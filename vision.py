import base64
import json
import math
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

CATEGORIES = ("battery", "ewaste", "hazardous", "other", "unknown")
BATTERY_TYPES = ("alkaline", "lithium_ion", "lithium_coin", "lead_acid", "nimh", "other")
SCHEMA = {
    "type": "object",
    "required": ["item", "category", "batteryType", "markings", "damaged", "damageNotes", "confidence"],
    "properties": {
        "item": {"type": "string"},
        "category": {"type": "string", "enum": list(CATEGORIES)},
        "batteryType": {"type": ["string", "null"], "enum": [*BATTERY_TYPES, None]},
        "markings": {"type": "string"},
        "damaged": {"type": ["boolean", "null"]},
        "damageNotes": {"type": "string"},
        "confidence": {"type": "number"},
    },
}
PROMPT = """
Identify the household item in this image for a recycling app in Hillsborough County, Florida.
Focus on identifying battery chemistry, device classification, and physical damage cues.
Extract any readable text, brand names, model numbers, voltage (e.g. 1.5V, 3.7V, 12V), size (e.g. AA, AAA, 18650, 21700, CR2032), or chemistry printed on the casing into markings.
Categories:
- battery: loose battery, cell, power tool pack (e.g., DeWalt, Milwaukee, Ryobi), e-bike pack, or vape battery.
- ewaste: electronic device with embedded battery (smartphone, tablet, laptop, headphones, watch, camera, power bank).
- hazardous: fluorescent bulb, hazardous chemical, paint, or mercury thermometer.
- other: identifiable non-hazardous decoy (metal coin, soda can, plastic bottle, food packaging).
- unknown: blurry, unidentifiable, empty frame, or multiple chaotic items.
Battery chemistry:
- alkaline: standard 1.5V alkaline cells (AA, AAA, C, D, 9V, LR6, LR03, MN1500, Coppertop, Energizer Max).
- lithium_ion: rechargeable Li-ion, Li-poly, 18650, 21700, phone/tool batteries, 3.6V-3.85V cells.
- lithium_coin: button/coin cells (CR2032, CR2025, CR2016, LR44, SR44, 357, A23).
- lead_acid: 6V/12V vehicle, AGM, GEL, SLA, or motorcycle batteries with Pb symbol.
- nimh: rechargeable Ni-MH, nickel-metal hydride, Eneloop, HR6.
- other: loose batteries with uncertain or unlisted chemistry.
Damage assessment:
- damaged: set true if visible swelling, puffiness, acid/chemical leakage, corrosion, dents, or punctures are present. Describe visible cues in damageNotes.
- damaged: set false if casing is intact and uncompromised.
- damaged: set null if surfaces cannot be fully inspected.
Use confidence 0.0 to 1.0 (>= 0.75 for clear views). Return structured JSON only.
"""

MARKINGS = {
    "alkaline": r"\b(?:alkaline|LR(?:03|6|14|20)|6LR61|MN(?:1500|2400|1300|1400|1604)|AM[1-4]|E9[12]|alk|alkalin|coppertop)\b",
    "lithium_ion": r"\b(?:li[ -]?ion|lithium[ -]?ion|li[ -]?polymer|li[ -]?po|18650|21700|26650|14500|16340|lifepo4?|lfp|nmc|inr|icr|imr|rechargeable lithium|pouch cell)\b",
    "lithium_coin": r"\b(?:CR\s?\d{3,4}|BR\s?\d{3,4}|DL\s?\d{3,4}|LR44|SR44|AG13|A23|357|377|coin cell|button cell)\b",
    "lead_acid": r"\b(?:lead[ -]?acid|VRLA|Pb|SLA|AGM|GEL|sealed lead|wet cell|car battery|automotive battery)\b",
    "nimh": r"\b(?:Ni[ -]?MH|nickel[ -]?metal hydride|HR(?:03|6)|eneloop|rechargeable nimh)\b",
}


class ScanError(Exception):
    def __init__(self, message, status):
        super().__init__(message)
        self.status = status


