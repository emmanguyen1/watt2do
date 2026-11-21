import os
from itertools import cycle
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from vision import ScanError, classify, make_result

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES + 64 * 1024

    try:
        from dropoffs import dropoffs_bp
    except ModuleNotFoundError as exc:
        if exc.name != "dropoffs":
            raise
    else:
        app.register_blueprint(dropoffs_bp)

    mock_results = cycle([
        make_result("AA battery", "battery", "alkaline", False, "", 0.95, "batteries"),
        make_result("Swollen phone battery", "battery", "lithium_ion", True,
                    "The battery casing appears visibly swollen.", 0.9, "batteries"),
        make_result("Coin", "other", None, None, "", 0.9, "none"),
    ])
    mock_lock = Lock()

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/api/health")
    def health():
        return jsonify(ok=True)

    @app.post("/api/scan")
    def scan():
        if request.mimetype != "multipart/form-data":
            raise ScanError("Upload a JPEG or PNG using the image field.", 400)
        files = request.files.getlist("image")
        if len(files) != 1 or len(request.files) != 1 or not files[0].filename:
            raise ScanError("Provide one photo in the image field.", 400)
        photo = files[0]
        image = photo.read(MAX_IMAGE_BYTES + 1)
        if len(image) > MAX_IMAGE_BYTES:
            raise ScanError("The photo is too large. Use an image under 5 MB.", 413)
        if image.startswith(b"\xff\xd8\xff") and photo.mimetype == "image/jpeg":
            image_type = "image/jpeg"
        elif image.startswith(b"\x89PNG\r\n\x1a\n") and photo.mimetype == "image/png":
            image_type = "image/png"
        else:
            raise ScanError("Choose a JPEG or PNG photo.", 415)
        if os.getenv("MOCK_SCAN") == "1":
            with mock_lock:
                return jsonify(next(mock_results))
        return jsonify(classify(image, image_type))

    @app.errorhandler(ScanError)
    def scan_error(error):
        return jsonify(ok=False, error=str(error)), error.status

    @app.errorhandler(HTTPException)
    def http_error(error):
        message = "The photo is too large. Use an image under 5 MB." if error.code == 413 else error.name
        return jsonify(ok=False, error=message), error.code

    @app.errorhandler(Exception)
    def unexpected_error(error):
        if request.path == "/api/scan":
            app.logger.error("Scan failed with %s", type(error).__name__)
        return jsonify(ok=False, error="The request could not be completed."), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("FLASK_RUN_PORT", "5000")))
