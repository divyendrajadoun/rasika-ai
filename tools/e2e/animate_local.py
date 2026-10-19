"""An /animate film end to end, in-process: references + idea → style bible, shots, code, checks,
critique → plan → render. The same code the worker's compose / plan / render steps run.

  apps/worker/.venv/Scripts/python.exe tools/e2e/animate_local.py "<topic>" <seconds> <out_dir> <ref.jpg> [ref2 …]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

import anthropic  # noqa: E402

from rasika_worker import animate, brief, media, music  # noqa: E402
from rasika_worker.planner import ChromiumValidator  # noqa: E402
from rasika_worker.render import RenderSpec, render  # noqa: E402
from rasika_worker.settings import Settings  # noqa: E402


def main() -> int:
    topic, seconds, out = sys.argv[1], float(sys.argv[2]), Path(sys.argv[3]).resolve()
    refs = [Path(p).resolve() for p in sys.argv[4:]]
    work = out / "animate"
    work.mkdir(parents=True, exist_ok=True)
    s = Settings()
    client = anthropic.Anthropic(api_key=s.anthropic_api_key)
    model = s.anthropic_planner_model
    t: dict[str, float] = {}

    t0 = time.time()
    film, _ = animate.write_film(client, model, topic, seconds, False, refs)
    t["film"] = round(time.time() - t0, 1)
    print("style:", json.dumps(film.get("style"), ensure_ascii=False)[:400])
    print("shots:", [(sh["sec"], sh["see"][:50]) for sh in film["shots"]])
    durs = [float(sh["sec"]) for sh in film["shots"]]

    t0 = time.time()
    codes, _ = animate.write_code(client, model, film, refs)
    res = animate.check(s, codes, durs, work / "check")
    print("check 1:", [r["notes"] for r in res])
    if any(r["notes"] for r in res):
        codes, _ = animate.fix_broken(client, model, film, codes, res)
        res = animate.check(s, codes, durs, work / "check")
        print("check 2:", [r["notes"] for r in res])
    t["code"] = round(time.time() - t0, 1)

    t0 = time.time()
    fixes, notes, _ = animate.critique(client, model, film, codes, [r["still"] for r in res], refs)
    if fixes:
        trial = list(codes)
        for i, c in fixes.items():
            trial[i] = c
        res2 = animate.check(s, trial, durs, work / "check2")
        for i in fixes:
            if not res2[i]["notes"]:
                codes[i] = trial[i]
    t["critique"] = round(time.time() - t0, 1)
    print("critique:", notes[:6], "| fixed shots:", sorted(i + 1 for i in fixes))
    (work / "film.json").write_text(json.dumps({**film, "codes": codes}, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [{"text": str(sh.get("words") or "♪"), "sec": float(sh["sec"])} for sh in film["shots"]]
    words, duration = brief.timeline(lines, start=0.0)
    duration = sum(durs)
    tokens = json.loads((ROOT / "packages" / "schema" / "presets" / "animate-studio.json").read_text(encoding="utf-8"))
    style = animate.palette_style(tokens, film)
    plan = animate.build_plan(style, film, codes, duration, False)
    v = ChromiumValidator(s)
    try:
        r = v(plan, words, [])
    finally:
        v.close()
    errs = [i for i in r["issues"] if i["level"] == "error"]
    print("valid" if not errs else f"INVALID {errs[:3]}")
    if errs:
        return 1

    t0 = time.time()
    voice = work / "voice.wav"
    music.write(voice, music.compose(str(film["music"]["mood"]), duration))
    src = work / "source.mp4"
    media.make_stage_video(s.ffmpeg_bin, voice, src, style["palette"]["stage"], duration)
    frames = work / "frames"
    n = media.extract_frames(s.ffmpeg_bin, src, frames)
    rr = render(s, work, RenderSpec(r["plan"], words, {}, frames, n, voice, preview=False))
    t["render"] = round(time.time() - t0, 1)
    print("rendered", rr.final, f"| {duration:.1f} s film |", t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