def instructions_for(category, battery_type, damaged):
    if damaged is True:
        return [
            "If there is smoke, fire, or immediate fire risk, move away and call 911.",
            "Stop using or charging it. Leave any built-in battery in place and avoid opening or puncturing it.",
            "Keep it out of trash, curbside recycling and regular battery drop-off bins.",
            "Call Hillsborough County Solid Waste at (813) 272-5680 or the manufacturer before moving it.",
        ]
    if category == "battery":
        if battery_type == "alkaline":
            return [
                "Confirm the label says alkaline. Keep loose batteries out of curbside recycling.",
                "Hillsborough County allows confirmed alkaline cells in household trash. Call ahead if you prefer a retail recycling option.",
            ]
        if battery_type == "lead_acid":
            return [
                "Keep the battery intact and out of household trash and curbside recycling.",
                "Call a lead-acid collector to confirm acceptance and handling before transporting it.",
            ]
        if battery_type == "other":
            return [
                "Check the printed label or manufacturer instructions before choosing a drop-off.",
                "Keep loose batteries out of curbside recycling and confirm your exact type with the collector.",
            ]
        return [
            "Keep this battery out of household trash and curbside recycling.",
            "For an intact loose battery, follow collector instructions for nonconductive tape or individual bagging.",
            "Confirm acceptance for your battery type and size before visiting.",
        ]
    if category == "ewaste":
        return [
            "Keep the device intact and leave any built-in battery in place.",
            "Use an electronics recycler that accepts the item. Wipe personal data if applicable and safe.",
        ]
    if category == "hazardous":
        return [
            "Keep the item separate from regular recycling and leave its casing intact.",
            "Check with your household hazardous waste program before transporting it.",
        ]
    if category == "other":
        return [
            "Check your local waste guide for the correct bin or reuse option for this item.",
            "Confirm the item has no hidden battery before putting it into a regular waste stream.",
        ]
    return [
        "Take a closer, well-lit photo of one item with the label facing the camera.",
        "Check the product label or manufacturer instructions before choosing a disposal option.",
    ]


def make_result(item, category, battery_type, damaged, damage_notes, confidence, dropoff_filter, condition="Intact and cool"):
    return {
        "ok": True,
        "item": item,
        "category": category,
        "batteryType": battery_type,
        "condition": condition,
        "damaged": damaged,
        "damageNotes": damage_notes,
        "confidence": confidence,
        "instructions": instructions_for(category, battery_type, damaged),
        "dropoffFilter": dropoff_filter,
    }


def bounded_text(value, length):
    return " ".join(value.split())[:length] if isinstance(value, str) else ""


def normalize(data):
    if not isinstance(data, dict):
        raise ScanError("The photo could not be interpreted. Try again.", 502)
    item = bounded_text(data.get("item"), 100)
    category = data.get("category")
    if category not in CATEGORIES or not item:
        category = "unknown"
    confidence = data.get("confidence")
    if type(confidence) not in (int, float) or not -1e10 <= confidence <= 1e10 or not math.isfinite(confidence):
        confidence = 0.0
    confidence = min(1.0, max(0.0, float(confidence)))
    if category == "unknown":
        confidence = min(confidence, 0.59)
    battery_type = data.get("batteryType")
    if category == "battery":
        markings = bounded_text(data.get("markings"), 180)
        supported_types = [name for name, pattern in MARKINGS.items() if re.search(pattern, markings, re.I)]
        if supported_types:
            battery_type = supported_types[0] if (battery_type not in supported_types) else battery_type
        elif battery_type not in BATTERY_TYPES:
            battery_type = "other"
    else:
        battery_type = None
    damaged = data.get("damaged")
    notes = bounded_text(data.get("damageNotes"), 180)
    if type(damaged) is not bool or (damaged is True and not notes):
        damaged = None
    if category in ("unknown", "other") and damaged is not True:
        damaged = None

    if damaged is True:
        condition = "Damaged / Hazard"
    elif damaged is False or (category in ("battery", "ewaste") and confidence >= 0.6 and not notes):
        condition = "Intact and cool"
        damaged = False
    else:
        condition = "Condition unconfirmed"

    dropoff_filter = {"battery": "batteries", "ewaste": "ewaste", "hazardous": "hazardous"}.get(category, "none")
    # A photo cannot establish that a collector accepts an item in damaged condition.
    if damaged is True or confidence < 0.6:
        dropoff_filter = "none"
    result = make_result(item or "Unrecognized item", category, battery_type, damaged,
                         notes if damaged is not False else "", confidence, dropoff_filter, condition)
    if damaged is None and category in ("battery", "ewaste"):
        result["instructions"].insert(0, "The photo cannot confirm condition. If it is swollen, leaking or unusually hot, stop and get handling advice before drop-off.")
        result["dropoffFilter"] = "none"
    return result


def classify(image, mime):
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise ScanError("Scanning is unavailable. Set a Gemini API key or enable mock mode.", 503)
    model = quote(os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"), safe="")
    body = {
        "contents": [{"parts": [
            {"text": PROMPT},
            {"inlineData": {"mimeType": mime, "data": base64.b64encode(image).decode("ascii")}},
        ]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseJsonSchema": SCHEMA,
            "maxOutputTokens": 300,
            "thinkingConfig": {"thinkingLevel": "LOW"},
        },
    }
    request = Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            provider = json.load(response)
        parts = provider["candidates"][0]["content"]["parts"]
        output = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        return normalize(json.loads(output))
    except HTTPError as exc:
        if exc.code == 429:
            raise ScanError("Scan quota reached. Try again later.", 503) from exc
        raise ScanError("Gemini could not complete the scan. Check the configuration and try again.", 502) from exc
    except (URLError, TimeoutError) as exc:
        raise ScanError("The scan service is unavailable. Try again.", 503) from exc
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
        raise ScanError("The photo could not be interpreted. Try again.", 502) from exc
