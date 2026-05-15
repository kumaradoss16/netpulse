# ─────────────────────────────────────────────────────────────────────────────
# worker.py  –  Net-Pulse Cloudflare Worker (Python)
# SDK: workers-py >= 1.90
# ─────────────────────────────────────────────────────────────────────────────

import json
import math
import time
import os
import re

from workers import fetch as js_fetch, Response, Headers


# ── CORS ──────────────────────────────────────────────────────────────────────

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

def json_response(data: dict, status: int = 200):
    return Response(
        json.dumps(data),
        status=status,
        headers=CORS_HEADERS
    )

def error_response(msg: str, status: int = 500):
    return json_response({"error": msg}, status)


# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Geo-IP via Cloudflare request metadata ────────────────────────────────────

def get_geoip_from_cf(request):
    cf = request.cf
    try:
        ip       = request.headers.get("CF-Connecting-IP") or "N/A"
        country  = str(cf.country)        if cf else "N/A"
        city     = str(cf.city)           if cf else "N/A"
        region   = str(cf.region)         if cf else "N/A"
        timezone = str(cf.timezone)       if cf else "N/A"
        lat      = str(cf.latitude)       if cf else "0"
        lon      = str(cf.longitude)      if cf else "0"
        isp      = str(cf.asOrganization) if cf else "N/A"
        asn      = str(cf.asn)            if cf else "N/A"
        loc      = f"{lat},{lon}"
    except Exception:
        ip = city = region = country = timezone = isp = asn = "N/A"
        lat = lon = "0"
        loc = "0,0"

    return {
        "ip":       ip,
        "isp":      isp,
        "asn":      asn,
        "city":     city,
        "region":   region,
        "country":  country,
        "loc":      loc,
        "lat":      lat,
        "lon":      lon,
        "timezone": timezone,
        "hostname": "N/A",
    }


# ── Speedtest.net server list ─────────────────────────────────────────────────

async def fetch_speedtest_servers(user_lat: float, user_lon: float):
    url = "https://www.speedtest.net/speedtest-servers-static.php"
    try:
        resp = await js_fetch(
            url,
            method="GET",
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/xml"
            }
        )
        if not resp.ok:
            return []
        raw = await resp.text()
        servers_raw = []
        for m in re.finditer(r"<Server\s([^/]+)/>", raw):
            attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
            servers_raw.append(attrs)
    except Exception as e:
        return [{"error": str(e)}]

    results = []
    for s in servers_raw:
        try:
            slat = float(s.get("lat", "0"))
            slon = float(s.get("lon", "0"))
            dist = haversine(user_lat, user_lon, slat, slon)
        except Exception:
            dist = 9999
        results.append({
            "id":       s.get("id", ""),
            "name":     s.get("name", ""),
            "country":  s.get("country", ""),
            "sponsor":  s.get("sponsor", ""),
            "host":     s.get("host", ""),
            "lat":      s.get("lat", ""),
            "lon":      s.get("lon", ""),
            "distance": round(dist, 1),
        })

    results.sort(key=lambda x: x["distance"])
    return results[:12]


# ── Download test ─────────────────────────────────────────────────────────────

async def handle_download_test(request):
    size_bytes = 10 * 1024 * 1024
    payload = os.urandom(size_bytes)
    return Response(
        payload,
        status=200,
        headers={
            "Content-Type": "application/octet-stream",
            "Content-Length": str(size_bytes),
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
        }
    )


# ── Upload test ───────────────────────────────────────────────────────────────

async def handle_upload_test(request):
    t0 = time.monotonic()
    body = await request.arrayBuffer()
    size_bytes = body.byteLength
    elapsed = time.monotonic() - t0
    speed_mbps = round((size_bytes * 8) / (elapsed * 1_000_000), 2) if elapsed > 0 else 0
    return json_response({
        "received_bytes": size_bytes,
        "elapsed_s":      round(elapsed, 4),
        "upload_mbps":    speed_mbps,
        "status":         "ok",
    })


# ── Ping ──────────────────────────────────────────────────────────────────────

async def handle_ping(request):
    cf = request.cf
    try:
        colo = str(cf.colo) if cf else "Unknown"
    except Exception:
        colo = "Unknown"
    return json_response({
        "status":    "ok",
        "colo":      colo,
        "timestamp": time.time(),
        "message":   "pong",
    })


# ── Full speed test (one-shot) ────────────────────────────────────────────────

