#!/usr/bin/env python3
"""End-to-end check of a many-clips reel through the real worker (needs the stack up and `.env`).

  apps/worker/.venv/Scripts/python.exe tools/e2e/clips_reel.py <clips dir> [script.txt] [preset]

Uploads every *.mp4 in the folder (sorted by name = recording order) as the project's clips for
tester@rasika.local, enqueues an `assemble` job and follows it through probe → transcribe → clean
cut → plan → render to `done`. Prints what became of each clip, then joins them again in the
reverse of that order (the clips panel's "Join again") and follows that run too.
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


def follow(c: psycopg.Connection, jid: str, limit: float = 900) -> str:
    last, t0 = None, time.time()
    while time.time() - t0 < limit:
        r = c.execute(
            "select type,status,progress,message,error from jobs where id=%s::uuid", (jid,)
        ).fetchone()
        cur = (r[0], r[1], r[3])
        if cur != last:
            print(f"{time.time() - t0:5.0f}s  {r[0]:15s} {r[1]:20s} {r[2]:3d}  {r[3]}" + (f"  ERROR: {r[4]}" if r[4] else ""))
            last = cur
        if r[1] in ("done", "failed", "canceled"):
            return str(r[1])
        time.sleep(3)
    return "timeout"


def arrangement(c: psycopg.Connection, pid: str) -> list[dict]:
    row = c.execute(
        "select meta from assets where project_id=%s::uuid and kind='source_video' and meta ? 'assembled'",
        (pid,),
    ).fetchone()
    if not row:
        print("no joined take")
        return []
    meta = row[0]
    print(f"joined by {meta.get('arrangedBy')}: {meta.get('durationSec')} s")
    for d in meta["arrangement"]:
        mark = "keep" if d["keep"] else f"out ({d['why']})"
        print(f"  {d['name']:8s} {mark:32s} {d['start']:5.2f}-{d['end']:5.2f}  {d['text'][:60]}")
    return list(meta["arrangement"])


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    folder = pathlib.Path(sys.argv[1])
    script = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8") if len(sys.argv) > 2 and sys.argv[2] != "-" else ""
    preset = sys.argv[3] if len(sys.argv) > 3 else "ghost-clean"
    files = sorted(folder.glob("c*.mp4"))
    if not files:
        print("no clips in", folder)
        return 1
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
                "source": "clips", "cleanCut": True}
        if script:
            opts["clipScript"] = script
        c.execute(
            "insert into projects (id,user_id,title,status,style_preset,style_options,brand,duration_sec,credits_cost)"
            " values (%s::uuid,%s::uuid,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)",
            (pid, uid, f"E2E clips reel · {'script' if script else 'no script'}", "uploaded", preset,
             json.dumps(opts), json.dumps({"name": "Rasika", "handle": "@rasika"}), 30, 1),
        )
        for n, f in enumerate(files):
            info = media.probe(s.ffprobe_bin, f)
            aid = str(uuid.uuid4())
            key = f"u/{uid}/p/{pid}/clips/{aid}.mp4"
            size = storage.upload(f, key, "video/mp4")
            c.execute(
                "insert into assets (id,project_id,user_id,kind,storage_key,filename,mime,size_bytes,meta)"
                " values (%s::uuid,%s::uuid,%s::uuid,'source_clip',%s,%s,'video/mp4',%s,%s::jsonb)",
                (aid, pid, uid, key, f.name, size, json.dumps({"durationSec": info.duration_sec, "order": n})),
            )
        print("project", pid, "·", len(files), "clips")

        def run(payload: dict) -> str:
            jid = str(uuid.uuid4())
            c.execute(
                "insert into jobs (id,project_id,user_id,type,status,message) values (%s::uuid,%s::uuid,%s::uuid,'assemble','uploaded','Queued')",
                (jid, pid, uid),
            )
            msg = {"v": 1, "job_id": jid, "project_id": pid, "user_id": uid, "type": "assemble", "attempt": 1,
                   "payload": {"language_hint": "en", "max_duration_sec": 180, **payload},
                   "enqueued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            r.lpush(queue, json.dumps(msg))
            return follow(c, jid)

        status = run({})
        kept = [d["id"] for d in arrangement(c, pid) if d["keep"]]
        if status != "done" or not kept:
            return 1
        out = ROOT / ".work-e2e" / f"clips_{pid[:8]}.mp4"
        out.parent.mkdir(exist_ok=True)
        key = c.execute("select storage_key from assets where project_id=%s::uuid and kind='output_720'", (pid,)).fetchone()
        if key:
            storage.download(key[0], out)
            print("output", out)

        print("\njoin again, reversed:", list(reversed(kept)))
        status = run({"order": list(reversed(kept))})
        arrangement(c, pid)
        return 0 if status == "done" else 1


if __name__ == "__main__":
    raise SystemExit(main())
