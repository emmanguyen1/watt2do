# Watt2Do

Watt2Do helps people in Hillsborough County identify a battery or electronic item, check how to handle it, and find an appropriate drop-off.

## Run locally

Requires Node.js 22 or newer. From this directory, run `npm start` and open [localhost:3001](http://localhost:3001). There is no package installation step.

The manual picker, guidance, and location list work without a Gemini key. To enable the live camera and photo upload, get a [Gemini Developer API key](https://aistudio.google.com/api-keys), copy `.env.example` to `.env`, fill in `GEMINI_API_KEY`, and restart. The key stays on the server. The default model is Gemini 3.5 Flash-Lite. Browser camera and location access require localhost or an HTTPS origin and user permission.

## Demo workflow

1. Scan one item or choose a type manually. For a quick map demo, choose **Rechargeable battery or tool pack**.
2. Select **Intact and cool**, then select **Show guidance and drop-offs**. The map starts with Tampa. Enter a supported local ZIP or choose **Use my location** to refine distance sorting.
3. Try the same type with **Swollen** to see emergency indicators, handling guidance and time-aware county contact information.

Watt2Do uses approximate straight-line distance and a Tampa-area directory. Call ahead about exact acceptance, hours, limits, and fees. Intact power banks show call-first county contacts. Damaged items receive safety guidance and no routine drop-off directions.

## How it works

- The browser captures snapshots or takes an uploaded image. The Node server validates its type and size, sends it to Gemini and checks the structured response. The browser uses the suggestion to fill the editable type picker. Gemini can also suggest a visible condition. Review or correct the suggestion and confirm it before continuing. Only the user can mark an item as intact and cool.
- Application rules determine safety guidance and facility eligibility. Gemini provides only an item suggestion. It does not choose locations or determine whether an item is safe to transport.
- The server does not save images. Google processes submitted frames under [Gemini API terms](https://ai.google.dev/gemini-api/docs/terms). Google may use free-tier submissions to improve its products. Keep personal information out of the camera frame.

## Frameworks, libraries and services

- **Frameworks** — None. The server uses Node.js built-in modules. The frontend uses HTML, CSS and browser JavaScript.
- **Google Maps URLs** — external directions links.
- **Google Gemini Developer API** — image classification. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)

## Public data sources


- [Hillsborough County battery collection rules](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-batteries)
- [Hillsborough County electronics collection rules](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-paint-and-electronics)
- [Hillsborough County household hazardous waste collection](https://hcfl.gov/residents/property-owners-and-renters/trash-and-recycling/discarding-household-hazardous-waste)
- [EPA lithium-ion battery guidance](https://www.epa.gov/recycle/frequent-questions-lithium-ion-batteries)
- [Batteries Plus](https://www.batteriesplus.com/blog/power/battery-and-light-bulb-recycling), [Staples](https://www.staples.com/stores/recycling), [Best Buy](https://www.bestbuy.com/site/services/recycling/pcmcat149900050025.c), [eSmart](https://esmartrecycling.com/individual-dropoffs/) and [Posey](https://poseypowerbatteries.com/?page_id=614)
- [Hillsborough County Environmental Protection Commission lead-acid directory](https://www.epchc.org/home/showpublisheddocument/3228/639065853819430000)

## Optional Flask scan backend

The Node.js app on port 3001 is the demo entry point. The repository also includes the separate Flask scan API from the team brief. The browser demo uses the Node.js API. To test Flask separately, install `requirements.txt` and run `python app.py` on port 5000.

### Google Maps for the Node app

Set GOOGLE_MAPS_BROWSER_KEY in your local .env to enable the Google Maps
JavaScript API map. Allow http://localhost:3001/* in the key's website
restrictions for local development. Drop-off cards and directions links are
available while the map is unavailable. The map module adapts Person B's
Google Maps implementation for the Node app.
