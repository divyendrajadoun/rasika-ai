#!/usr/bin/env python3
"""End-to-end check of reference matching through the real worker (stack up, `.env` present).

  apps/worker/.venv/Scripts/python.exe tools/e2e/reference_reel.py <take.mp4> <reference.mp4> [preset] [fidelity]

Uploads both clips as the tester's project assets, enqueues `probe`, and follows the chain
probe → transcribe → analyse_reference → plan → render to `done`.
"""
from __future__ import annotations

import json
import pathlib
import sys
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

import psycopg  # noqa: E402
import redis  # noqa: E402

from rasika_worker.settings import Settings  # noqa: E402
from rasika_worker.storage import Storage  # noqa: E402


def main() -> int:
    take, ref = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    preset = sys.argv[3] if len(sys.argv) > 3 else "noir-minimal"
    fidelity = sys.argv[4] if len(sys.argv) > 4 else "look"
    env = dict(
        line.strip().split("=", 1)
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.startswith("#")
    )
    st = Storage(Settings())
    with psycopg.connect(env["DATABASE_URL"], autocommit=True) as c:
        uid = str(c.execute("select user_id from profiles where email=%s", ("tester@rasika.local",)).fetchone()[0])
        pid, jid = str(uuid.uuid4()), str(uuid.uuid4())
        prefix = f"u/{uid}/p/{pid}"
        c.execute(
            "insert into projects (id,user_id,title,status,style_preset,style_options,brand,duration_sec,credits_cost)"
            " values (%s::uuid,%s::uuid,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)",
            (pid, uid, f"E2E reference · {preset} · {fidelity}", "uploaded", preset,
             json.dumps({"captions": True, "sfxIntensity": 0.6, "music": False, "language": "auto",
                         "source": "reference", "fidelity": fidelity}),
             json.dumps({"name": "Baisa Bling", "handle": "@baisabling"}), 12, 1),
        )
        keys = {}
        for kind, path, name in (("source_video", take, "source.mp4"), ("reference_video", ref, "reference.mp4")):
            key = f"{prefix}/{name}"
            size = st.upload(path, key, "video/mp4")
            c.execute(
                "insert into assets (id,project_id,user_id,kind,storage_key,filename,mime,size_bytes,meta)"
                " values (%s::uuid,%s::uuid,%s::uuid,%s,%s,%s,%s,%s,%s::jsonb)",
                (str(uuid.uuid4()), pid, uid, kind, key, path.name, "video/mp4", size, "{}"),
            )
            keys[kind] = key
        c.execute(
            "insert into jobs (id,project_id,user_id,type,status,message) values (%s::uuid,%s::uuid,%s::uuid,%s,%s,%s)",
            (jid, pid, uid, "probe", "uploaded", "Queued"),
        )
        msg = {"v": 1, "job_id": jid, "project_id": pid, "user_id": uid, "type": "probe", "attempt": 1,
               "payload": {"source_key": keys["source_video"], "language_hint": "auto", "max_duration_sec": 180},
               "enqueued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        redis.Redis.from_url(env["REDIS_URL"]).lpush(env.get("JOB_QUEUE", "rasika:jobs"), json.dumps(msg))
        print("project", pid)
        last, t0 = None, time.time()
        while time.time() - t0 < 600:
            r = c.execute("select type,status,progress,message,error,timings from jobs where id=%s::uuid", (jid,)).fetchone()
            cur = (r[0], r[1], r[3])
            if cur != last:
                print(f"{time.time() - t0:5.0f}s  {r[0]:18s} {r[1]:22s} {r[2]:3d}  {r[3]}" + (f"  ERROR: {r[4]}" if r[4] else ""))
                last = cur
            if r[1] in ("done", "failed", "canceled"):
                t = r[5] or {}
                print({k: t[k] for k in t if k.startswith("reference") or k in ("plan_sec", "total_render_sec")})
                break
            time.sleep(4)
        opts = c.execute("select style_options from projects where id=%s::uuid", (pid,)).fetchone()[0]
        rs = opts.get("referenceStyle") or {}
        print("referenceStyle:", rs.get("name"), rs.get("palette"), (rs.get("motion") or {}).get("family"),
              (rs.get("motion") or {}).get("enter"), (rs.get("motion") or {}).get("camera"))
        key = c.execute("select storage_key from assets where project_id=%s::uuid and kind='output_720'", (pid,)).fetchone()
    if key:
        out = ROOT / ".work-e2e" / f"reference_{preset}_{fidelity}.mp4"
        out.parent.mkdir(exist_ok=True)
        st.download(key[0], out)
        print("output", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
