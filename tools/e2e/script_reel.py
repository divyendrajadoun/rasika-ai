#!/usr/bin/env python3
"""End-to-end check of a script-only reel through the real worker (needs the stack up and `.env`).

  apps/worker/.venv/Scripts/python.exe tools/e2e/script_reel.py [preset] [voice] [broll]

Creates a project for tester@rasika.local, enqueues a `synth` job and follows it to `done`, then
downloads the 720p output next to this file's scratch folder and prints the timings.
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
    "Most people buy jewellery for the wrong reason.\n\n"
    "They buy the shine. The shine is gone in a month, and what is left is the weight on your neck.\n\n"
    "Two thousand years ago, India had a word for this: ras. The taste that stays after the sparkle is gone.\n\n"
    "So here is the only question that matters. Will you still want to wear it in ten years?"
)


def main() -> int:
    preset = sys.argv[1] if len(sys.argv) > 1 else "paper-manuscript"
    voice = sys.argv[2] if len(sys.argv) > 2 else "aura-2-athena-en"
    broll = len(sys.argv) > 3 and sys.argv[3] == "broll"
    env = dict(
        line.strip().split("=", 1)
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.startswith("#")
    )
    with psycopg.connect(env["DATABASE_URL"], autocommit=True) as c:
        row = c.execute("select user_id from profiles where email=%s", ("tester@rasika.local",)).fetchone()
        if not row:
            print("no tester@rasika.local profile")
            return 1
        uid = str(row[0])
        pid, jid = str(uuid.uuid4()), str(uuid.uuid4())
        c.execute(
            "insert into projects (id,user_id,title,status,style_preset,style_options,brand,duration_sec,credits_cost)"
            " values (%s::uuid,%s::uuid,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)",
            (pid, uid, f"E2E script reel · {preset}", "uploaded", preset,
             json.dumps({"captions": True, "sfxIntensity": 0.6, "music": False, "language": "en",
                         "source": "script", "faceless": True, "voice": voice, "broll": broll}),
             json.dumps({"name": "Baisa Bling", "handle": "@baisabling"}), 30, 1),
        )
        c.execute(
            "insert into jobs (id,project_id,user_id,type,status,message) values (%s::uuid,%s::uuid,%s::uuid,%s,%s,%s)",
            (jid, pid, uid, "synth", "uploaded", "Queued"),
        )
        msg = {"v": 1, "job_id": jid, "project_id": pid, "user_id": uid, "type": "synth", "attempt": 1,
               "payload": {"script": SCRIPT, "voice": voice, "language_hint": "en", "max_duration_sec": 180},
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
                print({k: t[k] for k in ("tts_sec", "narration_sec", "plan_sec", "total_render_sec", "elapsed_sec") if k in t})
                break
            time.sleep(4)
        key = c.execute("select storage_key from assets where project_id=%s::uuid and kind='output_720'", (pid,)).fetchone()
    if key:
        from rasika_worker.settings import Settings
        from rasika_worker.storage import Storage

        out = ROOT / ".work-e2e" / f"script_{preset}.mp4"
        out.parent.mkdir(exist_ok=True)
        Storage(Settings()).download(key[0], out)
        print("output", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
