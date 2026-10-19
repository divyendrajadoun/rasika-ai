"""Stock B-roll from Pexels for `broll` plan elements.

The planner writes a `broll` element with a concrete English search query; this module finds a
portrait clip on Pexels (free API, key required: https://www.pexels.com/api/), downloads it once
into the worker's stock cache, and prepares the frames the engine shows for that element's
window. Pexels' licence lets the clips be used freely; we keep the photographer and the page URL
in the plan (`source`) so the dashboard can credit them.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

from rasika_worker import media

log = structlog.get_logger()

API = "https://api.pexels.com/videos/search"
MIN_HEIGHT = 1280  # a 9:16 clip needs at least 720×1280 to survive the 1080×1920 fit
MAX_BYTES = 120_000_000


@dataclass
class StockClip:
    id: int
    url: str  # the Pexels page (credit)
    author: str
    duration: float
    file_url: str
    width: int
    height: int
    file: Path | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def as_source(self) -> dict[str, Any]:
        return {
            "provider": "pexels",
            "id": self.id,
            "url": self.url,
            "author": self.author,
            "file": self.file.name if self.file else None,
            "duration": round(self.duration, 2),
        }


def pick_file(video: dict[str, Any]) -> dict[str, Any] | None:
    """The smallest portrait MP4 that is still ≥ 720×1280 (falls back to the largest portrait)."""
    files: list[dict[str, Any]] = [
        f
        for f in video.get("video_files") or []
        if str(f.get("file_type") or "").endswith("mp4")
        and int(f.get("height") or 0) > int(f.get("width") or 0)
        and f.get("link")
    ]
    if not files:
        return None
    ok = [f for f in files if int(f.get("height") or 0) >= MIN_HEIGHT]
    if ok:
        best: dict[str, Any] = min(ok, key=lambda f: int(f.get("height") or 0))
        return best
    largest: dict[str, Any] = max(files, key=lambda f: int(f.get("height") or 0))
    return largest


def choose(videos: list[dict[str, Any]], need_sec: float) -> StockClip | None:
    """First clip at least `need_sec` long with a usable portrait file (search order = relevance)."""
    for v in videos:
        dur = float(v.get("duration") or 0)
        if dur + 0.05 < need_sec:
            continue
        f = pick_file(v)
        if not f:
            continue
        user = v.get("user") or {}
        return StockClip(
            id=int(v.get("id") or 0),
            url=str(v.get("url") or ""),
            author=str(user.get("name") or "Pexels"),
            duration=dur,
            file_url=str(f["link"]),
            width=int(f.get("width") or 0),
            height=int(f.get("height") or 0),
        )
    return None


class PexelsClient:
    def __init__(self, api_key: str, cache_dir: Path, timeout: float = 30.0) -> None:
        if not api_key:
            raise RuntimeError("Stock footage needs a Pexels API key (PEXELS_API_KEY).")
        self.key = api_key
        self.cache = cache_dir
        self.cache.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout

    # ── HTTP ──
    def _get(self, url: str) -> bytes:
        req = urllib.request.Request(
            url, headers={"Authorization": self.key, "User-Agent": "rasika-worker"}
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310 — fixed https host
                return bytes(resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:200]
            raise RuntimeError(f"Pexels {exc.code}: {body}") from exc

    def search(self, query: str, per_page: int = 8) -> list[dict[str, Any]]:
        q = re.sub(r"\s+", " ", query).strip()[:80]
        key = hashlib.sha1(f"{q}|{per_page}".encode()).hexdigest()[:16]
        cached = self.cache / f"search_{key}.json"
        if cached.exists():
            return list(json.loads(cached.read_text(encoding="utf-8")).get("videos") or [])
        params = urllib.parse.urlencode(
            {"query": q, "orientation": "portrait", "size": "medium", "per_page": per_page}
        )
        data = json.loads(self._get(f"{API}?{params}").decode("utf-8"))
        cached.write_text(json.dumps(data), encoding="utf-8")
        return list(data.get("videos") or [])

    def download(self, clip: StockClip) -> Path:
        dest = self.cache / f"pexels_{clip.id}_{clip.height}.mp4"
        if dest.exists() and dest.stat().st_size > 0:
            clip.file = dest
            return dest
        tmp = dest.with_suffix(".part")
        req = urllib.request.Request(clip.file_url, headers={"User-Agent": "rasika-worker"})
        with urllib.request.urlopen(req, timeout=self.timeout * 4) as resp, tmp.open("wb") as out:  # noqa: S310
            total = 0
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_BYTES:
                    raise RuntimeError(
                        f"stock clip {clip.id} is larger than {MAX_BYTES // 1_000_000} MB"
                    )
                out.write(chunk)
        tmp.replace(dest)
        clip.file = dest
        return dest

    def resolve(self, query: str, need_sec: float) -> StockClip | None:
        """Search → choose → download. None when nothing portrait and long enough exists."""
        clip = choose(self.search(query), need_sec)
        if clip is None:
            log.info("stock_no_match", query=query, need_sec=need_sec)
            return None
        self.download(clip)
        log.info("stock_clip", query=query, id=clip.id, author=clip.author, sec=clip.duration)
        return clip


def extract_window(
    ffmpeg: str, src: Path, frames_dir: Path, length_sec: float, scale: float = 1.0
) -> int:
    """Frames for one B-roll window: the first `length_sec` of the clip at 30 fps, fitted to 9:16."""
    if frames_dir.exists():
        shutil.rmtree(frames_dir, ignore_errors=True)
    frames_dir.mkdir(parents=True, exist_ok=True)
    w, h = int(media.STAGE_W * scale), int(media.STAGE_H * scale)
    vf = media.VF_FIT if scale == 1.0 else f"{media.VF_FIT},scale={w}:{h}"
    media.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(src),
            "-t",
            f"{length_sec + 0.2:.3f}",
            "-vf",
            vf,
            "-q:v",
            "3",
            str(frames_dir / "f%05d.jpg"),
        ]
    )
    return len(list(frames_dir.glob("f*.jpg")))


def broll_elements(plan: dict[str, Any]) -> list[dict[str, Any]]:
    return [e for e in plan.get("elements") or [] if e.get("type") == "broll"]
