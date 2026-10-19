"""HeyGen presenter: request body, polling and the multipart upload (no network)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from rasika_worker import presenter


def test_payload_from_photo_is_portrait_1080p() -> None:
    p = presenter.build_payload("Hi there.", "v1", image_asset_id="a1", title="t")
    assert p["type"] == "image" and p["image"] == {"type": "asset_id", "asset_id": "a1"}
    assert p["aspect_ratio"] == "9:16" and p["resolution"] == "1080p" and p["voice_id"] == "v1"
    assert "avatar_id" not in p


def test_payload_from_look_with_engine() -> None:
    p = presenter.build_payload("Hi.", "v1", avatar_id="look1", engine="avatar_v")
    assert p["type"] == "avatar" and p["avatar_id"] == "look1" and p["engine"] == {"type": "avatar_v"}
    assert "image" not in p


def test_payload_requires_exactly_one_presenter() -> None:
    with pytest.raises(ValueError):
        presenter.build_payload("x", "v")
    with pytest.raises(ValueError):
        presenter.build_payload("x", "v", image_asset_id="a", avatar_id="b")


def test_client_requires_key() -> None:
    with pytest.raises(RuntimeError):
        presenter.HeyGenClient("")


def test_wait_polls_until_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    c = presenter.HeyGenClient("k")
    states = iter([{"status": "pending"}, {"status": "processing"}, {"status": "completed", "video_url": "u"}])
    monkeypatch.setattr(c, "video_status", lambda vid: next(states))
    monkeypatch.setattr(presenter.time, "sleep", lambda s: None)
    seen: list[str] = []
    st = c.wait("v", progress=lambda status, t: seen.append(status), every=0)
    assert st["video_url"] == "u" and seen == ["pending", "processing", "completed"]


def test_wait_raises_on_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    c = presenter.HeyGenClient("k")
    monkeypatch.setattr(c, "video_status", lambda vid: {"status": "failed", "failure_code": "x", "failure_message": "bad"})
    with pytest.raises(RuntimeError, match="bad"):
        c.wait("v", every=0)


def test_upload_image_builds_multipart(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    c = presenter.HeyGenClient("k")
    img = tmp_path / "face.jpg"
    img.write_bytes(b"\xff\xd8\xff\xe0JPEGDATA")
    captured: dict[str, Any] = {}

    def fake_req(method: str, path: str, body: bytes | None = None, content_type: str | None = None) -> dict[str, Any]:
        captured.update(method=method, path=path, body=body, ct=content_type)
        return {"data": {"asset_id": "asset_9"}}

    monkeypatch.setattr(c, "_req", fake_req)
    assert c.upload_image(img) == "asset_9"
    assert captured["method"] == "POST" and captured["path"] == "/v3/assets"
    assert captured["ct"].startswith("multipart/form-data; boundary=")
    assert b'name="file"; filename="face.jpg"' in captured["body"] and b"JPEGDATA" in captured["body"]


def test_create_video_reads_video_id(monkeypatch: pytest.MonkeyPatch) -> None:
    c = presenter.HeyGenClient("k")
    monkeypatch.setattr(c, "post_json", lambda path, payload: {"data": {"video_id": "vid_1"}})
    assert c.create_video({"type": "image"}) == "vid_1"
    monkeypatch.setattr(c, "post_json", lambda path, payload: {"data": {}})
    with pytest.raises(RuntimeError):
        c.create_video({})
    assert json.dumps(presenter.build_payload("s", "v", avatar_id="l"))  # serialisable
