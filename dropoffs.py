import json
import math
import os
import urllib.error
import urllib.request
from pathlib import Path
from flask import Blueprint, jsonify, request

dropoffs_bp = Blueprint("dropoffs", __name__)

DEFAULT_LAT = 28.06
DEFAULT_LNG = -82.41
DEFAULT_RADIUS_KM = 10.0
MAX_RADIUS_KM = 25.0

FALLBACK_FILE_PATH = Path(__file__).resolve().parent / "data" / "fallback_dropoffs.json"


def haversine_km(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance between two points on Earth in kilometers."""
    r = 6371.0  # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def get_fallback_results(user_lat, user_lng, filter_type, radius_km):
    """Load and process fallback drop-offs."""
    if not FALLBACK_FILE_PATH.exists():
        return []

    try:
        with open(FALLBACK_FILE_PATH, "r", encoding="utf-8") as f:
            raw_places = json.load(f)
    except Exception:
        return []

    processed = []
    for item in raw_places:
        accepts = item.get("accepts", [])
        # Match filter if possible, otherwise keep item
        if filter_type and accepts and filter_type not in accepts:
            continue

        lat = float(item["lat"])
        lng = float(item["lng"])
        dist = haversine_km(user_lat, user_lng, lat, lng)

        processed.append({
            "id": str(item.get("id")),
            "name": str(item.get("name")),
            "lat": lat,
            "lng": lng,
            "address": item.get("address"),
            "distanceKm": round(dist, 1),
            "openNow": item.get("openNow"),
            "hours": item.get("hours"),
            "accepts": accepts if accepts else [filter_type] if filter_type else ["batteries"],
        })

    # Sort ascending by distanceKm
    processed.sort(key=lambda x: x["distanceKm"])
    return processed[:10]


def query_places_api_new(user_lat, user_lng, filter_type, radius_km, api_key):
    """Query Google Places API (New) Text Search."""
    url = "https://places.googleapis.com/v1/places:searchText"

    if filter_type == "ewaste":
        query_text = "electronic waste recycling drop off"
    elif filter_type == "hazardous":
        query_text = "household hazardous waste drop off"
    else:
        query_text = "battery recycling drop off"

    payload = {
        "textQuery": query_text,
        "locationBias": {
            "circle": {
                "center": {
                    "latitude": user_lat,
                    "longitude": user_lng,
                },
                "radius": min(radius_km, MAX_RADIUS_KM) * 1000.0,
            }
        },
        "maxResultCount": 10,
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.currentOpeningHours"
        ),
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=5.0) as response:
        if response.status != 200:
            return None
        data = json.loads(response.read().decode("utf-8"))

    raw_places = data.get("places", [])
    if not raw_places:
        return None

    results = []
    for p in raw_places:
        loc = p.get("location")
        if not loc or "latitude" not in loc or "longitude" not in loc:
            continue

        lat = float(loc["latitude"])
        lng = float(loc["longitude"])
        dist = haversine_km(user_lat, user_lng, lat, lng)

        display_name = p.get("displayName", {}).get("text", "Drop-off Location")
        opening_hours = p.get("currentOpeningHours", {})
        open_now = opening_hours.get("openNow") if opening_hours else None
        weekday_desc = opening_hours.get("weekdayDescriptions", [])
        hours = weekday_desc[0] if (weekday_desc and len(weekday_desc) > 0) else None

        accepts_list = [filter_type] if filter_type in ["batteries", "ewaste", "hazardous"] else ["batteries"]

        results.append({
            "id": str(p.get("id")),
            "name": display_name,
            "lat": lat,
            "lng": lng,
            "address": p.get("formattedAddress"),
            "distanceKm": round(dist, 1),
            "openNow": open_now,
            "hours": hours,
            "accepts": accepts_list,
        })

    results.sort(key=lambda x: x["distanceKm"])
    return results[:10]


@dropoffs_bp.route("/api/maps-config", methods=["GET"])
def get_maps_config():
    """Return the Google Maps JavaScript API browser key."""
    maps_key = os.environ.get("GOOGLE_MAPS_BROWSER_KEY", "").strip()
    return jsonify({"ok": True, "mapsKey": maps_key})


@dropoffs_bp.route("/api/dropoffs", methods=["GET"])
def get_dropoffs():
    """
    GET /api/dropoffs?lat=<number>&lng=<number>&filter=<batteries|ewaste|hazardous>&radiusKm=<number>
    Returns sorted list of drop-offs from Places API (New) or fallback JSON.
    """
    try:
        # Parse latitude and longitude (default to USF Tampa area if missing or invalid)
        try:
            lat = float(request.args.get("lat", DEFAULT_LAT))
        except (TypeError, ValueError):
            lat = DEFAULT_LAT

        try:
            lng = float(request.args.get("lng", DEFAULT_LNG))
        except (TypeError, ValueError):
            lng = DEFAULT_LNG

        # Parse filter
        raw_filter = request.args.get("filter", "batteries")
        filter_type = str(raw_filter).lower().strip()
        if filter_type not in ["batteries", "ewaste", "hazardous"]:
            filter_type = "batteries"

        # Parse radiusKm
        try:
            radius_km = float(request.args.get("radiusKm", DEFAULT_RADIUS_KM))
        except (TypeError, ValueError):
            radius_km = DEFAULT_RADIUS_KM
        radius_km = max(1.0, min(radius_km, MAX_RADIUS_KM))

        server_key = os.environ.get("GOOGLE_PLACES_SERVER_KEY", "").strip()

        # Try Google Places API (New) if server key is available
        results = None
        if server_key:
            try:
                results = query_places_api_new(lat, lng, filter_type, radius_km, server_key)
            except Exception:
                # Log or swallow error to ensure fallback triggers seamlessly
                results = None

        if results is not None and len(results) > 0:
            return jsonify({
                "ok": True,
                "source": "places",
                "results": results,
            })

        # Use fallback JSON if Places call returned empty, failed, timed out, or no key
        fallback_results = get_fallback_results(lat, lng, filter_type, radius_km)
        return jsonify({
            "ok": True,
            "source": "fallback",
            "results": fallback_results,
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
