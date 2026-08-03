import os
import json
import base64
import io
import zipfile
import urllib.parse
from datetime import datetime
import re
import hashlib
import logging
import traceback

import boto3

# ── Logging setup ──
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3", region_name="us-east-1")
BUCKET = os.environ["BUCKET"]
API_PASSWORD = os.environ["API_PASSWORD"]
PREFIX = "data/"
TRASH_PREFIX = "trash/"
STUDY_CONFIG_PREFIX = "study_configs/"
DEFAULT_PAGE_SIZE = 1000
MAX_DOWNLOAD_URLS = 2000
DOWNLOAD_URL_TTL = 21600
REDIRECT_BASE = "https://adildsw.com/WebHandGuidance/#/prestudy"


def response(status, body, headers=None, is_binary=False):
    base_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Filename",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }
    if headers:
        base_headers.update(headers)
    if is_binary:
        logger.info(f"Responding {status} (binary, {len(body)} bytes)")
        return {
            "statusCode": status,
            "headers": base_headers,
            "body": base64.b64encode(body).decode("ascii"),
            "isBase64Encoded": True
        }
    if isinstance(body, (dict, list)):
        body = json.dumps(body)
        base_headers.setdefault("Content-Type", "application/json")
    logger.info(f"Responding {status} ({len(body) if isinstance(body, str) else 0} chars)")
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
        logger.warning("Auth failed: missing or malformed Bearer token")
        raise PermissionError
    token = auth.split(" ", 1)[1]
    if token != API_PASSWORD:
        logger.warning("Auth failed: invalid token")
        raise PermissionError
    logger.info("Auth succeeded")


def safe_fragment(s):
    if s is None:
        return ""
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", str(s))


def list_data_objects(continuation_token=None, max_keys=DEFAULT_PAGE_SIZE):
    logger.info(f"Listing objects in s3://{BUCKET}/{PREFIX} "
                f"(max_keys={max_keys}, continued={bool(continuation_token)})")
    kwargs = {"Bucket": BUCKET, "Prefix": PREFIX, "MaxKeys": max_keys}
    if continuation_token:
        kwargs["ContinuationToken"] = continuation_token

    page = s3.list_objects_v2(**kwargs)
    objects = []
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

    next_token = page.get("NextContinuationToken")
    logger.info(f"Found {len(objects)} objects (more={bool(next_token)})")
    return objects, next_token


def handler(event, context):
    method, path = get_method_and_path(event)
    query_params = event.get("queryStringParameters") or {}
    source_ip = event.get("requestContext", {}).get("http", {}).get("sourceIp", "unknown")
    logger.info(f">>> {method} {path} | params={json.dumps(query_params)} | ip={source_ip}")

    try:
        if method == "OPTIONS":
            logger.info("CORS preflight request")
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

        if path == "/get-upload-url" and method == "POST":
            return get_upload_url_handler(event)

        if path == "/study-config" and method == "GET":
            return study_config_page_handler()

        if path == "/upload-study-config" and method == "POST":
            return upload_study_config_handler(event)

        if path == "/study" and method == "GET":
            return study_redirect_handler(event)

        try:
            require_auth(event)
        except PermissionError:
            return response(403, "Forbidden", {"Content-Type": "text/plain"})

        if path == "/files-json" and method == "GET":
            return files_json_handler(event)

        if path == "/download-url" and method == "GET":
            return download_url_handler(event)

        if path == "/download-urls" and method == "POST":
            return download_urls_handler(event)

        if path == "/delete-selected" and method == "POST":
            return delete_selected_handler(event)

        logger.warning(f"No route matched: {method} {path}")
        return response(404, "Not found", {"Content-Type": "text/plain"})

    except Exception as e:
        logger.error(f"UNHANDLED EXCEPTION on {method} {path}: {e}")
        logger.error(traceback.format_exc())
        return response(500, "Internal server error", {"Content-Type": "text/plain"})


def root_handler():
    logger.info("Root handler called")
    return response(200, "WebHandGuidance server is running", {"Content-Type": "text/plain"})


def ping_handler():
    logger.info("Ping handler called")
    return response(200, "pong", {"Content-Type": "text/plain"})


