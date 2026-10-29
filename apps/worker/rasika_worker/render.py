"""Chunked, parallel, deterministic render through the engine harness (SPEC §7.6).

1. frames/f%05d.jpg already extracted (media.extract_frames)
2. the harness dir: index.html + rasika-engine.js + config.js (plan, words, images, frames pattern)
3. N worker processes, each with its own headless Chromium, render [start, end) frames and pipe
   JPEGs into ffmpeg with identical encoder settings → seg_NN.mp4
4. concat (no re-encode) → video_noaudio.mp4
5. cues from the engine (window.__cues) → sfx.wav → mix under the voice → mux → final.mp4,
   a 720p share copy and a thumbnail from the reveal moment.
"""

from __future__ import annotations

import base64
import contextlib
import json
import math
import multiprocessing
import shutil
import subprocess
import time
from concurrent.futures import Future, ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

from rasika_worker import media, sfx
from rasika_worker.settings import Settings

log = structlog.get_logger("rasika.worker.render")

SEEK_JS = """async (t) => {
  for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000; } catch (e) {} }
  const r = window.renderFrame(t);
  if (r && typeof r.then === 'function') await r;
  const imgs = [...document.images].filter(i => !i.complete);
  if (imgs.length) await Promise.all(imgs.map(i => i.decode().catch(() => {})));
}"""
CHROMIUM_ARGS = [
    "--allow-file-access-from-files",
    "--disable-web-security",
    "--autoplay-policy=no-user-gesture-required",
]


@dataclass
class RenderSpec:
    plan: dict[str, Any]
    words: list[dict[str, Any]]
    images: dict[str, Path]  # imageId → local file
    frames_dir: Path
    n_frames: int
    voice_wav: Path | None
    preview: bool = False
    music_bed: Path | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    # stock B-roll: element id → (frames dir, count), prepared by the pipeline
    broll: dict[str, tuple[Path, int]] = field(default_factory=dict)
    # the editor's "Studio sound": clean the voice before the mix
    studio_sound: bool = False

    @property
    def duration(self) -> float:
        return float(self.plan["meta"]["durationSec"])

    @property
    def fps(self) -> int:
        return int(self.plan["meta"].get("fps", 30))

    @property
    def scale(self) -> float:
        return 0.5 if self.preview else 1.0

    @property
    def size(self) -> tuple[int, int]:
        return (540, 960) if self.preview else (1080, 1920)


@dataclass
class RenderResult:
    video: Path
    final: Path
    share_720: Path | None
    thumbnail: Path | None
    cues: dict[str, Any]
    timings: dict[str, float]
    chunks: int


def plan_chunks(
    n_frames: int, parallelism: int, fps: int = 30, target_sec: float = 12.0
) -> list[tuple[int, int]]:
    """Split [0, n_frames) into ≤ parallelism chunks of ~target_sec, cut on frame boundaries."""
    if n_frames <= 0:
        return []
    want = max(1, math.ceil(n_frames / (target_sec * fps)))
    n = max(1, min(parallelism, want, n_frames))
    size = math.ceil(n_frames / n)
    out: list[tuple[int, int]] = []
    start = 0
    while start < n_frames:
        end = min(n_frames, start + size)
        out.append((start, end))
        start = end
    return out


def build_harness(work: Path, settings: Settings, spec: RenderSpec, grain: bool) -> Path:
    """work/eng/index.html + rasika-engine.js + config.js; images copied to work/img."""
    eng = work / "eng"
    eng.mkdir(parents=True, exist_ok=True)
    if not settings.engine_bundle.exists():
        raise RuntimeError(
            f"engine bundle missing: {settings.engine_bundle} — run `pnpm --filter @rasika/engine build`"
        )
    shutil.copy(settings.engine_bundle, eng / "rasika-engine.js")
    shutil.copy(settings.engine_harness_html, eng / "index.html")
    img_dir = work / "img"
    img_dir.mkdir(exist_ok=True)
    images: dict[str, str] = {}
    for image_id, src in spec.images.items():
        dest = img_dir / f"{image_id}{src.suffix.lower() or '.jpg'}"
        if src.resolve() != dest.resolve():
            shutil.copy(src, dest)
        images[image_id] = f"../img/{dest.name}"
    frames_rel = (
        Path("..") / spec.frames_dir.relative_to(work)
        if spec.frames_dir.is_relative_to(work)
        else spec.frames_dir.resolve()
    )
    pattern = (
        (frames_rel / "f%05d.jpg").as_posix()
        if not frames_rel.is_absolute()
        else (frames_rel / "f%05d.jpg").as_uri().replace("%2505d", "%05d")
    )
    broll_cfg: dict[str, Any] = {}
    for el_id, (bdir, bn) in spec.broll.items():
        rel = Path("..") / bdir.relative_to(work) if bdir.is_relative_to(work) else bdir.resolve()
        bpat = (
            (rel / "f%05d.jpg").as_posix()
            if not rel.is_absolute()
            else (rel / "f%05d.jpg").as_uri().replace("%2505d", "%05d")
        )
        broll_cfg[el_id] = {"pattern": bpat, "count": bn}
    cfg = {
        "plan": spec.plan,
        "words": spec.words,
        "images": images,
        "frames": {"pattern": pattern, "count": spec.n_frames},
        "broll": broll_cfg,
        "fontBaseUrl": settings.fonts_dir.resolve().as_uri(),
        "grain": grain,
        "scale": spec.scale,
    }
    (eng / "config.js").write_text(
        "window.HARNESS = " + json.dumps(cfg, ensure_ascii=False) + ";\n", encoding="utf-8"
    )
    return eng / "index.html"


