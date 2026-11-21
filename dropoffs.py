import os
from flask import Blueprint, jsonify, request

dropoffs_bp = Blueprint("dropoffs", __name__)


@dropoffs_bp.route("/api/maps-config", methods=["GET"])
def get_maps_config():
    maps_key = os.environ.get("GOOGLE_MAPS_BROWSER_KEY", "")
    return jsonify({"ok": True, "mapsKey": maps_key})


@dropoffs_bp.route("/api/dropoffs", methods=["GET"])
def get_dropoffs():
    # Stub response matching contract v1.1
    fake_results = [
        {
            "id": "stub-1",
            "name": "Home Depot - Battery & Light Bulb Recycling",
            "lat": 28.0542,
            "lng": -82.4351,
            "address": "1712 E Fowler Ave, Tampa, FL 33612",
            "distanceKm": 2.5,
            "openNow": True,
            "hours": "Open until 9:00 PM",
            "accepts": ["batteries"],
        },
        {
            "id": "stub-2",
            "name": "Best Buy E-Waste & Battery Drop",
            "lat": 28.0558,
            "lng": -82.4412,
            "address": "2111 E Fowler Ave, Tampa, FL 33612",
            "distanceKm": 3.1,
            "openNow": True,
            "hours": "Open until 8:00 PM",
            "accepts": ["batteries", "ewaste"],
        },
    ]
    return jsonify({
        "ok": True,
        "source": "fallback",
        "results": fake_results
    })
