"""AI presenter videos through HeyGen's v3 API (paid; the owner approved it by supplying the key).

Two routes, both `POST /v3/videos`:
  type "image"  — the user's own photo (uploaded to HeyGen as an asset) animated and lip-synced
  type "avatar" — one of HeyGen's stock looks (`avatar_id` = a look id) or the account's own looks
The result is polled on `GET /v3/videos/{id}` until `completed`, downloaded, and becomes the
project's `source_video`, so the normal probe → transcribe → plan → render chain treats it like a
recorded take. Rights: the user confirms in the wizard that they own the photo, that the person is
an adult, and that the photo and script may be sent to HeyGen.
"""

from __future__ import annotations

import json
import mimetypes
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger()

BASE = "https://api.heygen.com"


@dataclass
class PresenterResult:
    video_id: str
    video_url: str
    duration: float | None
    file: Path
    wallet_before: float | None
    wallet_after: float | None


class HeyGenClient:
    def __init__(self, api_key: str, timeout: float = 60.0) -> None:
        if not api_key:
            raise RuntimeError("AI presenter needs a HeyGen API key (HEYGEN_API_KEY).")
        self.key = api_key
        self.timeout = timeout

    # ── HTTP ──
    def _req(
        self, method: str, path: str, body: bytes | None = None, content_type: str | None = None
    ) -> dict[str, Any]:
        headers = {
            "X-Api-Key": self.key,
            "Accept": "application/json",
            "User-Agent": "rasika-worker",
        }
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310 — fixed https host
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", "replace")[:400]
            raise RuntimeError(f"HeyGen {exc.code} on {method} {path}: {text}") from exc
        data = json.loads(raw.decode("utf-8") or "{}")
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(f"HeyGen error on {method} {path}: {data['error']}")
        return dict(data) if isinstance(data, dict) else {"data": data}

    def get(self, path: str) -> dict[str, Any]:
        return self._req("GET", path)

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._req("POST", path, json.dumps(payload).encode("utf-8"), "application/json")

    # ── account ──
    def wallet_balance(self) -> float | None:
        try:
            me = self.get("/v3/users/me").get("data") or {}
            bal = (me.get("wallet") or {}).get("remaining_balance")
            return float(bal) if bal is not None else None
        except Exception as exc:  # the balance is informational
            log.warning("heygen_balance_failed", error=str(exc))
            return None

    # ── assets ──
    def upload_image(self, path: Path) -> str:
        """`POST /v3/assets` multipart (≤ 32 MB) → asset_id."""
        boundary = f"----rasika{uuid.uuid4().hex}"
        mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
        head = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode()
        body = head + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        data = self._req("POST", "/v3/assets", body, f"multipart/form-data; boundary={boundary}")
        asset_id = (data.get("data") or {}).get("asset_id")
        if not asset_id:
            raise RuntimeError(
                f"HeyGen asset upload returned no asset_id: {json.dumps(data)[:200]}"
            )
        return str(asset_id)

    # ── videos ──
    def create_video(self, payload: dict[str, Any]) -> str:
        data = self.post_json("/v3/videos", payload)
        vid = (data.get("data") or {}).get("video_id") or (data.get("data") or {}).get("id")
        if not vid:
            raise RuntimeError(f"HeyGen create returned no video_id: {json.dumps(data)[:300]}")
        return str(vid)

    def video_status(self, video_id: str) -> dict[str, Any]:
        return dict(self.get(f"/v3/videos/{urllib.parse.quote(video_id)}").get("data") or {})

    def wait(
        self, video_id: str, progress: Any = None, timeout_sec: float = 1800, every: float = 10
    ) -> dict[str, Any]:
        t0 = time.time()
        while True:
            st = self.video_status(video_id)
            status = str(st.get("status") or "")
            if progress:
                progress(status, time.time() - t0)
            if status == "completed":
                return st
            if status == "failed":
                raise RuntimeError(
                    f"HeyGen render failed: {st.get('failure_code') or ''} {st.get('failure_message') or ''}".strip()
                )
            if time.time() - t0 > timeout_sec:
                raise RuntimeError(f"HeyGen render still '{status}' after {timeout_sec:.0f} s")
            time.sleep(every)

    def download(self, url: str, dest: Path) -> Path:
        req = urllib.request.Request(url, headers={"User-Agent": "rasika-worker"})
        with urllib.request.urlopen(req, timeout=self.timeout * 4) as resp, dest.open("wb") as out:  # noqa: S310
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)
        return dest


def build_payload(
    script: str,
    voice_id: str,
    *,
    image_asset_id: str | None = None,
    avatar_id: str | None = None,
    title: str = "Rasika presenter",
    engine: str | None = None,
) -> dict[str, Any]:
    """The `POST /v3/videos` body for a 9:16 1080p presenter; exactly one of photo / avatar."""
    if bool(image_asset_id) == bool(avatar_id):
        raise ValueError("choose either a photo (image_asset_id) or a stock look (avatar_id)")
    payload: dict[str, Any] = {
        "script": script,
        "voice_id": voice_id,
        "title": title[:80],
        "resolution": "1080p",
        "aspect_ratio": "9:16",
    }
    if image_asset_id:
        payload.update({"type": "image", "image": {"type": "asset_id", "asset_id": image_asset_id}})
    else:
        payload.update({"type": "avatar", "avatar_id": avatar_id})
        if engine:
            payload["engine"] = {"type": engine}
    return payload


def make_presenter(
    client: HeyGenClient,
    script: str,
    voice_id: str,
    dest: Path,
    *,
    photo: Path | None = None,
    avatar_id: str | None = None,
    title: str = "Rasika presenter",
    progress: Any = None,
) -> PresenterResult:
    before = client.wallet_balance()
    asset_id = client.upload_image(photo) if photo else None
    payload = build_payload(
        script, voice_id, image_asset_id=asset_id, avatar_id=avatar_id, title=title
    )
    video_id = client.create_video(payload)
    log.info("heygen_created", video_id=video_id, route="image" if photo else "avatar")
    st = client.wait(video_id, progress)
    url = str(st.get("video_url") or "")
    if not url:
        raise RuntimeError("HeyGen completed without a video_url")
    client.download(url, dest)
    after = client.wallet_balance()
    dur = st.get("duration")
    log.info(
        "heygen_done", video_id=video_id, duration=dur, wallet_before=before, wallet_after=after
    )
    return PresenterResult(
        video_id, url, float(dur) if dur is not None else None, dest, before, after
    )
