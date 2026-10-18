#!/usr/bin/env python3
"""
Golden test (SPEC §6.4): render plans/baisa_bling.json with the engine (frames mode) and compare
against the hand-written reference composition at ~44 timestamps. SSIM ≥ threshold on every still,
grain excluded on both sides.

The reference and the engine are loaded in the same headless Chromium, pointed at the same video
frames, fonts and images, so the only variable is the engine itself.

  python tools/golden/golden.py                       # synthetic stand-in footage (CI)
  python tools/golden/golden.py --video IMG_7571.MP4  # real footage (extracts frames with ffmpeg)
  python tools/golden/golden.py --report out/golden   # write side-by-side PNGs + report.json

Exit code 1 when any still is below the threshold.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import pathlib
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageDraw
from skimage.metrics import structural_similarity

ROOT = pathlib.Path(__file__).resolve().parents[2]
REF_DIR = ROOT / "reference" / "baisa_bling"
ENGINE_DIR = ROOT / "packages" / "engine"
PLAN = ROOT / "plans" / "baisa_bling.json"
WORDS = ROOT / "plans" / "baisa_bling.words.json"

# Scene entries and mid-scene moments: every element type appears at least once.
TIMESTAMPS = [
    0.5, 1.2, 2.2, 3.5, 4.8, 5.5, 7.0, 8.5, 10.0, 12.0, 13.3, 14.9, 15.8, 16.4, 18.0, 19.3,
    21.0, 23.0, 25.0, 28.0, 30.5, 33.0, 35.0, 36.3, 37.3, 38.7, 39.8, 42.0, 44.5, 46.7, 48.4,
    50.3, 52.0, 53.8, 56.0, 58.5, 60.0, 61.0, 64.0, 67.0, 68.3, 69.3, 71.0, 73.5, 75.6, 76.5,
    79.0, 81.5, 82.8, 83.7, 84.5, 86.0, 88.5, 89.8,
]

SEEK_JS = """async (t) => {
  for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000; } catch (e) {} }
  const r = window.renderFrame(t);
  if (r && typeof r.then === 'function') await r;
  const imgs = [...document.images].filter(i => !i.complete);
  if (imgs.length) await Promise.all(imgs.map(i => i.decode().catch(() => {})));
}"""


def synth_frame(path: pathlib.Path) -> None:
    """A stand-in 'talking head' frame: warm wall, a dark figure, a bright prop at the choker point."""
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), (214, 196, 170))
    d = ImageDraw.Draw(img)
    for y in range(h):  # gentle vertical gradient
        k = y / h
        d.line([(0, y), (w, y)], fill=(int(214 - 60 * k), int(196 - 70 * k), int(170 - 70 * k)))
    d.ellipse([330, 620, 750, 1140], fill=(96, 62, 48))  # head
    d.rounded_rectangle([200, 1120, 880, 1920], radius=120, fill=(52, 30, 36))  # shoulders / body
    d.ellipse([380, 1240, 580, 1380], fill=(230, 180, 80))  # the "choker" prop at the zoom point
    img.save(path, quality=90)


def extract_frames(video: pathlib.Path, out: pathlib.Path, fps: int = 30) -> int:
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-vf",
         f"fps={fps},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
         "-q:v", "3", str(out / "f%05d.jpg")],
        check=True,
    )
    return len(list(out.glob("f*.jpg")))


def prepare(work: pathlib.Path, video: pathlib.Path | None) -> tuple[pathlib.Path, pathlib.Path, int]:
    if work.exists():
        shutil.rmtree(work)
    frames = work / "frames"
    if video:
        nfr = extract_frames(video, frames)
    else:
        frames.mkdir(parents=True)
        synth_frame(frames / "f00001.jpg")
        nfr = 1
    fonts = work / "fonts"
    shutil.copytree(ENGINE_DIR / "fonts", fonts)
    img = work / "img"
    shutil.copytree(REF_DIR / "img", img)

    # ── reference: the hand-written composition, two surgical patches ──
    ref = work / "ref"
    ref.mkdir()
    html = (REF_DIR / "comp.html").read_text(encoding="utf-8")
    html = html.replace("const W = 1080, H = 1920, NFR = 2703;", f"const W = 1080, H = 1920, NFR = {nfr};")
    html = html.replace("  drawGrain(t);\n};", "  drawGrain(t, 0); // golden: grain excluded\n};")
    assert f"NFR = {nfr}" in html and "drawGrain(t, 0)" in html, "reference patch points moved"
    (ref / "comp.html").write_text(html, encoding="utf-8")
    shutil.copy(REF_DIR / "words.js", ref / "words.js")
    for d in ("frames", "fonts", "img"):
        _link(work / d, ref / d)

    # ── engine: the harness + config ──
    eng = work / "eng"
    eng.mkdir()
    shutil.copy(ENGINE_DIR / "harness" / "index.html", eng / "index.html")
    bundle = ENGINE_DIR / "dist" / "rasika-engine.js"
    if not bundle.exists():
        sys.exit("packages/engine/dist/rasika-engine.js missing — run `pnpm --filter @rasika/engine build`")
    shutil.copy(bundle, eng / "rasika-engine.js")
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    words = json.loads(WORDS.read_text(encoding="utf-8"))["words"]
    images = {p.stem: f"img/{p.name}" for p in img.glob("*.jpg")}
    cfg = {"plan": plan, "words": words, "images": images,
           "frames": {"pattern": "frames/f%05d.jpg", "count": nfr}, "fontBaseUrl": "fonts", "grain": False}
    (eng / "config.js").write_text("window.HARNESS = " + json.dumps(cfg, ensure_ascii=False) + ";\n", encoding="utf-8")
    for d in ("frames", "fonts", "img"):
        _link(work / d, eng / d)
    return ref / "comp.html", eng / "index.html", nfr


def _link(src: pathlib.Path, dst: pathlib.Path) -> None:
    try:
        dst.symlink_to(src.resolve(), target_is_directory=True)
    except OSError:  # Windows without developer mode: copy instead
        shutil.copytree(src, dst)


def open_page(p, html: pathlib.Path, browser):
    page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
    page.add_init_script("window.__RENDER__ = true;")
    page.goto(html.resolve().as_uri())
    page.wait_for_function("typeof window.renderFrame === 'function' && !!window.COMP", timeout=30000)
    page.evaluate("async () => { if (window.__ready) await window.__ready; await document.fonts.ready; }")
    return page


def shoot(page, cdp, t: float) -> Image.Image:
    page.evaluate(SEEK_JS, t)
    data = cdp.send("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})["data"]
    return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")


def ssim_of(a: Image.Image, b: Image.Image, scale: int = 4) -> float:
    ga = np.asarray(a.convert("L").reduce(scale), dtype=np.float64)
    gb = np.asarray(b.convert("L").reduce(scale), dtype=np.float64)
    return float(structural_similarity(ga, gb, data_range=255.0))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", type=pathlib.Path, help="real footage; omitted → synthetic stand-in frame")
    ap.add_argument("--work", type=pathlib.Path, default=ROOT / ".golden-work")
    ap.add_argument("--report", type=pathlib.Path, help="directory for side-by-side PNGs + report.json")
    ap.add_argument("--threshold", type=float, default=0.92)
    ap.add_argument("--times", help="comma-separated override of the timestamps")
    args = ap.parse_args()
    times = [float(x) for x in args.times.split(",")] if args.times else TIMESTAMPS

    from playwright.sync_api import sync_playwright

    ref_html, eng_html, nfr = prepare(args.work, args.video)
    print(f"frames: {nfr}  stills: {len(times)}  threshold: {args.threshold}")
    if args.report:
        args.report.mkdir(parents=True, exist_ok=True)

    rows = []
    t0 = time.time()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--allow-file-access-from-files", "--disable-web-security"])
        ref = open_page(p, ref_html, browser)
        eng = open_page(p, eng_html, browser)
        cref = ref.context.new_cdp_session(ref)
        ceng = eng.context.new_cdp_session(eng)
        for t in times:
            a = shoot(ref, cref, t)
            b = shoot(eng, ceng, t)
            s = ssim_of(a, b)
            ok = s >= args.threshold
            rows.append({"t": t, "ssim": round(s, 4), "ok": ok})
            print(f"  t={t:6.2f}s  ssim={s:.4f}  {'ok' if ok else 'FAIL'}", flush=True)
            if args.report and (not ok or args.report):
                side = Image.new("RGB", (1080 * 2 + 20, 1920), (40, 40, 40))
                side.paste(a, (0, 0))
                side.paste(b, (1100, 0))
                side.reduce(3).save(args.report / f"t{t:06.2f}_{s:.3f}{'' if ok else '_FAIL'}.png")
        browser.close()

    worst = min(rows, key=lambda r: r["ssim"])
    mean = sum(r["ssim"] for r in rows) / len(rows)
    failed = [r for r in rows if not r["ok"]]
    summary = {"stills": len(rows), "mean": round(mean, 4), "worst": worst, "failed": failed,
               "threshold": args.threshold, "frames": nfr, "seconds": round(time.time() - t0, 1)}
    print(json.dumps(summary, indent=1))
    if args.report:
        (args.report / "report.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=1))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
