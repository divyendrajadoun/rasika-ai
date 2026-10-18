"""ffmpeg / ffprobe helpers. Every command is explicit and logged; nothing shells through a string."""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import structlog

log = structlog.get_logger("rasika.worker.media")

STAGE_W, STAGE_H, FPS = 1080, 1920, 30
# Identical encoder settings for every chunk so the concat demuxer can join them without re-encoding.
X264_FINAL = [
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-r",
    str(FPS),
    "-g",
    str(FPS),
    "-keyint_min",
    str(FPS),
    "-sc_threshold",
    "0",
    "-x264-params",
    "scenecut=0:open-gop=0",
]
X264_PREVIEW = [
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "28",
    "-pix_fmt",
    "yuv420p",
    "-r",
    str(FPS),
    "-g",
    str(FPS),
    "-keyint_min",
    str(FPS),
    "-sc_threshold",
    "0",
    "-x264-params",
    "scenecut=0:open-gop=0",
]


class MediaError(RuntimeError):
    pass


@dataclass
class MediaInfo:
    duration_sec: float
    width: int
    height: int
    rotation: int
    fps: float
    codec: str
    has_audio: bool
    size_bytes: int

    @property
    def display_size(self) -> tuple[int, int]:
        """Width/height after applying the rotation tag."""
        return (self.height, self.width) if self.rotation % 180 == 90 else (self.width, self.height)

    @property
    def is_vertical(self) -> bool:
        w, h = self.display_size
        return h >= w * 1.2

    @property
    def aspect(self) -> float:
        w, h = self.display_size
        return w / h if h else 0


def run(cmd: list[str], timeout: float | None = None) -> subprocess.CompletedProcess[str]:
    t0 = time.monotonic()
    p = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace"
    )
    log.debug("cmd", argv=cmd[:3], sec=round(time.monotonic() - t0, 2), rc=p.returncode)
    if p.returncode != 0:
        raise MediaError(f"{cmd[0]} failed ({p.returncode}): {p.stderr[-800:]}")
    return p


def probe(ffprobe: str, path: Path) -> MediaInfo:
    out = run(
        [
            ffprobe,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ]
    ).stdout
    data = json.loads(out)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video:
        raise MediaError("no video stream")
    audio = any(s.get("codec_type") == "audio" for s in streams)
    rotation = 0
    for sd in video.get("side_data_list", []) or []:
        if "rotation" in sd:
            rotation = int(round(float(sd["rotation"])))
    if not rotation and video.get("tags", {}).get("rotate"):
        rotation = int(video["tags"]["rotate"])
    num, _, den = (video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1").partition(
        "/"
    )
    fps = float(num) / float(den or 1) if float(den or 1) else 30.0
    fmt = data.get("format", {})
    duration = float(video.get("duration") or fmt.get("duration") or 0)
    return MediaInfo(
        duration_sec=round(duration, 3),
        width=int(video["width"]),
        height=int(video["height"]),
        rotation=abs(rotation) % 360,
        fps=round(fps, 3),
        codec=str(video.get("codec_name", "")),
        has_audio=audio,
        size_bytes=int(fmt.get("size") or path.stat().st_size),
    )


VF_FIT = f"fps={FPS},scale={STAGE_W}:{STAGE_H}:force_original_aspect_ratio=increase,crop={STAGE_W}:{STAGE_H}"


def extract_audio(ffmpeg: str, src: Path, voice: Path, audio16k: Path) -> None:
    """voice.wav (48 kHz stereo, for the mix) + audio16k.wav (mono, for ASR)."""
    run(
        [ffmpeg, "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "2", "-ar", "48000", str(voice)]
    )
    run(
        [
            ffmpeg,
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
            str(audio16k),
        ]
    )


def make_proxy(ffmpeg: str, src: Path, dest: Path) -> None:
    """Normalised H.264 1080×1920 30 fps proxy with AAC audio (editor preview)."""
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(src),
            "-vf",
            VF_FIT,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )


