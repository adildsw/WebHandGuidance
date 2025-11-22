from flask import Flask, request, Response, jsonify, send_file, render_template
import os
import io
import zipfile
from pathlib import Path
from datetime import datetime
from werkzeug.middleware.proxy_fix import ProxyFix
import json
import re
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
API_PASSWORD = os.environ.get("API_PASSWORD", "devpassword")


def require_auth():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth.split(" ", 1)[1]
    return token == API_PASSWORD


def list_data_objects():
    objs = []
    for p in sorted(DATA_DIR.glob("*")):
        if p.is_file():
            stat = p.stat()
            key = f"data/{p.name}"
            objs.append(
                {
                    "key": key,
                    "name": p.name,
                    "size": stat.st_size,
                    "last_modified": datetime.utcfromtimestamp(stat.st_mtime).isoformat() + "Z",
                }
            )
    return objs


def safe_fragment(s):
    if s is None:
        return ""
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", str(s))


@app.after_request
def add_cors_headers(resp):
    resp.headers.setdefault("Access-Control-Allow-Origin", "*")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Filename")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return resp


@app.route("/", methods=["GET"])
def root():
    return Response("WebHandGuidance server is running", mimetype="text/plain")


@app.route("/ping", methods=["GET"])
def ping():
    return Response("pong", mimetype="text/plain")


@app.route("/upload", methods=["POST", "OPTIONS"])
def upload():
    if request.method == "OPTIONS":
        return Response("", status=204)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return Response("Invalid JSON", status=400, mimetype="text/plain")

    data_csv = payload.get("dataCsv", "")
    raw_data_csv = payload.get("rawDataCsv", "")
    imu_data_csv = payload.get("imuDataCsv", "") or ""
    participant_id = payload.get("participantId", "")
    timestamp = payload.get("timestamp", "")
    task_str = payload.get("task", "")

    if not all([data_csv, raw_data_csv, participant_id, timestamp, task_str]):
        return Response("Missing required fields", status=400, mimetype="text/plain")

    safe_pid = safe_fragment(participant_id)
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_{safe_ts}.zip"
    path = DATA_DIR / filename

    participation_info = {
        "participant_id": participant_id,
        "timestamp": timestamp,
    }

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.csv", data_csv)
        zf.writestr("rawData.csv", raw_data_csv)
        if imu_data_csv.strip():
            zf.writestr("imuData.csv", imu_data_csv)
        zf.writestr("task.json", task_str)
        zf.writestr("participation_info.json", json.dumps(participation_info))

    size = path.stat().st_size
    key = f"data/{filename}"
    return jsonify({"status": "ok", "key": key, "size": size})


@app.route("/files-json", methods=["GET", "OPTIONS"])
def files_json():
    if request.method == "OPTIONS":
        return Response("", status=204)
    if not require_auth():
        return Response("Forbidden", status=403, mimetype="text/plain")
    objs = list_data_objects()
    return jsonify(objs)


@app.route("/download-url", methods=["GET", "OPTIONS"])
def download_url():
    if request.method == "OPTIONS":
        return Response("", status=204)
    if not require_auth():
        return Response("Forbidden", status=403, mimetype="text/plain")
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "missing key"}), 400
    if key.startswith("data/"):
        name = key.split("/", 1)[1]
    else:
        name = key
    url = f"/download-file?key={name}"
    return jsonify({"url": url})


@app.route("/download-file", methods=["GET", "OPTIONS"])
def download_file():
    if request.method == "OPTIONS":
        return Response("", status=204)
    if not require_auth():
        return Response("Forbidden", status=403, mimetype="text/plain")
    key = request.args.get("key")
    if not key:
        return Response("Missing key", status=400, mimetype="text/plain")
    if key.startswith("data/"):
        name = key.split("/", 1)[1]
    else:
        name = key
    path = DATA_DIR / name
    if not path.exists() or not path.is_file():
        return Response("Not found", status=404, mimetype="text/plain")
    return send_file(path, as_attachment=True, download_name=name, mimetype="application/zip")


@app.route("/download-all", methods=["GET", "OPTIONS"])
def download_all():
    if request.method == "OPTIONS":
        return Response("", status=204)
    if not require_auth():
        return Response("Forbidden", status=403, mimetype="text/plain")
    objs = list_data_objects()
    if not objs:
        return Response("No files to download", status=404, mimetype="text/plain")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for o in objs:
            name = o["name"]
            path = DATA_DIR / name
            if path.is_file():
                with open(path, "rb") as f:
                    zf.writestr(name, f.read())
    buf.seek(0)
    return send_file(
        buf,
        as_attachment=True,
        download_name="all_data.zip",
        mimetype="application/zip",
    )


@app.route("/files", methods=["GET", "OPTIONS"])
def files_page():
    if request.method == "OPTIONS":
        return Response("", status=204)
    return render_template("files.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
