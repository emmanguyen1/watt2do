# Watt2Do

Watt2Do is an intelligent battery and electronic waste identification and safe disposal assistant designed for Hillsborough County, Florida. It helps residents identify electronic items and battery chemistries, evaluate their physical condition, receive critical safety guidance, and locate verified municipal and commercial drop-off facilities.

---

## Features

- **Visual Item Identification**: Leverages the Google Gemini Developer API to analyze photos or live camera captures to suggest battery chemistry and device classification.
- **Safety-First Handling Rules**: Differentiates between intact items and compromised items (swollen, leaking, or hot). Automatically surfaces hazardous waste protocols, emergency handling precautions, and regulatory contacts for high-risk items.
- **Local Drop-Off Directory & Interactive Mapping**: Features an interactive Leaflet and OpenStreetMap interface with geolocation-based distance calculations, filtering municipal collection centers, retail drop-off partners (e.g., Batteries Plus, Best Buy, Staples), and county hazardous waste sites.
- **Privacy & Security by Design**: No user images are stored on disk. API keys remain protected server-side, and client-side confirmation ensures the user verifies item conditions before proceeding.
- **Zero-Dependency Node.js Server**: The primary application runs on modern Node.js using native modules, with an alternative Python Flask implementation available.

---

## Quick Start

### Prerequisites

- **Node.js**: Version 22.0.0 or newer
- *(Optional)* **Gemini API Key**: Required for live camera and image recognition features. Manual selection and the facility directory work without a key. Obtain a key from [Google AI Studio](https://aistudio.google.com/api-keys).

### Installation & Execution

1. **Clone the repository**:
   ```bash
   git clone https://github.com/emmanguyen1/watt2do.git
   cd watt2do
   ```

2. **Configure environment variables (optional)**:
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini Developer API key to `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite
   PORT=3001
   ```
   > **Note:** `.env` is included in `.gitignore` to prevent credentials from being tracked in version control. Never commit API keys or secret tokens.

3. **Start the application**:
   ```bash
   npm start
   ```
   Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## How It Works

1. **Capture & Classify**: The user captures an image using a device camera or uploads a file. The server validates image dimensions and MIME type before sending the frame to the Gemini Developer API (`gemini-3.5-flash-lite`).
2. **User Verification**: Gemini returns an initial item and condition suggestion. The user reviews and confirms the item type and physical condition. To ensure safety, only the user can certify an item as intact and cool.
3. **Safety Routing**: Rule-based logic evaluates the confirmed condition. Damaged, swollen, or punctured batteries immediately trigger safety mitigation steps (e.g., isolation, non-flammable containers, sand/vermiculite) and suppress routine recycling directions in favor of specialized hazardous waste handling.
4. **Locate Drop-Off Facilities**: Intact items display eligible drop-off centers sorted by straight-line distance, incorporating operational hours, contact details, and acceptance criteria.

---

## System Architecture & Tech Stack

- **Frontend**: Standard HTML5, CSS3, and modern browser JavaScript (ES modules).
  - **Mapping**: [Leaflet 1.9.4](https://leafletjs.com/) with [OpenStreetMap](https://www.openstreetmap.org/) basemap tiles.
  - **Navigation**: Direct external routing via Google Maps.
- **Backend (Default)**: Node.js (native `node:http`, `node:crypto`, `node:fs`, ESM). Zero third-party runtime package dependencies.
- **Backend (Python / Flask Alternative)**: A Python Flask REST API (`app.py`, `vision.py`, `dropoffs.py`) is also provided for Python environments.
- **AI Classification**: [Google Gemini Developer API](https://ai.google.dev/) using `gemini-3.5-flash-lite`.

---

## Running the Python / Flask Service (Alternative)

If you prefer to run the Python backend:

1. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Ensure `.env` is configured, then run:
   ```bash
   python app.py
   ```
   The Flask application will start on port 5000.

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
