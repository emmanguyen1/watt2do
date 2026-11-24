# ⚡ Watt2Do — Watt's Next? Watt2Do.

Watt2Do is an intelligent battery and electronic waste identification and safe disposal assistant designed for Hillsborough County, Florida. It helps residents identify electronic items and battery chemistries, evaluate their physical condition, receive critical safety guidance, and locate verified municipal and commercial drop-off facilities.

---

## Features

- **Visual Item Identification**: Leverages the Google Gemini Developer API to analyze photos or live camera captures to suggest battery chemistry and device classification.
- **Safety-First Handling Rules**: Differentiates between intact items and compromised items (swollen, leaking, or hot). Automatically surfaces hazardous waste protocols, emergency handling precautions, and regulatory contacts for high-risk items.
- **Local Drop-Off Directory & Interactive Mapping**: Features an interactive Google Maps interface with geolocation-based distance calculations, filtering municipal collection centers, retail drop-off partners (e.g., Batteries Plus, Best Buy, Staples), and county hazardous waste sites.
- **Privacy & Security by Design**: No user images are stored on disk. API keys remain protected server-side, and client-side confirmation ensures the user verifies item conditions before proceeding.
- **Dual Server Support**: Offers a lightweight zero-dependency Node.js implementation as well as a full Python Flask backend.

---

## Architecture & Codebase Overview

```text
watt2do/
├── app.py                      # Flask server (port 5001): /api/health, /api/scan, registers dropoffs_bp
├── vision.py                   # Gemini Vision API integration and structured JSON response validator
├── dropoffs.py                 # Blueprint dropoffs_bp: GET /api/dropoffs & GET /api/maps-config
├── data/
│   └── fallback_dropoffs.json  # Hand-verified Hillsborough County / USF area drop-off locations
├── static/
│   └── map.js                  # Google Maps JavaScript API module (Watt2DoMap)
├── public/
│   ├── page.html               # Frontend interface
│   ├── screen.css              # Interface styling
│   ├── screen.mjs              # Interactive client script
│   └── map.js                  # Frontend map script
├── directory.mjs               # Node.js local recycling directory & rules
├── index.mjs                   # Lightweight Node.js server (port 3001)
├── requirements.txt            # Python dependencies (Flask, python-dotenv)
├── .env.example                # Template for environment keys
└── .gitignore                  # Excludes .env, build files, and cache
```

---

## Quick Start

### Prerequisites

