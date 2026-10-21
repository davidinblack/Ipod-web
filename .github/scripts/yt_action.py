#!/usr/bin/env python3
"""
Paso del workflow "Descargar de YouTube".

1. Descarga y convierte con la misma lógica que server/server.py.
2. Publica <id>.mp3 y <id>.json en la rama "descargas". La rama se reescribe
   en un solo commit cada vez y se borran los archivos de más de 24 h, para que
   las canciones no se acumulen en el historial del repositorio público.

Variables: YT_URL, REQ_ID, YT_COOKIES (secreto opcional con un cookies.txt).
"""
import glob
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BRANCH = "descargas"
KEEP_SECONDS = 24 * 3600
MAX_BYTES = 95 * 1024 * 1024  # GitHub rechaza archivos de más de 100 MB

url = os.environ.get("YT_URL", "").strip()
req_id = os.environ.get("REQ_ID", "").strip() or "manual"
if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", req_id):
    sys.exit("REQ_ID inválido")

# --- configuración del motor antes de importarlo
os.environ.setdefault("IPOD_MAX_DURATION", "4200")  # 70 min → el MP3 cabe en GitHub
os.environ.setdefault("IPOD_QUALITY", "160")
cookies = os.environ.get("YT_COOKIES", "")
if cookies.strip():
    path = os.path.join(tempfile.mkdtemp(), "cookies.txt")
    with open(path, "w") as f:
        f.write(cookies if cookies.endswith("\n") else cookies + "\n")
    os.environ["IPOD_COOKIES"] = path
    print("Usando cookies de YouTube (secreto YT_COOKIES)")

sys.path.insert(0, os.path.join(ROOT, "server"))
import server  # noqa: E402

meta = {"id": req_id, "url": url, "created": int(time.time()), "status": "error",
        "title": None, "filename": None, "error": None, "cover": False}
mp3 = None
cover = None

if not server.YT_RE.match(url):
    meta["error"] = "Sólo se aceptan enlaces de YouTube"
elif not server.HAS_FFMPEG:
    meta["error"] = "Falta ffmpeg en el runner"
else:
    job = {"id": req_id, "url": url, "status": "working", "stage": "queued", "progress": 0,
           "title": None, "error": None, "created": time.time()}
    server.run_job(job)
    meta.update(title=job.get("title"), error=job.get("error"))
    if job["status"] == "done":
        size = os.path.getsize(job["file"])
        if size > MAX_BYTES:
            meta["error"] = "El audio es demasiado grande para GitHub (máx. ~95 MB)"
        else:
            mp3 = job["file"]
            cover = job.get("cover")
            meta.update(status="done", filename=job["filename"], size=size, cover=bool(cover))

if meta["error"] and "Sign in to confirm" in meta["error"]:
    meta["error"] = "YouTube bloqueó a GitHub. Agrega el secreto YT_COOKIES (ver README)."

print(json.dumps(meta, ensure_ascii=False, indent=2))


# --- publicar en la rama "descargas"

def git(*args, env=None, cwd=ROOT, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r


README = """# Rama de descargas

La usa la app iPod Web para recoger los MP3 que convierte el workflow
"Descargar de YouTube". Se reescribe sola y borra lo que tenga más de 24 h.
No guardes nada aquí.
"""


def publish():
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    for attempt in range(8):
        remote = git("ls-remote", "origin", f"refs/heads/{BRANCH}").stdout.split()
        old = remote[0] if remote else ""
        pub = tempfile.mkdtemp()
        if old:
            git("fetch", "--depth=1", "origin", f"refs/heads/{BRANCH}")
            tar = subprocess.run(["git", "archive", "FETCH_HEAD"], cwd=ROOT, capture_output=True, check=True)
            subprocess.run(["tar", "-x", "-C", pub], input=tar.stdout, check=True)

        now = time.time()
        for j in glob.glob(os.path.join(pub, "*.json")):
            try:
                created = json.load(open(j)).get("created", 0)
            except (OSError, ValueError):
                created = 0
            if now - created > KEEP_SECONDS:
                base = j[:-5]
                for f in (j, base + ".mp3", base + ".jpg"):
                    if os.path.exists(f):
                        os.remove(f)

        if mp3:
            shutil.copy(mp3, os.path.join(pub, f"{req_id}.mp3"))
        if cover:
            shutil.copy(cover, os.path.join(pub, f"{req_id}.jpg"))
        with open(os.path.join(pub, f"{req_id}.json"), "w") as f:
            json.dump(meta, f, ensure_ascii=False)
        with open(os.path.join(pub, "README.md"), "w") as f:
            f.write(README)

        env = {**os.environ, "GIT_DIR": os.path.join(ROOT, ".git"), "GIT_WORK_TREE": pub,
               "GIT_INDEX_FILE": os.path.join(tempfile.mkdtemp(), "index")}
        git("add", "-A", ".", env=env, cwd=pub)
        tree = git("write-tree", env=env, cwd=pub).stdout.strip()
        commit = git("commit-tree", tree, "-m", f"descarga {req_id}", env=env, cwd=pub).stdout.strip()
        r = git("push", f"--force-with-lease=refs/heads/{BRANCH}:{old}", "origin",
                f"{commit}:refs/heads/{BRANCH}", check=False)
        shutil.rmtree(pub, ignore_errors=True)
        if r.returncode == 0:
            print(f"Publicado en la rama {BRANCH}")
            return
        print(f"Otra descarga publicó al mismo tiempo; reintento ({attempt + 1})…")
        time.sleep(2 + random.random() * 4)
    raise SystemExit("No se pudo publicar en la rama descargas")


publish()
if meta["status"] != "done":
    sys.exit(f"Error: {meta['error']}")
