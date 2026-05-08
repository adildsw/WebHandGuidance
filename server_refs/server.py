from flask import Flask, request, Response, jsonify, send_file, render_template, redirect
import os
import io
import zipfile
import base64
import hashlib
import urllib.parse
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
TRASH_DIR = Path("trash")
TRASH_DIR.mkdir(exist_ok=True)
STUDY_CONFIG_DIR = Path("study_configs")
STUDY_CONFIG_DIR.mkdir(exist_ok=True)
API_PASSWORD = os.environ.get("API_PASSWORD", "devpassword")
REDIRECT_BASE = "https://adildsw.com/WebHandGuidance/#/prestudy"


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
    filename = f"{safe_pid}_fulldata_{safe_ts}.zip"
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


@app.route("/uploadTaskData", methods=["POST", "OPTIONS"])
def upload_task_data():
    if request.method == "OPTIONS":
        return Response("", status=204)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return Response("Invalid JSON", status=400, mimetype="text/plain")

    data_csv = payload.get("dataCsv", "")
    raw_data_csv = payload.get("rawDataCsv", "")
    imu_data_csv = payload.get("imuDataCsv", "") or ""
    participant_id = payload.get("participantId", "")
    task_tag = payload.get("taskTag", "")
    task_idx = payload.get("taskIdx", "")
    timestamp = payload.get("timestamp", "")
    task_str = payload.get("task", "")

    if not all([participant_id, timestamp, task_tag]):
        return Response("Missing required fields (participantId, timestamp, taskTag)", status=400, mimetype="text/plain")

    safe_pid = safe_fragment(participant_id)
    safe_tag = safe_fragment(task_tag)
    safe_idx = safe_fragment(str(task_idx))
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_task{safe_idx}_{safe_tag}_{safe_ts}.zip"
    path = DATA_DIR / filename

    task_info = {
        "participant_id": participant_id,
        "task_tag": task_tag,
        "task_idx": task_idx,
        "timestamp": timestamp,
    }

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        if data_csv.strip():
            zf.writestr("data.csv", data_csv)
        if raw_data_csv.strip():
            zf.writestr("rawData.csv", raw_data_csv)
        if imu_data_csv.strip():
            zf.writestr("imuData.csv", imu_data_csv)
        if task_str.strip():
            zf.writestr("task.json", task_str)
        zf.writestr("task_info.json", json.dumps(task_info))

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


@app.route("/download-selected", methods=["POST", "OPTIONS"])
def download_selected():
    if request.method == "OPTIONS":
        return Response("", status=204)
    if not require_auth():
        return Response("Forbidden", status=403, mimetype="text/plain")
    payload = request.get_json(silent=True) or {}
    keys = payload.get("keys") or []
    if not isinstance(keys, list) or not keys:
        return Response("No keys provided", status=400, mimetype="text/plain")
    buf = io.BytesIO()
    added = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for key in keys:
            if not isinstance(key, str):
                continue
            name = key.split("/", 1)[1] if key.startswith("data/") else key
            if "/" in name or name in ("", ".", ".."):
                continue
            path = DATA_DIR / name
            if path.is_file():
                with open(path, "rb") as f:
                    zf.writestr(name, f.read())
                added += 1
    if added == 0:
        return Response("No matching files", status=404, mimetype="text/plain")
    buf.seek(0)
    return send_file(
        buf,
        as_attachment=True,
        download_name="selected_data.zip",
        mimetype="application/zip",
    )


@app.route("/delete-selected", methods=["POST", "OPTIONS"])
def delete_selected():
    if request.method == "OPTIONS":
        return Response("", status=204)
    if not require_auth():
        return Response("Forbidden", status=403, mimetype="text/plain")
    payload = request.get_json(silent=True) or {}
    keys = payload.get("keys") or []
    if not isinstance(keys, list) or not keys:
        return Response("No keys provided", status=400, mimetype="text/plain")
    moved = []
    skipped = []
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    for key in keys:
        if not isinstance(key, str):
            skipped.append(key)
            continue
        name = key.split("/", 1)[1] if key.startswith("data/") else key
        if "/" in name or name in ("", ".", ".."):
            skipped.append(key)
            continue
        src = DATA_DIR / name
        if not src.is_file():
            skipped.append(key)
            continue
        dest = TRASH_DIR / name
        if dest.exists():
            stem = dest.stem
            suffix = dest.suffix
            dest = TRASH_DIR / f"{stem}_{ts}{suffix}"
        src.rename(dest)
        moved.append(name)
    return jsonify({"moved": moved, "skipped": skipped})


@app.route("/files", methods=["GET", "OPTIONS"])
def files_page():
    if request.method == "OPTIONS":
        return Response("", status=204)
    return render_template("files.html")


@app.route("/study-config", methods=["GET", "OPTIONS"])
def study_config_page():
    if request.method == "OPTIONS":
        return Response("", status=204)
    return render_template("study_config.html")


@app.route("/upload-study-config", methods=["POST", "OPTIONS"])
def upload_study_config():
    if request.method == "OPTIONS":
        return Response("", status=204)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return Response("Invalid JSON", status=400, mimetype="text/plain")

    json_content = payload.get("jsonContent")
    participant_id = payload.get("participantId", "P1")

    if not json_content:
        return Response("Missing jsonContent field", status=400, mimetype="text/plain")

    try:
        parsed = json.loads(json_content)
        normalized = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
    except json.JSONDecodeError:
        return Response("Invalid JSON content in jsonContent field", status=400, mimetype="text/plain")

    content_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]

    path = STUDY_CONFIG_DIR / (content_hash + ".json")
    with open(path, "w", encoding="utf-8") as f:
        f.write(normalized)

    return jsonify({
        "status": "ok",
        "hash": content_hash,
        "participantId": participant_id
    })


@app.route("/study", methods=["GET", "OPTIONS"])
def study_redirect():
    if request.method == "OPTIONS":
        return Response("", status=204)

    config_hash = request.args.get("hash")
    participant_id = request.args.get("participantId", "P1")

    if not config_hash:
        return Response("Missing hash parameter", status=400, mimetype="text/plain")

    path = STUDY_CONFIG_DIR / (config_hash + ".json")

    if not path.exists() or not path.is_file():
        return Response("Study configuration not found for the given hash", status=404, mimetype="text/plain")

    with open(path, "r", encoding="utf-8") as f:
        json_content = f.read()

    data_b64 = base64.b64encode(json_content.encode("utf-8")).decode("ascii")

    redirect_url = f"{REDIRECT_BASE}?participantId={urllib.parse.quote(participant_id)}&data={urllib.parse.quote(data_b64)}"

    return redirect(redirect_url, code=302)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