- **Node.js 22+** (for default server) or **Python 3.10+** (for Flask backend)
- *(Optional)* **Gemini & Google Maps API Keys**: Obtain from [Google AI Studio](https://aistudio.google.com/api-keys) and [Google Cloud Console](https://console.cloud.google.com/).

### Installation & Execution

1. **Clone the repository**:
   ```bash
   git clone https://github.com/emmanguyen1/watt2do.git
   cd watt2do
   ```

2. **Configure environment variables**:
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   Add your credentials to `.env`:
   ```env
   # Gemini Vision API
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite
   MOCK_SCAN=0

   # Google Maps JavaScript API (Browser)
   # Tip: Allow http://localhost:3001/* in website restrictions for local testing
   GOOGLE_MAPS_BROWSER_KEY=your_maps_browser_key_here

   # Google Places API (New) (Server-only)
   GOOGLE_PLACES_SERVER_KEY=your_places_server_key_here

   PORT=3001
   FLASK_RUN_PORT=5001
   ```
   > **Important Security Notice:** `.env` is listed in `.gitignore` to prevent credentials from being tracked in version control. Never commit API keys or secret tokens.

3. **Start the Node.js Application (Default - Port 3001)**:
   ```bash
   npm start
   ```
   Open [http://localhost:3001](http://localhost:3001) in your browser.

4. **Alternative: Python Flask Application (Port 5001)**:
   ```bash
   pip install -r requirements.txt
   python3 app.py
   ```
   - Verify health: `curl http://localhost:5001/api/health`
   - Verify maps configuration: `curl http://localhost:5001/api/maps-config`
   - Verify drop-offs endpoint: `curl "http://localhost:5001/api/dropoffs?lat=28.06&lng=-82.41&filter=batteries"`

---

## How It Works

1. **Capture & Classify**: The user captures an image using a device camera or uploads a file. The server validates image dimensions and MIME type before sending the frame to the Gemini Developer API (`gemini-3.5-flash-lite` or `gemini-2.5-flash`).
2. **User Verification**: Gemini returns an initial item and condition suggestion. The user reviews and confirms the item type and physical condition. To ensure safety, only the user can certify an item as intact and cool.
3. **Safety Routing**: Rule-based logic evaluates the confirmed condition. Damaged, swollen, or punctured batteries immediately trigger safety mitigation steps (e.g., isolation, non-flammable containers, sand/vermiculite) and suppress routine recycling directions in favor of specialized hazardous waste handling.
4. **Locate Drop-Off Facilities**: Intact items display eligible drop-off centers sorted by distance, incorporating operational hours, contact details, and acceptance criteria.

---

## Drop-Off Data Pipeline & Map Visualization

The application provides a robust data pipeline and interactive map visualization:

### 1. Fallback Database (`data/fallback_dropoffs.json`)
- Contains 21 hand-verified drop-offs throughout Hillsborough County (Home Depot, Best Buy, Staples, Target, Batteries Plus Bulbs, USF EHS, and County Solid Waste / HHW Centers).
- Each entry includes physical address, operating hours, geolocation coordinates, and accepted materials (`batteries`, `ewaste`, `hazardous`).
- **Customization:** Additional facilities, operating hours, or accepted waste types can be configured directly in `data/fallback_dropoffs.json`.

### 2. Backend Search & Filtering (`dropoffs.py`)
- **Endpoint:** `GET /api/dropoffs?lat=<lat>&lng=<lng>&filter=<batteries|ewaste|hazardous>&radiusKm=<km>`
- Queries Google **Places API (New)** Text Search biased by user GPS coordinates.
- Calculates great-circle distance via the **Haversine formula**, rounds to 1 decimal place, sorts ascending, and returns top results.
- **Fail-Safe Fallback:** If `GOOGLE_PLACES_SERVER_KEY` is not provided, times out (5 seconds), or returns no locations, `dropoffs.py` automatically falls back to `data/fallback_dropoffs.json` with `"source": "fallback"`.

### 3. Google Maps Module (`public/map.js` / `static/map.js`)
- Exposes `Watt2DoMap.show(containerId, userLocation, results)` and `Watt2DoMap.clear()`.
- Dynamically retrieves the browser key from `GET /api/maps-config` and loads the **Google Maps JavaScript API** on demand.
- Visual elements:
  - **User beacon:** Blue marker indicating current position.
  - **Numbered markers:** Precise pins for each nearby drop-off facility.
  - **Interactive Info Windows:** Click any marker to view facility name, address, distance (km), current open status, and accepted disposal categories.
  - **Auto-fit bounds:** Smoothly frames the user's location and nearby sites.
  - **Default location:** Centers on the Tampa/USF area (`28.06, -82.41`) if geolocation permission is denied.

---

## Public Data & Regulatory Sources

Facility information and handling guidelines are derived from official municipal and industry standards:

- [Hillsborough County Battery Collection Guidelines](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-batteries)
- [Hillsborough County Electronics Recycling](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-paint-and-electronics)
- [Hillsborough County Household Hazardous Waste Collection](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-household-hazardous-waste)
- [EPA Lithium-Ion Battery Safety & Recycling](https://www.epa.gov/recycle/frequent-questions-lithium-ion-batteries)
- [Hillsborough County EPC Lead-Acid Directory](https://www.epchc.org/home/showpublisheddocument/3228/639065853819430000)
- Verified retail recycling programs: [Batteries Plus](https://www.batteriesplus.com/blog/power/battery-and-light-bulb-recycling), [Best Buy](https://www.bestbuy.com/site/services/recycling/pcmcat149900050025.c), [Staples](https://www.staples.com/stores/recycling), [eSmart Recycling](https://esmartrecycling.com/individual-dropoffs/), and [Posey Power Batteries](https://poseypowerbatteries.com/?page_id=614).

---

## Safety & Disclaimer

Watt2Do provides location guidance and safety suggestions for informational purposes. Compromised lithium-ion batteries present severe thermal runaway and fire risks. Always contact recycling centers and municipal facilities in advance to confirm current acceptance policies, volume limits, operating hours, and handling fees.

### Google sign-in and Watty in the Node app

Run `npm ci` before starting the Node app. For Google sign-in, set
`GOOGLE_SIGN_IN_CLIENT_ID` to a Web application OAuth client ID and authorize
`http://localhost:3001` as a JavaScript origin. Guest access works without
an OAuth client. Account sessions expire after eight hours or on restart.

Watty uses the existing Gemini configuration to identify the item and its
condition. Answers use the local disposal rules, and common item names work
when Gemini is unavailable. The browser keeps recent questions for the
current conversation.
