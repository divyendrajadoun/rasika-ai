#!/usr/bin/env python3
"""End-to-end check of "One messy video" through the real worker (needs the stack up and `.env`).

  apps/worker/.venv/Scripts/python.exe tools/e2e/messy_reel.py <video.mp4> [preset] [script.txt]

Uploads the one video as the project's clip for tester@rasika.local (style options as the wizard
sends them), enqueues `assemble` and follows it to the shot check: prints every shot, kept or left
out and why. Then does what "Make my reel" does with the worker's own order (the style picked,
`reviewed`, a probe of the joined take) and follows that to `done`; the reel lands next to the
video as reel_1080.mp4.
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

STOP = ("done", "failed", "canceled", "awaiting_shot_review")


def follow(c: psycopg.Connection, jid: str, limit: float = 1200) -> str:
    last, t0 = None, time.time()
    while time.time() - t0 < limit:
        r = c.execute(
            "select type,status,progress,message,error from jobs where id=%s::uuid", (jid,)
        ).fetchone()
        cur = (r[0], r[1], r[3])
        if cur != last:
            print(f"{time.time() - t0:5.0f}s  {r[0]:10s} {r[1]:22s} {r[2]:3d}  {r[3]}" + (f"  ERROR: {r[4]}" if r[4] else ""))
            last = cur
        if r[1] in STOP:
            return str(r[1])
        time.sleep(2)
    return "timeout"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    video = pathlib.Path(sys.argv[1]).resolve()
    preset = sys.argv[2] if len(sys.argv) > 2 else "ghost-clean"
    script = pathlib.Path(sys.argv[3]).read_text(encoding="utf-8") if len(sys.argv) > 3 else ""
    env = dict(
        line.strip().split("=", 1)
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.startswith("#")
    )
    from rasika_worker import media
    from rasika_worker.settings import Settings
    from rasika_worker.storage import Storage

    s = Settings()
    storage = Storage(s)
    queue = env.get("JOB_QUEUE", "rasika:jobs")
    r = redis.Redis.from_url(env["REDIS_URL"])
    with psycopg.connect(env["DATABASE_URL"], autocommit=True) as c:
        row = c.execute("select user_id from profiles where email=%s", ("tester@rasika.local",)).fetchone()
        if not row:
            print("no tester@rasika.local profile")
            return 1
        uid = str(row[0])
        pid = str(uuid.uuid4())
        opts = {"captions": True, "sfxIntensity": 0.6, "music": False, "language": "en",
                "source": "clips", "cleanCut": True, "messy": True}
        if script:
            opts["clipScript"] = script
        c.execute(
            "insert into projects (id,user_id,title,status,style_preset,style_options,brand,duration_sec,credits_cost)"
            " values (%s::uuid,%s::uuid,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)",
            (pid, uid, "E2E one messy video", "uploaded", "mikku-royal", json.dumps(opts),
             json.dumps({"name": "Rasika", "handle": "@rasika"}), 30, 1),
        )
        info = media.probe(s.ffprobe_bin, video)
        aid = str(uuid.uuid4())
        key = f"u/{uid}/p/{pid}/clips/{aid}.mp4"
        size = storage.upload(video, key, "video/mp4")
        c.execute(
            "insert into assets (id,project_id,user_id,kind,storage_key,filename,mime,size_bytes,meta)"
            " values (%s::uuid,%s::uuid,%s::uuid,'source_clip',%s,%s,'video/mp4',%s,%s::jsonb)",
            (aid, pid, uid, key, video.name, size, json.dumps({"durationSec": info.duration_sec, "order": 0})),
        )
        print("project", pid, f"· {info.duration_sec:.1f} s")

        def push(jtype: str, payload: dict) -> str:
            jid = str(uuid.uuid4())
            c.execute(
                "insert into jobs (id,project_id,user_id,type,status,message) values (%s::uuid,%s::uuid,%s::uuid,%s,'uploaded','Queued')",
                (jid, pid, uid, jtype),
            )
            msg = {"v": 1, "job_id": jid, "project_id": pid, "user_id": uid, "type": jtype, "attempt": 1,
                   "payload": {"language_hint": "en", "max_duration_sec": 180, **payload},
                   "enqueued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            r.lpush(queue, json.dumps(msg))
            return follow(c, jid)

        status = push("assemble", {})
        if status != "awaiting_shot_review":
            return 1
        joined = c.execute(
            "select storage_key, meta from assets where project_id=%s::uuid and kind='source_video' and meta ? 'assembled'",
            (pid,),
        ).fetchone()
        looks = {
            str(i): m.get("look") or {}
            for i, m in c.execute(
                "select id, meta from assets where project_id=%s::uuid and kind='source_clip'", (pid,)
            ).fetchall()
        }
        meta = joined[1]
        print(f"\nordered by {meta.get('arrangedBy')}: {meta.get('durationSec'):.1f} s kept")
        for d in meta["arrangement"]:
            mark = "keep" if d["keep"] else f"out: {d['why']}"
            flags = ",".join(looks.get(d["id"], {}).get("flags") or [])
            print(f"  {d['name']:8s} {mark:40s} {d['duration']:5.2f}s {flags:12s} {d['text'][:70]}")

        print("\nMake my reel with", preset)
        c.execute(
            "update projects set style_preset=%s, style_options = style_options || %s::jsonb where id=%s::uuid",
            (preset, json.dumps({"reviewed": True}), pid),
        )
        status = push("probe", {"source_key": joined[0]})
        if status != "done":
            return 1
        out = video.parent / "reel_1080.mp4"
        k = c.execute("select storage_key from assets where project_id=%s::uuid and kind='output_1080'", (pid,)).fetchone()
        if k:
            storage.download(k[0], out)
            print("output", out)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
