"""Pexels clip selection and the search cache (no network)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from rasika_worker import stock


def video(id_: int, dur: float, files: list[tuple[int, int, str]]) -> dict:
    return {
        "id": id_,
        "url": f"https://www.pexels.com/video/{id_}/",
        "duration": dur,
        "user": {"name": f"Maker {id_}"},
        "video_files": [
            {
                "link": f"https://v.pexels.com/{id_}-{h}.mp4",
                "width": w,
                "height": h,
                "file_type": ft,
            }
            for w, h, ft in files
        ],
    }


def test_pick_file_prefers_smallest_portrait_above_1280() -> None:
    v = video(
        1,
        12,
        [
            (1920, 1080, "video/mp4"),
            (720, 1280, "video/mp4"),
            (1080, 1920, "video/mp4"),
            (2160, 3840, "video/mp4"),
        ],
    )
    f = stock.pick_file(v)
    assert f and f["height"] == 1280


def test_pick_file_falls_back_to_largest_portrait() -> None:
    v = video(2, 12, [(360, 640, "video/mp4"), (540, 960, "video/mp4"), (1920, 1080, "video/mp4")])
    f = stock.pick_file(v)
    assert f and f["height"] == 960


def test_pick_file_rejects_landscape_only() -> None:
    assert stock.pick_file(video(3, 12, [(1920, 1080, "video/mp4")])) is None


def test_choose_skips_short_and_landscape_clips() -> None:
    vids = [
        video(10, 2.0, [(1080, 1920, "video/mp4")]),  # too short for 3 s
        video(11, 9.0, [(1920, 1080, "video/mp4")]),  # landscape only
        video(12, 9.0, [(1080, 1920, "video/mp4")]),
    ]
    c = stock.choose(vids, need_sec=3.0)
    assert c and c.id == 12 and c.author == "Maker 12" and c.height == 1920
    assert c.as_source()["provider"] == "pexels"


def test_choose_none_when_nothing_fits() -> None:
    assert stock.choose([video(1, 1.0, [(1080, 1920, "video/mp4")])], 4.0) is None


def test_client_requires_key(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError):
        stock.PexelsClient("", tmp_path)


def test_search_uses_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    c = stock.PexelsClient("k", tmp_path)
    calls: list[str] = []

    def fake_get(url: str) -> bytes:
        calls.append(url)
        return json.dumps({"videos": [video(5, 8, [(1080, 1920, "video/mp4")])]}).encode()

    monkeypatch.setattr(c, "_get", fake_get)
    a = c.search("gold necklace  close up")
    b = c.search("gold necklace close up")
    assert len(calls) == 1 and a == b and a[0]["id"] == 5
    assert "orientation=portrait" in calls[0] and "query=gold+necklace+close+up" in calls[0]


def test_broll_elements_filters_by_type() -> None:
    plan = {"elements": [{"type": "posterText"}, {"type": "broll", "query": "x"}]}
    assert [e["query"] for e in stock.broll_elements(plan)] == ["x"]
