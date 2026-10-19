"""A brief film end to end, in-process: capture → writer → narration/score → planner → render.

The same code the worker's compose / transcribe / plan / render steps run, minus the queue and the
object storage, so it works when Docker is down. Spends real Claude (writer + planner) and, for
narrated kinds, Deepgram (voice + word timings).

  apps/worker/.venv/Scripts/python.exe tools/e2e/brief_local.py <kind> '<inputs json>' <out_dir>
  e.g. brief_local.py recipe '{"recipe": "Negroni: 30 ml gin, 30 ml Campari, 30 ml sweet vermouth…"}' out/
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

import anthropic  # noqa: E402

from rasika_worker import brief, media, music  # noqa: E402
from rasika_worker.face import subject_from_keyframes  # noqa: E402
from rasika_worker.planner import ChromiumValidator, Planner, PlannerInput  # noqa: E402
from rasika_worker.render import RenderSpec, render  # noqa: E402
from rasika_worker.settings import Settings  # noqa: E402
from rasika_worker.transcribe import make_transcriber  # noqa: E402
from rasika_worker.tts import DeepgramTTS  # noqa: E402


def main() -> int:
    kind_id, inputs, out = sys.argv[1], json.loads(sys.argv[2]), Path(sys.argv[3]).resolve()
    work = out / kind_id
    work.mkdir(parents=True, exist_ok=True)
    s = Settings()
    kind = brief.KINDS[kind_id]
    narrate = bool(inputs.pop("narrate", kind["narrate"]))
    t: dict[str, float] = {}
    client = anthropic.Anthropic(api_key=s.anthropic_api_key)

    capture = None
    images: list[dict] = []
    if "url" in kind["needs"]:
        t0 = time.time()
        capture = brief.capture_site(str(inputs["url"]), work / "site")
        t["capture"] = round(time.time() - t0, 1)
        for label, path in capture.shots:
            images.append({"id": path.stem, "label": label, "sayWhen": "", "path": str(path)})
        print("captured", capture.host, [lbl for lbl, _ in capture.shots])

    t0 = time.time()
    film, usage = brief.write(client, s.anthropic_planner_model, kind_id, inputs, capture, narrate, 180)
    t["write"] = round(time.time() - t0, 1)
    (work / "film.json").write_text(json.dumps(film, ensure_ascii=False, indent=2), encoding="utf-8")
    print("written:", film.get("title"), "|", len(film["lines"]), "lines |", usage)

    voice = work / "voice.wav"
    style = json.loads((ROOT / "packages" / "schema" / "presets" / f"{kind['preset']}.json").read_text(encoding="utf-8"))
    options: dict = {"faceless": True, "brief": {"kind": kind_id, **inputs}, "sfxIntensity": 0.8}
    music_bed = None
    if narrate and film.get("narration"):
        t0 = time.time()
        duration = DeepgramTTS(s.deepgram_api_key, s.deepgram_tts_model).speak(str(film["narration"]), voice)
        audio16k = work / "audio16k.wav"
        media.extract_audio(s.ffmpeg_bin, voice, work / "voice48.wav", audio16k)
        tr = make_transcriber(s).transcribe(audio16k, "en", lambda p, m: None, [])
        words = brief.align_to_script([w.as_dict() for w in tr.words], str(film["narration"]))
        t["voice"] = round(time.time() - t0, 1)
        music_bed = work / "music_bed.wav"
        music.write(music_bed, music.compose(kind["mood"], duration, film["music"].get("bpm")))
        options["captions"] = True
    else:
        words, duration = brief.timeline(film["lines"])
        music.write(voice, music.compose(kind["mood"], duration, film["music"].get("bpm")))
        options["captions"] = False
    if kind_id == "machine":
        options["sfxIntensity"] = 1.0
    options["film"] = {k: film.get(k) for k in ("title", "lines", "data", "narration")}

    src = work / "source.mp4"
    media.make_stage_video(s.ffmpeg_bin, voice, src, style["palette"]["stage"], duration)
    keyframes = media.extract_keyframes(s.ffmpeg_bin, src, work / "kf", duration)
    subject = subject_from_keyframes(keyframes)
    inp = PlannerInput(
        duration_sec=round(duration, 2),
        language="en",
        words=words,
        subject=subject.as_plan_subject(),
        style=style,
        style_text=None,
        brand={},
        images=images,
        keyframes=keyframes,
        options=options,
        wall_is_dark=subject.wall_is_dark,
    )
    t0 = time.time()
    validator = ChromiumValidator(s)
    try:
        res = Planner(s, client).plan(inp, validator)
    finally:
        validator.close()
    t["plan"] = round(time.time() - t0, 1)
    (work / "plan.json").write_text(json.dumps(res.plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print("planned ok" if res.ok else "PLAN FAILED", "| attempts", res.attempts, "| elements",
          [(e["type"], round(e["t0"], 1)) for e in res.plan.get("elements", [])][:20])
    if not res.ok:
        print([e["message"] for e in res.report["errors"][:5]])
        return 1

    t0 = time.time()
    frames = work / "frames"
    n = media.extract_frames(s.ffmpeg_bin, src, frames)
    spec = RenderSpec(
        res.plan,
        words,
        {im["id"]: Path(im["path"]) for im in images},
        frames,
        n,
        voice,
        preview=False,
        music_bed=music_bed,
    )
    r = render(s, work, spec)
    t["render"] = round(time.time() - t0, 1)
    print("rendered", r.final, "|", f"{duration:.1f} s film |", t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
