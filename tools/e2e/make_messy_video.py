#!/usr/bin/env python3
"""A test "messy video" for the one-messy-video path: a talking head (the demo take, silent) with
a narration that has what a phone edit leaves in: a false start, a retake, a black shot and a
blurry earlier take, all joined into one file the way VN or CapCut exports it.

  apps/worker/.venv/Scripts/python.exe tools/e2e/make_messy_video.py [out.mp4]

Needs DEEPGRAM_API_KEY in `.env` (one short narration per shot).
"""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

#: (what is said, the take's video starts here in the demo clip, shot kind)
SHOTS = [
    ("So today I want to", 0.0, "plain"),  # a false start
    ("So today I want to show you three ways to cut your phone bill in half.", 0.0, "plain"),
    ("", 0.0, "black"),  # the lens covered for a moment
    ("First, check which plan you actually use.", 10.0, "blur"),  # an out-of-focus earlier take
    ("First, check which plan you actually use. Most people pay for data they never touch.", 10.0, "plain"),
    ("Um, second, turn off auto renew on the add-ons you forgot about.", 18.0, "plain"),
    ("Third, call and ask for a loyalty discount. It works more often than you think.", 24.0, "plain"),
    ("Comment SAVE and I'll send you the full list.", 2.0, "plain"),
]


def main() -> int:
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".work-e2e" / "messy" / "messy.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            os.environ.setdefault(k, v)
    from rasika_worker.tts import DeepgramTTS

    tts = DeepgramTTS(os.environ["DEEPGRAM_API_KEY"], "aura-2-thalia-en")
    face = ROOT / "apps" / "web" / "public" / "demo" / "before.mp4"
    vf = "scale=1080:1920,fps=30,setsar=1,format=yuv420p"
    parts = []
    for n, (text, at, kind) in enumerate(SHOTS):
        part = out.parent / f"shot{n}.mp4"
        if kind == "black":
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=1.5",
                 "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1.5",
                 "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(part)],
                check=True,
            )  # fmt: skip
        else:
            wav = out.parent / f"say{n}.wav"
            sec = tts.speak(text, wav) + 0.35
            blur = ",boxblur=22:2" if kind == "blur" else ""
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-ss", f"{at}", "-t", f"{sec:.2f}", "-i", str(face),
                 "-i", str(wav), "-filter_complex",
                 f"[0:v]{vf}{blur}[v];[1:a]aresample=48000,apad,atrim=0:{sec:.2f}[a]",
                 "-map", "[v]", "-map", "[a]", "-t", f"{sec:.2f}",
                 "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(part)],
                check=True,
            )  # fmt: skip
        parts.append(part)
    lst = out.parent / "parts.txt"
    lst.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in parts), encoding="utf-8")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", str(out)],
        check=True,
    )  # fmt: skip
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