def _local_only(route: Any) -> None:
    url = str(route.request.url)
    if url.startswith(("file:", "data:", "blob:", "about:")):
        route.continue_()
    else:
        route.abort()


def _open(p: Any, html: Path, size: tuple[int, int]) -> tuple[Any, Any, Any]:
    browser = p.chromium.launch(args=CHROMIUM_ARGS)
    page = browser.new_page(viewport={"width": size[0], "height": size[1]}, device_scale_factor=1)
    # the renderer needs no network: films can carry model-written drawing code (codeScene), so
    # every request that leaves the machine is refused
    page.route("**/*", _local_only)
    page.add_init_script("window.__RENDER__ = true;")
    page.goto(html.resolve().as_uri())
    page.wait_for_function(
        "typeof window.renderFrame === 'function' && !!window.COMP", timeout=30000
    )
    page.evaluate(
        "async () => { if (window.__ready) await window.__ready; await document.fonts.ready; }"
    )
    cdp = page.context.new_cdp_session(page)
    return browser, page, cdp


def quiet_before_drop(cues: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    """A music machine stays silent until its ball drops: every sound before then is removed
    (entrances and swishes included), so the first sound is the first note."""
    drops = [
        float(el["t0"]) + float(el["dropAt"])
        for el in plan.get("elements") or []
        if el.get("type") == "noteMachine"
    ]
    if not drops:
        return cues
    drop = min(drops) - 0.03
    return {**cues, "cues": [c for c in cues.get("cues") or [] if float(c.get("t", 0)) >= drop]}


def read_cues(html: Path, size: tuple[int, int]) -> dict[str, Any]:
    """Open the harness once: fails fast on a broken plan/bundle and returns the derived cues."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser, page, _ = _open(p, html, size)
        cues = page.evaluate("() => window.__cues")
        browser.close()
    return dict(cues or {"duration": 0, "bpm": 0, "bed_gain": 0, "cues": []})


def render_chunk(args: dict[str, Any]) -> dict[str, Any]:
    """Runs in a separate process: one Chromium, frames [start, end) → one mp4 segment."""
    from playwright.sync_api import sync_playwright

    html = Path(args["html"])
    start, end, fps = int(args["start"]), int(args["end"]), int(args["fps"])
    dest = Path(args["dest"])
    progress_file = Path(args["progress_file"])
    size = tuple(args["size"])
    quality = 80 if args["preview"] else 95
    t0 = time.time()
    ff = subprocess.Popen(
        media.encoder_cmd(args["ffmpeg"], dest, bool(args["preview"])),
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert ff.stdin is not None
    try:
        with sync_playwright() as p:
            browser, page, cdp = _open(p, html, (size[0], size[1]))
            for i in range(start, end):
                t = i / fps
                page.evaluate(SEEK_JS, t)
                data = cdp.send(
                    "Page.captureScreenshot",
                    {
                        "format": "jpeg",
                        "quality": quality,
                        "optimizeForSpeed": True,
                        "captureBeyondViewport": False,
                    },
                )["data"]
                try:
                    ff.stdin.write(base64.b64decode(data))
                except (BrokenPipeError, ValueError, OSError) as exc:
                    # ffmpeg died: surface its own message instead of "flush of closed file"
                    _, err = ff.communicate(timeout=30)
                    raise media.MediaError(
                        f"ffmpeg chunk {dest.name} died at frame {i}: {err.decode('utf-8', 'replace')[-600:] or exc}"
                    ) from exc
                if (i - start) % 15 == 0:
                    progress_file.write_text(str(i - start + 1))
            browser.close()
    finally:
        pass  # communicate() below flushes and closes stdin itself (closing it first makes
        # Python 3.12's communicate raise "flush of closed file")
    _, err = ff.communicate()
    if ff.returncode != 0:
        raise media.MediaError(
            f"ffmpeg chunk {dest.name} failed: {err.decode('utf-8', 'replace')[-600:]}"
        )
    progress_file.write_text(str(end - start))
    return {"dest": str(dest), "frames": end - start, "sec": round(time.time() - t0, 2)}


def render(
    settings: Settings,
    work: Path,
    spec: RenderSpec,
    on_progress: Any = None,
    parallelism: int | None = None,
) -> RenderResult:
    report = on_progress or (lambda p, m: None)
    timings: dict[str, float] = {}
    t_all = time.time()
    grain = not spec.preview
    html = build_harness(work, settings, spec, grain)

    t0 = time.time()
    cues = quiet_before_drop(read_cues(html, spec.size), spec.plan)
    timings["harness_sec"] = round(time.time() - t0, 2)

    # ── chunks in parallel ──
    par = parallelism or settings.effective_parallelism
    chunks = plan_chunks(spec.n_frames, par, spec.fps)
    seg_dir = work / ("seg_preview" if spec.preview else "seg")
    shutil.rmtree(seg_dir, ignore_errors=True)
    seg_dir.mkdir(parents=True)
    jobs = []
    for k, (a, b) in enumerate(chunks):
        jobs.append(
            {
                "html": str(html),
                "start": a,
                "end": b,
                "fps": spec.fps,
                "dest": str(seg_dir / f"seg_{k:03d}.mp4"),
                "progress_file": str(seg_dir / f"p_{k:03d}.txt"),
                "size": list(spec.size),
                "preview": spec.preview,
                "ffmpeg": settings.ffmpeg_bin,
            }
        )
    log.info(
        "render_start",
        frames=spec.n_frames,
        chunks=len(chunks),
        parallelism=par,
        preview=spec.preview,
    )
    t0 = time.time()
    results: list[dict[str, Any]] = []
    # spawn, never fork: a forked child inherits the parent's Playwright/asyncio state and its
    # stdio, which on Linux ends in "ValueError: flush of closed file" when the chunk exits
    with ProcessPoolExecutor(
        max_workers=len(jobs), mp_context=multiprocessing.get_context("spawn")
    ) as ex:
        futs = [ex.submit(render_chunk, j) for j in jobs]
        pending: set[Future[dict[str, Any]]] = set(futs)
        while pending:
            for f in list(pending):
                if f.done():
                    results.append(f.result())  # raises if a chunk failed
                    pending.discard(f)
            done_frames = 0
            for j in jobs:
                pf = Path(str(j["progress_file"]))
                if pf.exists():
                    with contextlib.suppress(ValueError):
                        done_frames += int(pf.read_text() or 0)
            report(
                done_frames / max(1, spec.n_frames),
                f"Rendering frame {min(done_frames, spec.n_frames)} of {spec.n_frames}…",
            )
            if pending:
                time.sleep(1.0)
    timings["render_sec"] = round(time.time() - t0, 2)
    fps_eff = spec.n_frames / max(0.001, timings["render_sec"])
    log.info("render_done", sec=timings["render_sec"], frames_per_sec=round(fps_eff, 1))

    # ── concat → video_noaudio ──
    t0 = time.time()
    parts = [Path(str(j["dest"])) for j in jobs]
    video = work / ("preview_noaudio.mp4" if spec.preview else "video_noaudio.mp4")
    media.concat(settings.ffmpeg_bin, parts, video)
    timings["concat_sec"] = round(time.time() - t0, 2)

    # ── sfx + mix + mux ──
    t0 = time.time()
    final = work / ("preview_540.mp4" if spec.preview else "final_1080.mp4")
    if spec.voice_wav and spec.voice_wav.exists():
        sfx_wav: Path | None = None
        if cues.get("cues"):
            sfx_wav = work / ("sfx_preview.wav" if spec.preview else "sfx.wav")
            sfx.write(str(sfx_wav), sfx.build({**cues, "voice": str(spec.voice_wav)}))
        mix_wav = work / ("mix_preview.wav" if spec.preview else "mix.wav")
        media.mix(
            settings.ffmpeg_bin,
            spec.voice_wav,
            sfx_wav,
            mix_wav,
            music=spec.music_bed,
            studio=spec.studio_sound,
        )
        media.mux(settings.ffmpeg_bin, video, mix_wav, final)
    else:
        shutil.copy(video, final)
    timings["audio_sec"] = round(time.time() - t0, 2)

    share: Path | None = None
    thumb: Path | None = None
    if not spec.preview:
        t0 = time.time()
        share = work / "share_720.mp4"
        media.downscale(settings.ffmpeg_bin, final, share)
        thumb = work / "thumb.jpg"
        media.still(settings.ffmpeg_bin, final, thumbnail_time(spec.plan), thumb)
        timings["derivatives_sec"] = round(time.time() - t0, 2)

    timings["total_render_sec"] = round(time.time() - t_all, 2)
    # frames are scratch: drop them right after the render (SPEC §7.7)
    shutil.rmtree(seg_dir, ignore_errors=True)
    return RenderResult(video, final, share, thumb, cues, timings, len(chunks))


def thumbnail_time(plan: dict[str, Any]) -> float:
    """The reveal moment if the plan has one, else 40 % in."""
    d = float(plan["meta"]["durationSec"])
    for el in plan.get("elements", []):
        if el.get("type") == "reveal":
            return min(d - 0.1, float(el["t0"]) + 0.6)
    return round(d * 0.4, 2)
