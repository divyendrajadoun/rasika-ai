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
from rasika_worker.protocol import JobMessage, JobStatus, JobType
from rasika_worker.render import RenderSpec, render
from rasika_worker.settings import Settings
from rasika_worker.storage import Storage, project_prefix
from rasika_worker.transcribe import Transcriber, make_transcriber

if TYPE_CHECKING:
    from rasika_worker.main import Publisher

log = structlog.get_logger("rasika.worker.pipeline")

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

    @property
    def handlers(self) -> dict[JobType, Callable[[JobMessage, Publisher], None]]:
        return {
            JobType.PROBE: self.probe,
            JobType.TRANSCRIBE: self.transcribe,
            JobType.PLAN: self.plan_stub,
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
        pub.update(
            JobStatus.AWAITING_TRANSCRIPT_REVIEW,
            100,
            f"Transcript ready: {len(words)} words ({result.language}). Designing the edit arrives in Phase 5.",
            transcribe_sec=t_tr,
            transcript_words=float(len(words)),
        )

    def plan_stub(self, job: JobMessage, pub: Publisher) -> None:
        # MOCK: the Claude planner lands in Phase 5; until then a `plan` job reports honestly.
        pub.update(
            JobStatus.AWAITING_TRANSCRIPT_REVIEW, 100, "Planning is not built yet (Phase 5)."
        )

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
