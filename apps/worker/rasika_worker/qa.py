"""
The finished reel, measured: what nobody watched or listened to before it went out.

After a reel is rendered (`output_1080`), this looks at every frame and the mix and says PASS, WARN
or FAIL per check, with the times:

- frame 0: black or flat (feeds show it as the thumbnail and before autoplay starts)
- single-frame flashes: one frame unlike both its neighbours (a glitch, a stray transition)
- frozen stretches: the picture holding still for 1.5 s or more before the end (dead air?)
- blank frames: near-uniform frames mid-reel (an empty transition, a scene that didn't draw)
- loudness: integrated LUFS against the -14 the mix is levelled to, and the true peak
- silences: 1.5 s or more of quiet mid-reel in a reel with sound (a gap in the voice?)

and draws a contact sheet: the first 3 s every 0.5 s (the muted-autoplay test: can you tell what it
is from those?) above one frame every few seconds of the whole reel.

The checks are ported from video-director's qa_video.py (https://github.com/win4r/video-director, MIT,
© its contributors) and cut to what a reel needs; the thresholds are its defaults unless noted.
Nothing here changes the reel: the report goes in the reel's asset meta for the admin page.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ANALYSIS_W = 108  # tiny greyscale copies (108×192 for a reel): plenty for frame diffs
FREEZE_SEC = 1.5  # video-director warns at 1 s; a narrated reel may hold a card a little longer
# a frame is still when almost no pixel moved: a mean difference (video-director's test) calls a
# talking host still, since a mouth is a few pixels of a small copy; count the pixels that changed
FREEZE_PIXELS = 4
FREEZE_STEP = 12  # grey levels (0-255) a pixel must change by to count
SILENCE_SEC = 1.5
LUFS_TARGET = -14.0  # media.LEVEL levels every mix to this
TILE_W = 240


def _run(cmd: list[str], timeout: float = 600) -> subprocess.CompletedProcess[bytes]:
    p = subprocess.run(cmd, capture_output=True, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {p.stderr.decode(errors='replace')[-600:]}")
    return p


def probe(ffprobe: str, path: Path) -> dict[str, Any]:
    out = json.loads(
        _run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "stream=codec_type,width,height,r_frame_rate:format=duration",
                "-of",
                "json",
                str(path),
            ]
        ).stdout
    )
    v = next((s for s in out["streams"] if s["codec_type"] == "video"), None)
    if v is None:
        raise RuntimeError("no video stream")
    num, den = (int(x) for x in v["r_frame_rate"].split("/"))
    return {
        "w": int(v["width"]),
        "h": int(v["height"]),
        "fps": num / den if den else 30.0,
        "dur": float(out["format"]["duration"]),
        "audio": any(s["codec_type"] == "audio" for s in out["streams"]),
    }


def _runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """[start, end) index pairs of consecutive True values."""
    out: list[tuple[int, int]] = []
    start: int | None = None
    for i, m in enumerate(mask):
        if m and start is None:
            start = i
        elif not m and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return out


def picture(ffmpeg: str, path: Path, info: dict[str, Any]) -> dict[str, Any]:
    """Stream tiny greyscale frames and keep per-frame stats, never the whole reel."""
    aw = ANALYSIS_W
    ah = max(2, int(round(aw * info["h"] / info["w"] / 2)) * 2)
    size = aw * ah
    proc = subprocess.Popen(
        [
            ffmpeg,
            "-v",
            "error",
            "-i",
            str(path),
            "-vf",
            f"scale={aw}:{ah}:flags=area,format=gray",
            "-f",
            "rawvideo",
            "-",
        ],
        stdout=subprocess.PIPE,
    )
    assert proc.stdout is not None
    mean: list[float] = []
    std: list[float] = []
    d: list[float] = []
    moved: list[int] = []  # pixels that changed by more than FREEZE_STEP
    skip: list[float] = []  # skip[n] = |f[n+1] - f[n-1]|
    prev = prev2 = None
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        f = np.frombuffer(buf, np.uint8).reshape(ah, aw).astype(np.int16)
        mean.append(float(f.mean()))
        std.append(float(f.std()))
        diff = np.abs(f - prev) if prev is not None else None
        d.append(float(diff.mean()) if diff is not None else 0.0)
        moved.append(int((diff > FREEZE_STEP).sum()) if diff is not None else size)
        if prev2 is not None:
            skip.append(float(np.abs(f - prev2).mean()))
        prev2, prev = prev, f
    proc.wait()
    n = len(mean)
    fps = float(info["fps"])
    if n < 3:
        return {"frames": n}
    da = np.array(d)
    sk = np.array([math.nan, *skip, math.nan][:n])
    med = float(np.median(da[1:]))
    # a flash: frame i differs from both neighbours, while its neighbours look alike
    t_flash = max(2.0, 4 * med)
    flashes = [
        i
        for i in range(1, n - 1)
        if da[i] > t_flash and da[i + 1] > t_flash and sk[i] < 0.35 * min(da[i], da[i + 1])
    ]
    still = np.array(moved) < FREEZE_PIXELS
    frozen = [
        (a, b) for a, b in _runs(still) if (b - a + 1) / fps >= FREEZE_SEC and b < n
    ]  # a hold that runs to the last frame is the end card
    flat = [(a, b) for a, b in _runs(np.array(std) < 6.0) if a > 0]
    return {
        "frames": n,
        "frame0": {"mean": round(mean[0], 1), "contrast": round(std[0], 1)},
        "flashes": [round(i / fps, 2) for i in flashes],
        "frozen": [
            {
                "from": round((a - 1) / fps, 2),
                "to": round(b / fps, 2),
                "sec": round((b - a + 1) / fps, 1),
            }
            for a, b in frozen
        ],
        "blank": [{"from": round(a / fps, 2), "to": round(b / fps, 2)} for a, b in flat],
        "median_step": round(med, 3),
    }


def sound(ffmpeg: str, path: Path, dur: float) -> dict[str, Any]:
    r = subprocess.run(
        [
            ffmpeg,
            "-nostats",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-af",
            "ebur128=peak=true",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        timeout=600,
    )
    log = r.stderr.decode(errors="replace")
    summary = log[log.rfind("Summary:") :] if "Summary:" in log else ""
    i_m = re.search(r"I:\s+(-?[\d.]+|-inf)\s+LUFS", summary)
    p_m = re.search(r"Peak:\s+(-?[\d.]+|-inf)\s+dBFS", summary)
    res: dict[str, Any] = {
        "lufs": float(i_m.group(1)) if i_m and i_m.group(1) != "-inf" else None,
        "true_peak": float(p_m.group(1)) if p_m and p_m.group(1) != "-inf" else None,
    }
    sr = 16000
    raw = _run(
        [
            ffmpeg,
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            str(sr),
            "-f",
            "f32le",
            "-",
        ]
    ).stdout
    x = np.frombuffer(raw, np.float32)
    win, hop = int(0.1 * sr), int(0.05 * sr)
    if x.size < win:
        return res
    nwin = 1 + (x.size - win) // hop
    frames = np.lib.stride_tricks.as_strided(x, (nwin, win), (x.strides[0] * hop, x.strides[0]))
    db = 10 * np.log10(np.mean(frames.astype(np.float64) ** 2, axis=1) + 1e-12)
    p90 = float(np.percentile(db, 90))
    # quiet = 15 dB under the reel's loud parts AND under -30 dBFS, so a soft bed isn't "silence"
    thresh = min(p90 - 15.0, -30.0)
    sil = [((a * hop) / sr, ((b - 1) * hop + win) / sr) for a, b in _runs(db < thresh)]
    res["silences"] = [
        {"from": round(a, 2), "to": round(b, 2)}
        for a, b in sil
        if b - a >= SILENCE_SEC and a > 0.3 and b < dur - 1.0  # lead-in and tail are fine
    ]
    return res


def _font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def _tiles(ffmpeg: str, path: Path, times: list[float], tmp: Path, tag: str) -> list[Image.Image]:
    out: list[Image.Image] = []
    for i, t in enumerate(times):
        f = tmp / f"{tag}_{i:03d}.jpg"
        try:
            _run(
                [ffmpeg, "-v", "error", "-y", "-ss", f"{max(t, 0):.2f}", "-i", str(path), "-frames:v", "1",
                 "-vf", f"scale={TILE_W}:-2", "-q:v", "4", str(f)],
                timeout=60,
            )  # fmt: skip
        except Exception:
            continue
        if f.exists():
            im = Image.open(f).convert("RGB")
            draw = ImageDraw.Draw(im)
            fnt = _font(15)
            draw.rectangle([0, 0, im.width, 21], fill=(0, 0, 0))
            draw.text((5, 3), f"{t:.1f}s", fill=(255, 255, 255), font=fnt)
            out.append(im)
    return out


def contact_sheet(ffmpeg: str, path: Path, dur: float, dest: Path) -> Path | None:
    """The first 3 s every 0.5 s on top (the muted test), then the whole reel, about 16 frames."""
    hook = [i * 0.5 for i in range(7) if i * 0.5 < dur]
    step = max(1.0, dur / 16)
    rest = [round(step * (i + 0.5), 2) for i in range(int(dur / step)) if step * (i + 0.5) < dur]
    with tempfile.TemporaryDirectory() as td:
        top = _tiles(ffmpeg, path, hook, Path(td), "hook")
        body = _tiles(ffmpeg, path, rest, Path(td), "all")
    if not top and not body:
        return None
    tw, th = (top or body)[0].size
    cols, gap, band = 8, 4, 26
    rows = math.ceil(len(body) / cols)
    sheet = Image.new(
        "RGB", (cols * (tw + gap), band + th + band + rows * (th + gap)), (28, 24, 22)
    )
    draw = ImageDraw.Draw(sheet)
    fnt = _font(16)
    draw.text(
        (6, 4),
        "First 3 seconds, sound off: is it clear what this is?",
        fill=(240, 220, 170),
        font=fnt,
    )
    for i, im in enumerate(top):
        sheet.paste(im, (i * (tw + gap), band))
    y0 = band + th + band
    draw.text(
        (6, y0 - band + 4), f"The whole reel, every {step:.1f} s", fill=(240, 220, 170), font=fnt
    )
    for i, im in enumerate(body):
        sheet.paste(im, ((i % cols) * (tw + gap), y0 + (i // cols) * (th + gap)))
    sheet.save(dest, quality=82)
    return dest


def check(ffmpeg: str, ffprobe: str, path: Path, sheet: Path | None = None) -> dict[str, Any]:
    """The report: {"verdict": PASS|WARN|FAIL, "checks": [{level, check, detail}], ...}."""
    info = probe(ffprobe, path)
    pic = picture(ffmpeg, path, info)
    aud = sound(ffmpeg, path, info["dur"]) if info["audio"] else None
    checks: list[dict[str, str]] = []

    def add(level: str, name: str, detail: str) -> None:
        checks.append({"level": level, "check": name, "detail": detail})

    f0 = pic.get("frame0")
    if f0 is None:
        add("FAIL", "picture", f"only {pic.get('frames', 0)} frames decoded")
    else:
        if f0["contrast"] < 6 or f0["mean"] < 8:
            add(
                "FAIL",
                "first frame",
                f"black or flat (brightness {f0['mean']}, contrast {f0['contrast']}): the thumbnail",
            )
        else:
            add("PASS", "first frame", f"brightness {f0['mean']}, contrast {f0['contrast']}")
        fl = pic["flashes"]
        add("FAIL" if fl else "PASS", "flashes", f"one-frame flashes at {fl} s" if fl else "none")
        fr = pic["frozen"]
        add(
            "WARN" if fr else "PASS",
            "frozen picture",
            "; ".join(f"{x['from']}–{x['to']} s ({x['sec']} s)" for x in fr[:6]) if fr else "none",
        )
        bl = pic["blank"]
        add(
            "WARN" if bl else "PASS",
            "blank frames",
            "; ".join(f"{x['from']}–{x['to']} s" for x in bl[:6]) if bl else "none",
        )
    if aud is None:
        add("WARN", "sound", "the reel has no sound")
    else:
        lufs, tp = aud.get("lufs"), aud.get("true_peak")
        if lufs is None:
            add("FAIL", "loudness", "silent")
        else:
            off = abs(lufs - LUFS_TARGET)
            level = "PASS" if off <= 1.5 else "WARN" if off <= 3 else "FAIL"
            add(level, "loudness", f"{lufs} LUFS (target {LUFS_TARGET:g} ±1.5)")
        if tp is not None:
            add("PASS" if tp <= -1.0 else "WARN", "true peak", f"{tp} dBTP (≤ -1)")
        sil = aud.get("silences") or []
        add(
            "WARN" if sil else "PASS",
            "gaps in the sound",
            "; ".join(f"{x['from']}–{x['to']} s" for x in sil[:6]) if sil else "none",
        )
    levels = {c["level"] for c in checks}
    verdict = "FAIL" if "FAIL" in levels else "WARN" if "WARN" in levels else "PASS"
    sheet_path = contact_sheet(ffmpeg, path, info["dur"], sheet) if sheet else None
    return {
        "verdict": verdict,
        "checks": checks,
        "info": {k: round(v, 2) if isinstance(v, float) else v for k, v in info.items()},
        "sheet": bool(sheet_path),
    }


if __name__ == "__main__":  # python -m rasika_worker.qa reel.mp4 [sheet.jpg]
    import sys

    rep = check(
        "ffmpeg", "ffprobe", Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else None
    )
    for c in rep["checks"]:
        print(f"{c['level']:4s}  {c['check']:18s} {c['detail']}")
    print("verdict:", rep["verdict"])
