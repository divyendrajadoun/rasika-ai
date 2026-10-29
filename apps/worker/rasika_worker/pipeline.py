"""Job handlers: probe → transcribe (→ plan, Phase 5) · render_preview · render_final · cleanup.

Each handler is idempotent: it recreates its own outputs from the source object and overwrites
its own asset rows. Stage timings go into `jobs.timings` through the Publisher.
"""

from __future__ import annotations

import json
import mimetypes
import shutil
import subprocess
import time
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

import redis
import structlog

from rasika_worker import assemble, cleancut, media, notify, shots
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


#: the neutral starting point a reference style is written over (dark ground, plain sans, no
#: pattern); with a full match every visual field is replaced by what the reference shows
REFERENCE_BASE_PRESET = "ghost-clean"


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
            JobType.PRESENTER: self.presenter,
            JobType.ASSEMBLE: self.assemble,
            JobType.PROBE: self.probe,
            JobType.ANALYSE_REFERENCE: self.analyse_reference,
            JobType.COMPOSE: self.compose,
            JobType.TRANSCRIBE: self.transcribe,
            JobType.PLAN: self.plan,
            JobType.RENDER_PREVIEW: lambda j, p: self.render(j, p, preview=True),
            JobType.RENDER_FINAL: lambda j, p: self.render(j, p, preview=False),
            JobType.RECUT: self.recut,
            JobType.EXPORT: self.export,
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

    # ── brief-driven films: materials → script → narration or score → stage clip → probe ──
    def compose(self, job: JobMessage, pub: Publisher) -> None:
        from rasika_worker import brief as film_brief
        from rasika_worker import music as score
        from rasika_worker.tts import VOICES, DeepgramTTS

        pub.update(JobStatus.PROBING, 1, "Reading your brief…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        opts = dict(project.get("style_options") or {})
        b = dict(opts.get("brief") or {})
        kind_id = str(b.get("kind") or "")
        opts["brief"] = b  # the same dict: what the steps below add to the brief is saved with it
        if kind_id not in film_brief.KINDS:
            raise PipelineError("This brief is missing its kind of film.")
        kind = film_brief.KINDS[kind_id]
        max_dur = float(str(job.payload.get("max_duration_sec") or MAX_DURATION_DEFAULT))
        narrate = bool(b.get("narrate", kind["narrate"]))
        timings: dict[str, float] = {}

        capture = None
        if "url" in kind["needs"] or (kind_id == "diagram" and b.get("url")):
            pub.update(JobStatus.PROBING, 4, "Visiting " + str(b.get("url") or "the site") + "…")
            t0 = time.time()
            try:
                capture = film_brief.capture_site(str(b.get("url") or ""), work / "site")
            except film_brief.UnsafeUrlError as exc:
                raise PipelineError(str(exc)) from exc
            except Exception as exc:
                raise PipelineError(f"Could not open the website: {exc}") from exc
            timings["site_sec"] = round(time.time() - t0, 2)
            prefix = project_prefix(job.user_id, job.project_id)
            for i, (label, path) in enumerate(capture.shots):
                self.upload_asset(
                    job,
                    "image",
                    path,
                    f"{prefix}/img/{path.name}",
                    {
                        "label": label,
                        "sayWhen": "",
                        "order": 100 + i,
                        "source": "site",
                        "url": capture.url,
                    },
                    replace=False,
                )
            pub.update(
                JobStatus.PROBING,
                18,
                f"Captured {len(capture.shots)} screens of {capture.host}.",
                **timings,
            )

        pub.update(JobStatus.PROBING, 22, "Writing the film…", **timings)
        t0 = time.time()
        inputs = {k: v for k, v in b.items() if k not in ("kind", "narrate", "voice")}
        if kind_id == "animate":
            film, usage = self._animate_film(job, pub, work, b, narrate, max_dur, timings)
        elif kind_id == "roundup":
            film, usage = self._roundup_film(job, pub, work, b, max_dur, timings)
        elif kind_id in ("researched", "toon"):
            film, usage = self._researched_film(job, pub, work, b, max_dur, timings)
        else:
            film, usage = self._write_brief(kind_id, inputs, capture, narrate, max_dur)
        timings["write_sec"] = round(time.time() - t0, 2)
        timings["write_input_tokens"] = float(usage["input_tokens"])
        timings["write_output_tokens"] = float(usage["output_tokens"])
        self.repo.audit(
            job.user_id,
            "brief_written",
            "project",
            job.project_id,
            {"kind": kind_id, "usage": usage, "film": film},
        )

        if kind_id == "roundup" and str(b.get("mode") or "voice") == "presenter":
            self._roundup_presenter(job, pub, project, opts, film, b, max_dur, timings)
            return

        mood = str(film["music"]["mood"])
        bpm = film["music"].get("bpm")
        voice = work / "narration.wav"
        unspoken: list[dict[str, Any]] | None = None
        music_bed: dict[str, Any] | None = None
        if narrate and film.get("narration"):
            if not self.s.deepgram_api_key:
                raise PipelineError("Narration is not configured on this server.")
            voice_id = str(b.get("voice") or self.s.deepgram_tts_model)
            if voice_id not in VOICES:
                voice_id = self.s.deepgram_tts_model
            pub.update(
                JobStatus.PROBING,
                40,
                f"Recording the narration ({VOICES[voice_id][0]})…",
                **timings,
            )
            try:
                duration = DeepgramTTS(self.s.deepgram_api_key, voice_id).speak(
                    str(film["narration"]), voice
                )
            except RuntimeError as exc:
                raise PipelineError(f"Narration failed: {exc}") from exc
            if duration > max_dur + 0.5:
                raise PipelineError(
                    f"The narration runs {duration:.0f} s; your plan allows {max_dur:.0f} s."
                )
            music_bed = {
                "mood": mood,
                "bpm": bpm,
                "seed": 7,
            }  # mixed under the voice at render time
        else:
            # no narrator: the on-screen lines are the timeline and the score is the soundtrack
            unspoken, duration = film_brief.timeline(film["lines"])
            pub.update(JobStatus.PROBING, 40, "Scoring the film…", **timings)
            score.write(voice, score.compose(mood, duration, bpm))

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
        opts.update(
            {
                "faceless": True,
                "film": {k: film.get(k) for k in ("title", "lines", "data", "narration")},
                "unspokenWords": unspoken,
                "musicBed": music_bed,
            }
        )
        if unspoken:
            opts["captions"] = False  # the lines are on screen already; captions would repeat them
        if kind_id == "machine":
            opts["sfxIntensity"] = 1.0  # the machine's notes are the music
        if kind_id == "animate":
            from rasika_worker import animate

            opts["referenceStyle"] = animate.palette_style(
                self._style_tokens(project, use_override=False), film
            )
        if capture and (kind.get("through") or kind_id == "flyover") and capture.brand:
            # the film wears the site's own colours and typeface
            opts["referenceStyle"] = film_brief.brand_style(
                self._style_tokens(project, use_override=False), capture.brand
            )
        fields: dict[str, Any] = {"style_options": opts, "duration_sec": duration}
        if film.get("title") and not str(project.get("title") or "").strip():
            fields["title"] = str(film["title"])[:120]
        self.repo.update_project(job.project_id, **fields)
        pub.update(JobStatus.PROBING, 60, "The film is written.", **timings)
        self.enqueue(
            job,
            JobType.PROBE,
            {"source_key": key, "language_hint": "en", "max_duration_sec": max_dur},
        )

    def _write_brief(
        self,
        kind_id: str,
        inputs: dict[str, Any],
        capture: Any,
        narrate: bool,
        max_dur: float,
    ) -> tuple[dict[str, Any], dict[str, int]]:
        from rasika_worker import brief as film_brief

        try:
            return film_brief.write(
                self.anthropic(),
                self.s.anthropic_planner_model,
                kind_id,
                inputs,
                capture,
                narrate,
                max_dur,
            )
        except Exception as exc:
            raise PipelineError(f"Could not write the film: {exc}") from exc

    def _roundup_film(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        b: dict[str, Any],
        max_dur: float,
        timings: dict[str, float],
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """A pasted post: its items, a visit to every link (numbers, screenshots, the README's own
        pictures and clips, saved as the project's assets), then the narration and its visuals."""
        import shutil

        from rasika_worker import roundup

        post = str(b.get("post") or "").strip()
        if len(post) < 20 or not roundup.links_in(post):
            raise PipelineError("Paste a post that lists things with their links.")
        client = self.anthropic()
        pub.update(JobStatus.PROBING, 4, "Reading the post…", **timings)
        t0 = time.time()
        topic, items, closing = roundup.split_post(post, client, self.s.anthropic_fast_model)
        if not items:
            raise PipelineError("The post has no links to research.")
        rdir = work / "research"
        shutil.rmtree(rdir, ignore_errors=True)
        found: list[roundup.Research] = []
        for i, it in enumerate(items):
            pub.update(
                JobStatus.PROBING,
                6 + int(14 * i / len(items)),
                f"Researching {it.name} ({i + 1} of {len(items)})…",
                **timings,
            )
            found.append(
                roundup.research_item(
                    it, rdir / f"item{it.rank}", self.s.ffmpeg_bin, self.s.ffprobe_bin
                )
            )
        timings["research_sec"] = round(time.time() - t0, 2)
        timings["research_media"] = float(sum(len(r.media) for r in found))
        prefix = project_prefix(job.user_id, job.project_id)
        media_map: dict[str, dict[str, Any]] = {}
        first = {"image": True, "research_clip": True}
        for r in found:
            for m in r.media:
                kind = "image" if m.kind == "image" else "research_clip"
                aid = self.upload_asset(
                    job,
                    kind,
                    m.path,
                    f"{prefix}/research/item{r.item.rank}_{m.path.name}",
                    {
                        "label": f"{r.item.name}: {m.label}"[:80],
                        "sayWhen": "",
                        "order": 100 + len(media_map),
                        "source": "research",
                        "url": m.source,
                        "page": r.url,
                        "media": m.id,
                    },
                    replace=first[kind],
                )
                first[kind] = False
                media_map[m.id] = {
                    "asset": aid,
                    "kind": m.kind,
                    "item": r.item.rank,
                    "shows": m.label,
                    "url": m.source,
                    "page": r.url,
                    "w": m.width,
                    "h": m.height,
                    "sec": m.duration,
                }
        ref_id = str(b.get("reference_asset") or "")
        if ref_id:  # the user's reference reel: its look, colours and type for the scenes
            pub.update(JobStatus.PROBING, 21, "Studying your reference reel…", **timings)
            try:
                from rasika_worker import reference as ref_mod

                src = self._asset_file(ref_id, work / "ref_reel")
                if src:
                    report = ref_mod.analyse(
                        self.s.ffmpeg_bin, self.s.ffprobe_bin, src, work / "ref_reel" / "stills"
                    )
                    b["reference"] = roundup.match_reference(
                        client, self.s.anthropic_planner_model, report, list(ref_mod.FONTS)
                    )
            except Exception as exc:  # a reference that cannot be read leaves the chosen look
                log.warning("roundup_reference_failed", error=str(exc))
        pub.update(JobStatus.PROBING, 22, "Writing the script…", **timings)
        lo, hi = roundup.seconds_for(len(items), max_dur)
        try:
            script, usage = roundup.write(
                client,
                self.s.anthropic_planner_model,
                topic,
                found,
                closing,
                (lo, hi),
                str(b.get("cta") or "") or None,
            )
        except Exception as exc:
            raise PipelineError(f"Could not write the script: {exc}") from exc
        lines = [
            {"text": str(x.get("line") or x.get("name") or ""), "sec": 8.0} for x in script["items"]
        ]
        return (
            {
                "title": script.get("title") or topic or "Roundup",
                "narration": script["narration"],
                "lines": [x for x in lines if x["text"]],
                "music": {"mood": "showreel", "bpm": None},
                "data": {
                    "roundup": script,
                    "media": media_map,
                    "facts": {str(r.item.rank): r.facts for r in found},
                    "problems": {str(r.item.rank): r.problems for r in found if r.problems},
                },
            },
            usage,
        )

    def _researched_film(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        b: dict[str, Any],
        max_dur: float,
        timings: dict[str, float],
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """Research the topic (web + the user's links + screenshots of the sources), save what was
        found as the project's assets, write the storyboard and the narration."""
        import shutil

        from rasika_worker import research

        topic = str(b.get("topic") or "").strip()
        if len(topic) < 6:
            raise PipelineError("Say what the reel should explain.")
        client = self.anthropic()
        rdir = work / "research"
        shutil.rmtree(rdir, ignore_errors=True)
        pub.update(JobStatus.PROBING, 4, "Researching the topic…", **timings)
        t0 = time.time()
        found, u1 = research.research(
            topic,
            rdir,
            client,
            self.s.anthropic_planner_model,
            self.s.ffmpeg_bin,
            self.s.ffprobe_bin,
        )
        timings["research_sec"] = round(time.time() - t0, 2)
        timings["research_facts"] = float(len(found.facts))
        prefix = project_prefix(job.user_id, job.project_id)
        media_map: dict[str, dict[str, Any]] = {}
        first = {"image": True, "research_clip": True}
        for m in found.media:
            kind = "image" if m.kind == "image" else "research_clip"
            aid = self.upload_asset(
                job,
                kind,
                m.path,
                f"{prefix}/research/{m.id}_{m.path.name}",
                {
                    "label": m.label[:80],
                    "sayWhen": "",
                    "order": 100 + len(media_map),
                    "source": "research",
                    "url": m.source,
                    "media": m.id,
                },
                replace=first[kind],
            )
            first[kind] = False
            media_map[m.id] = {
                "asset": aid,
                "kind": m.kind,
                "url": m.source,
                "suffix": m.path.suffix.lower(),
            }
        ref_id = str(b.get("reference_asset") or "")
        if ref_id:  # a reel to match: its colours and type dress the studio look
            pub.update(JobStatus.PROBING, 18, "Studying your reference reel…", **timings)
            try:
                from rasika_worker import hyper, roundup
                from rasika_worker import reference as ref_mod

                src = self._asset_file(ref_id, work / "ref_reel")
                if src:
                    report = ref_mod.analyse(
                        self.s.ffmpeg_bin, self.s.ffprobe_bin, src, work / "ref_reel" / "stills"
                    )
                    b["reference"] = roundup.match_reference(
                        client, self.s.anthropic_planner_model, report, list(hyper.FONTS)
                    )
            except Exception as exc:
                log.warning("researched_reference_failed", error=str(exc))
        pub.update(JobStatus.PROBING, 22, "Writing the storyboard…", **timings)
        try:
            if str(b.get("kind")) == "toon":
                from rasika_worker import toon, toonhost

                sb, u2 = toon.write_storyboard(
                    client,
                    self.s.anthropic_planner_model,
                    found,
                    research.seconds_for(max_dur),
                    str(b.get("cta") or "") or None,
                    str(b.get("host") or toonhost.DEFAULT_HOST),
                )
            else:
                sb, u2 = research.write_storyboard(
                    client,
                    self.s.anthropic_planner_model,
                    found,
                    research.seconds_for(max_dur),
                    str(b.get("cta") or "") or None,
                )
        except Exception as exc:
            raise PipelineError(f"Could not write the reel: {exc}") from exc
        usage = {k: u1[k] + u2[k] for k in u1}
        lines = [
            {"text": str(s.get("title") or s.get("pill") or "")[:80], "sec": 3.0}
            for s in sb["scenes"]
        ]
        return (
            {
                "title": sb.get("title") or topic[:80],
                "narration": sb["narration"],
                "lines": [x for x in lines if x["text"]],
                "music": {"mood": "showreel", "bpm": None},
                "data": {
                    "storyboard": sb,
                    "media": media_map,
                    "facts": found.facts,
                    "sources": found.sources,
                    "problems": found.problems,
                },
            },
            usage,
        )

    def _build_toon(
        self,
        proj: Path,
        hdir: Path,
        sb: dict[str, Any],
        words: list[dict[str, Any]],
        duration: float,
        voice: Path,
        files: dict[str, Path],
        b: dict[str, Any],
    ) -> None:
        """A toon reel: the project is laid out once for its sound cues (a pop, a whoosh, a click on
        everything that moves), the effects and a quiet music bed are made, then it is written with
        the voice, the effects and the bed."""
        from rasika_worker import music as score
        from rasika_worker import sfx, toon, toonhost

        host = str(b.get("host") or toonhost.DEFAULT_HOST)
        look = str(b.get("look") or "paper")
        length = duration + 0.6
        _, cues = toon.build_project(
            proj, sb, words, length, [], files, look, host, voice_wav=voice,
            gsap_js=self.s.hyperframes_gsap,
        )  # fmt: skip
        fx = hdir / "toon_sfx.wav"
        sfx.write(
            str(fx),
            sfx.build({"duration": length, "kit": "toon", "cues": cues, "voice": str(voice)}),
        )
        audio: list[tuple[str, Path, float]] = [("voice", voice, 1.0), ("fx", fx, 0.45)]
        if b.get("music", True):
            bed = hdir / "toon_music.wav"
            score.write(bed, score.compose("showreel", length))
            audio.append(("music", bed, 0.1))
        toon.build_project(
            proj, sb, words, length, audio, files, look, host, voice_wav=voice,
            gsap_js=self.s.hyperframes_gsap,
        )  # fmt: skip

    def _render_hyper(
        self,
        job: JobMessage,
        pub: Publisher,
        words: list[dict[str, Any]],
        duration: float,
        options: dict[str, Any],
        timings: dict[str, float],
    ) -> None:
        """A researched reel is drawn by HyperFrames from its storyboard: the project is written,
        rendered with the narration and a sound track on the scene changes, and the outputs land
        where a normal render's do."""
        import shlex
        import shutil

        from rasika_worker import hyper, sfx
        from rasika_worker.roundup import when

        film = dict(options.get("film") or {})
        data = dict(film.get("data") or {})
        sb = dict(data.get("storyboard") or {})
        b = dict(options.get("brief") or {})
        work = self.work(job.project_id)
        hdir = work / "hyper"
        shutil.rmtree(hdir, ignore_errors=True)
        hdir.mkdir(parents=True)
        pub.update(JobStatus.RENDERING_FINAL, 2, "Laying out the scenes…", **timings)
        # the narration, from the stage clip the narrated path made
        src, _ = self.source(job, work)
        voice = hdir / "narration.wav"
        media.run(
            [
                self.s.ffmpeg_bin,
                "-v",
                "error",
                "-y",
                "-i",
                str(src),
                "-vn",
                "-ac",
                "2",
                "-ar",
                "48000",
                str(voice),
            ]
        )
        # the research media
        files: dict[str, Path] = {}
        for mid, m in (data.get("media") or {}).items():
            f = self._asset_file(str(m.get("asset")), hdir / "media")
            if f:
                files[mid] = f
        # a whoosh on every scene change
        cues = []
        for s in (sb.get("scenes") or [])[1:]:
            t = when(words, str(s.get("say") or ""))
            if t:
                cues.append(
                    {"t": round(max(0.0, t - 0.08), 3), "type": "whoosh", "dur": 0.35, "gain": 0.5}
                )
        fx = hdir / "sfx.wav"
        sfx.write(
            str(fx),
            sfx.build(
                {"duration": duration + 0.6, "kit": "click", "cues": cues, "voice": str(voice)}
            ),
        )
        proj = hdir / "project"
        if str(b.get("kind")) == "toon":
            self._build_toon(proj, hdir, sb, words, duration, voice, files, b)
        else:
            theme = hyper.theme_for(str(b.get("theme") or "studio"), b.get("reference"))
            hyper.build_project(
                proj,
                sb,
                words,
                duration + 0.6,
                [("voice", voice, 1.0), ("fx", fx, 0.35)],
                files,
                theme,
                gsap_js=self.s.hyperframes_gsap,
            )
        pub.update(JobStatus.RENDERING_FINAL, 10, "Drawing the reel…", **timings)
        t0 = time.time()
        final = hdir / "final_1080.mp4"
        try:
            hyper.render(
                proj, final, shlex.split(self.s.hyperframes_cli), browser=self.s.hyperframes_browser
            )
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            raise PipelineError(f"The reel could not be drawn: {str(exc)[:400]}") from exc
        timings["hyper_render_sec"] = round(time.time() - t0, 2)
        share = hdir / "share_720.mp4"
        media.run(
            [
                self.s.ffmpeg_bin,
                "-v",
                "error",
                "-y",
                "-i",
                str(final),
                "-vf",
                "scale=720:1280",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                str(share),
            ]
        )
        thumb = hdir / "thumb.jpg"
        media.run(
            [
                self.s.ffmpeg_bin,
                "-v",
                "error",
                "-y",
                "-ss",
                "0.6",
                "-i",
                str(final),
                "-frames:v",
                "1",
                "-vf",
                "scale=540:960",
                str(thumb),
            ]
        )
        pub.update(JobStatus.RENDERING_FINAL, 90, "Uploading your reel…", **timings)
        prefix = project_prefix(job.user_id, job.project_id)
        out_prefix = f"{prefix}/out/{job.job_id}"
        self.upload_asset(
            job,
            "output_1080",
            final,
            f"{out_prefix}/final_1080.mp4",
            {"width": 1080, "height": 1920, "durationSec": duration, "engine": "hyperframes"},
        )
        self.upload_asset(
            job,
            "output_720",
            share,
            f"{out_prefix}/share_720.mp4",
            {"width": 720, "height": 1280, "durationSec": duration},
        )
        tid = self.upload_asset(
            job, "thumbnail", thumb, f"{out_prefix}/thumb.jpg", {"width": 540, "height": 960}
        )
        self.repo.update_project(job.project_id, thumbnail_asset_id=tid)
        self.repo.audit(
            job.user_id,
            "render_final",
            "project",
            job.project_id,
            {"job": job.job_id, "engine": "hyperframes", "timings": timings},
        )
        pub.update(JobStatus.DONE, 100, "Your reel is ready", **timings)
        self._email_ready(job)

    def _animate_film(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        b: dict[str, Any],
        narrate: bool,
        max_dur: float,
        timings: dict[str, float],
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """The /animate studio: style bible + shots, code per shot, checks, one critique loop."""
        from rasika_worker import animate

        client, model = self.anthropic(), self.s.anthropic_planner_model
        refs_dir = work / "refs"
        refs_dir.mkdir(exist_ok=True)
        refs: list[Path] = []
        for a in self.repo.assets(job.project_id, "image")[:3]:
            dest = refs_dir / f"{a['id']}{Path(a['storage_key']).suffix.lower() or '.jpg'}"
            if not dest.exists():
                self.storage.download(a["storage_key"], dest)
            refs.append(dest)
        seconds = min(float(b.get("seconds") or 15), max_dur)
        total = {"input_tokens": 0, "output_tokens": 0}

        def add(u: dict[str, int]) -> None:
            for k in total:
                total[k] += int(u.get(k, 0))

        try:
            pub.update(JobStatus.PROBING, 24, "Studying your style references…", **timings)
            film, u = animate.write_film(
                client,
                model,
                str(b.get("topic") or ""),
                seconds,
                narrate,
                refs,
                str(b.get("focus") or ""),
            )
            add(u)
            shots = film["shots"]
            codes, res, notes, u = animate.draw_shots(
                self.s,
                client,
                model,
                film,
                refs,
                work,
                lambda m: pub.update(JobStatus.PROBING, 32, m, **timings),
            )
            add(u)
        except Exception as exc:
            raise PipelineError(f"The studio could not draw the film: {exc}") from exc
        broken = [i + 1 for i, r in enumerate(res) if r["notes"]]
        if broken:
            raise PipelineError(
                f"Shot(s) {broken} would not draw: {res[broken[0] - 1]['notes'][0]}"
            )
        film["data"] = {
            "style": film.get("style"),
            "facts": film.get("facts") or [],
            "shots": shots,
            "codes": codes,
            "notes": notes,
        }
        film["lines"] = [
            {"text": str(s.get("words") or "♪"), "sec": float(s["sec"])} for s in shots
        ]
        timings["animate_shots"] = float(len(shots))
        return film, total

    # ── AI presenter: HeyGen renders the take, then the normal chain ──
    def presenter(self, job: JobMessage, pub: Publisher) -> None:
        from rasika_worker.presenter import HeyGenClient, make_presenter

        pub.update(JobStatus.PROBING, 1, "Preparing the presenter…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id)
        if not project:
            raise PipelineError("Project not found.")
        script = str(job.payload.get("script") or "").strip()
        voice_id = str(job.payload.get("voice_id") or "")
        look_id = str(job.payload.get("look_id") or "") or None
        if not script or not voice_id:
            raise PipelineError("The presenter needs a script and a voice.")
        if not self.s.heygen_api_key:
            raise PipelineError("AI presenter is not set up on this workspace yet.")
        max_dur = float(str(job.payload.get("max_duration_sec") or MAX_DURATION_DEFAULT))

        photo: Path | None = None
        if not look_id:
            photos = self.repo.assets(job.project_id, "presenter_image")
            if not photos:
                raise PipelineError("No presenter photo was uploaded for this project.")
            a = photos[-1]
            photo = work / ("presenter" + (Path(a["storage_key"]).suffix.lower() or ".jpg"))
            if not photo.exists():
                self.storage.download(a["storage_key"], photo)

        client = HeyGenClient(self.s.heygen_api_key)
        t0 = time.time()

        def prog(status: str, elapsed: float) -> None:
            pub.update(
                JobStatus.PROBING,
                min(55, 10 + int(elapsed / 6)),
                f"Rendering the presenter ({status}, {elapsed:.0f} s)…",
            )

        src = work / "source.mp4"
        try:
            res = make_presenter(
                client,
                script,
                voice_id,
                src,
                photo=photo,
                avatar_id=look_id,
                title=f"Rasika · {str(project.get('title') or 'presenter')[:60]}",
                progress=prog,
            )
        except RuntimeError as exc:
            log.warning("presenter_failed", error=str(exc))
            # users see the reason without the vendor's name; the log above keeps the raw error
            reason = str(exc).replace("HeyGen ", "").replace("HeyGen", "the avatar service")
            raise PipelineError(f"The presenter could not be rendered: {reason}") from exc
        info = media.probe(self.s.ffprobe_bin, src)
        if info.duration_sec > max_dur + 0.5:
            raise PipelineError(
                f"The presenter video runs {info.duration_sec:.0f} s; your plan allows {max_dur:.0f} s. Shorten the script."
            )
        timings: dict[str, float] = {
            "presenter_sec": round(time.time() - t0, 2),
            "presenter_duration": round(info.duration_sec, 2),
        }
        if res.wallet_before is not None and res.wallet_after is not None:
            timings["heygen_wallet_before"] = res.wallet_before
            timings["heygen_wallet_after"] = res.wallet_after
            timings["heygen_cost_usd"] = round(res.wallet_before - res.wallet_after, 2)
        prefix = project_prefix(job.user_id, job.project_id)
        key = f"{prefix}/source.mp4"
        self.upload_asset(
            job,
            "source_video",
            src,
            key,
            {
                "width": info.display_size[0],
                "height": info.display_size[1],
                "fps": info.fps,
                "durationSec": info.duration_sec,
                "heygenVideoId": res.video_id,
                "synthetic": True,
            },
        )
        self.repo.update_project(job.project_id, duration_sec=info.duration_sec)
        self.repo.audit(
            job.user_id,
            "presenter",
            "project",
            job.project_id,
            {"heygen_video_id": res.video_id, **timings},
        )
        pub.update(JobStatus.PROBING, 60, "Presenter ready.", **timings)
        self.enqueue(
            job,
            JobType.PROBE,
            {
                "source_key": key,
                "language_hint": job.payload.get("language_hint") or "auto",
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
        unspoken = (project.get("style_options") or {}).get("unspokenWords")
        if unspoken:
            # a brief film with no narrator: its on-screen lines are the timeline (nothing to hear)
            version = self.repo.insert_transcript(job.project_id, "en", list(unspoken))
            pub.update(JobStatus.PLANNING, 0, "Designing your film…")
            self.enqueue(job, JobType.PLAN, {"transcript_version": version})
            return
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
        narration = ((project.get("style_options") or {}).get("film") or {}).get("narration")
        if narration:  # we wrote these words: recognition only times them
            from rasika_worker import brief as film_brief

            words = film_brief.align_to_script(words, str(narration))
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
        if self.s.anthropic_api_key and words and not narration:
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

        self._remember_transcript(job, version, words)
        opts = dict(project.get("style_options") or {})
        if (
            (opts.get("cleanCut") or opts.get("hookFirst"))
            and words
            and self._clean_cut(job, pub, work, words, timings)
        ):
            return  # the cut goes back through probe → transcribe; planning waits for it
        if opts.get("aiImages") and words and self.s.higgsfield_api_key:
            self._ai_images(job, pub, work, words, opts, timings)
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

    def _ai_images(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        words: list[dict[str, Any]],
        opts: dict[str, Any],
        timings: dict[str, float],
    ) -> None:
        """Up to 6 AI images for the key moments of what is said (Higgsfield); never blocks the edit."""
        from concurrent.futures import ThreadPoolExecutor

        from rasika_worker import imagegen

        have = [
            a
            for a in self.repo.assets(job.project_id, "image")
            if (a.get("meta") or {}).get("source") == "ai"
        ]
        want = min(imagegen.MAX_PER_REEL, int(opts.get("aiImageCount") or imagegen.MAX_PER_REEL))
        made_auto = sum(1 for a in have if (a.get("meta") or {}).get("auto"))
        # N more than any drawn by hand, never past the reel's cap, never twice on a retry
        n = min(want - made_auto, imagegen.MAX_PER_REEL - len(have))
        if n <= 0:
            return
        t0 = time.time()
        pub.update(
            JobStatus.TRANSCRIBING, 97, "Choosing the moments that want a picture…", **timings
        )
        try:
            moments = imagegen.pick_moments(
                self.anthropic(),
                self.s.anthropic_planner_model,
                words,
                n,
                str(opts.get("aiImageStyle") or ""),
                str(opts.get("styleText") or ""),
            )
        except Exception as exc:
            log.warning("ai_images_pick_failed", error=str(exc))
            return
        if not moments:
            return
        pub.update(JobStatus.TRANSCRIBING, 98, f"Drawing {len(moments)} images with AI…", **timings)
        hf = imagegen.Higgsfield(self.s.higgsfield_api_key, self.s.higgsfield_api_secret)
        out_dir = work / "ai_images"
        out_dir.mkdir(exist_ok=True)

        def draw(i: int) -> tuple[int, Path | None, str]:
            try:
                return i, hf.generate(moments[i]["prompt"], out_dir / f"ai_{i + 1}.jpg"), ""
            except Exception as exc:
                return i, None, str(exc)

        with ThreadPoolExecutor(max_workers=3) as pool:
            done = list(pool.map(draw, range(len(moments))))
        prefix = project_prefix(job.user_id, job.project_id)
        made = 0
        for i, path, err in done:
            if not path:
                log.warning("ai_image_failed", error=err)
                continue
            m = moments[i]
            self.upload_asset(
                job,
                "image",
                path,
                f"{prefix}/img/ai_{int(time.time())}_{i + 1}.jpg",
                {
                    "label": m["label"],
                    "sayWhen": m["say_when"],
                    "order": 50 + i,
                    "source": "ai",
                    "auto": True,
                    "prompt": m["prompt"],
                },
                replace=False,
            )
            made += 1
        timings["ai_images"] = float(made)
        timings["ai_images_sec"] = round(time.time() - t0, 2)
        self.repo.audit(
            job.user_id,
            "ai_images",
            "project",
            job.project_id,
            {"made": made, "moments": moments, "errors": [e for _, p, e in done if not p]},
        )

    def _remember_transcript(
        self, job: JobMessage, version: int, words: list[dict[str, Any]]
    ) -> None:
        """The take records which transcript is its own; an uncut take also gets the cuts the
        editor suggests (fillers, repeats, retakes) so the user can keep or restore each."""
        key = str(job.payload.get("source_key") or "")
        srcs = self.repo.assets(job.project_id, "source_video")
        asset = next((a for a in srcs if a["storage_key"] == key), srcs[-1] if srcs else None)
        if not asset:
            return
        patch: dict[str, Any] = {"transcriptVersion": version}
        if not (asset.get("meta") or {}).get("cleanCut"):
            patch["suggestedCuts"] = cleancut.suggest(words)
        try:
            self.repo.merge_asset_meta(str(asset["id"]), patch)
        except Exception as exc:  # the editor falls back to dates; never block the pipeline
            log.warning("remember_transcript_failed", error=str(exc))

    def _clean_cut(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        words: list[dict[str, Any]],
        timings: dict[str, float],
    ) -> bool:
        """Cut the ums, repeats and dead air; True when a cut take was queued for probing."""
        src, asset = self.source(job, work)
        if (asset.get("meta") or {}).get("cleanCut"):
            return False  # this take is already the clean cut
        duration = float(
            (asset.get("meta") or {}).get("durationSec")
            or media.probe(self.s.ffprobe_bin, src).duration_sec
        )
        project = self.repo.project(job.project_id) or {}
        hook = None
        if (project.get("style_options") or {}).get("hookFirst") and self.s.anthropic_api_key:
            try:
                hook = cleancut.pick_hook(self.anthropic(), self.s.anthropic_fast_model, words)
            except Exception as exc:  # never block the cut on the hook pick
                log.warning("hook_pick_failed", error=str(exc))
        plan = cleancut.plan_cuts(words, duration, hook=hook)
        ledger = {
            "cleanCut": True,
            "cleanCutOf": str(asset["id"]),
            "removedSec": plan.removed_sec,
            "removed": plan.removed[:400],
            "keep": plan.keep,
        }
        self.repo.audit(
            job.user_id,
            "clean_cut",
            "project",
            job.project_id,
            {k: v for k, v in ledger.items() if k != "keep"},
        )
        if plan.removed_sec < 0.3 and not plan.moved:
            log.info("clean_cut_nothing", removed_sec=plan.removed_sec)
            return False
        pub.update(
            JobStatus.TRANSCRIBING,
            97,
            f"Clean cut: taking out {len(plan.removed)} fillers and repeats, {plan.removed_sec:.1f} s in all…",
            **timings,
        )
        t0 = time.time()
        dest = work / "source_clean.mp4"
        info = media.probe(self.s.ffprobe_bin, src)
        cleancut.cut(self.s.ffmpeg_bin, src, dest, plan.keep, has_audio=info.has_audio)
        prefix = project_prefix(job.user_id, job.project_id)
        key = f"{prefix}/source_clean.mp4"
        self.upload_asset(job, "source_video", dest, key, ledger, replace=False)
        for stale in ("voice.wav", "audio16k.wav", "proxy.mp4"):
            (work / stale).unlink(missing_ok=True)
        log.info(
            "clean_cut",
            removed=len(plan.removed),
            removed_sec=plan.removed_sec,
            sec=round(time.time() - t0, 2),
        )
        pub.update(JobStatus.PROBING, 0, "Looking at the clean cut…")
        self.enqueue(job, JobType.PROBE, {"source_key": key})
        return True

    # ── many clips → one take, then the normal chain ──
    def assemble(self, job: JobMessage, pub: Publisher) -> None:
        pub.update(JobStatus.PROBING, 2, "Gathering your clips…")
        work = self.work(job.project_id)
        project = self.repo.project(job.project_id) or {}
        opts = dict(project.get("style_options") or {})
        rows = sorted(
            self.repo.assets(job.project_id, "source_clip"),
            key=lambda a: (int((a.get("meta") or {}).get("order", 0)), str(a["created_at"])),
        )
        if not rows:
            raise PipelineError("This project has no clips. Upload them again.")
        hint = str(job.payload.get("language_hint") or opts.get("language") or "auto")
        clip_dir = work / "clips"
        clip_dir.mkdir(exist_ok=True)
        t0 = time.time()
        # one messy video: cut back into the shots it was joined from; the shots are the clips
        messy = bool(opts.get("messy"))
        if messy:
            rows = self._split_messy(job, pub, work, rows, hint)
        rows = [r for r in rows if not (r.get("meta") or {}).get("split")]
        sources: dict[str, Path] = {}
        clips: list[assemble.Clip] = []
        looks: dict[str, shots.Look] = {}
        for n, a in enumerate(rows):
            cid = str(a["id"])
            meta = a.get("meta") or {}
            name = f"Shot {n + 1}" if messy else f"Clip {n + 1}"
            lk = meta.get("look")
            if isinstance(lk, dict):
                looks[cid] = shots.Look(
                    float(lk.get("bright") or 0),
                    float(lk.get("sharp") or 0),
                    float(lk.get("shift") or 0),
                    str(work / "shots" / f"{cid}.jpg"),
                    list(lk.get("flags") or []),
                )
            dest = clip_dir / (cid + Path(a["storage_key"]).suffix.lower())
            if not dest.exists() or dest.stat().st_size != int(a.get("size_bytes") or 0):
                pub.update(
                    JobStatus.PROBING,
                    2 + int(8 * n / len(rows)),
                    f"Fetching clip {n + 1} of {len(rows)}…",
                )
                self.storage.download(a["storage_key"], dest)
            sources[cid] = dest
            if isinstance(meta.get("words"), list) and meta.get("clipDuration"):
                words, duration = list(meta["words"]), float(meta["clipDuration"])
            else:
                # each clip is heard once; a re-assembly reuses what was heard
                info = media.probe(self.s.ffprobe_bin, dest)
                duration = info.duration_sec
                words = []
                if info.has_audio:
                    pub.update(
                        JobStatus.PROBING,
                        10 + int(70 * n / len(rows)),
                        f"Listening to clip {n + 1} of {len(rows)}…",
                    )
                    a16 = clip_dir / f"{cid}.16k.wav"
                    media.run(
                        [
                            self.s.ffmpeg_bin,
                            "-v",
                            "error",
                            "-y",
                            "-i",
                            str(dest),
                            "-vn",
                            "-ac",
                            "1",
                            "-ar",
                            "16000",
                            str(a16),
                        ]
                    )
                    words = [w.as_dict() for w in self.transcriber().transcribe(a16, hint).words]
                    a16.unlink(missing_ok=True)
                self.repo.merge_asset_meta(
                    cid, {"words": words, "clipDuration": duration, "order": n}
                )
            clips.append(assemble.Clip(cid, name, words, duration))

        picked = job.payload.get("order")
        script = str(opts.get("clipScript") or "").strip()
        how = "picked"
        if isinstance(picked, list) and picked:
            decisions = assemble.arrange_as_picked(clips, [str(x) for x in picked])
        elif messy:
            how = "model"
            decisions = None
            if self.s.anthropic_api_key:
                pub.update(JobStatus.PROBING, 82, f"Looking at all {len(clips)} shots…")
                try:
                    decisions = shots.review(
                        self.anthropic(), self.s.anthropic_planner_model, clips, looks, script
                    )
                except Exception as exc:  # never block the edit on the review call
                    log.warning("shot_review_failed", error=str(exc))
            if not decisions:
                how = "script" if script else "recorded"
                decisions = (
                    assemble.arrange_by_script(clips, script)
                    if script
                    else assemble.arrange_recorded(clips)
                )
                decisions = shots.drop_unusable(decisions, looks, {c.id: c for c in clips})
        elif script:
            how = "script"
            decisions = assemble.arrange_by_script(clips, script)
        else:
            how = "recorded"
            decisions = None
            if self.s.anthropic_api_key and len(clips) > 1:
                pub.update(JobStatus.PROBING, 82, "Putting your clips in order…")
                try:
                    decisions = assemble.arrange_with_model(
                        self.anthropic(), self.s.anthropic_fast_model, clips
                    )
                    how = "model" if decisions else how
                except Exception as exc:  # never block the edit on the ordering call
                    log.warning("assemble_order_failed", error=str(exc))
            if not decisions:
                decisions = assemble.arrange_recorded(clips)
        if decisions is None:  # every branch above sets an order; recording order otherwise
            decisions = assemble.arrange_recorded(clips)
        kept = [d for d in decisions if d.keep]
        if not kept:
            raise PipelineError("Every clip was left out. Keep at least one.")
        pub.update(
            JobStatus.PROBING,
            86,
            f"Joining {len(kept)} of {len(clips)} {'shots' if messy else 'clips'}…",
        )
        dest = work / "assembled.mp4"
        assemble.render(self.s.ffmpeg_bin, self.s.ffprobe_bin, sources, decisions, dest)
        info = media.probe(self.s.ffprobe_bin, dest)

        # the joined take replaces every earlier take (and its cuts); the clips stay for re-assembly
        for old in self.repo.assets(job.project_id, "source_video"):
            self.repo.exec("DELETE FROM assets WHERE id = %s::uuid", (str(old["id"]),))
            try:
                self.storage.delete(old["storage_key"])
            except Exception as exc:  # best effort
                log.warning("delete_failed", key=old["storage_key"], error=str(exc))
        for stale in work.glob("*"):
            if stale.is_file() and (
                stale.name.startswith(("source", "original"))
                or stale.name in ("voice.wav", "audio16k.wav", "proxy.mp4")
            ):
                stale.unlink(missing_ok=True)
        prefix = project_prefix(job.user_id, job.project_id)
        key = f"{prefix}/source_assembled_{int(time.time())}.mp4"
        arrangement = [d.as_dict() for d in decisions]
        self.upload_asset(
            job,
            "source_video",
            dest,
            key,
            {
                "assembled": True,
                "arrangement": arrangement,
                "arrangedBy": how,
                "durationSec": info.duration_sec,
            },
            replace=False,
        )
        self.repo.update_project(job.project_id, duration_sec=info.duration_sec)
        self.repo.audit(
            job.user_id,
            "assemble",
            "project",
            job.project_id,
            {
                "clips": len(clips),
                "kept": len(kept),
                "by": how,
                "sec": info.duration_sec,
                "took_sec": round(time.time() - t0, 2),
            },
        )
        max_dur = float(str(job.payload.get("max_duration_sec") or MAX_DURATION_DEFAULT))
        if messy and not opts.get("reviewed") and not job.payload.get("proceed"):
            # the user checks the shots and picks a style before the reel is designed
            over = info.duration_sec > max_dur + 0.5
            pub.update(
                JobStatus.AWAITING_SHOT_REVIEW,
                100,
                f"Cleaned up: kept {len(kept)} of {len(clips)} shots, {info.duration_sec:.0f} s."
                + (f" Your plan allows {max_dur:.0f} s, so leave a few out." if over else "")
                + " Check them, pick a style and make your reel.",
            )
            return
        if info.duration_sec > max_dur + 0.5:
            raise PipelineError(
                f"The kept clips add up to {info.duration_sec:.0f} s; your plan allows {max_dur:.0f} s. "
                "Leave a clip out below and join them again."
            )
        pub.update(JobStatus.PROBING, 0, f"Joined {len(kept)} clips into one take. Looking at it…")
        self.enqueue(
            job,
            JobType.PROBE,
            {"source_key": key, "language_hint": hint, "max_duration_sec": max_dur},
        )

    def _split_messy(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        rows: list[dict[str, Any]],
        hint: str,
    ) -> list[dict[str, Any]]:
        """One messy video (or a few): each is heard once, cut back into the shots it was joined
        from, and every shot is saved as a clip of the project with its words and its look. The
        originals stay (marked `split`); a re-assembly reuses the shots."""
        done = [r for r in rows if (r.get("meta") or {}).get("shotOf")]
        if done:
            return done
        clip_dir = work / "clips"
        sdir = work / "shots"
        sdir.mkdir(exist_ok=True)
        prefix = project_prefix(job.user_id, job.project_id)
        originals = [r for r in rows if not (r.get("meta") or {}).get("split")]
        n_shot = 0
        for k, a in enumerate(originals):
            oid = str(a["id"])
            src = clip_dir / (oid + Path(a["storage_key"]).suffix.lower())
            if not src.exists() or src.stat().st_size != int(a.get("size_bytes") or 0):
                pub.update(JobStatus.PROBING, 2, "Fetching your video…")
                self.storage.download(a["storage_key"], src)
            info = media.probe(self.s.ffprobe_bin, src)
            words: list[dict[str, Any]] = []
            if info.has_audio:
                pub.update(JobStatus.PROBING, 6, "Listening to your video…")
                a16 = clip_dir / f"{oid}.16k.wav"
                media.run(
                    [self.s.ffmpeg_bin, "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1",
                     "-ar", "16000", str(a16)]
                )  # fmt: skip
                words = [w.as_dict() for w in self.transcriber().transcribe(a16, hint).words]
                a16.unlink(missing_ok=True)
            pub.update(JobStatus.PROBING, 30, "Finding where your shots were joined…")
            cuts = shots.find_cuts(shots.scene_scores(self.s.ffmpeg_bin, src), words)
            segs = shots.segments(cuts, info.duration_sec)
            per = shots.split_words(words, segs)
            looks = []
            for n, (s0, s1) in enumerate(segs):
                pub.update(
                    JobStatus.PROBING,
                    34 + int(20 * n / len(segs)),
                    f"Checking shot {n + 1} of {len(segs)}…",
                )
                looks.append(shots.look(self.s.ffmpeg_bin, src, s0, s1, sdir / f"{oid}_{n}.jpg"))
            shots.hints(looks)
            for n, (s0, s1) in enumerate(segs):
                pub.update(
                    JobStatus.PROBING,
                    56 + int(24 * n / len(segs)),
                    f"Cutting shot {n + 1} of {len(segs)}…",
                )
                part = clip_dir / f"{oid}_shot{n:02d}.mp4"
                cmd = [self.s.ffmpeg_bin, "-v", "error", "-y", "-ss", f"{s0:.3f}",
                       "-t", f"{s1 - s0:.3f}", "-i", str(src), "-map", "0:v:0"]  # fmt: skip
                if info.has_audio:
                    cmd += ["-map", "0:a:0", "-c:a", "aac", "-b:a", "192k"]
                cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(part)]  # fmt: skip
                media.run(cmd)
                sid = self.upload_asset(
                    job,
                    "source_clip",
                    part,
                    f"{prefix}/shots/{oid}_{n:02d}.mp4",
                    {
                        "shotOf": oid,
                        "shotStart": s0,
                        "shotEnd": s1,
                        "order": n_shot,
                        "words": per[n],
                        "clipDuration": round(s1 - s0, 3),
                        "durationSec": round(s1 - s0, 3),
                        "look": looks[n].as_dict(),
                    },
                    replace=False,
                )
                n_shot += 1
                part.replace(clip_dir / f"{sid}.mp4")
                if looks[n].still and Path(looks[n].still).is_file():
                    Path(looks[n].still).replace(sdir / f"{sid}.jpg")
            self.repo.merge_asset_meta(oid, {"split": True, "shots": len(segs), "order": k})
            log.info("messy_split", asset=oid, shots=len(segs), cuts=len(cuts))
        return sorted(
            (
                r
                for r in self.repo.assets(job.project_id, "source_clip")
                if (r.get("meta") or {}).get("shotOf")
            ),
            key=lambda r: int((r.get("meta") or {}).get("order", 0)),
        )

    # ── the editor: the original take cut to the words the user kept ──
    def recut(self, job: JobMessage, pub: Publisher) -> None:
        pub.update(JobStatus.PROBING, 2, "Cutting your take…")
        work = self.work(job.project_id)
        srcs = self.repo.assets(job.project_id, "source_video")
        original = next((a for a in srcs if not (a.get("meta") or {}).get("cleanCut")), None)
        if not original:
            raise PipelineError("The original take is missing.")
        version = int(str(job.payload.get("transcript_version") or 0))
        row = self.repo.one(
            "SELECT words FROM transcripts WHERE project_id = %s::uuid AND version = %s",
            (job.project_id, version),
        )
        if not row:
            raise PipelineError("The transcript this edit was made on is missing.")
        words = list(row["words"])
        raw = job.payload.get("removed")
        picked = raw if isinstance(raw, list) else []
        removed = {int(i) for i in picked if 0 <= int(i) < len(words)}
        dest_src = work / ("original" + Path(original["storage_key"]).suffix.lower())
        if not dest_src.exists() or dest_src.stat().st_size != int(original.get("size_bytes") or 0):
            self.storage.download(original["storage_key"], dest_src)
        info = media.probe(self.s.ffprobe_bin, dest_src)
        try:
            plan = cleancut.plan_kept(words, info.duration_sec, removed)
        except ValueError as exc:
            raise PipelineError("Keep at least one word.") from exc
        dest = work / "source_edit.mp4"
        cleancut.cut(self.s.ffmpeg_bin, dest_src, dest, plan.keep, has_audio=info.has_audio)
        ledger = {
            "cleanCut": True,
            "userEdit": True,
            "cleanCutOf": str(original["id"]),
            "removedSec": plan.removed_sec,
            "removedIdx": sorted(removed),
            "transcriptOf": version,
            "keep": plan.keep,
        }
        prefix = project_prefix(job.user_id, job.project_id)
        key = f"{prefix}/source_edit_{int(time.time())}.mp4"
        # earlier cuts are replaced; the original stays (every edit starts from it)
        for old in srcs:
            if (old.get("meta") or {}).get("cleanCut"):
                self.repo.exec("DELETE FROM assets WHERE id = %s::uuid", (str(old["id"]),))
                try:
                    self.storage.delete(old["storage_key"])
                except Exception as exc:  # best effort
                    log.warning("delete_failed", key=old["storage_key"], error=str(exc))
        self.upload_asset(job, "source_video", dest, key, ledger, replace=False)
        if not (original.get("meta") or {}).get("transcriptVersion"):
            # a take from before the editor: from now on it names its own transcript
            self.repo.merge_asset_meta(str(original["id"]), {"transcriptVersion": version})
        for stale in ("source.mp4", "source.mov", "voice.wav", "audio16k.wav", "proxy.mp4"):
            (work / stale).unlink(missing_ok=True)
        self.repo.audit(
            job.user_id,
            "recut",
            "project",
            job.project_id,
            {k: v for k, v in ledger.items() if k != "keep"},
        )
        pub.update(
            JobStatus.PROBING,
            0,
            f"Cut {len(removed)} words, {plan.removed_sec:.1f} s. Looking at your edit…",
        )
        self.enqueue(job, JobType.PROBE, {"source_key": key})

    # ── the finished reel in another shape (fitted, on a soft blurred backdrop) ──
    def export(self, job: JobMessage, pub: Publisher) -> None:
        try:
            self._export(job, pub)
        except Exception as exc:  # the reel itself is fine: say so instead of failing the project
            log.error("export_failed", error=str(exc))
            pub.update(JobStatus.DONE, 100, f"The export failed ({exc}). Your reel is unchanged.")

    def _export(self, job: JobMessage, pub: Publisher) -> None:
        fmt = str(job.payload.get("format") or "")
        if fmt not in media.EXPORT_SIZES:
            raise PipelineError(f"Unknown export shape: {fmt}")
        pub.update(JobStatus.RENDERING_FINAL, 5, f"Exporting {fmt}…")
        work = self.work(job.project_id)
        outs = self.repo.assets(job.project_id, "output_1080")
        if not outs:
            raise PipelineError("Render the reel before exporting it.")
        src = work / "export_src.mp4"
        if not src.exists() or src.stat().st_size != int(outs[-1].get("size_bytes") or 0):
            self.storage.download(outs[-1]["storage_key"], src)
        dest = work / f"export_{fmt.replace(':', 'x')}.mp4"
        t0 = time.time()
        media.export_shape(self.s.ffmpeg_bin, src, dest, fmt)
        prefix = project_prefix(job.user_id, job.project_id)
        name = fmt.replace(":", "x")
        old = [
            a
            for a in self.repo.assets(job.project_id, "export")
            if (a.get("meta") or {}).get("format") == fmt
        ]
        for a in old:
            self.repo.exec("DELETE FROM assets WHERE id = %s::uuid", (str(a["id"]),))
        self.upload_asset(
            job,
            "export",
            dest,
            f"{prefix}/export_{name}_{int(time.time())}.mp4",
            {"format": fmt, "of": str(outs[-1]["id"]), "sec": round(time.time() - t0, 1)},
            replace=False,
        )
        pub.update(JobStatus.DONE, 100, f"{fmt} export ready.")

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
        # a reference is matched in full unless an older draft asked for less
        fidelity = str(opts.get("fidelity") or "look")

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
        # the reference is the style: start from a neutral base, never the house look or a picked preset
        preset = self._style_tokens({"style_preset": REFERENCE_BASE_PRESET}, use_override=False)
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
        self.enqueue(
            job, JobType.PLAN, {"transcript_version": job.payload.get("transcript_version")}
        )

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
        if (options.get("brief") or {}).get("kind") == "animate":
            self._plan_animate(job, pub, words, duration, style, options, timings)
            return
        if (options.get("brief") or {}).get("kind") in ("researched", "toon"):
            self._render_hyper(job, pub, words, duration, options, timings)
            return
        if (options.get("brief") or {}).get("kind") == "roundup":
            presenter = (
                subject.as_plan_subject()
                if str((options.get("brief") or {}).get("mode") or "") == "presenter"
                else None
            )
            self._plan_roundup(
                job,
                pub,
                words,
                duration,
                style,
                options,
                timings,
                [i["id"] for i in images],
                presenter,
            )
            return
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
            reference_stills=self._reference_stills(project, work),
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
        if res.ok and options.get("animated"):
            res.plan = self._animated_scenes(
                job,
                pub,
                work,
                res.plan,
                words,
                duration,
                style,
                options,
                [i["id"] for i in images],
                timings,
            )
        # stock B-roll: resolve each `broll` query to a Pexels clip now, so the plan records its source
        if (project.get("style_options") or {}).get("broll"):
            t0 = time.time()
            res.plan = self._resolve_broll(res.plan, pub)
            timings["broll_sec"] = round(time.time() - t0, 2)
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

    def _animated_scenes(
        self,
        job: JobMessage,
        pub: Publisher,
        work: Path,
        plan: dict[str, Any],
        words: list[dict[str, Any]],
        duration: float,
        style: dict[str, Any],
        options: dict[str, Any],
        image_ids: list[str],
        timings: dict[str, float],
    ) -> dict[str, Any]:
        """Animated scenes drawn in code cut in over the speaker on key lines (the Animate studio
        working on a talking-head edit). Scenes that would not draw are left out; if none survive,
        the edit goes ahead without them and the audit says why."""
        from rasika_worker import animate

        client, model = self.anthropic(), self.s.anthropic_planner_model
        t0 = time.time()
        n = max(1, min(4, int(options.get("animatedCount") or 2)))
        usage = {"input_tokens": 0, "output_tokens": 0}

        def add(u: dict[str, int]) -> None:
            for k in usage:
                usage[k] += int(u.get(k, 0))

        try:
            pub.update(JobStatus.PLANNING, 60, "Choosing the lines to animate…", **timings)
            film, u = animate.cutaways(
                client, model, words, duration, n, style, str(options.get("animatedLook") or "")
            )
            add(u)
            codes, res, notes, u = animate.draw_shots(
                self.s,
                client,
                model,
                film,
                [],
                work / "anim",
                lambda m: pub.update(JobStatus.PLANNING, 70, m, **timings),
            )
            add(u)
            good = [i for i, r in enumerate(res) if not r["notes"]]
            dropped = [
                {"line": film["shots"][i].get("line"), "why": r["notes"][0]}
                for i, r in enumerate(res)
                if r["notes"]
            ]
            if not good:
                raise ValueError("no scene passed the render checks")
            merged = animate.insert_cutaways(
                plan, [film["shots"][i] for i in good], [codes[i] for i in good]
            )
            validator = ChromiumValidator(self.s)
            try:
                r = validator(merged, words, image_ids)
            finally:
                validator.close()
            errors = [i for i in r.get("issues") or [] if i.get("level") == "error"]
            if errors:
                raise ValueError("; ".join(e["message"] for e in errors[:3]))
            timings["animated_scenes"] = float(len(good))
            timings["animated_sec"] = round(time.time() - t0, 2)
            self.repo.audit(
                job.user_id,
                "animated_scenes",
                "project",
                job.project_id,
                {
                    "scenes": [film["shots"][i] for i in good],
                    "dropped": dropped,
                    "notes": notes,
                    **usage,
                },
            )
            return dict(r["plan"])
        except Exception as exc:
            log.warning("animated scenes skipped", error=str(exc))
            timings["animated_scenes"] = 0.0
            self.repo.audit(
                job.user_id,
                "animated_scenes",
                "project",
                job.project_id,
                {"skipped": str(exc)[:500], **usage},
            )
            return plan

    def _roundup_presenter(
        self,
        job: JobMessage,
        pub: Publisher,
        project: dict[str, Any],
        opts: dict[str, Any],
        film: dict[str, Any],
        b: dict[str, Any],
        max_dur: float,
        timings: dict[str, float],
    ) -> None:
        """A roundup spoken by the AI presenter: the script goes to the presenter step, whose video
        becomes the source; probe → transcribe (timed to the script) → the roundup plan follow."""
        voice_id = str(b.get("presenter_voice") or "")
        look_id = str(b.get("look_id") or "") or None
        if not voice_id:
            raise PipelineError("Choose the presenter's voice.")
        if not look_id and not self.repo.assets(job.project_id, "presenter_image"):
            raise PipelineError("Choose a presenter look or upload a photo.")
        opts.update(
            {
                "faceless": False,
                "film": {k: film.get(k) for k in ("title", "lines", "data", "narration")},
                "unspokenWords": None,
                "musicBed": None,
            }
        )
        fields: dict[str, Any] = {"style_options": opts}
        if film.get("title") and not str(project.get("title") or "").strip():
            fields["title"] = str(film["title"])[:120]
        self.repo.update_project(job.project_id, **fields)
        pub.update(
            JobStatus.PROBING, 30, "The script is written. Rendering the presenter…", **timings
        )
        self.enqueue(
            job,
            JobType.PRESENTER,
            {
                "script": str(film["narration"]),
                "voice_id": voice_id,
                "look_id": look_id,
                "max_duration_sec": max_dur,
                "language_hint": "en",
            },
        )

    def _plan_roundup(
        self,
        job: JobMessage,
        pub: Publisher,
        words: list[dict[str, Any]],
        duration: float,
        style: dict[str, Any],
        options: dict[str, Any],
        timings: dict[str, float],
        image_ids: list[str],
        presenter: dict[str, Any] | None = None,
    ) -> None:
        """The roundup's edit is fixed by its script (roundup.build_plan): validate, save, render."""
        from rasika_worker import roundup

        film = dict(options.get("film") or {})
        if presenter:
            plan = roundup.build_plan(style, film, words, duration, presenter)
        else:  # the designed scenes, in the chosen look (or the reference reel's colours and type)
            b = dict(options.get("brief") or {})
            ref = (b.get("reference") or {}) if isinstance(b.get("reference"), dict) else {}
            plan = roundup.build_scenes(
                style,
                film,
                words,
                duration,
                str(ref.get("look") or b.get("look") or roundup.DEFAULT_LOOK),
                ref.get("colors") or None,
                ref.get("fonts") or None,
            )
        validator = ChromiumValidator(self.s)
        try:
            r = validator(plan, words, image_ids)
        finally:
            validator.close()
        errors = [i for i in r.get("issues") or [] if i.get("level") == "error"]
        if errors:
            raise PipelineError(
                "The roundup did not validate: " + "; ".join(e["message"] for e in errors[:3])
            )
        report = {
            "elements": len(r["plan"]["elements"]),
            "errors": [],
            "fixed": [i for i in r.get("issues") or [] if i.get("level") == "fixed"][:40],
        }
        version = self.repo.insert_plan(
            job.project_id, r["plan"], created_by="roundup", report=report
        )
        self.repo.audit(
            job.user_id, "plan", "project", job.project_id, {"version": version, **report}
        )
        if self.s.auto_render:
            pub.update(JobStatus.RENDERING_PREVIEW, 0, "Making a quick preview…", **timings)
            self.enqueue(job, JobType.RENDER_PREVIEW, {"plan_version": version, "then_final": True})
        else:
            pub.update(
                JobStatus.AWAITING_PLAN_REVIEW, 100, "Your reel is ready to preview", **timings
            )

    def _plan_animate(
        self,
        job: JobMessage,
        pub: Publisher,
        words: list[dict[str, Any]],
        duration: float,
        style: dict[str, Any],
        options: dict[str, Any],
        timings: dict[str, float],
    ) -> None:
        from rasika_worker import animate

        film = dict(options.get("film") or {})
        data = dict(film.get("data") or {})
        plan = animate.build_plan(
            style,
            {"shots": data.get("shots") or []},
            list(data.get("codes") or []),
            duration,
            bool(film.get("narration")),
        )
        validator = ChromiumValidator(self.s)
        try:
            r = validator(plan, words, [])
        finally:
            validator.close()
        errors = [i for i in r.get("issues") or [] if i.get("level") == "error"]
        if errors:
            raise PipelineError(
                "The animated film did not validate: " + "; ".join(e["message"] for e in errors[:3])
            )
        report = {
            "elements": len(plan["elements"]),
            "errors": [],
            "fixed": [i for i in r.get("issues") or [] if i.get("level") == "fixed"][:40],
        }
        version = self.repo.insert_plan(
            job.project_id, r["plan"], created_by="animate", report=report
        )
        self.repo.audit(
            job.user_id, "plan", "project", job.project_id, {"version": version, **report}
        )
        if self.s.auto_render:
            pub.update(JobStatus.RENDERING_PREVIEW, 0, "Making a quick preview…", **timings)
            self.enqueue(job, JobType.RENDER_PREVIEW, {"plan_version": version, "then_final": True})
        else:
            pub.update(
                JobStatus.AWAITING_PLAN_REVIEW, 100, "Your film is ready to preview", **timings
            )

    # ── stock B-roll (Pexels) ──
    def _stock(self) -> Any:
        from rasika_worker.stock import PexelsClient

        if not self.s.pexels_api_key:
            raise PipelineError(
                "This edit asks for stock B-roll but the worker has no Pexels key (PEXELS_API_KEY)."
            )
        cache = self.s.stock_cache_dir or (self.s.work_dir / "stock")
        return PexelsClient(self.s.pexels_api_key, cache)

    def _resolve_broll(self, plan: dict[str, Any], pub: Publisher) -> dict[str, Any]:
        """Fill `source` on every broll element; drop the ones Pexels has nothing for."""
        from rasika_worker.stock import broll_elements

        els = [e for e in broll_elements(plan) if not e.get("source")]
        if not els:
            return plan
        client = self._stock()
        kept: list[str] = []
        for i, el in enumerate(els):
            pub.update(
                JobStatus.PLANNING,
                60 + int(30 * i / len(els)),
                f"Finding stock footage: {el['query']}…",
            )
            need = float(el["t1"]) - float(el["t0"])
            try:
                clip = client.resolve(str(el["query"]), need)
            except Exception as exc:
                log.warning("stock_failed", query=el["query"], error=str(exc))
                clip = None
            if clip is None:
                continue
            el["source"] = clip.as_source()
            kept.append(str(el["id"]))
        asked = {str(e["id"]) for e in els}
        plan["elements"] = [
            e
            for e in plan["elements"]
            if e.get("type") != "broll" or str(e.get("id")) not in asked or str(e.get("id")) in kept
        ]
        log.info("broll_resolved", asked=len(els), found=len(kept))
        return plan

    def _prepare_broll(
        self, plan: dict[str, Any], work: Path, preview: bool
    ) -> dict[str, tuple[Path, int]]:
        """Frames for each resolved broll window (re-downloads the clip if the cache was cleaned)."""
        from rasika_worker.stock import StockClip, broll_elements, extract_window

        out: dict[str, tuple[Path, int]] = {}
        els = [e for e in broll_elements(plan) if e.get("source")]
        if not els:
            return out
        for el in [e for e in els if e["source"].get("provider") == "asset"]:
            # the project's own clips (a roundup's demo videos): the whole picture over a blur
            bdir = work / ("broll_540" if preview else "broll") / str(el["id"])
            own = self._asset_file(str(el["source"]["assetId"]), work / "own_clips")
            if not own:
                continue
            n = extract_window(
                self.s.ffmpeg_bin,
                own,
                bdir,
                float(el["t1"]) - float(el["t0"]),
                scale=0.5 if preview else 1.0,
                fit="contain",
            )
            if n:
                out[str(el["id"])] = (bdir, n)
        els = [e for e in els if e["source"].get("provider") != "asset"]
        if not els:
            return out
        client = self._stock()
        for el in els:
            src = el["source"]
            clip = StockClip(
                id=int(src["id"]),
                url=str(src.get("url") or ""),
                author=str(src.get("author") or ""),
                duration=float(src.get("duration") or 0),
                file_url="",
                width=0,
                height=0,
            )
            cached = sorted(client.cache.glob(f"pexels_{clip.id}_*.mp4"))
            if cached:
                clip.file = cached[-1]
            else:
                found = client.resolve(str(el["query"]), float(el["t1"]) - float(el["t0"]))
                if not found:
                    continue
                clip = found
            if not clip.file:
                continue
            bdir = work / ("broll_540" if preview else "broll") / str(el["id"])
            n = extract_window(
                self.s.ffmpeg_bin,
                clip.file,
                bdir,
                float(el["t1"]) - float(el["t0"]),
                scale=0.5 if preview else 1.0,
            )
            if n:
                out[str(el["id"])] = (bdir, n)
        return out

    def _asset_file(self, asset_id: str, folder: Path) -> Path | None:
        """One asset's file in the work folder (downloaded once)."""
        row = self.repo.asset(asset_id)
        if not row:
            return None
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / f"{asset_id}{Path(str(row['storage_key'])).suffix.lower() or '.mp4'}"
        if not dest.exists():
            self.storage.download(str(row["storage_key"]), dest)
        return dest

    def _reference_stills(self, project: dict[str, Any], work: Path, n: int = 4) -> list[Path]:
        """Frames of the reference reel for the planner ("Match a reference" projects only): the
        stills saved while the reference was analysed, re-extracted if the work folder was cleared."""
        from rasika_worker import reference

        opts = project.get("style_options") or {}
        if opts.get("source") != "reference":
            return []
        ref_dir = work / "ref"
        stills = sorted(ref_dir.glob("*.jpg")) if ref_dir.exists() else []
        if not stills:
            refs = self.repo.assets(str(project["id"]), "reference_video")
            if not refs:
                return []
            dest = work / ("reference" + Path(refs[-1]["storage_key"]).suffix.lower())
            if not dest.exists():
                self.storage.download(refs[-1]["storage_key"], dest)
            report = reference.analyse(self.s.ffmpeg_bin, self.s.ffprobe_bin, dest, ref_dir)
            stills = [Path(p) for p in report.stills]
        if len(stills) <= n:
            return stills
        step = len(stills) / n
        return [stills[int(i * step + step / 2)] for i in range(n)]

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
        if preset != "mikku-royal":
            # never fall back silently: a worker image that predates a preset would otherwise
            # render every new style as the house look
            raise PipelineError(
                f"The style '{preset}' is not installed on this worker yet (rebuild the worker image)."
            )
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
        bed = (project.get("style_options") or {}).get("musicBed")
        if isinstance(bed, dict) and bed.get("mood"):
            from rasika_worker import music as score

            music = work / "music_bed.wav"
            if not music.exists():
                dur = float(plan["meta"]["durationSec"])
                score.write(
                    music,
                    score.compose(str(bed["mood"]), dur, bed.get("bpm"), int(bed.get("seed") or 7)),
                )
        t0 = time.time()
        broll = self._prepare_broll(plan, work, preview)
        if broll:
            timings["broll_frames_sec"] = round(time.time() - t0, 2)
        spec = RenderSpec(
            plan,
            words,
            images,
            frames_dir,
            n_frames,
            work / "voice.wav",
            preview=preview,
            music_bed=music,
            broll=broll,
            studio_sound=bool((project.get("style_options") or {}).get("studioSound")),
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
        self._email_ready(job)

    def _email_ready(self, job: JobMessage) -> None:
        """Tell the owner by email (they may have closed the page while it rendered)."""
        try:
            row = self.repo.one(
                "SELECT p.email, j.title FROM profiles p, projects j "
                "WHERE p.user_id = %s::uuid AND j.id = %s::uuid",
                (job.user_id, job.project_id),
            )
            if row and row.get("email"):
                sent = notify.reel_ready(
                    self.s, str(row["email"]), str(row["title"]), job.project_id
                )
                log.info("ready_email", sent=sent)
        except Exception as exc:  # never fail the render over an email
            log.warning("ready_email_failed", error=str(exc))

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
