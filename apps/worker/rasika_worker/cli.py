"""Developer CLI.

  python -m rasika_worker.cli render-local --plan plans/baisa_bling.json --words plans/baisa_bling.words.json \
      --images reference/baisa_bling/img --video IMG_7571.MP4 -o out/baisa.mp4 [--preview] [--parallelism 8]
      → full render pipeline on local files, no DB / S3 / Redis; prints per-stage timings.

  python -m rasika_worker.cli run-plan --project <id> --plan ... --words ... --images DIR [--preview]
      → seeds the project with the images, transcript and plan, then enqueues a render job for
        the running worker (dashboard shows progress + download).

  python -m rasika_worker.cli enqueue --project <id> [--type probe]
      → (re)run the pipeline from a stage for an existing project.

  python -m rasika_worker.cli transcribe-local --audio file.(wav|mp4|m4a) [--lang auto] → words JSON.

  python -m rasika_worker.cli plan-local --words words.json --video file.mp4 [--images DIR] [--style katana-pop]
      [--brand "Name"] [--industry "real estate"] -o out/plan.json → Claude plan + validator report (no DB).
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import uuid
from pathlib import Path
from typing import Any

import structlog

from rasika_worker import media
from rasika_worker.main import configure_logging
from rasika_worker.settings import Settings, get_settings

log = structlog.get_logger("rasika.worker.cli")


def _load_plan_words(
    plan_path: Path, words_path: Path | None
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    words: list[dict[str, Any]] = []
    if words_path:
        raw = json.loads(words_path.read_text(encoding="utf-8"))
        words = raw["words"] if isinstance(raw, dict) else raw
    return plan, words


def _plan_image_ids(plan: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for el in plan.get("elements", []):
        if el.get("imageId"):
            ids.append(el["imageId"])
        for c in el.get("cards", []) or []:
            if c.get("imageId"):
                ids.append(c["imageId"])
        ids.extend(el.get("imageIds", []) or [])
    if plan.get("endCard", {}).get("bgImageId"):
        ids.append(plan["endCard"]["bgImageId"])
    return list(dict.fromkeys(ids))


def _find_image(images_dir: Path, image_id: str) -> Path:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = images_dir / f"{image_id}{ext}"
        if p.exists():
            return p
    raise SystemExit(f"image {image_id} not found in {images_dir}")


def cmd_render_local(a: argparse.Namespace, s: Settings) -> int:
    from rasika_worker.render import RenderSpec, render

    out = Path(a.out)
    work = Path(a.work or (s.work_dir / f"local-{int(time.time())}"))
    work.mkdir(parents=True, exist_ok=True)
    plan, words = _load_plan_words(Path(a.plan), Path(a.words) if a.words else None)
    images = {i: _find_image(Path(a.images), i) for i in _plan_image_ids(plan)} if a.images else {}
    timings: dict[str, float] = {}
    src = Path(a.video)
    info = media.probe(s.ffprobe_bin, src)
    print(
        f"source: {info.codec} {info.display_size[0]}x{info.display_size[1]} {info.fps}fps {info.duration_sec}s audio={info.has_audio}"
    )
    if abs(info.duration_sec - float(plan["meta"]["durationSec"])) > 1.0:
        print(f"warning: plan duration {plan['meta']['durationSec']} vs video {info.duration_sec}")

    t0 = time.time()
    voice = work / "voice.wav"
    if info.has_audio:
        media.extract_audio(s.ffmpeg_bin, src, voice, work / "audio16k.wav")
    timings["extract_audio_sec"] = round(time.time() - t0, 2)

    t0 = time.time()
    frames_dir = work / ("frames_540" if a.preview else "frames")
    if a.reuse_frames and frames_dir.exists() and any(frames_dir.glob("f*.jpg")):
        n = len(list(frames_dir.glob("f*.jpg")))
    else:
        shutil.rmtree(frames_dir, ignore_errors=True)
        n = media.extract_frames(s.ffmpeg_bin, src, frames_dir, scale=0.5 if a.preview else 1.0)
    timings["frames_sec"] = round(time.time() - t0, 2)
    print(f"frames: {n} in {timings['frames_sec']}s")

    spec = RenderSpec(
        plan, words, images, frames_dir, n, voice if info.has_audio else None, preview=a.preview
    )
    last = [0.0]

    def prog(p: float, m: str) -> None:
        if time.time() - last[0] > 5:
            last[0] = time.time()
            print(f"  {int(p * 100):3d}%  {m}")

    res = render(s, work, spec, prog, parallelism=a.parallelism)
    timings.update(res.timings)
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(res.final, out)
    if res.share_720:
        shutil.copy(res.share_720, out.with_name(out.stem + "_720.mp4"))
    if res.thumbnail:
        shutil.copy(res.thumbnail, out.with_suffix(".jpg"))
    (out.with_suffix(".cues.json")).write_text(json.dumps(res.cues, indent=1), encoding="utf-8")
    timings["total_sec"] = round(
        sum(
            v
            for k, v in timings.items()
            if k in ("extract_audio_sec", "frames_sec", "total_render_sec")
        ),
        2,
    )
    print(json.dumps({"out": str(out), "chunks": res.chunks, "timings": timings}, indent=1))
    if not a.keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return 0


def cmd_run_plan(a: argparse.Namespace, s: Settings) -> int:
    import redis

    from rasika_worker.db import Repo
    from rasika_worker.protocol import JobMessage, JobType
    from rasika_worker.storage import Storage, project_prefix

    repo = Repo(s.database_url)
    storage = Storage(s)
    project = repo.project(a.project)
    if not project:
        raise SystemExit(f"project {a.project} not found")
    user_id = str(project["user_id"])
    prefix = project_prefix(user_id, a.project)
    plan, words = _load_plan_words(Path(a.plan), Path(a.words) if a.words else None)

    # images: upload each referenced id from --images and rewrite the plan's ids to asset ids
    mapping: dict[str, str] = {}
    if a.images:
        existing = {
            a_["meta"].get("label"): str(a_["id"])
            for a_ in repo.assets(a.project, "image")
            if a_.get("meta")
        }
        for i, image_id in enumerate(_plan_image_ids(plan)):
            if image_id in existing and not a.reupload:
                mapping[image_id] = existing[image_id]
                continue
            src = _find_image(Path(a.images), image_id)
            aid = str(uuid.uuid4())
            key = f"{prefix}/img/{aid}{src.suffix.lower()}"
            size = storage.upload(src, key)
            repo.insert_asset(
                a.project,
                user_id,
                "image",
                key,
                src.name,
                "image/jpeg",
                size,
                {"label": image_id, "order": i},
                aid,
            )
            mapping[image_id] = aid
        plan = _remap_images(plan, mapping)
        print(f"images: {len(mapping)} mapped")

    if words:
        v = repo.insert_transcript(a.project, plan["meta"].get("language", "en"), words)
        print(f"transcript v{v}: {len(words)} words")
    pv = repo.insert_plan(
        a.project, plan, created_by="user", report={"source": str(a.plan), "imageMap": mapping}
    )
    print(f"plan v{pv}")
    job_type = JobType.RENDER_PREVIEW if a.preview else JobType.RENDER_FINAL
    job_id = repo.insert_job(a.project, user_id, job_type.value)
    msg = JobMessage(
        job_id=job_id,
        project_id=a.project,
        user_id=user_id,
        type=job_type,
        payload={"plan_version": pv},
    )
    r: redis.Redis[str] = redis.Redis.from_url(s.redis_url, decode_responses=True)
    r.lpush(s.job_queue, msg.model_dump_json())
    print(
        f"enqueued {job_type.value} job {job_id}; watch http://localhost:3000/dashboard/p/{a.project}"
    )
    return 0


def _remap_images(plan: dict[str, Any], mapping: dict[str, str]) -> dict[str, Any]:
    def m(x: str) -> str:
        return mapping.get(x, x)

    for el in plan.get("elements", []):
        if el.get("imageId"):
            el["imageId"] = m(el["imageId"])
        for c in el.get("cards", []) or []:
            if c.get("imageId"):
                c["imageId"] = m(c["imageId"])
        if el.get("imageIds"):
            el["imageIds"] = [m(i) for i in el["imageIds"]]
    if plan.get("endCard", {}).get("bgImageId"):
        plan["endCard"]["bgImageId"] = m(plan["endCard"]["bgImageId"])
    return plan


def cmd_enqueue(a: argparse.Namespace, s: Settings) -> int:
    import redis

    from rasika_worker.db import Repo
    from rasika_worker.protocol import JobMessage, JobType

    repo = Repo(s.database_url)
    project = repo.project(a.project)
    if not project:
        raise SystemExit("project not found")
    user_id = str(project["user_id"])
    job_type = JobType(a.type)
    job_id = repo.insert_job(a.project, user_id, job_type.value)
    payload: dict[str, Any] = json.loads(a.payload) if a.payload else {}
    if job_type == JobType.PROBE:
        srcs = repo.assets(a.project, "source_video")
        if srcs:
            payload["source_key"] = srcs[-1]["storage_key"]
        payload["language_hint"] = a.lang
    msg = JobMessage(
        job_id=job_id, project_id=a.project, user_id=user_id, type=job_type, payload=payload
    )
    r: redis.Redis[str] = redis.Redis.from_url(s.redis_url, decode_responses=True)
    r.lpush(s.job_queue, msg.model_dump_json())
    print(f"enqueued {job_type.value} job {job_id}")
    return 0


def cmd_plan_local(a: argparse.Namespace, s: Settings) -> int:
    """words + video (+ images) → plan.json via the real planner, no DB. Prints the validator report."""
    from rasika_worker.face import subject_from_keyframes
    from rasika_worker.planner import ChromiumValidator, Planner, PlannerInput

    work = Path(a.work or (s.work_dir / f"plan-{int(time.time())}"))
    work.mkdir(parents=True, exist_ok=True)
    raw = json.loads(Path(a.words).read_text(encoding="utf-8"))
    words = raw["words"] if isinstance(raw, dict) else raw
    language = raw.get("language", "en") if isinstance(raw, dict) else "en"
    src = Path(a.video)
    info = media.probe(s.ffprobe_bin, src)
    keyframes = media.extract_keyframes(s.ffmpeg_bin, src, work / "keyframes", info.duration_sec)
    subject = subject_from_keyframes(keyframes)
    images: list[dict[str, Any]] = []
    if a.images:
        for p in sorted(Path(a.images).glob("*")):
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                images.append(
                    {
                        "id": p.stem,
                        "label": p.stem.replace("_", " "),
                        "sayWhen": p.stem.replace("_", " "),
                        "path": str(p),
                    }
                )
    style_path = Path(a.style) if a.style else None
    if style_path and style_path.exists():
        style = json.loads(style_path.read_text(encoding="utf-8"))
    else:
        preset_dir = Path(__file__).resolve().parents[3] / "packages" / "schema" / "presets"
        style = json.loads(
            (preset_dir / f"{a.style or 'mikku-royal'}.json").read_text(encoding="utf-8")
        )
    brand: dict[str, Any] = {}
    if a.brand:
        brand["name"] = a.brand
    if a.handle:
        brand["handle"] = a.handle
    inp = PlannerInput(
        duration_sec=round(info.duration_sec, 2),
        language=language,
        words=words,
        subject=subject.as_plan_subject(),
        style=style,
        style_text=a.style_text,
        brand=brand,
        images=images,
        keyframes=keyframes,
        industry=a.industry,
        options={"captions": True, "sfxIntensity": 0.8},
    )
    validator = ChromiumValidator(s)
    try:
        res = Planner(s).plan(inp, validator)
    finally:
        validator.close()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res.plan, ensure_ascii=False, indent=1), encoding="utf-8")
    out.with_suffix(".report.json").write_text(
        json.dumps(res.report, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    if res.raw_first is not None:
        out.with_suffix(".raw.json").write_text(
            json.dumps(res.raw_first, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    rep = res.report
    print(
        json.dumps(
            {
                "out": str(out),
                "ok": rep["ok"],
                "attempts": rep["attempts"],
                "elements": rep["elements"],
                "modeSwitches": rep["modeSwitches"],
                "errors": len(rep["errors"]),
                "warnings": len(rep["warnings"]),
                "fixed": len(rep["fixed"]),
                "usage": rep["usage"],
                "seconds": rep["seconds"],
                "subject": subject.as_plan_subject(),
            },
            indent=1,
        )
    )
    for e in rep["errors"]:
        print("  error", e["code"], e.get("elementId", ""), e["message"])
    for w in rep["warnings"][:12]:
        print("  warn ", w["code"], w.get("elementId", ""), w["message"])
    return 0 if rep["ok"] else 1


def cmd_transcribe_local(a: argparse.Namespace, s: Settings) -> int:
    from rasika_worker.transcribe import make_transcriber

    src = Path(a.audio)
    work = s.work_dir / "local-asr"
    work.mkdir(parents=True, exist_ok=True)
    wav = work / "audio16k.wav"
    media.run(
        [
            s.ffmpeg_bin,
            "-v",
            "error",
            "-y",
            "-i",
            str(src),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(wav),
        ]
    )
    t0 = time.time()
    res = make_transcriber(s).transcribe(
        wav, a.lang, lambda p, m: print(f"  {int(p * 100):3d}% {m}", file=sys.stderr)
    )
    out = {
        "language": res.language,
        "engine": res.engine,
        "notes": res.notes,
        "sec": round(time.time() - t0, 1),
        "words": [w.as_dict() for w in res.words],
    }
    text = json.dumps(out, ensure_ascii=False, indent=0 if a.out else None)
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
        print(f"{len(res.words)} words ({res.language}) in {out['sec']}s → {a.out}")
    else:
        print(text)
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="rasika_worker.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("render-local")
    p.add_argument("--plan", required=True)
    p.add_argument("--words")
    p.add_argument("--images")
    p.add_argument("--video", required=True)
    p.add_argument("-o", "--out", default="out/render.mp4")
    p.add_argument("--preview", action="store_true")
    p.add_argument("--parallelism", type=int)
    p.add_argument("--work")
    p.add_argument("--reuse-frames", action="store_true")
    p.add_argument("--keep-work", action="store_true")
    p.set_defaults(fn=cmd_render_local)

    p = sub.add_parser("run-plan")
    p.add_argument("--project", required=True)
    p.add_argument("--plan", required=True)
    p.add_argument("--words")
    p.add_argument("--images")
    p.add_argument("--preview", action="store_true")
    p.add_argument("--reupload", action="store_true")
    p.set_defaults(fn=cmd_run_plan)

    p = sub.add_parser("enqueue")
    p.add_argument("--project", required=True)
    p.add_argument("--type", default="probe")
    p.add_argument("--lang", default="auto")
    p.add_argument("--payload", help='extra JSON payload, for example {"then_final": true}')
    p.set_defaults(fn=cmd_enqueue)

    p = sub.add_parser("plan-local")
    p.add_argument("--words", required=True)
    p.add_argument("--video", required=True)
    p.add_argument("--images")
    p.add_argument("--style", help="preset id or a style tokens json file")
    p.add_argument("--style-text")
    p.add_argument("--brand")
    p.add_argument("--handle")
    p.add_argument("--industry")
    p.add_argument("-o", "--out", default="out/plan.json")
    p.add_argument("--work")
    p.set_defaults(fn=cmd_plan_local)

    p = sub.add_parser("transcribe-local")
    p.add_argument("--audio", required=True)
    p.add_argument("--lang", default="auto")
    p.add_argument("--out")
    p.set_defaults(fn=cmd_transcribe_local)

    a = ap.parse_args(argv)
    s = get_settings()
    configure_logging(s.log_level)
    return int(a.fn(a, s))


if __name__ == "__main__":
    raise SystemExit(main())