def extract_frames(ffmpeg: str, src: Path, frames_dir: Path, scale: float = 1.0) -> int:
    """JPEG frames f%05d.jpg at 30 fps, cropped to 9:16. `scale` 0.5 → 540×960 for previews."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    w, h = int(STAGE_W * scale), int(STAGE_H * scale)
    vf = VF_FIT if scale == 1.0 else f"{VF_FIT},scale={w}:{h}"
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(src),
            "-vf",
            vf,
            "-q:v",
            "3",
            str(frames_dir / "f%05d.jpg"),
        ]
    )
    return len(list(frames_dir.glob("f*.jpg")))


def extract_keyframes(
    ffmpeg: str, src: Path, dest_dir: Path, duration: float, n: int = 6, width: int = 540
) -> list[Path]:
    """n evenly spaced stills (planner vision input)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    out: list[Path] = []
    for i in range(n):
        t = duration * (i + 0.5) / n
        p = dest_dir / f"k{i + 1}.jpg"
        run(
            [
                ffmpeg,
                "-v",
                "error",
                "-y",
                "-ss",
                f"{t:.3f}",
                "-i",
                str(src),
                "-frames:v",
                "1",
                "-vf",
                f"{VF_FIT},scale={width}:-2",
                "-q:v",
                "3",
                str(p),
            ]
        )
        out.append(p)
    return out


def still(ffmpeg: str, src: Path, t: float, dest: Path, width: int = 540) -> Path:
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-ss",
            f"{t:.3f}",
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-vf",
            f"scale={width}:-2",
            "-q:v",
            "3",
            str(dest),
        ]
    )
    return dest


def concat(ffmpeg: str, parts: list[Path], dest: Path) -> None:
    lst = dest.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in parts), encoding="utf-8")
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-c",
            "copy",
            str(dest),
        ]
    )


def mix(
    ffmpeg: str,
    voice: Path,
    sfx: Path | None,
    dest: Path,
    sfx_gain: float = 0.45,
    music: Path | None = None,
    music_gain: float = 0.18,
) -> None:
    """voice 1.0 + sfx (0.45) [+ music bed ducked under the voice], then a limiter."""
    inputs = ["-i", str(voice)]
    chains = ["[0:a]volume=1.0[v]"]
    mix_in = ["[v]"]
    idx = 1
    if sfx is not None:
        inputs += ["-i", str(sfx)]
        chains.append(f"[{idx}:a]volume={sfx_gain},aresample=48000[s]")
        mix_in.append("[s]")
        idx += 1
    if music is not None:
        inputs += ["-stream_loop", "-1", "-i", str(music)]
        chains.append(f"[{idx}:a]volume={music_gain},aresample=48000[m0]")
        chains.append("[m0][v]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[m]")
        mix_in.append("[m]")
        idx += 1
    n = len(mix_in)
    graph = ";".join(chains)
    # amix scales every input by 1/n (older builds lack `normalize=0`), so undo it with volume=n
    if n > 1:
        graph += (
            f";{''.join(mix_in)}amix=inputs={n}:duration=first,volume={n},alimiter=limit=0.95[a]"
        )
    else:
        graph += ";[v]alimiter=limit=0.95[a]"
    out_map = "[a]"
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            *inputs,
            "-filter_complex",
            graph,
            "-map",
            out_map,
            "-ac",
            "2",
            "-ar",
            "48000",
            str(dest),
        ]
    )


def mux(ffmpeg: str, video: Path, audio: Path, dest: Path) -> None:
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )


def downscale(ffmpeg: str, src: Path, dest: Path, width: int = 720, height: int = 1280) -> None:
    run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(src),
            "-vf",
            f"scale={width}:{height}",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )


def encoder_cmd(ffmpeg: str, dest: Path, preview: bool) -> list[str]:
    """ffmpeg command that reads JPEG frames from stdin and writes one video chunk."""
    return [
        ffmpeg,
        "-v",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-framerate",
        str(FPS),
        "-i",
        "-",
        *(X264_PREVIEW if preview else X264_FINAL),
        "-movflags",
        "+faststart",
        str(dest),
    ]