def upload_handler(event):
    logger.info("Upload handler called")
    body_bytes = get_body_bytes(event)
    logger.info(f"Request body size: {len(body_bytes)} bytes")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    if not isinstance(payload, dict):
        logger.error(f"Expected dict, got {type(payload).__name__}")
        return response(400, "Invalid JSON body", {"Content-Type": "text/plain"})

    data_csv = payload.get("dataCsv") or ""
    raw_data_csv = payload.get("rawDataCsv") or ""
    imu_data_csv = payload.get("imuDataCsv") or ""
    participant_id = payload.get("participantId") or ""
    timestamp = payload.get("timestamp") or ""
    task_str = payload.get("task") or ""

    logger.info(f"Upload fields: participantId={participant_id}, timestamp={timestamp}, "
                f"dataCsv={len(data_csv)} chars, rawDataCsv={len(raw_data_csv)} chars, "
                f"imuDataCsv={len(imu_data_csv)} chars, task={len(task_str)} chars")

    if not all([data_csv, raw_data_csv, participant_id, timestamp, task_str]):
        missing = [f for f, v in [("dataCsv", data_csv), ("rawDataCsv", raw_data_csv),
                   ("participantId", participant_id), ("timestamp", timestamp),
                   ("task", task_str)] if not v]
        logger.error(f"Missing required fields: {missing}")
        return response(400, "Missing required fields", {"Content-Type": "text/plain"})

    safe_pid = safe_fragment(participant_id)
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_fulldata_{safe_ts}.zip"
    key = PREFIX + filename
    logger.info(f"Will upload to s3://{BUCKET}/{key}")

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
    logger.info(f"Zip created: {len(zipped_bytes)} bytes")

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=zipped_bytes,
        ContentType="application/zip"
    )
    logger.info(f"Upload successful: {key}")

    return response(200, {"status": "ok", "key": key, "size": len(zipped_bytes)})


def upload_task_data_handler(event):
    logger.info("Upload task data handler called")
    body_bytes = get_body_bytes(event)
    logger.info(f"Request body size: {len(body_bytes)} bytes")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    if not isinstance(payload, dict):
        logger.error(f"Expected dict, got {type(payload).__name__}")
        return response(400, "Invalid JSON body", {"Content-Type": "text/plain"})

    data_csv = payload.get("dataCsv") or ""
    raw_data_csv = payload.get("rawDataCsv") or ""
    imu_data_csv = payload.get("imuDataCsv") or ""
    participant_id = payload.get("participantId") or ""
    task_tag = payload.get("taskTag") or ""
    task_idx = payload.get("taskIdx") or ""
    timestamp = payload.get("timestamp") or ""
    task_str = payload.get("task") or ""

    logger.info(f"Task upload fields: participantId={participant_id}, taskTag={task_tag}, "
                f"taskIdx={task_idx}, timestamp={timestamp}, "
                f"dataCsv={len(data_csv)} chars, rawDataCsv={len(raw_data_csv)} chars, "
                f"imuDataCsv={len(imu_data_csv)} chars, task={len(task_str)} chars")

    if not all([participant_id, timestamp, task_tag]):
        missing = [f for f, v in [("participantId", participant_id),
                   ("timestamp", timestamp), ("taskTag", task_tag)] if not v]
        logger.error(f"Missing required fields: {missing}")
        return response(400, "Missing required fields (participantId, timestamp, taskTag)", {"Content-Type": "text/plain"})

    safe_pid = safe_fragment(participant_id)
    safe_tag = safe_fragment(task_tag)
    safe_idx = safe_fragment(str(task_idx))
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_task{safe_idx}_{safe_tag}_{safe_ts}.zip"
    key = PREFIX + filename
    logger.info(f"Will upload to s3://{BUCKET}/{key}")

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
    logger.info(f"Zip created: {len(zipped_bytes)} bytes")

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=zipped_bytes,
        ContentType="application/zip"
    )
    logger.info(f"Task data upload successful: {key}")

    return response(200, {"status": "ok", "key": key, "size": len(zipped_bytes)})


