# ⚡ Watt2Do — Watt's Next? Watt2Do.

> **HackJam 26 Submission** | **Team Watt's Next** (Person A, Person B, Person C)  
> **Tracks:** Sustainability &bull; Best Use of the Google Gemini API  
> **Target Community:** USF & Hillsborough County / Tampa Bay Area

---

## 🌟 1. Project Overview & Problem Statement

**The Problem:** Millions of household batteries end up in standard trash or curbside recycling bins every year. When garbage truck compactors crush discarded lithium-ion batteries, or when terminals short against metal in recycling sorting facilities, they trigger catastrophic, explosive thermal runaway fires. Municipalities and recycling centers lose millions of dollars and put workers' lives at risk because consumers simply don't know:
1. What kind of battery is inside their gadget
2. Whether the battery is compromised or swollen
3. Exactly where to safely take it locally

**Our Solution:** **Watt2Do** is an instant mobile web application. Simply point your smartphone camera at any battery, gadget, or electronic device:
- **Google Gemini Vision** accurately detects the battery type (alkaline, lithium-ion, lithium coin, lead-acid, NiMH) and inspects for physical damage (swelling, leaks, corrosion, punctures).
- If damage is detected, **Watt2Do** raises an immediate **high-visibility safety alert** with specific containment steps (tape terminals, non-flammable containers, keep away from combustibles).
- Using **Google Places API (New)** and **Google Maps JavaScript API**, the app pins verified local drop-off centers (Best Buy, Home Depot, Batteries Plus, and Hillsborough/USF county hazardous waste drop-offs) within driving distance of the user.

---

## 🚀 2. Live Demo & Key Features

- 📷 **Instant Mobile-First Camera Flow:** Seamless photo capture using native mobile browser camera input (`capture="environment"`), with automated client-side canvas downsampling (1024px) for blazing-fast inference.
- 🤖 **Multimodal Gemini Vision Intelligence:** Classifies item chemistry, assesses structural damage, and outputs strict schema-validated safety directives.
- 🚨 **Thermal Runaway Warning System:** Real-time damage detection flags swollen or leaking cells with specialized fire prevention procedures.
- 🗺️ **Dynamic Nearby Drop-off Locator:** Real-time geolocation matching with the Places API (New) for certified e-waste and battery drop-offs, backed by an offline local JSON fallback.
- 🌱 **Community Impact Counter:** Persisted local tracking displaying total hazardous units safely diverted from municipal landfills.
- 💬 **"Watty" Recycling Helper:** An interactive in-app conversational assistant powered by Gemini to answer user questions about battery storage, terminal taping, and safe drop-offs.

---

## 🏆 3. Best Use of Google Gemini API

Watt2Do integrates the Google Gemini API at the core of its safety and classification pipeline:

| Gemini Feature | Implementation in Watt2Do |
| :--- | :--- |
| **Multimodal Vision Analysis** | Detects subtle visual cues on unlabelled or worn cells: cylindrical form factors (AA/AAA/18650), pouch cells, button cells, and lead-acid terminals. |
| **Damage & Hazard Detection** | Inspects for hazardous physical anomalies: pouch battery puffing/swelling, electrolyte leakage, crusty terminal corrosion, and denting. |
| **Structured JSON Output** | Enforces a strict JSON contract (`item`, `category`, `batteryType`, `damaged`, `damageNotes`, `confidence`, `instructions`, `dropoffFilter`) to ensure zero UI hallucination or parsing crashes. |
| **Context-Aware Safety Protocol Generation** | Produces concise, battery-chemistry-specific precautions (e.g. taping 9V/lithium terminals, non-flammable sandbox storage for swollen cells). |
| **Conversational Assistant ("Watty")** | Interactive safety helper addressing specific hazardous disposal and handling inquiries. |

---

## 🛠️ 4. Tech Stack

- **Backend:** Python 3, Flask, `python-dotenv`, `google-genai` / Gemini Vision API, Google Places API (New)
- **Frontend:** Mobile-first responsive HTML5, CSS3 with dark mode and `#C6F432` lime accent, Vanilla ES6+ JavaScript, HTML5 Canvas API, Geolocation API
- **Maps & Location:** Google Maps JavaScript API, Google Places API (New) with distance calculation (Haversine) and local verified fallback dataset
- **Deployment:** Containerized / HTTPS Cloud hosting (Google Cloud Run / Render)

---

## 💻 5. How to Run Locally

### Option A: Python Flask Backend (Port 5000)

1. **Activate virtual environment & install requirements:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # On Windows
   # or source .venv/bin/activate  # On macOS/Linux
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   Create `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_MAPS_BROWSER_KEY=your_browser_key
   GOOGLE_PLACES_SERVER_KEY=your_server_key
   MOCK_SCAN=0  # Set to 1 for offline mock testing
   ```

3. **Start Flask server:**
   ```bash
   python app.py
   ```
   Open `http://localhost:5000/` or `http://localhost:5000/static/index.html`.

### Option B: Node.js Demo (Port 3001)

