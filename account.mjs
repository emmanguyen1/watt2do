import {randomBytes} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';

const clientId = process.env.GOOGLE_SIGN_IN_CLIENT_ID?.trim() || '';
const verifier = new OAuth2Client();
const sessions = new Map();
const lifetime = 8 * 60 * 60;
const cookieName = 'watt2do_session';

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expires <= now) sessions.delete(id);
  }
}, 60_000).unref();

function sessionId(request) {
  return (request.headers.cookie || '').match(/(?:^|;\s*)watt2do_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}

function writeCookie(response, value, age) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`);
}

export async function handleAccount(request,response,{readBody,respond,RequestError}) {
  if (request.method === 'GET') {
    const session = sessions.get(sessionId(request));
    return respond(response,200,{clientId,user:session?.expires > Date.now() ? session.user : null});
  }

  if (request.headers['sec-fetch-site'] === 'cross-site' ||
      request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new RequestError(403,'Use Watt2Do to change your sign-in.');
  }

  let input;
  try {
    input = JSON.parse((await readBody(request,16_384)).toString('utf8'));
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400,'Invalid sign-in request.');
  }

  if (input?.action === 'sign-out') {
    sessions.delete(sessionId(request));
    writeCookie(response,'',0);
    return respond(response,200,{user:null});
  }
  if (input?.action !== 'google' || typeof input.credential !== 'string' || !input.credential) {
    throw new RequestError(400,'A Google sign-in credential is required.');
  }
  if (!clientId) throw new RequestError(503,'Google sign-in is unavailable. You can continue as a guest.');

  let profile;
  try {
    const ticket = await verifier.verifyIdToken({idToken:input.credential,audience:clientId});
    profile = ticket.getPayload();
    if (!profile?.sub) throw new Error('Missing account identifier');
  } catch {
    throw new RequestError(401,'Google sign-in could not be verified. Try again or continue as a guest.');
  }

  const user = {name:profile.name || 'Google user'};
  const id = randomBytes(32).toString('hex');
  sessions.delete(sessionId(request));
  sessions.set(id,{user,expires:Date.now() + lifetime * 1000});
  writeCookie(response,id,lifetime);
  return respond(response,200,{user});
}
