#!/usr/bin/env python3
"""A roundup reel ("From a post") end to end through the real worker (needs the local stack up and
`.env` pointing at it). Used by the post-to-reel Claude skill and for checking the feature.

  apps/worker/.venv/Scripts/python.exe tools/e2e/roundup_reel.py <post.txt> [--mode voice|presenter]
      [--voice aura-2-thalia-en] [--preset dark-ios] [--cta "Follow for tomorrow's list."] [--out DIR]

Creates a project for tester@rasika.local, enqueues a `compose` job (research → script → narration →
transcribe → plan → render) and follows it to `done`, then saves the 720p and 1080p outputs, the
script and the research summary into --out (default .work-e2e/roundup/<project id>/).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

import psycopg  # noqa: E402
import redis  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("post", type=pathlib.Path)
    ap.add_argument("--mode", choices=["voice", "presenter"], default="voice")
    ap.add_argument("--voice", default="aura-2-thalia-en")
    ap.add_argument("--preset", default="dark-ios")
    ap.add_argument("--cta", default="")
    ap.add_argument("--out", type=pathlib.Path, default=None)
    ap.add_argument("--timeout", type=float, default=1500)
    a = ap.parse_args()
    if a.mode == "presenter":
        print("presenter mode is not wired into roundups yet; use --mode voice")
        return 2
    post = a.post.read_text(encoding="utf-8")
    env = dict(
        line.strip().split("=", 1)
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.startswith("#")
    )
    brief = {"kind": "roundup", "post": post, "voice": a.voice, "mode": a.mode}
    if a.cta:
        brief["cta"] = a.cta
    with psycopg.connect(env["DATABASE_URL"], autocommit=True) as c:
        row = c.execute(
            "select user_id from profiles where email=%s", ("tester@rasika.local",)
        ).fetchone()
        if not row:
            print("no tester@rasika.local profile (run the local seed first)")
            return 1
        uid = str(row[0])
        pid, jid = str(uuid.uuid4()), str(uuid.uuid4())
        opts = {
            "captions": True,
            "sfxIntensity": 0.6,
            "music": False,
            "language": "en",
            "source": "brief",
            "faceless": True,
            "brief": brief,
        }
        c.execute(
            "insert into projects (id,user_id,title,status,style_preset,style_options,brand,duration_sec,credits_cost)"
            " values (%s::uuid,%s::uuid,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)",
            (pid, uid, "", "uploaded", a.preset, json.dumps(opts), json.dumps({}), 60, 1),
        )
        c.execute(
            "insert into jobs (id,project_id,user_id,type,status,message) values (%s::uuid,%s::uuid,%s::uuid,%s,%s,%s)",
            (jid, pid, uid, "compose", "uploaded", "Queued"),
        )
        msg = {
            "v": 1,
            "job_id": jid,
            "project_id": pid,
            "user_id": uid,
            "type": "compose",
            "attempt": 1,
            "payload": {"max_duration_sec": 180},
            "enqueued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        redis.Redis.from_url(env["REDIS_URL"]).lpush(
            env.get("JOB_QUEUE", "rasika:jobs"), json.dumps(msg)
        )
        print("project", pid)
        last, t0, status = None, time.time(), ""
        while time.time() - t0 < a.timeout:
            r = c.execute(
                "select type,status,progress,message,error,timings from jobs where id=%s::uuid", (jid,)
            ).fetchone()
            cur = (r[0], r[1], r[3])
            if cur != last:
                err = f"  ERROR: {r[4]}" if r[4] else ""
                print(f"{time.time() - t0:5.0f}s  {r[0]:16s} {r[1]:22s} {r[2]:3d}  {r[3]}{err}", flush=True)
                last = cur
            status = r[1]
            if status in ("done", "failed", "canceled"):
                t = r[5] or {}
                keep = ("research_sec", "research_media", "write_sec", "plan_sec", "total_render_sec", "elapsed_sec")
                print({k: t[k] for k in keep if k in t})
                break
            time.sleep(4)
        proj = c.execute("select style_options, title from projects where id=%s::uuid", (pid,)).fetchone()
        keys = c.execute(
            "select kind, storage_key from assets where project_id=%s::uuid and kind in ('output_720','output_1080')",
            (pid,),
        ).fetchall()
    out = a.out or (ROOT / ".work-e2e" / "roundup" / pid)
    out.mkdir(parents=True, exist_ok=True)
    film = (proj[0] or {}).get("film") or {}
    (out / "script.json").write_text(
        json.dumps({"title": proj[1], **(film.get("data") or {}).get("roundup", {})}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (out / "research.json").write_text(
        json.dumps(
            {k: (film.get("data") or {}).get(k) for k in ("facts", "problems", "media")},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    if keys:
        from rasika_worker.settings import Settings
        from rasika_worker.storage import Storage

        st = Storage(Settings(_env_file=str(ROOT / ".env")))  # type: ignore[call-arg]
        for kind, key in keys:
            dest = out / f"reel_{kind.split('_')[1]}.mp4"
            st.download(key, dest)
            print("output", dest)
    print("folder", out)
    return 0 if status == "done" else 1


if __name__ == "__main__":
    raise SystemExit(main())
