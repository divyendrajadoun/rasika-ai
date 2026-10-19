"""Match a reference end to end, in-process (no queue, no storage): the worker's own transcribe →
analyse_reference → plan (with the reference frames) → render, for when Docker is down.

  apps/worker/.venv/Scripts/python.exe tools/e2e/reference_local.py <take.mp4> <reference.mp4> <out_dir>
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

import anthropic  # noqa: E402

from rasika_worker import media, reference  # noqa: E402
from rasika_worker.face import subject_from_keyframes  # noqa: E402
from rasika_worker.pipeline import REFERENCE_BASE_PRESET  # noqa: E402
from rasika_worker.planner import ChromiumValidator, Planner, PlannerInput  # noqa: E402
from rasika_worker.render import RenderSpec, render  # noqa: E402
from rasika_worker.settings import Settings  # noqa: E402
from rasika_worker.transcribe import make_transcriber  # noqa: E402


def main() -> int:
    take, ref, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve()
    work = out / "reference"
    work.mkdir(parents=True, exist_ok=True)
    s = Settings()
    client = anthropic.Anthropic(api_key=s.anthropic_api_key)
    t: dict[str, float] = {}

    t0 = time.time()
    src = work / "source.mp4"
    media.run([s.ffmpeg_bin, "-v", "error", "-y", "-i", str(take), "-c", "copy", str(src)])
    duration = float(media.probe(s.ffprobe_bin, src).duration_sec)
    voice, a16 = work / "voice.wav", work / "audio16k.wav"
    media.extract_audio(s.ffmpeg_bin, src, voice, a16)
    tr = make_transcriber(s).transcribe(a16, "auto", lambda p, m: None, [])
    words = [w.as_dict() for w in tr.words]
    if not duration:
        duration = float(words[-1]["end"]) + 0.6
    t["transcribe"] = round(time.time() - t0, 1)
    print("transcribed", len(words), "words,", tr.language)

    t0 = time.time()
    report = reference.analyse(s.ffmpeg_bin, s.ffprobe_bin, ref, work / "ref")
    base = json.loads((ROOT / "packages" / "schema" / "presets" / f"{REFERENCE_BASE_PRESET}.json").read_text(encoding="utf-8"))
    style, usage = reference.propose_style(client, s.anthropic_planner_model, report, base, "look", None)
    t["style"] = round(time.time() - t0, 1)
    (work / "style.json").write_text(json.dumps(style, ensure_ascii=False, indent=2), encoding="utf-8")
    print("style:", style.get("name"), style.get("palette"), {k: style["motion"].get(k) for k in ("family", "enter", "framing")})

    kf = media.extract_keyframes(s.ffmpeg_bin, src, work / "kf", duration)
    subject = subject_from_keyframes(kf)
    stills = sorted((work / "ref").glob("*.jpg"))
    step = len(stills) / 4
    stills4 = [stills[int(i * step + step / 2)] for i in range(4)]
    inp = PlannerInput(
        duration_sec=round(duration, 2),
        language=tr.language,
        words=words,
        subject=subject.as_plan_subject(),
        style=style,
        style_text=None,
        brand={},
        images=[],
        keyframes=kf,
        options={"captions": True, "sfxIntensity": 0.5, "source": "reference", "referenceStyle": style},
        wall_is_dark=subject.wall_is_dark,
        reference_stills=stills4,
    )
    t0 = time.time()
    v = ChromiumValidator(s)
    try:
        res = Planner(s, client).plan(inp, v)
    finally:
        v.close()
    t["plan"] = round(time.time() - t0, 1)
    (work / "plan.json").write_text(json.dumps(res.plan, ensure_ascii=False, indent=2), encoding="utf-8")
    posters = [
        (round(e["t0"], 1), [(ln["text"], ln["size"], ln.get("color"), ln["font"]) for ln in e["lines"]])
        for e in res.plan["elements"]
        if e["type"] == "posterText"
    ]
    print("planned", "ok" if res.ok else "FAILED", "| modes", [m["mode"] for m in res.plan["videoModes"]])
    print("posters:", posters[:8])
    if not res.ok:
        return 1

    t0 = time.time()
    frames = work / "frames"
    n = media.extract_frames(s.ffmpeg_bin, src, frames)
    r = render(s, work, RenderSpec(res.plan, words, {}, frames, n, voice, preview=False))
    t["render"] = round(time.time() - t0, 1)
    print("rendered", r.final, t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