def get_upload_url_handler(event):
    """Generate a presigned S3 PUT URL so the client can upload directly to S3."""
    logger.info("Get upload URL handler called")
    body_bytes = get_body_bytes(event)

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    participant_id = payload.get("participantId") or ""
    task_tag = payload.get("taskTag") or ""
    task_idx = payload.get("taskIdx") or ""
    timestamp = payload.get("timestamp") or ""

    if not all([participant_id, timestamp, task_tag]):
        missing = [f for f, v in [("participantId", participant_id),
                   ("timestamp", timestamp), ("taskTag", task_tag)] if not v]
        logger.error(f"Missing required fields: {missing}")
        return response(400, "Missing required fields (participantId, timestamp, taskTag)", {"Content-Type": "text/plain"})

    safe_pid = safe_fragment(participant_id)
    safe_tag = safe_fragment(task_tag)
    safe_idx = safe_fragment(str(task_idx))
    safe_ts = safe_fragment(timestamp)
    filename = f"{safe_pid}_task{safe_idx}_{safe_tag}_{safe_ts}.zip"
    key = PREFIX + filename

    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET,
            "Key": key,
            "ContentType": "application/zip"
        },
        ExpiresIn=300  # 5 minutes
    )

    logger.info(f"Generated presigned upload URL for s3://{BUCKET}/{key} (expires in 300s)")

    return response(200, {
        "uploadUrl": presigned_url,
        "key": key,
        "expiresIn": 300
    })


def files_json_handler(event):
    logger.info("Files JSON handler called")
    token = get_query_param(event, "token")
    limit = get_query_param(event, "limit")

    max_keys = DEFAULT_PAGE_SIZE
    if limit:
        try:
            max_keys = max(1, min(DEFAULT_PAGE_SIZE, int(limit)))
        except ValueError:
            logger.error(f"Invalid limit parameter: {limit}")
            return response(400, {"error": "invalid limit"})

    try:
        objects, next_token = list_data_objects(token, max_keys)
    except s3.exceptions.ClientError as e:
        logger.error(f"Invalid continuation token: {e}")
        return response(400, {"error": "invalid token"})

    return response(200, {"files": objects, "nextToken": next_token})


def download_urls_handler(event):
    logger.info("Download URLs handler called")
    body_bytes = get_body_bytes(event)
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError:
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    keys = payload.get("keys") if isinstance(payload, dict) else None
    if not isinstance(keys, list) or not keys:
        return response(400, "No keys provided", {"Content-Type": "text/plain"})
    if len(keys) > MAX_DOWNLOAD_URLS:
        logger.error(f"Too many keys requested: {len(keys)}")
        return response(400, {"error": f"at most {MAX_DOWNLOAD_URLS} keys per request"})

    valid_keys = [k for k in keys if isinstance(k, str) and k.startswith(PREFIX)]
    if not valid_keys:
        return response(400, "No valid keys", {"Content-Type": "text/plain"})

    urls = [
        {
            "key": key,
            "name": key.split("/")[-1],
            "url": s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET, "Key": key},
                ExpiresIn=DOWNLOAD_URL_TTL
            )
        }
        for key in valid_keys
    ]

    logger.info(f"Generated {len(urls)} presigned download URLs (expire in {DOWNLOAD_URL_TTL}s)")
    return response(200, {"urls": urls, "expiresIn": DOWNLOAD_URL_TTL})


def download_url_handler(event):
    key = get_query_param(event, "key")
    logger.info(f"Download URL handler called: key={key}")
    if not key:
        logger.error("Missing key parameter")
        return response(400, {"error": "missing key"})
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=3600
    )
    logger.info(f"Generated presigned URL for {key}")
    return response(200, {"url": url})


def delete_selected_handler(event):
    logger.info("Delete selected handler called")
    body_bytes = get_body_bytes(event)
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError:
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})
    keys = payload.get("keys") if isinstance(payload, dict) else None
    if not isinstance(keys, list) or not keys:
        return response(400, "No keys provided", {"Content-Type": "text/plain"})

    valid_keys = [k for k in keys if isinstance(k, str) and k.startswith(PREFIX)]
    if not valid_keys:
        return response(400, "No valid keys", {"Content-Type": "text/plain"})

    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    moved = []
    skipped = []
    for key in valid_keys:
        name = key.split("/")[-1]
        dest_key = TRASH_PREFIX + name
        try:
            s3.head_object(Bucket=BUCKET, Key=dest_key)
            stem, dot, ext = name.rpartition(".")
            if dot:
                dest_key = f"{TRASH_PREFIX}{stem}_{ts}.{ext}"
            else:
                dest_key = f"{TRASH_PREFIX}{name}_{ts}"
        except s3.exceptions.ClientError:
            pass
        try:
            s3.copy_object(
                Bucket=BUCKET,
                Key=dest_key,
                CopySource={"Bucket": BUCKET, "Key": key},
            )
            s3.delete_object(Bucket=BUCKET, Key=key)
            moved.append(name)
            logger.info(f"Moved {key} -> {dest_key}")
        except Exception as e:
            logger.warning(f"Failed to move {key}: {e}")
            skipped.append(key)

    return response(200, {"moved": moved, "skipped": skipped})


