"""Job handlers: probe → transcribe (→ plan, Phase 5) · render_preview · render_final · cleanup.

Each handler is idempotent: it recreates its own outputs from the source object and overwrites
its own asset rows. Stage timings go into `jobs.timings` through the Publisher.
"""

from __future__ import annotations

import json
import mimetypes
import shutil
import time
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

import redis
import structlog

from rasika_worker import media
from rasika_worker.db import Repo
from rasika_worker.face import subject_from_keyframes
from rasika_worker.planner import ChromiumValidator, Planner, PlannerInput
from rasika_worker.protocol import JobMessage, JobStatus, JobType
from rasika_worker.render import RenderSpec, render
from rasika_worker.settings import Settings
from rasika_worker.storage import Storage, project_prefix
from rasika_worker.transcribe import Transcriber, make_transcriber
from rasika_worker.transcript_fix import suggest_fixes

if TYPE_CHECKING:
    from rasika_worker.main import Publisher

log = structlog.get_logger("rasika.worker.pipeline")
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parents[2] if len(_HERE.parents) > 2 else None

MAX_DURATION_DEFAULT = 180.0


class PipelineError(RuntimeError):
    """A user-facing failure (bad input); the message is shown in the dashboard."""


class Pipeline:
    def __init__(self, settings: Settings, r: redis.Redis[str] | None = None) -> None:
        self.s = settings
        self.repo = Repo(settings.database_url)
        self.storage = Storage(settings)
        self.redis = r
        self._transcriber: Transcriber | None = None
        self._planner: Planner | None = None
        self._anthropic: Any = None

    @property
    def handlers(self) -> dict[JobType, Callable[[JobMessage, Publisher], None]]:
        return {
            JobType.SYNTH: self.synth,
            JobType.PROBE: self.probe,
            JobType.ANALYSE_REFERENCE: self.analyse_reference,
            JobType.TRANSCRIBE: self.transcribe,
            JobType.PLAN: self.plan,
            JobType.RENDER_PREVIEW: lambda j, p: self.render(j, p, preview=True),
            JobType.RENDER_FINAL: lambda j, p: self.render(j, p, preview=False),
            JobType.CLEANUP: self.cleanup,
        }

    # ── helpers ──
    def work(self, project_id: str) -> Path:
        w = self.s.work_dir / project_id
        w.mkdir(parents=True, exist_ok=True)
        return w

    def source(self, job: JobMessage, work: Path) -> tuple[Path, dict[str, Any]]:
        """Download the source video once per project work dir (size-checked)."""
        key = str(job.payload.get("source_key") or "")
        asset: dict[str, Any] | None = None
        if key:
            asset = next(
                (
                    a
                    for a in self.repo.assets(job.project_id, "source_video")
                    if a["storage_key"] == key
                ),
                None,
            )
        if asset is None:
            srcs = self.repo.assets(job.project_id, "source_video")
            if not srcs:
                raise PipelineError("This project has no uploaded video.")
            asset = srcs[-1]
            key = asset["storage_key"]
        dest = work / ("source" + Path(key).suffix.lower())
        if not dest.exists() or (
            asset.get("size_bytes") and dest.stat().st_size != int(asset["size_bytes"])
        ):
            self.storage.download(key, dest)
        return dest, asset

    def enqueue(self, job: JobMessage, job_type: JobType, payload: dict[str, Any]) -> None:
        if self.redis is None:
            log.warning("no_redis_cannot_chain", job_id=job.job_id, next=job_type)
            return
        nxt = JobMessage(
            job_id=job.job_id,
            project_id=job.project_id,
            user_id=job.user_id,
            type=job_type,
            payload=payload,
        )
        self.repo.set_job_type(job.job_id, job_type.value)
        self.redis.lpush(self.s.job_queue, nxt.model_dump_json())

    def upload_asset(
        self,
        job: JobMessage,
        kind: str,
        src: Path,
        key: str,
        meta: dict[str, Any] | None = None,
        replace: bool = True,
        asset_id: str | None = None,
    ) -> str:
        if replace:
            for old_key in self.repo.replace_assets(job.project_id, kind):
                if old_key != key:
                    try:
                        self.storage.delete(old_key)
                    except Exception as exc:  # best effort
                        log.warning("delete_failed", key=old_key, error=str(exc))
        mime = mimetypes.guess_type(src.name)[0] or "application/octet-stream"
        size = self.storage.upload(src, key, mime)
        return self.repo.insert_asset(
            job.project_id, job.user_id, kind, key, src.name, mime, size, meta, asset_id
        )

    # ── script-only reels: narration + stage clip, then the normal chain ──
    def synth(self, job: JobMessage, pub: Publisher) -> None:
        from rasika_worker.tts import VOICES, DeepgramTTS

        pub.update(JobStatus.PROBING, 1, "Reading your script…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        script = str(job.payload.get("script") or "").strip()
        if not script:
            raise PipelineError("The script is empty.")
        if not self.s.deepgram_api_key:
            raise PipelineError("Narration is not configured on this server (DEEPGRAM_API_KEY).")
        voice_id = str(job.payload.get("voice") or self.s.deepgram_tts_model)
        if voice_id not in VOICES:
            voice_id = self.s.deepgram_tts_model
        max_dur = float(str(job.payload.get("max_duration_sec") or MAX_DURATION_DEFAULT))

        t0 = time.time()
        pub.update(JobStatus.PROBING, 5, f"Recording the narration ({VOICES[voice_id][0]})…")
        voice = work / "narration.wav"
        try:
            duration = DeepgramTTS(self.s.deepgram_api_key, voice_id).speak(script, voice)
        except RuntimeError as exc:
            raise PipelineError(f"Narration failed: {exc}") from exc
        if duration > max_dur + 0.5:
            raise PipelineError(
                f"Spoken, this script runs {duration:.0f} s; your plan allows {max_dur:.0f} s. Shorten it."
            )
        timings = {"tts_sec": round(time.time() - t0, 2), "narration_sec": round(duration, 2)}
        pub.update(JobStatus.PROBING, 40, "Building the stage…", **timings)

        t0 = time.time()
        style = self._style_tokens(project)
        colour = str((style.get("palette") or {}).get("stage") or "#000000")
        src = work / "source.mp4"
        media.make_stage_video(self.s.ffmpeg_bin, voice, src, colour, duration)
        prefix = project_prefix(job.user_id, job.project_id)
        key = f"{prefix}/source.mp4"
        self.upload_asset(
            job,
            "source_video",
            src,
            key,
            {"width": 1080, "height": 1920, "fps": 30, "durationSec": duration, "synthetic": True},
        )
        self.repo.update_project(job.project_id, duration_sec=duration)
        timings["stage_sec"] = round(time.time() - t0, 2)
        pub.update(JobStatus.PROBING, 60, "Narration ready.", **timings)
        self.enqueue(
            job,
            JobType.PROBE,
            {
                "source_key": key,
                "language_hint": job.payload.get("language_hint") or "en",
                "max_duration_sec": max_dur,
            },
        )

    # ── 7.1 probe & prep ──
    def probe(self, job: JobMessage, pub: Publisher) -> None:
        pub.update(JobStatus.PROBING, 2, "Looking at your video…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        prefix = project_prefix(job.user_id, job.project_id)
        t0 = time.time()
        src, asset = self.source(job, work)
        info = media.probe(self.s.ffprobe_bin, src)
        t_probe = round(time.time() - t0, 2)
        max_dur = float(str(job.payload.get("max_duration_sec") or MAX_DURATION_DEFAULT))
        if info.duration_sec > max_dur + 0.5:
            raise PipelineError(
                f"This video is {info.duration_sec:.0f} s; your plan allows {max_dur:.0f} s. Trim it or upgrade."
            )
        notes = []
        if not info.is_vertical:
            notes.append(f"auto-cropped {info.display_size[0]}×{info.display_size[1]} to 9:16")
        log.info("probed", **info.__dict__, notes=notes)
        self.repo.exec(
            "UPDATE assets SET meta = meta || %s::jsonb WHERE id = %s::uuid",
            (
                json.dumps(
                    {
                        "width": info.display_size[0],
                        "height": info.display_size[1],
                        "fps": info.fps,
                        "codec": info.codec,
                        "durationSec": info.duration_sec,
                        "rotation": info.rotation,
                        "autoCrop": not info.is_vertical,
                    }
                ),
                asset["id"],
            ),
        )
        self.repo.update_project(job.project_id, duration_sec=info.duration_sec)
        pub.update(JobStatus.PROBING, 20, "Separating the voice…", probe_sec=t_probe)

        t0 = time.time()
        media.extract_audio(self.s.ffmpeg_bin, src, work / "voice.wav", work / "audio16k.wav")
        pub.update(
            JobStatus.PROBING, 35, "Making a preview copy…", audio_sec=round(time.time() - t0, 2)
        )

        t0 = time.time()
        proxy = work / "proxy.mp4"
        media.make_proxy(self.s.ffmpeg_bin, src, proxy)
        self.upload_asset(
            job,
            "proxy",
            proxy,
            f"{prefix}/proxy.mp4",
            {"width": 1080, "height": 1920, "fps": 30, "durationSec": info.duration_sec},
        )
        pub.update(
            JobStatus.PROBING, 75, "Picking key moments…", proxy_sec=round(time.time() - t0, 2)
        )

        t0 = time.time()
        keyframes = media.extract_keyframes(
            self.s.ffmpeg_bin, src, work / "keyframes", info.duration_sec
        )
        self.repo.replace_assets(job.project_id, "keyframe")
        for i, kf in enumerate(keyframes):
            self.upload_asset(
                job,
                "keyframe",
                kf,
                f"{prefix}/keyframes/{kf.name}",
                {"order": i, "t": round(info.duration_sec * (i + 0.5) / len(keyframes), 2)},
                replace=False,
            )
        pub.update(JobStatus.PROBING, 95, "Video ready.", keyframes_sec=round(time.time() - t0, 2))

        hint = str(
            job.payload.get("language_hint")
            or (project.get("style_options") or {}).get("language")
            or "auto"
        )
        pub.update(JobStatus.TRANSCRIBING, 0, "Timing every word…")
        self.enqueue(
            job, JobType.TRANSCRIBE, {"language_hint": hint, "source_key": asset["storage_key"]}
        )

    # ── 7.2 transcription ──
    def transcriber(self) -> Transcriber:
        if self._transcriber is None:
            self._transcriber = make_transcriber(self.s)
        return self._transcriber

    def transcribe(self, job: JobMessage, pub: Publisher) -> None:
        pub.update(JobStatus.TRANSCRIBING, 2, "Timing every word…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id) or {}
        audio = work / "audio16k.wav"
        if not audio.exists():  # retry-safe: regenerate from the source
            src, _ = self.source(job, work)
            media.extract_audio(self.s.ffmpeg_bin, src, work / "voice.wav", audio)
        hint = str(
            job.payload.get("language_hint")
            or (project.get("style_options") or {}).get("language")
            or "auto"
        )
        brand = (project.get("brand") or {}).get("name")
        labels = [
            a["meta"].get("label")
            for a in self.repo.assets(job.project_id, "image")
            if a.get("meta", {}).get("label")
        ]
        vocab = [v for v in [brand, *labels] if v]
        t0 = time.time()

        def prog(p: float, m: str) -> None:
            pub.update(JobStatus.TRANSCRIBING, int(2 + 93 * p), m)

        result = self.transcriber().transcribe(audio, hint, prog, vocab)
        t_tr = round(time.time() - t0, 2)
        words = [w.as_dict() for w in result.words]
        version = self.repo.insert_transcript(job.project_id, result.language, words)
        self.repo.audit(
            job.user_id,
            "transcribe",
            "project",
            job.project_id,
            {
                "version": version,
                "language": result.language,
                "words": len(words),
                "engine": result.engine,
                "notes": result.notes,
            },
        )
        log.info(
            "transcribed", words=len(words), language=result.language, sec=t_tr, notes=result.notes
        )
        timings: dict[str, float] = {"transcribe_sec": t_tr, "transcript_words": float(len(words))}

        # cheap correction pass: safe fixes applied as a new version, the rest kept as suggestions
        if self.s.anthropic_api_key and words:
            pub.update(JobStatus.TRANSCRIBING, 96, "Checking spellings and names…", **timings)
            t0 = time.time()
            try:
                fix = suggest_fixes(
                    self.anthropic(),
                    self.s.anthropic_fast_model,
                    words,
                    brand,
                    labels,
                    None,
                    result.language,
                )
                if fix.changed:
                    version = self.repo.insert_transcript(
                        job.project_id, result.language, fix.words
                    )
                    words = fix.words
                self.repo.audit(
                    job.user_id,
                    "transcript_fix",
                    "project",
                    job.project_id,
                    {
                        "version": version,
                        "applied": fix.applied[:200],
                        "suggestions": fix.suggestions[:100],
                        "rejected": fix.rejected,
                        "usage": fix.usage,
                    },
                )
                timings["transcript_fix_sec"] = round(time.time() - t0, 2)
                timings["transcript_fix_applied"] = float(fix.changed)
            except Exception as exc:  # never block the pipeline on suggestions
                log.warning("transcript_fix_failed", error=str(exc))

        opts = dict(project.get("style_options") or {})
        if self.s.auto_plan and self.s.anthropic_api_key:
            if opts.get("source") == "reference" and not opts.get("referenceStyle"):
                pub.update(JobStatus.PLANNING, 0, "Studying the reference reel…", **timings)
                self.enqueue(job, JobType.ANALYSE_REFERENCE, {"transcript_version": version})
            else:
                pub.update(JobStatus.PLANNING, 0, "Designing your edit…", **timings)
                self.enqueue(job, JobType.PLAN, {"transcript_version": version})
        else:
            pub.update(
                JobStatus.AWAITING_TRANSCRIPT_REVIEW,
                100,
                f"Transcript ready: {len(words)} words ({result.language}).",
                **timings,
            )

    # ── reference matching (reelmimic-style analyse → style) ──
    def analyse_reference(self, job: JobMessage, pub: Publisher) -> None:
        from rasika_worker import reference

        pub.update(JobStatus.PLANNING, 2, "Studying the reference reel…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        refs = self.repo.assets(job.project_id, "reference_video")
        if not refs:
            raise PipelineError("No reference reel was uploaded for this project.")
        ref = refs[-1]
        dest = work / ("reference" + Path(ref["storage_key"]).suffix.lower())
        if not dest.exists():
            self.storage.download(ref["storage_key"], dest)
        opts = dict(project.get("style_options") or {})
        fidelity = str(opts.get("fidelity") or "camera")

        t0 = time.time()
        report = reference.analyse(self.s.ffmpeg_bin, self.s.ffprobe_bin, dest, work / "ref")
        timings: dict[str, float] = {
            "reference_analyse_sec": round(time.time() - t0, 2),
            "reference_cuts": float(len(report.cuts)),
            "reference_mean_shot_sec": report.mean_shot_sec,
        }
        pub.update(
            JobStatus.PLANNING,
            10,
            f"Reference: {len(report.cuts)} cuts, {report.mean_shot_sec:.1f} s shots. Writing the style…",
            **timings,
        )
        t0 = time.time()
        preset = self._style_tokens(project, use_override=False)
        try:
            tokens, usage = reference.propose_style(
                self.anthropic(),
                self.s.anthropic_planner_model,
                report,
                preset,
                fidelity,
                project.get("style_text"),
            )
        except Exception as exc:
            raise PipelineError(f"Could not write a style from the reference: {exc}") from exc
        timings["reference_style_sec"] = round(time.time() - t0, 2)
        timings["reference_input_tokens"] = float(usage["input_tokens"])
        timings["reference_output_tokens"] = float(usage["output_tokens"])
        opts["referenceStyle"] = tokens
        opts["referenceReport"] = {k: v for k, v in report.as_dict().items() if k != "stills"}
        self.repo.exec(
            "UPDATE projects SET style_options = %s::jsonb, updated_at = now() WHERE id = %s::uuid",
            (json.dumps(opts), job.project_id),
        )
        self.repo.audit(
            job.user_id,
            "reference_style",
            "project",
            job.project_id,
            {"fidelity": fidelity, "usage": usage, "report": opts["referenceReport"]},
        )
        pub.update(JobStatus.PLANNING, 15, "Designing your edit in that rhythm…", **timings)
        self.enqueue(job, JobType.PLAN, {"transcript_version": job.payload.get("transcript_version")})

    # ── 7.4 planning ──
    def anthropic(self) -> Any:
        if self._anthropic is None:
            import anthropic

            self._anthropic = anthropic.Anthropic(api_key=self.s.anthropic_api_key)
        return self._anthropic

    def planner(self) -> Planner:
        if self._planner is None:
            self._planner = Planner(self.s, self.anthropic())
        return self._planner

    def plan(self, job: JobMessage, pub: Publisher) -> None:
        pub.update(JobStatus.PLANNING, 3, "Designing your edit…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        tr = self.repo.latest_transcript(job.project_id)
        if not tr or not tr["words"]:
            raise PipelineError("No transcript to plan from.")
        words = list(tr["words"])
        duration = float(
            project.get("duration_sec") or (words[-1].get("end") or words[-1]["t"]) + 1.0
        )

        # keyframes + face detection
        t0 = time.time()
        kf_dir = work / "keyframes"
        kf_dir.mkdir(exist_ok=True)
        keyframes: list[Path] = []
        for a in self.repo.assets(job.project_id, "keyframe"):
            dest = kf_dir / Path(a["storage_key"]).name
            if not dest.exists():
                self.storage.download(a["storage_key"], dest)
            keyframes.append(dest)
        if not keyframes:
            src, _ = self.source(job, work)
            keyframes = media.extract_keyframes(self.s.ffmpeg_bin, src, kf_dir, duration)
        subject = subject_from_keyframes(keyframes)
        timings: dict[str, float] = {
            "subject_sec": round(time.time() - t0, 2),
            "face_detections": float(subject.detections),
        }
        pub.update(JobStatus.PLANNING, 12, "Reading the room…", **timings)

        # the user's images
        img_dir = work / "img"
        img_dir.mkdir(exist_ok=True)
        images: list[dict[str, Any]] = []
        for a in sorted(
            self.repo.assets(job.project_id, "image"),
            key=lambda r: (r.get("meta") or {}).get("order", 0),
        ):
            dest = img_dir / f"{a['id']}{Path(a['storage_key']).suffix.lower() or '.jpg'}"
            if not dest.exists():
                self.storage.download(a["storage_key"], dest)
            meta = a.get("meta") or {}
            images.append(
                {
                    "id": str(a["id"]),
                    "label": meta.get("label"),
                    "sayWhen": meta.get("sayWhen"),
                    "path": str(dest),
                }
            )

        style = self._style_tokens(project)
        brand = dict(project.get("brand") or {})
        options = dict(project.get("style_options") or {})
        inp = PlannerInput(
            duration_sec=round(duration, 2),
            language=str(tr["language"]),
            words=words,
            subject=subject.as_plan_subject(),
            style=style,
            style_text=project.get("style_text"),
            brand=brand,
            images=images,
            keyframes=keyframes,
            options=options,
            wall_is_dark=subject.wall_is_dark,
        )
        timings["wall_luma"] = float(subject.wall_luma if subject.wall_luma is not None else -1)
        pub.update(JobStatus.PLANNING, 20, "Designing your edit…", **timings)
        t0 = time.time()
        validator = ChromiumValidator(self.s)
        try:
            res = self.planner().plan(inp, validator)
        finally:
            validator.close()
        timings["plan_sec"] = round(time.time() - t0, 2)
        timings["plan_input_tokens"] = float(res.usage["input_tokens"])
        timings["plan_output_tokens"] = float(res.usage["output_tokens"])
        timings["plan_cache_read"] = float(res.usage["cache_read"])
        version = self.repo.insert_plan(
            job.project_id, res.plan, created_by="llm", report=res.report
        )
        self.repo.audit(
            job.user_id, "plan", "project", job.project_id, {"version": version, **res.report}
        )
        log.info(
            "planned",
            version=version,
            ok=res.ok,
            attempts=res.attempts,
            elements=res.report["elements"],
            errors=len(res.report["errors"]),
        )
        if not res.ok:
            errs = "; ".join(e["message"] for e in res.report["errors"][:3])
            raise PipelineError(
                f"The planner could not produce a valid edit ({len(res.report['errors'])} errors): {errs}"
            )
        if self.s.auto_render:
            pub.update(JobStatus.RENDERING_PREVIEW, 0, "Making a quick preview…", **timings)
            self.enqueue(job, JobType.RENDER_PREVIEW, {"plan_version": version, "then_final": True})
        else:
            pub.update(
                JobStatus.AWAITING_PLAN_REVIEW, 100, "Your edit is ready to preview", **timings
            )

    def _style_tokens(self, project: dict[str, Any], use_override: bool = True) -> dict[str, Any]:
        """The preset's tokens (packages/schema/presets) for the project's style_preset — or the
        style written from a reference reel, when the project has one."""
        override = (project.get("style_options") or {}).get("referenceStyle")
        if use_override and isinstance(override, dict) and override.get("palette"):
            return dict(override)
        preset = str(project.get("style_preset") or "mikku-royal")
        candidates = [
            (_REPO_ROOT / "packages" / "schema" / "presets" / f"{preset}.json")
            if _REPO_ROOT
            else None,
            Path("/app/presets") / f"{preset}.json",
        ]
        for c in candidates:
            if c and c.exists():
                return dict(json.loads(c.read_text(encoding="utf-8")))
        fewshot = [
            (_REPO_ROOT / "plans" / "baisa_bling.json") if _REPO_ROOT else None,
            Path("/app/plans/baisa_bling.json"),
        ]
        for c in fewshot:
            if c and c.exists():
                return dict(json.loads(c.read_text(encoding="utf-8"))["style"])
        raise PipelineError(f"Unknown style preset {preset}")

    # ── 7.5 / 7.6 render ──
    def render(self, job: JobMessage, pub: Publisher, preview: bool) -> None:
        status = JobStatus.RENDERING_PREVIEW if preview else JobStatus.RENDERING_FINAL
        pub.update(status, 1, "Preparing the render…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        prefix = project_prefix(job.user_id, job.project_id)
        version = job.payload.get("plan_version")
        plan_row = self.repo.plan(job.project_id, int(str(version)) if version else None)
        if not plan_row:
            raise PipelineError("No edit plan for this project yet.")
        plan = dict(plan_row["plan"])
        tr = self.repo.latest_transcript(job.project_id)
        words = list(tr["words"]) if tr else []
        timings: dict[str, float] = {}

        # images
        t0 = time.time()
        images: dict[str, Path] = {}
        img_dir = work / "img"
        img_dir.mkdir(exist_ok=True)
        for a in self.repo.assets(job.project_id, "image"):
            dest = img_dir / f"{a['id']}{Path(a['storage_key']).suffix.lower() or '.jpg'}"
            if not dest.exists():
                self.storage.download(a["storage_key"], dest)
            images[str(a["id"])] = dest
        src, _ = self.source(job, work)
        if not (work / "voice.wav").exists():
            media.extract_audio(self.s.ffmpeg_bin, src, work / "voice.wav", work / "audio16k.wav")
        timings["fetch_sec"] = round(time.time() - t0, 2)
        pub.update(status, 5, "Extracting frames…", **timings)

        # frames (scratch; deleted after the render)
        t0 = time.time()
        frames_dir = work / ("frames_540" if preview else "frames")
        shutil.rmtree(frames_dir, ignore_errors=True)
        n_frames = media.extract_frames(
            self.s.ffmpeg_bin, src, frames_dir, scale=0.5 if preview else 1.0
        )
        timings["frames_sec"] = round(time.time() - t0, 2)
        pub.update(status, 15, f"{n_frames} frames ready. Rendering…", **timings)

        music = (
            self.s.music_bed_path
            if (
                self.s.enable_music_bed
                and (project.get("style_options") or {}).get("music")
                and self.s.music_bed_path
            )
            else None
        )
        spec = RenderSpec(
            plan,
            words,
            images,
            frames_dir,
            n_frames,
            work / "voice.wav",
            preview=preview,
            music_bed=music,
        )

        def prog(p: float, m: str) -> None:
            pub.update(status, int(15 + 70 * p), m)

        try:
            res = render(self.s, work, spec, prog)
        finally:
            shutil.rmtree(frames_dir, ignore_errors=True)
        timings.update(res.timings)
        pub.update(status, 90, "Uploading your reel…", **timings)

        # upload outputs + asset rows
        t0 = time.time()
        out_prefix = f"{prefix}/out/{job.job_id}"
        if preview:
            self.upload_asset(
                job,
                "preview_540",
                res.final,
                f"{out_prefix}/preview_540.mp4",
                {
                    "width": 540,
                    "height": 960,
                    "durationSec": spec.duration,
                    "planVersion": plan_row["version"],
                },
            )
            timings["upload_sec"] = round(time.time() - t0, 2)
            if job.payload.get("then_final"):
                pub.update(
                    JobStatus.RENDERING_FINAL,
                    0,
                    "Preview ready. Rendering in full quality…",
                    **timings,
                )
                self.enqueue(job, JobType.RENDER_FINAL, {"plan_version": plan_row["version"]})
            else:
                pub.update(JobStatus.READY_PREVIEW, 100, "Preview ready", **timings)
            return
        self.upload_asset(
            job,
            "output_1080",
            res.final,
            f"{out_prefix}/final_1080.mp4",
            {
                "width": 1080,
                "height": 1920,
                "durationSec": spec.duration,
                "planVersion": plan_row["version"],
                "chunks": res.chunks,
            },
        )
        if res.share_720:
            self.upload_asset(
                job,
                "output_720",
                res.share_720,
                f"{out_prefix}/share_720.mp4",
                {"width": 720, "height": 1280, "durationSec": spec.duration},
            )
        if res.thumbnail:
            tid = self.upload_asset(
                job,
                "thumbnail",
                res.thumbnail,
                f"{out_prefix}/thumb.jpg",
                {"width": 540, "height": 960},
            )
            self.repo.update_project(job.project_id, thumbnail_asset_id=tid)
        (work / "cues.json").write_text(json.dumps(res.cues), encoding="utf-8")
        timings["upload_sec"] = round(time.time() - t0, 2)
        self.repo.audit(
            job.user_id,
            "render_final",
            "project",
            job.project_id,
            {"job": job.job_id, "timings": timings, "chunks": res.chunks},
        )
        log.info("rendered", job_id=job.job_id, **timings)
        pub.update(JobStatus.DONE, 100, "Your reel is ready", **timings)

    # ── 7.7 cleanup ──
    def cleanup(self, job: JobMessage, pub: Publisher) -> None:
        keep_outputs = bool(job.payload.get("keep_outputs", True))
        work = self.s.work_dir / job.project_id
        shutil.rmtree(work, ignore_errors=True)
        prefix = project_prefix(job.user_id, job.project_id)
        removed = 0
        for a in self.repo.assets(job.project_id):
            if keep_outputs and a["kind"] in ("output_1080", "output_720", "thumbnail"):
                continue
            try:
                self.storage.delete(a["storage_key"])
                removed += 1
            except Exception as exc:
                log.warning("delete_failed", key=a["storage_key"], error=str(exc))
            self.repo.exec("DELETE FROM assets WHERE id = %s::uuid", (a["id"],))
        if not keep_outputs:
            removed += self.storage.delete_prefix(prefix + "/")
        pub.update(
            JobStatus.DONE,
            100,
            f"Cleaned up ({removed} objects removed).",
            cleanup_removed=float(removed),
        )