Requires Node.js 22 or newer:
```bash
npm start
```
Open [http://localhost:3001](http://localhost:3001).

---

## 📋 6. API Contract (v1.1)

### `POST /api/scan`
- **Request:** `multipart/form-data` with `image` file field (JPEG/PNG, resized to &le; 1024px).
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "item": "AA battery",
    "category": "battery",
    "batteryType": "alkaline",
    "damaged": false,
    "damageNotes": "",
    "confidence": 0.95,
    "instructions": [
      "Tape both terminals with electrical tape.",
      "Store in a dry, cool container.",
      "Drop off at a certified battery collection box."
    ],
    "dropoffFilter": "batteries"
  }
  ```

### `GET /api/dropoffs?lat=<lat>&lng=<lng>&filter=<batteries|ewaste|hazardous>&radiusKm=<10>`
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "source": "places",
    "results": [
      {
        "id": "ChIJ...",
        "name": "Best Buy Tampa",
        "lat": 28.055,
        "lng": -82.435,
        "address": "1234 E Fowler Ave, Tampa, FL",
        "distanceKm": 1.4,
        "openNow": true,
        "hours": "Open until 8:00 PM",
        "accepts": ["batteries", "ewaste"]
      }
    ]
  }
  ```

### `GET /api/maps-config`
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "mapsKey": "<GOOGLE_MAPS_BROWSER_KEY>"
  }
  ```

---

## 🎤 7. 3-Minute Demo Pitch & Video Script

### Segment 1: The Problem (0:00 - 0:30)
- **Speaker:** "Every single week, a recycling facility or waste truck catches fire because someone unknowingly threw a dead lithium battery into the trash. When compacted, these batteries rupture, spark thermal runaway, and cause millions of dollars in damages. But how is a regular consumer supposed to know the difference between an alkaline AA, a pouch lithium cell, and a dangerous swollen battery?"

### Segment 2: Live Demo (0:30 - 2:00)
- **Visual:** Person holding phone opens Watt2Do over HTTPS.
- **Action 1 (Alkaline battery):** Scans a standard AA battery. App shows: Alkaline battery, 95% match, taped terminal instructions, and pins nearby drop-off bins at Home Depot & Best Buy on the Google Map.
- **Action 2 (Damaged / Swollen Phone Battery):** Scans a bloated smartphone battery.
- **Alert:** The screen flashes a bold red emergency banner: *"CRITICAL SAFETY ALERT: DAMAGED / SWOLLEN BATTERY DETECTED"*.
- **Guidance:** Specific fire-prevention steps appear instantly: *"Do not charge or puncture. Place immediately in a non-combustible container of sand. Keep away from heat."*
- **Drop-offs:** Google Places API pinpoints certified Tampa hazardous waste collection facilities equipped to receive damaged cells.

### Segment 3: Impact & Local Angle (2:00 - 2:30)
- **Speaker:** "Watt2Do is tailored directly to the University of South Florida and Tampa Bay community. In addition to commercial partners like Batteries Plus and Best Buy, our database indexes local Hillsborough County Household Hazardous Waste Collection Centers and campus e-waste stations. Every verified scan increments our community impact counter, helping USF students keep toxic heavy metals out of our Floridian aquifers."

### Segment 4: What's Next? (2:30 - 3:00)
- **Speaker:** "Watt's next for Watt2Do? We're taking our vision model to hardware: an ESP32-CAM smart disposal bin kiosk placed in campus dorms and dining halls that automatically scans discarded batteries at the door. Together with a gamified residence hall leaderboard, we can eradicate battery trash fires for good. Watt's next? Watt2Do!"

---

## 📚 8. Public Data Sources

- [Hillsborough County battery collection rules](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-batteries)
- [Hillsborough County electronics collection rules](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-paint-and-electronics)
- [Hillsborough County household hazardous waste collection](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-household-hazardous-waste)
- [EPA lithium-ion battery guidance](https://www.epa.gov/recycle/frequent-questions-lithium-ion-batteries)
- [Batteries Plus](https://www.batteriesplus.com/blog/power/battery-and-light-bulb-recycling), [Staples](https://www.staples.com/stores/recycling), [Best Buy](https://www.bestbuy.com/site/services/recycling/pcmcat149900050025.c), [eSmart](https://esmartrecycling.com/individual-dropoffs/) and [Posey](https://poseypowerbatteries.com/?page_id=614)
- [Hillsborough County Environmental Protection Commission lead-acid directory](https://www.epchc.org/home/showpublisheddocument/3228/639065853819430000)

---

## 👥 9. Team Watt's Next
- **Person A (Vision/AI & Backend):** Gemini vision prompt engineering, structured JSON validation, Flask server (`app.py`, `vision.py`).
- **Person B (Data/Maps & Cloud):** Google Maps JavaScript integration, Google Places API (New) pipeline, fallback data (`dropoffs.py`, `map.js`).
- **Person C (Frontend/UX & Submission):** Mobile-first UI, camera canvas downsampling, state machines, geolocation, impact counter, documentation (`static/index.html`, `static/style.css`, `static/app.js`, `README.md`).
