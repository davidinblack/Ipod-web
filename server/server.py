#!/usr/bin/env python3
"""
iPod Web — servidor

1. Sirve la app web (carpeta ../web) sin caché, para que cada cambio llegue
   al teléfono la próxima vez que se abra la app.
2. API para convertir un enlace de YouTube en MP3 con título, artista y portada
   (usa yt-dlp + ffmpeg).

Uso:
    pip install -U yt-dlp
    python server.py

Variables de entorno opcionales:
    IPOD_PORT   puerto (8787)
    IPOD_HOST   interfaz (0.0.0.0)
    IPOD_TOKEN  clave que la app debe enviar en el encabezado X-Token
    IPOD_ORIGIN origen permitido por CORS (* por defecto)
    IPOD_WEB    carpeta de la app web (../web)
    IPOD_MAX_DURATION  duración máxima en segundos (10800)
    IPOD_COOKIES       ruta a un cookies.txt de YouTube (opcional)
    IPOD_QUALITY       kbps del MP3 (192)
"""
import hmac
import json
import os
import re
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, urlparse

try:
    import yt_dlp
except ImportError:
    raise SystemExit("Falta yt-dlp. Instálalo con:  pip install -U yt-dlp")

VERSION = "1.0.0"
HOST = os.environ.get("IPOD_HOST", "0.0.0.0")
PORT = int(os.environ.get("IPOD_PORT", "8787"))
TOKEN = os.environ.get("IPOD_TOKEN", "")
ORIGIN = os.environ.get("IPOD_ORIGIN", "*")
HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.abspath(os.environ.get("IPOD_WEB", os.path.join(HERE, "..", "web")))
WORK_DIR = tempfile.mkdtemp(prefix="ipod-dl-")
JOB_TTL = 3600            # se borran los trabajos terminados después de 1 h
MAX_DURATION = int(os.environ.get("IPOD_MAX_DURATION", 3 * 3600))  # segundos
COOKIES = os.environ.get("IPOD_COOKIES", "")  # cookies.txt opcional (si YouTube pide "no soy un bot")
QUALITY = os.environ.get("IPOD_QUALITY", "192")

YT_RE = re.compile(r"^https?://(?:[\w-]+\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/", re.I)
ID_RE = re.compile(r"^[0-9a-f]{32}$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")

JOBS = {}
JOBS_LOCK = threading.Lock()
SLOTS = threading.Semaphore(2)  # descargas simultáneas
HAS_FFMPEG = shutil.which("ffmpeg") is not None


# ------------------------------------------------------------------ descargas

def public(job):
    out = {k: job.get(k) for k in ("id", "status", "stage", "progress", "title", "error")}
    out["cover"] = bool(job.get("cover"))
    return out


def square_cover(src, out):
    """Recorta la miniatura (16:9) a un cuadrado centrado de máx. 800 px, como portada de disco."""
    dst = os.path.join(out, "portada.jpg")
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vf",
                        "crop='min(iw,ih)':'min(iw,ih)',scale='min(800,iw)':-1", "-q:v", "3", dst],
                       capture_output=True)
    return dst if r.returncode == 0 and os.path.exists(dst) else None


def embed_cover(mp3, jpg):
    """Incrusta la portada en el MP3 (ID3v2.3, tipo «portada frontal»)."""
    tmp = mp3 + ".tmp.mp3"
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", mp3, "-i", jpg,
                        "-map", "0:a", "-map", "1:v", "-c", "copy", "-id3v2_version", "3",
                        "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)",
                        tmp], capture_output=True)
    if r.returncode == 0:
        os.replace(tmp, mp3)
    elif os.path.exists(tmp):
        os.remove(tmp)


