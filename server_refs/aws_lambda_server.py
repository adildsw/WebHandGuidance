import os
import json
import base64
import io
import zipfile
import urllib.parse
from datetime import datetime
import re

import boto3

s3 = boto3.client("s3", region_name="us-east-1")
BUCKET = os.environ["BUCKET"]
API_PASSWORD = os.environ["API_PASSWORD"]
PREFIX = "data/"


def response(status, body, headers=None, is_binary=False):
    base_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Filename",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }
    if headers:
        base_headers.update(headers)
    if is_binary:
        return {
            "statusCode": status,
            "headers": base_headers,
            "body": base64.b64encode(body).decode("ascii"),
            "isBase64Encoded": True
        }
    if isinstance(body, (dict, list)):
        body = json.dumps(body)
        base_headers.setdefault("Content-Type", "application/json")
    return {
        "statusCode": status,
        "headers": base_headers,
        "body": body,
        "isBase64Encoded": False
    }


def get_method_and_path(event):
    http = event.get("requestContext", {}).get("http", {})
    method = http.get("method") or event.get("httpMethod")
    path = event.get("rawPath") or event.get("path") or "/"
    return method, path


def get_query_param(event, name):
    raw_qs = event.get("rawQueryString")
    if raw_qs:
        parsed = urllib.parse.parse_qs(raw_qs)
        vals = parsed.get(name)
        if vals:
            return vals[0]
    params = event.get("queryStringParameters") or {}
    return params.get(name)


def get_body_bytes(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        return base64.b64decode(body)
    return body.encode("utf-8")


def require_auth(event):
    headers = event.get("headers") or {}
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        raise PermissionError
    token = auth.split(" ", 1)[1]
    if token != API_PASSWORD:
        raise PermissionError


def safe_fragment(s):
    if s is None:
        return ""
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", str(s))


def list_data_objects():
    objects = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith("/"):
                objects.append(
                    {
                        "key": key,
                        "name": key.split("/")[-1],
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"].isoformat()
                    }
                )
    objects.sort(key=lambda x: x["last_modified"])
    return objects


def handler(event, context):
    method, path = get_method_and_path(event)

    if method == "OPTIONS":
        return response(204, "")

    if path == "/" and method == "GET":
        return root_handler()

    if path == "/ping" and method == "GET":
        return ping_handler()

    if path == "/files" and method == "GET":
        return files_page_handler()

    if path == "/upload" and method == "POST":
        return upload_handler(event)

    if path == "/uploadTaskData" and method == "POST":
        return upload_task_data_handler(event)

    try:
        require_auth(event)
    except PermissionError:
        return response(403, "Forbidden", {"Content-Type": "text/plain"})

    if path == "/files-json" and method == "GET":
        return files_json_handler(event)

    if path == "/download-url" and method == "GET":
        return download_url_handler(event)

    if path == "/download-all" and method == "GET":
        return download_all_handler(event)

    return response(404, "Not found", {"Content-Type": "text/plain"})


def root_handler():
    return response(200, "WebHandGuidance server is running", {"Content-Type": "text/plain"})


def ping_handler():
    return response(200, "pong", {"Content-Type": "text/plain"})


def upload_handler(event):
    body_bytes = get_body_bytes(event)
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError:
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    if not isinstance(payload, dict):
        return response(400, "Invalid JSON body", {"Content-Type": "text/plain"})

    data_csv = payload.get("dataCsv") or ""
    raw_data_csv = payload.get("rawDataCsv") or ""
    imu_data_csv = payload.get("imuDataCsv") or ""
    participant_id = payload.get("participantId") or ""
    timestamp = payload.get("timestamp") or ""
    task_str = payload.get("task") or ""

    if not all([data_csv, raw_data_csv, participant_id, timestamp, task_str]):
        return response(400, "Missing required fields", {"Content-Type": "text/plain"})

    safe_pid = safe_fragment(participant_id)
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_fulldata_{safe_ts}.zip"
    key = PREFIX + filename

    participation_info = {
        "participant_id": participant_id,
        "timestamp": timestamp
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.csv", data_csv)
        zf.writestr("rawData.csv", raw_data_csv)
        if imu_data_csv.strip():
            zf.writestr("imuData.csv", imu_data_csv)
        zf.writestr("task.json", task_str)
        zf.writestr("participation_info.json", json.dumps(participation_info))

    zipped_bytes = buf.getvalue()

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=zipped_bytes,
        ContentType="application/zip"
    )

    return response(200, {"status": "ok", "key": key, "size": len(zipped_bytes)})


def upload_task_data_handler(event):
    body_bytes = get_body_bytes(event)
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError:
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    if not isinstance(payload, dict):
        return response(400, "Invalid JSON body", {"Content-Type": "text/plain"})

    data_csv = payload.get("dataCsv") or ""
    raw_data_csv = payload.get("rawDataCsv") or ""
    imu_data_csv = payload.get("imuDataCsv") or ""
    participant_id = payload.get("participantId") or ""
    task_tag = payload.get("taskTag") or ""
    task_idx = payload.get("taskIdx") or ""
    timestamp = payload.get("timestamp") or ""
    task_str = payload.get("task") or ""

    if not all([participant_id, timestamp, task_tag]):
        return response(400, "Missing required fields (participantId, timestamp, taskTag)", {"Content-Type": "text/plain"})

    safe_pid = safe_fragment(participant_id)
    safe_tag = safe_fragment(task_tag)
    safe_idx = safe_fragment(str(task_idx))
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_task{safe_idx}_{safe_tag}_{safe_ts}.zip"
    key = PREFIX + filename

    task_info = {
        "participant_id": participant_id,
        "task_tag": task_tag,
        "task_idx": task_idx,
        "timestamp": timestamp
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if data_csv.strip():
            zf.writestr("data.csv", data_csv)
        if raw_data_csv.strip():
            zf.writestr("rawData.csv", raw_data_csv)
        if imu_data_csv.strip():
            zf.writestr("imuData.csv", imu_data_csv)
        if task_str.strip():
            zf.writestr("task.json", task_str)
        zf.writestr("task_info.json", json.dumps(task_info))

    zipped_bytes = buf.getvalue()

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=zipped_bytes,
        ContentType="application/zip"
    )

    return response(200, {"status": "ok", "key": key, "size": len(zipped_bytes)})


def files_json_handler(event):
    objects = list_data_objects()
    return response(200, objects)


def download_url_handler(event):
    key = get_query_param(event, "key")
    if not key:
        return response(400, {"error": "missing key"})
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=3600
    )
    return response(200, {"url": url})


def download_all_handler(event):
    objects = list_data_objects()
    if not objects:
        return response(404, "No files to download", {"Content-Type": "text/plain"})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for o in objects:
            key = o["key"]
            name = o["name"]
            obj = s3.get_object(Bucket=BUCKET, Key=key)
            data = obj["Body"].read()
            zf.writestr(name, data)
    buf.seek(0)
    return response(
        200,
        buf.getvalue(),
        {
            "Content-Type": "application/zip",
            "Content-Disposition": "attachment; filename=all_data.zip"
        },
        is_binary=True
    )


def files_page_handler():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "files.html")
    try:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
    except FileNotFoundError:
        html = "<html><body><h1>files.html not found</h1></body></html>"
    return response(200, html, {"Content-Type": "text/html; charset=utf-8"})
