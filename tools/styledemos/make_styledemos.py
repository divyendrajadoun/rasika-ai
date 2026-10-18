#!/usr/bin/env python3
"""
Real style demos for the landing page: the same 12 s of the owner's real take, rendered by the
engine in every preset (540×960, preview encoder, no grain), plus the raw clip for the compare.

  python tools/styledemos/make_styledemos.py --video IMG_7571.MP4 [--seconds 12] [--only katana-pop]

Writes apps/web/public/demo/styles/<preset>.mp4 + <preset>.jpg (poster) and raw.mp4.
Uses plans/baisa_bling.json with the preset's tokens swapped in (colours are tokens, so every
preset re-skins the same edit) and its words for captions.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

from rasika_worker import media  # noqa: E402
from rasika_worker.render import RenderSpec, render  # noqa: E402
from rasika_worker.settings import Settings  # noqa: E402

PRESETS = ROOT / "packages" / "schema" / "presets"
OUT = ROOT / "apps" / "web" / "public" / "demo" / "styles"


# The hand plan's poster sizes assume Anton's narrow advance; wider families get scaled so the
# same lines still fit the stage (the validator does this with real metrics in production).
WIDTH_SCALE = {
    "Montserrat": 0.68, "Poppins": 0.7, "Archivo Black": 0.66, "Bangers": 0.9, "Bebas Neue": 1.05,
    "DM Serif Display": 0.82, "Playfair Display": 0.8, "Inter": 0.72, "Caveat": 0.95,
}


def trimmed_plan(seconds: float, style: dict) -> dict:
    plan = json.loads((ROOT / "plans" / "baisa_bling.json").read_text(encoding="utf-8"))
    plan.pop("$schema", None)
    plan["meta"]["durationSec"] = seconds
    plan["style"] = style
    k_poster = WIDTH_SCALE.get(style["fonts"]["poster"], 1.0)
    k_accent = WIDTH_SCALE.get(style["fonts"]["accent"], 1.0)
    for e in plan["elements"]:
        for line in e.get("lines", []):
            k = k_poster if line["font"] == "anton" else k_accent if line["font"] == "serif" else 1.0
            line["size"] = max(24, int(line["size"] * k))
    plan["videoModes"] = [m for m in plan["videoModes"] if m["t"] < seconds - 0.5]
    els = []
    for e in plan["elements"]:
        if e["t0"] >= seconds - 0.3:
            continue
        e["t1"] = min(e["t1"], seconds)
        els.append(e)
    plan["elements"] = els
    plan.pop("endCard", None)
    return plan


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, type=pathlib.Path)
    ap.add_argument("--seconds", type=float, default=12.0)
    ap.add_argument("--only")
    ap.add_argument("--parallelism", type=int, default=4)
    args = ap.parse_args()
    s = Settings()
    OUT.mkdir(parents=True, exist_ok=True)
    work = ROOT / ".work-styledemos"
    work.mkdir(exist_ok=True)

    clip = work / "clip.mp4"
    if not clip.exists():
        media.run([s.ffmpeg_bin, "-v", "error", "-y", "-i", str(args.video), "-t", str(args.seconds), "-c", "copy", str(clip)])
    raw = OUT / "raw.mp4"
    if not raw.exists():
        media.run(
            [s.ffmpeg_bin, "-v", "error", "-y", "-i", str(clip), "-vf", f"{media.VF_FIT},scale=540:960",
             "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(raw)]
        )
        media.still(s.ffmpeg_bin, raw, 1.0, OUT / "raw.jpg", 540)
    voice = work / "voice.wav"
    if not voice.exists():
        media.extract_audio(s.ffmpeg_bin, clip, voice, work / "a16.wav")
    frames = work / "frames_540"
    if not any(frames.glob("f*.jpg")):
        n = media.extract_frames(s.ffmpeg_bin, clip, frames, scale=0.5)
    else:
        n = len(list(frames.glob("f*.jpg")))
    words = json.loads((ROOT / "plans" / "baisa_bling.words.json").read_text(encoding="utf-8"))["words"]
    images = {p.stem: p for p in (ROOT / "reference" / "baisa_bling" / "img").glob("*.jpg")}

    for pf in sorted(PRESETS.glob("*.json")):
        style = json.loads(pf.read_text(encoding="utf-8"))
        if args.only and style["id"] != args.only:
            continue
        dest = OUT / f"{style['id']}.mp4"
        t0 = time.time()
        w = work / style["id"]
        w.mkdir(exist_ok=True)
        spec = RenderSpec(trimmed_plan(args.seconds, style), words, images, frames, n, voice, preview=True)
        res = render(s, w, spec, parallelism=args.parallelism)
        # re-encode the preview to a small, web-friendly file (no audio: the page plays it muted)
        media.run(
            [s.ffmpeg_bin, "-v", "error", "-y", "-i", str(res.final), "-c:v", "libx264", "-preset", "slow", "-crf", "27",
             "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(dest)]
        )
        media.still(s.ffmpeg_bin, dest, 1.0, OUT / f"{style['id']}.jpg", 540)
        print(f"{style['id']:18s} {dest.stat().st_size / 1e6:5.2f} MB  {time.time() - t0:5.1f}s", flush=True)
        shutil.rmtree(w, ignore_errors=True)


if __name__ == "__main__":
    main()