def run_job(job):
    out = os.path.join(WORK_DIR, job["id"])
    os.makedirs(out, exist_ok=True)

    def on_progress(d):
        info = d.get("info_dict") or {}
        if info.get("title"):
            job["title"] = info["title"]
        if d.get("status") == "downloading":
            job["stage"] = "downloading"
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            if total:
                job["progress"] = round(min(d.get("downloaded_bytes", 0) / total, 1.0) * 85, 1)
        elif d.get("status") == "finished":
            job["stage"] = "converting"
            job["progress"] = max(job["progress"], 85)

    def on_postprocess(d):
        if d.get("status") == "started":
            job["stage"] = "converting"
            job["progress"] = min(98, job["progress"] + 3)

    opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(out, "%(title).150B.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "windowsfilenames": True,
        "writethumbnail": True,
        "match_filter": yt_dlp.utils.match_filter_func(f"!is_live & duration <? {MAX_DURATION}"),
        "progress_hooks": [on_progress],
        "postprocessor_hooks": [on_postprocess],
        "postprocessors": [
            {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"},
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": QUALITY},
            {"key": "FFmpegMetadata", "add_metadata": True, "add_chapters": False},
        ],
        **({"cookiefile": COOKIES} if COOKIES and os.path.exists(COOKIES) else {}),
    }

    try:
        with SLOTS:
            job["stage"] = "downloading"
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(job["url"], download=True) or {}
        mp3s = [f for f in os.listdir(out) if f.lower().endswith(".mp3")]
        if not mp3s:
            raise RuntimeError("No se generó el audio (¿video en vivo, privado o demasiado largo?)")
        jpgs = [f for f in os.listdir(out) if f.lower().endswith((".jpg", ".jpeg"))]
        if jpgs:
            job["stage"] = "converting"
            square = square_cover(os.path.join(out, jpgs[0]), out)
            if square:
                embed_cover(os.path.join(out, mp3s[0]), square)
                jpgs = [os.path.basename(square)]
        job.update(
            file=os.path.join(out, mp3s[0]), filename=mp3s[0],
            cover=os.path.join(out, jpgs[0]) if jpgs else None,
            title=info.get("title") or job.get("title"),
            status="done", stage="done", progress=100,
        )
    except Exception as e:  # noqa: BLE001
        msg = ANSI_RE.sub("", str(e)).replace("ERROR: ", "").strip()
        job.update(status="error", stage="error", error=msg[:300] or "Error desconocido")
        shutil.rmtree(out, ignore_errors=True)
    job["finished"] = time.time()


def janitor():
    while True:
        time.sleep(300)
        now = time.time()
        with JOBS_LOCK:
            old = [j for j in JOBS.values() if j.get("finished") and now - j["finished"] > JOB_TTL]
            for j in old:
                JOBS.pop(j["id"], None)
        for j in old:
            shutil.rmtree(os.path.join(WORK_DIR, j["id"]), ignore_errors=True)


def remove_job(job_id):
    with JOBS_LOCK:
        JOBS.pop(job_id, None)
    shutil.rmtree(os.path.join(WORK_DIR, job_id), ignore_errors=True)


# ------------------------------------------------------------------ HTTP

class Handler(SimpleHTTPRequestHandler):
    server_version = f"iPodWeb/{VERSION}"
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".json": "application/json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    # --- utilidades
    @property
    def route(self):
        return urlparse(self.path).path

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Expose-Headers", "Content-Disposition")
        if ORIGIN != "*":
            self.send_header("Vary", "Origin")
        if not self.route.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if not TOKEN:
            return True
        given = self.headers.get("X-Token", "")
        return hmac.compare_digest(given.encode(), TOKEN.encode())

    def get_job(self, job_id):
        if not ID_RE.match(job_id):
            return None
        with JOBS_LOCK:
            return JOBS.get(job_id)

    def log_message(self, fmt, *args):
        if self.route.startswith("/api/"):
            super().log_message(fmt, *args)

    # --- métodos
    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.route.startswith("/api/"):
            return super().do_GET()
        if not self.authorized():
            return self.send_json(401, {"error": "Clave incorrecta"})
        parts = self.route.strip("/").split("/")  # api, jobs, <id>, file

        if parts == ["api", "health"]:
            return self.send_json(200, {"ok": True, "version": VERSION,
                                        "ytdlp": yt_dlp.version.__version__, "ffmpeg": HAS_FFMPEG})

        if len(parts) >= 3 and parts[1] == "jobs":
            job = self.get_job(parts[2])
            if not job:
                return self.send_json(404, {"error": "Trabajo no encontrado"})
            if len(parts) == 3:
                return self.send_json(200, public(job))
            if len(parts) == 4 and parts[3] == "file":
                if job["status"] != "done" or not os.path.exists(job.get("file", "")):
                    return self.send_json(409, {"error": "Aún no está listo"})
                return self.send_file(job)
            if len(parts) == 4 and parts[3] == "cover":
                cover = job.get("cover")
                if not cover or not os.path.exists(cover):
                    return self.send_json(404, {"error": "Sin imagen"})
                with open(cover, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return None
        return self.send_json(404, {"error": "No encontrado"})

    def send_file(self, job):
        path, name = job["file"], job["filename"]
        ascii_name = name.encode("ascii", "replace").decode().replace("?", "_").replace('"', "")
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(os.path.getsize(path)))
        self.send_header("Content-Disposition",
                         f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        with open(path, "rb") as f:
            shutil.copyfileobj(f, self.wfile)
        # se conserva un rato por si la app reintenta, luego se borra
        threading.Timer(120, remove_job, args=(job["id"],)).start()

    def do_POST(self):
        if self.route != "/api/jobs":
            return self.send_json(404, {"error": "No encontrado"})
        if not self.authorized():
            return self.send_json(401, {"error": "Clave incorrecta"})
        if not HAS_FFMPEG:
            return self.send_json(500, {"error": "Falta ffmpeg en el servidor"})
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 4096)
            url = str(json.loads(self.rfile.read(length) or b"{}").get("url", "")).strip()
        except (ValueError, json.JSONDecodeError):
            return self.send_json(400, {"error": "Petición inválida"})
        if not YT_RE.match(url):
            return self.send_json(400, {"error": "Sólo se aceptan enlaces de YouTube"})

        job = {"id": uuid.uuid4().hex, "url": url, "status": "working", "stage": "queued",
               "progress": 0, "title": None, "error": None, "created": time.time()}
        with JOBS_LOCK:
            JOBS[job["id"]] = job
        threading.Thread(target=run_job, args=(job,), daemon=True).start()
        return self.send_json(202, {"id": job["id"]})

    def do_DELETE(self):
        parts = self.route.strip("/").split("/")
        if not self.authorized():
            return self.send_json(401, {"error": "Clave incorrecta"})
        if len(parts) == 3 and parts[:2] == ["api", "jobs"] and self.get_job(parts[2]):
            job = self.get_job(parts[2])
            if job["status"] != "working":
                remove_job(parts[2])
            return self.send_json(200, {"ok": True})
        return self.send_json(404, {"error": "No encontrado"})


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main():
    if not HAS_FFMPEG:
        print("⚠  No se encontró ffmpeg: las descargas fallarán hasta que lo instales.")
    if not os.path.isdir(WEB_DIR):
        print(f"⚠  No existe {WEB_DIR}: sólo funcionará la API.")
    threading.Thread(target=janitor, daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"iPod Web {VERSION}  ·  yt-dlp {yt_dlp.version.__version__}")
    print(f"  En este equipo:  http://localhost:{PORT}")
    print(f"  En tu red:       http://{lan_ip()}:{PORT}")
    if TOKEN:
        print("  Clave activada (IPOD_TOKEN)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        shutil.rmtree(WORK_DIR, ignore_errors=True)


if __name__ == "__main__":
    main()
