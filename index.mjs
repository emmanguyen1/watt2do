import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {advice,conditions,groups,labels,locations,zipCenters} from './directory.mjs';

import {handleAccount} from './account.mjs';

import {chat} from './chat.mjs';

const assets = {
  '/watty.mjs':['watty.mjs','text/javascript'],
  '/account.mjs':['account.mjs','text/javascript'],
  '/':['page.html','text/html'],
  '/screen.css':['screen.css','text/css'],
  '/static/screen.css':['screen.css','text/css'],
  '/screen.mjs':['screen.mjs','text/javascript'],
  '/map.js':['map.js','text/javascript'],
  '/static/map.js':['map.js','text/javascript']
};
const key = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const maxImage = 5 * 1024 * 1024;
class RequestError extends Error {
  constructor(status,message) {
    super(message);
    this.status = status;
  }
}
async function readBody(request,max) {
  if (Number(request.headers['content-length']) > max) throw new RequestError(413,'This upload is too large.');
  let received = 0;
  const chunks = [];
  for await (const chunk of request.iterator({destroyOnReturn:false})) {
    received += chunk.length;
    if (received > max) {
      request.resume();
      throw new RequestError(413,'This upload is too large.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function respond(response,status,payload) {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(JSON.stringify(payload));
}

function runVisionDirect(bytes, mime) {
  return new Promise((resolve, reject) => {
    const python = spawn('./venv/bin/python3', ['-c', `
import dotenv, vision, json, sys
dotenv.load_dotenv('.env')
data = sys.stdin.buffer.read()
mime = sys.argv[1]
try:
    res = vision.classify(data, mime)
    print(json.dumps(res))
except Exception as e:
    sys.exit(str(e))
`, mime]);
    const chunks = [];
    const errChunks = [];
    python.stdout.on('data', d => chunks.push(d));
    python.stderr.on('data', d => errChunks.push(d));
    python.on('close', code => {
      if (code === 0) {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(new RequestError(502, 'The photo could not be interpreted. Try again.'));
        }
      } else {
        const errStr = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new RequestError(502, errStr || 'The photo could not be interpreted. Try again.'));
      }
    });
    python.stdin.write(bytes);
    python.stdin.end();
  });
}

async function scan(request) {
  if (!key) throw new RequestError(503, 'Camera recognition needs a Gemini key. You can select your item manually.');
  const bytes = await readBody(request, maxImage);
  const mime = request.headers['content-type'] || 'image/jpeg';
  const matches = {
    'image/jpeg': bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/webp': bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  };
  if (!Object.hasOwn(matches, mime) || !matches[mime]) throw new RequestError(415, 'Choose a JPEG, PNG or WebP image.');

  let visionResult = null;
  const flaskPort = process.env.FLASK_RUN_PORT || 5001;
  try {
    const flaskRes = await fetch(`http://127.0.0.1:${flaskPort}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': mime },
      body: bytes,
      signal: AbortSignal.timeout(18000)
    });
    if (flaskRes.ok) {
      visionResult = await flaskRes.json();
    }
  } catch {
    // If Flask connection fails, execute vision.py directly
  }

  if (!visionResult || !visionResult.ok) {
    visionResult = await runVisionDirect(bytes, mime);
  }

  const typeMap = {
    'alkaline': 'household',
    'lithium_ion': 'rechargeable',
    'lithium_coin': 'button',
    'lead_acid': 'starter',
    'nimh': 'rechargeable',
    'other': 'unknownBattery'
  };
  const bType = visionResult.batteryType;
  const mappedType = typeMap[bType] || (visionResult.category === 'battery' ? 'unknownBattery' : (visionResult.category || 'unsure'));

  visionResult.type = mappedType;
  visionResult.description = visionResult.item || 'Recognized Item';
  visionResult.condition = visionResult.damaged === true ? 'damaged' : (visionResult.damaged === false ? 'intact' : 'unsure');
  visionResult.conditionEvidence = visionResult.damageNotes || '';

  return visionResult;
}

async function plan(request) {
  let input;
  try { input = JSON.parse(await readBody(request,4096)); }
  catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400,'Select an item and condition.');
  }
  if (!input || !Object.hasOwn(labels,input.type) || !Object.hasOwn(conditions,input.condition)) {
    throw new RequestError(400,'Select an item and condition.');
  }
  const area = typeof input.area === 'string' ? input.area.trim() : '';
  const areaKey = !area || area.toLowerCase() === 'tampa' ? 'Tampa' : area;
  const work = advice(input.type,input.condition);
  if (input.condition !== 'intact') return {advice:work,sites:[],area:'',areaError:''};
  const point = input.position;
  const validPoint = Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;
  if (!validPoint && !Object.hasOwn(zipCenters,areaKey)) {
    return {advice:work,sites:[],area:'',areaError:'Use Tampa or a supported ZIP: ' + Object.keys(zipCenters).filter(zip => zip !== 'Tampa').join(', ') + '.'};
  }
  return {advice:work,sites:locations(input.type,input.condition,validPoint ? point : zipCenters[areaKey]),
    area:validPoint ? 'your location' : areaKey,areaError:''};
}

export const server = createServer(async (request,response) => {
  try {
    const url = new URL(request.url,'http://localhost');
    const path = url.pathname;
    if (['GET','HEAD'].includes(request.method) && Object.hasOwn(assets,path)) {
      const [file,type] = assets[path];
      const content = await readFile(new URL('./public/' + file,import.meta.url));
      response.writeHead(200,{'Content-Type':type + '; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
      return response.end(request.method === 'HEAD' ? undefined : content);
    }
    if (path === '/api/account' && ['GET','POST'].includes(request.method)) {
      return await handleAccount(request,response,{readBody,respond,RequestError});
    }
    if (request.method === 'GET' && path === '/api/maps-config') {
      return respond(response,200,{ok:true,mapsKey:process.env.GOOGLE_MAPS_BROWSER_KEY?.trim() || ''});
    }
    if (request.method === 'GET' && path === '/api/options') return respond(response,200,{groups,conditions,vision:Boolean(key)});
    if (request.method === 'POST' && path === '/api/chat') {
      let input;
      try { input = JSON.parse((await readBody(request,16_384)).toString('utf8')); }
      catch (error) {
        if (error instanceof RequestError) throw error;
        throw new RequestError(400,'Enter a question for Watty.');
      }
      const messages = input?.messages;
      if (!Array.isArray(messages) || messages.length < 1 || messages.length > 4 ||
          !messages.every(message => typeof message === 'string' && message.trim() && message.length <= 500)) {
        throw new RequestError(400,'Enter a question up to 500 characters.');
      }
      return respond(response,200,await chat(messages,key,model));
    }
    if (request.method === 'POST' && path === '/api/plan') return respond(response,200,await plan(request));
    if (request.method === 'POST' && path === '/api/scan') return respond(response,200,await scan(request));
    if (request.method === 'GET' && path === '/api/dropoffs') {
      const lat = parseFloat(url.searchParams.get('lat')) || 28.06;
      const lng = parseFloat(url.searchParams.get('lng')) || -82.41;
      const filter = url.searchParams.get('filter') || 'all';
      const itemType = filter === 'ewaste' ? 'laptop' : 'rechargeable';
      const sites = locations(itemType, 'intact', [lat, lng]);
      const results = sites.map((s, i) => {
        const accepts = [];
        if (s.county || /battery/i.test(s.name)) accepts.push('batteries');
        if (/Best Buy|Staples|Recycling|eCycle/i.test(s.name)) accepts.push('ewaste');
        if (s.county || /HHW|Hazardous/i.test(s.name)) accepts.push('hazardous');
        if (!accepts.length) accepts.push('batteries');
        return {
          id: 'dropoff-' + i,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          address: s.address,
          hours: s.hours,
          phone: s.phone,
          accepts,
          openNow: true,
          miles: s.miles
        };
      });
      return respond(response, 200, { ok: true, results });
    }
    return respond(response,404,{error:'Page not found.'});
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 503;
    return respond(response,status,{error:status === 503 && !(error instanceof RequestError)
      ? 'The service is temporarily unavailable. Try again or choose a type manually.' : error.message});
  }
});

const port = Number(process.env.PORT || 3001);
server.listen(port,'127.0.0.1',() => console.log('Watt2Do running at http://localhost:' + server.address().port));