def files_page_handler():
    logger.info("Files page handler called")
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "templates", "files.html")
    try:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        logger.info(f"Loaded files.html ({len(html)} chars)")
    except FileNotFoundError:
        logger.error(f"files.html not found at {path}")
        html = "<html><body><h1>files.html not found</h1></body></html>"
    return response(200, html, {"Content-Type": "text/html; charset=utf-8"})


def study_config_page_handler():
    logger.info("Study config page handler called")
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "templates", "study_config.html")
    try:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        logger.info(f"Loaded study_config.html ({len(html)} chars)")
    except FileNotFoundError:
        logger.error(f"study_config.html not found at {path}")
        html = "<html><body><h1>study_config.html not found</h1></body></html>"
    return response(200, html, {"Content-Type": "text/html; charset=utf-8"})


def upload_study_config_handler(event):
    logger.info("Upload study config handler called")
    body_bytes = get_body_bytes(event)
    logger.info(f"Request body size: {len(body_bytes)} bytes")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return response(400, "Invalid JSON", {"Content-Type": "text/plain"})

    json_content = payload.get("jsonContent")
    participant_id = payload.get("participantId", "P1")
    logger.info(f"Study config upload: participantId={participant_id}, "
                f"jsonContent={'present' if json_content else 'missing'} "
                f"({len(json_content) if json_content else 0} chars)")

    if not json_content:
        logger.error("Missing jsonContent field")
        return response(400, "Missing jsonContent field", {"Content-Type": "text/plain"})

    try:
        parsed = json.loads(json_content)
        normalized = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
        logger.info(f"JSON content parsed and normalized ({len(normalized)} chars)")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in jsonContent: {e}")
        return response(400, "Invalid JSON content in jsonContent field", {"Content-Type": "text/plain"})

    content_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    key = STUDY_CONFIG_PREFIX + content_hash + ".json"
    logger.info(f"Study config hash={content_hash}, uploading to s3://{BUCKET}/{key}")

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=normalized.encode("utf-8"),
        ContentType="application/json"
    )
    logger.info(f"Study config upload successful: {key}")

    return response(200, {
        "status": "ok",
        "hash": content_hash,
        "participantId": participant_id
    })


def study_redirect_handler(event):
    config_hash = get_query_param(event, "hash")
    participant_id = get_query_param(event, "participantId") or "P1"
    logger.info(f"Study redirect handler: hash={config_hash}, participantId={participant_id}")

    if not config_hash:
        logger.error("Missing hash parameter")
        return response(400, "Missing hash parameter", {"Content-Type": "text/plain"})

    key = STUDY_CONFIG_PREFIX + config_hash + ".json"
    logger.info(f"Fetching study config from s3://{BUCKET}/{key}")

    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        json_content = obj["Body"].read().decode("utf-8")
        logger.info(f"Study config loaded ({len(json_content)} chars)")
    except s3.exceptions.NoSuchKey:
        logger.warning(f"Study config not found: {key}")
        return response(404, "Study configuration not found for the given hash", {"Content-Type": "text/plain"})
    except Exception as e:
        if "NoSuchKey" in str(e) or "404" in str(e):
            logger.warning(f"Study config not found (fallback check): {key} - {e}")
            return response(404, "Study configuration not found for the given hash", {"Content-Type": "text/plain"})
        logger.error(f"Unexpected error fetching study config: {e}")
        raise

    data_b64 = base64.b64encode(json_content.encode("utf-8")).decode("ascii")
    redirect_url = f"{REDIRECT_BASE}?participantId={urllib.parse.quote(participant_id)}&data={urllib.parse.quote(data_b64)}"
    logger.info(f"Redirecting to {redirect_url[:120]}...")

    return response(302, "", {
        "Location": redirect_url,
        "Content-Type": "text/plain"
    })