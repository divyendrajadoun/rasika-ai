"""Plan one style's demo with the real planner (the same 12 s take every demo uses).

  apps/worker/.venv/Scripts/python.exe tools/styledemos/plan_one.py <preset-id>

Writes tools/styledemos/plans/<id>.json (+ .report.json); then make_styledemos.py --only <id> renders it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

from rasika_worker import media  # noqa: E402
from rasika_worker.face import subject_from_keyframes  # noqa: E402
from rasika_worker.planner import ChromiumValidator, Planner, PlannerInput  # noqa: E402
from rasika_worker.settings import Settings  # noqa: E402

SECONDS = 12.0


def main() -> int:
    pid = sys.argv[1]
    s = Settings()
    work = ROOT / ".work-styledemos"
    clip = work / "clip.mp4"
    style = json.loads((ROOT / "packages" / "schema" / "presets" / f"{pid}.json").read_text(encoding="utf-8"))
    words = [
        w
        for w in json.loads((ROOT / "plans" / "baisa_bling.words.json").read_text(encoding="utf-8"))["words"]
        if float(w["t"]) < SECONDS - 0.3
    ]
    keyframes = media.extract_keyframes(s.ffmpeg_bin, clip, work / f"kf_{pid}", SECONDS)
    subject = subject_from_keyframes(keyframes)
    images = [
        {"id": p.stem, "label": "jewellery" if p.stem != "choker" else "the choker", "sayWhen": "", "path": str(p)}
        for p in sorted((ROOT / "reference" / "baisa_bling" / "img").glob("*.jpg"))[:4]
    ]
    inp = PlannerInput(
        duration_sec=SECONDS,
        language="en",
        words=words,
        subject=subject.as_plan_subject(),
        style=style,
        style_text=None,
        brand={},
        images=images,
        keyframes=keyframes,
        options={"captions": True, "sfxIntensity": 0.8},
        wall_is_dark=subject.wall_is_dark,
    )
    validator = ChromiumValidator(s)
    try:
        res = Planner(s).plan(inp, validator)
    finally:
        validator.close()
    out = ROOT / "tools" / "styledemos" / "plans"
    (out / f"{pid}.json").write_text(json.dumps(res.plan, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / f"{pid}.report.json").write_text(json.dumps(res.report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(pid, "ok" if res.ok else "FAILED", "attempts", res.attempts, [(e["type"], round(e["t0"], 1)) for e in res.plan.get("elements", [])])
    return 0 if res.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