async def handle_run_speedtest(request, user_lat: float, user_lon: float, server_host: str = None):
    if not server_host:
        servers = await fetch_speedtest_servers(user_lat, user_lon)
        if not servers or "error" in servers[0]:
            return error_response("Could not retrieve nearby Speedtest servers.")
        nearest = servers[0]
        server_host = nearest["host"]
        server_info = nearest
    else:
        server_info = {
            "host": server_host,
            "name": "Selected",
            "country": "",
            "sponsor": "",
            "distance": 0
        }

    # Ping (5 samples, drop first and last)
    ping_url = f"https://{server_host}/speedtest/latency.txt"
    pings = []
    for _ in range(5):
        t0 = time.monotonic()
        try:
            r = await js_fetch(ping_url, method="GET")
            await r.text()
            pings.append((time.monotonic() - t0) * 1000)
        except Exception:
            pings.append(999)
    pings.sort()
    ping_ms = round(sum(pings[1:-1]) / max(len(pings[1:-1]), 1), 2)
    jitter_ms = round(
        math.sqrt(sum((p - ping_ms) ** 2 for p in pings) / len(pings)), 2
    )

    # Download
    dl_url = f"https://{server_host}/speedtest/random4000x4000.jpg"
    t0 = time.monotonic()
    try:
        dl_resp = await js_fetch(dl_url, method="GET")
        dl_body = await dl_resp.arrayBuffer()
        dl_bytes = dl_body.byteLength
    except Exception:
        dl_bytes = 0
    dl_elapsed = time.monotonic() - t0
    download_mbps = round((dl_bytes * 8) / (dl_elapsed * 1_000_000), 2) if dl_elapsed > 0 else 0

    # Upload
    ul_payload = os.urandom(2 * 1024 * 1024)
    ul_url = f"https://{server_host}/speedtest/upload.php"
    t0 = time.monotonic()
    try:
        ul_resp = await js_fetch(ul_url, method="POST", body=ul_payload)
        await ul_resp.text()
    except Exception:
        pass
    ul_elapsed = time.monotonic() - t0
    upload_mbps = round((len(ul_payload) * 8) / (ul_elapsed * 1_000_000), 2) if ul_elapsed > 0 else 0

    return json_response({
        "stage":    "complete",
        "ping":     ping_ms,
        "jitter":   jitter_ms,
        "download": download_mbps,
        "upload":   upload_mbps,
        "server":   f"{server_info.get('name', '')}, {server_info.get('country', '')}",
        "sponsor":  server_info.get("sponsor", ""),
        "host":     server_host,
        "distance": server_info.get("distance", 0),
    })


# ── Main router ───────────────────────────────────────────────────────────────

async def on_fetch(request, env):
    url    = str(request.url)
    method = str(request.method).upper()
    path   = "/" + "/".join(url.split("//", 1)[-1].split("/")[1:]).split("?")[0]

    # OPTIONS preflight
    if method == "OPTIONS":
        return Response("", status=204, headers=CORS_HEADERS)

    # /ping
    if path in ("/ping", "/api/ping"):
        return await handle_ping(request)

    # /get-ip
    if path == "/get-ip":
        ip = request.headers.get("CF-Connecting-IP") or "Unavailable"
        return json_response({"ip": ip})

    # /get-geoip
    if path == "/get-geoip":
        return json_response(get_geoip_from_cf(request))

    # /get-servers
    if path == "/get-servers":
        params = {}
        if "?" in url:
            for part in url.split("?", 1)[1].split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v
        try:
            user_lat = float(params.get("lat", "0"))
            user_lon = float(params.get("lon", "0"))
        except ValueError:
            cf = request.cf
            try:
                user_lat = float(str(cf.latitude))
                user_lon = float(str(cf.longitude))
            except Exception:
                user_lat, user_lon = 0.0, 0.0

        servers = await fetch_speedtest_servers(user_lat, user_lon)
        return json_response({"servers": servers})

    # /download-test
    if path in ("/download-test", "/api/download-test"):
        return await handle_download_test(request)

    # /upload-test
    if path in ("/upload-test", "/api/upload-test") and method == "POST":
        return await handle_upload_test(request)

    # /run-speedtest
    if path == "/run-speedtest":
        params = {}
        if "?" in url:
            for part in url.split("?", 1)[1].split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v

        server_host = params.get("server_host") or None
        if server_host:
            from urllib.parse import unquote
            server_host = unquote(server_host)

        cf = request.cf
        try:
            user_lat = float(params["lat"]) if "lat" in params else float(str(cf.latitude))
            user_lon = float(params["lon"]) if "lon" in params else float(str(cf.longitude))
        except Exception:
            user_lat, user_lon = 0.0, 0.0

        return await handle_run_speedtest(request, user_lat, user_lon, server_host)

    return error_response(f"Route not found: {path}", 404)
