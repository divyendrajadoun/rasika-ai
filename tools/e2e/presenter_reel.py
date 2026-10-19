#!/usr/bin/env python3
"""End-to-end AI presenter reel through the real worker (PAID: spends the HeyGen wallet).

  apps/worker/.venv/Scripts/python.exe tools/e2e/presenter_reel.py <look_id> <voice_id> [preset]

Creates a project for tester@rasika.local with a short script, enqueues `presenter`, follows the
chain to `done`, prints the HeyGen cost the job recorded, and downloads the 720p output.
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

SCRIPT = (
    "Most people buy jewellery for the wrong reason. They buy the shine. "
    "The shine is gone in a month, and what is left is the weight on your neck."
)


def main() -> int:
    look_id, voice_id = sys.argv[1], sys.argv[2]
    preset = sys.argv[3] if len(sys.argv) > 3 else "cinema-navy"
    env = dict(
        line.strip().split("=", 1)
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.startswith("#")
    )
    with psycopg.connect(env["DATABASE_URL"], autocommit=True) as c:
        uid = str(c.execute("select user_id from profiles where email=%s", ("tester@rasika.local",)).fetchone()[0])
        pid, jid = str(uuid.uuid4()), str(uuid.uuid4())
        c.execute(
            "insert into projects (id,user_id,title,status,style_preset,style_options,brand,duration_sec,credits_cost)"
            " values (%s::uuid,%s::uuid,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)",
            (pid, uid, f"E2E presenter · {preset}", "uploaded", preset,
             json.dumps({"captions": True, "sfxIntensity": 0.6, "music": False, "language": "en",
                         "source": "presenter", "presenterVoice": voice_id, "presenterLook": look_id}),
             json.dumps({"name": "Baisa Bling", "handle": "@baisabling"}), 15, 1),
        )
        c.execute(
            "insert into jobs (id,project_id,user_id,type,status,message) values (%s::uuid,%s::uuid,%s::uuid,%s,%s,%s)",
            (jid, pid, uid, "presenter", "uploaded", "Queued"),
        )
        msg = {"v": 1, "job_id": jid, "project_id": pid, "user_id": uid, "type": "presenter", "attempt": 1,
               "payload": {"script": SCRIPT, "voice_id": voice_id, "look_id": look_id, "language_hint": "en",
                           "max_duration_sec": 180},
               "enqueued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        redis.Redis.from_url(env["REDIS_URL"]).lpush(env.get("JOB_QUEUE", "rasika:jobs"), json.dumps(msg))
        print("project", pid)
        last, t0 = None, time.time()
        while time.time() - t0 < 1500:
            r = c.execute("select type,status,progress,message,error,timings from jobs where id=%s::uuid", (jid,)).fetchone()
            cur = (r[0], r[1], r[3])
            if cur != last and "Rendering frame" not in (r[3] or ""):
                print(f"{time.time() - t0:5.0f}s  {r[0]:14s} {r[1]:22s} {r[2]:3d}  {r[3]}" + (f"  ERROR: {r[4]}" if r[4] else ""))
                last = cur
            if r[1] in ("done", "failed", "canceled"):
                t = r[5] or {}
                print({k: t[k] for k in t if k.startswith("heygen") or k.startswith("presenter") or k in ("plan_sec", "total_render_sec")})
                break
            time.sleep(6)
        key = c.execute("select storage_key from assets where project_id=%s::uuid and kind='output_720'", (pid,)).fetchone()
    if key:
        from rasika_worker.settings import Settings
        from rasika_worker.storage import Storage

        out = ROOT / ".work-e2e" / f"presenter_{preset}.mp4"
        out.parent.mkdir(exist_ok=True)
        Storage(Settings()).download(key[0], out)
        print("output", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
