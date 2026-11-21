# Watt2Do

> **Tagline:** Watt's Next? Watt2Do.  
> **Tracks:** Sustainability | Best Use of the Google Gemini API  
> **Team Watt's Next** | HackJam 26 | Person A, Person B, Person C

**Watt2Do** ("what to do" with a dead battery) is a mobile web application designed to prevent battery fires and guide safe disposal.

**The Hook:** Lithium-ion and household batteries tossed into standard trash start fires in garbage trucks and recycling facilities. Watt2Do empowers people to snap or upload a photo of an item; Gemini Vision identifies the battery chemistry and detects physical damage (swollen, leaking, corroded), displays immediate safety precautions, and plots nearby verified drop-off locations on an interactive **Google Map**.

---

## Architecture & Codebase Overview

The repository is organized across clear modular boundaries:

```text
watt2do/
├── app.py                      # Flask server (port 5000): /api/health, /api/scan, registers dropoffs_bp
├── vision.py                   # Gemini Vision API integration and structured JSON response validator
├── dropoffs.py                 # Blueprint dropoffs_bp: GET /api/dropoffs & GET /api/maps-config
├── data/
│   └── fallback_dropoffs.json  # Hand-verified Hillsborough County / USF area drop-off locations
├── static/
│   ├── map.js                  # Google Maps JavaScript API module (global Watt2DoMap)
│   ├── index.html              # Mobile-first scanner UI
│   ├── app.js                  # Frontend scan flow & drop-off list renderer
│   └── style.css               # Mobile-responsive styles
├── requirements.txt            # Python dependencies (Flask, python-dotenv)
├── .env.example                # Template for environment keys
└── .gitignore                  # Excludes .env, build files, and cache
```

---

## Where to Upload / Set API Keys

All keys must be placed in a local `.env` file in the project root. This file is **ignored by Git** and will **never be committed** to the public repository.

### 1. Create your local `.env` file
In the project directory, copy the template:
```bash
cp .env.example .env
```

### 2. Enter your keys in `.env`
Open `.env` in VS Code or your editor and add:

```env
# 1. Google Gemini Developer API (Person A)
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
MOCK_SCAN=0

# 2. Google Maps JavaScript API (Person B - Browser Key)
# Restriction: "Maps JavaScript API", HTTP Referrer: http://localhost:5000/*
GOOGLE_MAPS_BROWSER_KEY=AIzaSyYourBrowserMapKeyHere

# 3. Google Places API (New) (Person B - Server Key)
# Restriction: "Places API (New)", Server-side only (never exposed to browser)
GOOGLE_PLACES_SERVER_KEY=AIzaSyYourServerPlacesKeyHere

FLASK_RUN_PORT=5000
```

### 3. Production Deployment Key Upload
When deploying (e.g. Google Cloud Run, Render, or Vercel), upload these exact same variable names (`GEMINI_API_KEY`, `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_PLACES_SERVER_KEY`) into your hosting provider's **Environment Variables** dashboard.

---

## Controlling Person B's Database & Map Features

Person B manages the drop-off data pipeline and map visualization:

### 1. Fallback Database (`data/fallback_dropoffs.json`)
- Contains 12+ hand-verified drop-offs throughout the Tampa and USF area (Home Depot, Best Buy, Staples, Target, Batteries Plus Bulbs, USF EHS, and Hillsborough County Solid Waste Centers).
- Each entry includes:
  ```json
  {
    "id": "tampa-hd-fowler",
    "name": "The Home Depot - Battery & Bulb Recycling",
    "lat": 28.0551,
    "lng": -82.4385,
    "address": "1712 E Fowler Ave, Tampa, FL 33612",
    "openNow": true,
    "hours": "Mon-Sat 6:00 AM - 10:00 PM, Sun 8:00 AM - 8:00 PM",
    "accepts": ["batteries", "hazardous"]
  }
  ```
- **Control:** You can easily add new facilities or edit hours and accepted waste types directly in `data/fallback_dropoffs.json`.

### 2. Backend Search & Filtering (`dropoffs.py`)
- **Endpoint:** `GET /api/dropoffs?lat=<lat>&lng=<lng>&filter=<batteries|ewaste|hazardous>&radiusKm=<km>`
- Queries Google **Places API (New)** Text Search (`https://places.googleapis.com/v1/places:searchText`) biased by the user's GPS coordinates.
- Computes straight-line distance via the **Haversine formula**, rounds to 1 decimal place, sorts ascending, and limits to 10 results.
- **Fail-safe fallback:** If `GOOGLE_PLACES_SERVER_KEY` is not provided, times out (5 seconds), or returns no locations, `dropoffs.py` automatically falls back to `data/fallback_dropoffs.json` with `"source": "fallback"`.

### 3. Google Maps Module (`static/map.js`)
- Exposes `Watt2DoMap.show(containerId, userLocation, results)` and `Watt2DoMap.clear()`.
- Dynamically fetches the browser key from `GET /api/maps-config` and loads the **Google Maps JavaScript API** on demand.
- Visual elements:
  - **User beacon:** Blue marker indicating "You are here".
  - **Numbered location markers:** Pinpointed for each nearby drop-off facility.
  - **Interactive Info Windows:** Click any marker to view facility name, address, distance (km), current open status, and accepted disposal categories.
  - **Auto-fit bounds:** Smoothly frames user location and nearby sites.
  - **Default location:** Centers on the USF Tampa area (`28.06, -82.41`) if geolocation permission is denied.

---

## How to Run Locally

### 1. Main Flask Application (Port 5000)
```bash
# Install dependencies
pip install -r requirements.txt

# Start the Flask development server
python3 app.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

- Check server health: `curl http://localhost:5000/api/health`
- Check maps configuration: `curl http://localhost:5000/api/maps-config`
- Check drop-offs API: `curl "http://localhost:5000/api/dropoffs?lat=28.06&lng=-82.41&filter=batteries"`

### 2. Lightweight Node.js Demo (Port 3001)
If testing the standalone JavaScript prototype:
```bash
npm start
```
Open **[http://localhost:3001](http://localhost:3001)**.
