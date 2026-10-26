"""Roundup films: the post's items, the README's media and the script's checks (no network)."""

from __future__ import annotations

from pathlib import Path

from rasika_worker.roundup import (
    Item,
    Media,
    Research,
    check_script,
    github_repo,
    links_in,
    readme_media,
    says,
    seconds_for,
    split_by_links,
    split_post,
)

POST = """Today's GitHub Daily Top: the 5 projects with the most brutal star surges!

1. pbakaus/impeccable

A design language that makes AI coding assistants truly understand design.

🔗 Direct Link: https://github.com/pbakaus/impeccable

619 stars in one day, total stars smashing through 86K.

🟢

2. makecindy/cindy

An open-source, out-of-the-box AI Agent.

🔗 Direct Link: https://github.com/makecindy/cindy.

477 stars in one day!

Summary:
Design Skills + ready-to-go Agents are the new infrastructure."""


def test_links_in_order_once_without_trailing_punctuation() -> None:
    assert links_in(POST) == [
        "https://github.com/pbakaus/impeccable",
        "https://github.com/makecindy/cindy",
    ]


def test_github_repo() -> None:
    assert github_repo("https://github.com/pbakaus/impeccable") == ("pbakaus", "impeccable")
    assert github_repo("https://github.com/a/b.git") == ("a", "b")
    assert github_repo("https://github.com/a/b/tree/main/docs") == ("a", "b")
    assert github_repo("https://github.com/topics/ai") is None
    assert github_repo("https://example.com/a/b") is None


def test_split_by_links_keeps_each_items_heading_and_comment() -> None:
    items = split_by_links(POST)
    assert [i.name for i in items] == ["impeccable", "cindy"]
    assert "design language" in items[0].post_says
    assert "619 stars" in items[0].post_says
    assert "2. makecindy" not in items[0].post_says  # the next item's heading is not ours
    assert "477 stars" in items[1].post_says


class _Resp:
    def __init__(self, text: str) -> None:
        self.content = [type("B", (), {"text": text})()]


class _Client:
    def __init__(self, text: str) -> None:
        self.text = text
        self.messages = self

    def create(self, **_: object) -> _Resp:
        return _Resp(self.text)


def test_split_post_rejects_links_the_post_does_not_have() -> None:
    made_up = (
        '{"topic": "x", "items": [{"rank": 1, "name": "Fake", "url": "https://github.com/x/y"}]}'
    )
    topic, items, _ = split_post(POST, _Client(made_up), "m")
    assert topic == ""  # fell back
    assert [i.name for i in items] == ["impeccable", "cindy"]


def test_split_post_uses_the_models_names() -> None:
    good = (
        '{"topic": "GitHub daily top", "items": ['
        '{"rank": 1, "name": "Impeccable", "url": "https://github.com/pbakaus/impeccable", "post_says": "a"},'
        '{"rank": 2, "name": "Cindy", "url": "https://github.com/makecindy/cindy", "post_says": "b"}],'
        ' "closing": "Agents are infrastructure."}'
    )
    topic, items, closing = split_post(POST, _Client(good), "m")
    assert topic == "GitHub daily top"
    assert [i.name for i in items] == ["Impeccable", "Cindy"]
    assert closing == "Agents are infrastructure."


def test_readme_media_skips_badges_and_resolves_paths() -> None:
    md = """
[![stars](https://img.shields.io/github/stars/a/b)](x)
![Demo](docs/demo.gif)
<img src="https://github.com/a/b/blob/main/shot.png" alt="Screenshot">
<img src="logo.svg">

https://github.com/user-attachments/assets/1234-abcd

<video src="https://example.com/clip.mp4"></video>
"""
    got = readme_media(md, "https://raw.githubusercontent.com/a/b/HEAD/")
    urls = [u for u, _ in got]
    assert urls == [
        "https://raw.githubusercontent.com/a/b/HEAD/docs/demo.gif",
        "https://raw.githubusercontent.com/a/b/main/shot.png",
        "https://github.com/user-attachments/assets/1234-abcd",
        "https://example.com/clip.mp4",
    ]
    assert got[0][1] == "Demo"


def test_says_matches_whole_words_in_order() -> None:
    n = "Five repos blew up today. First, Impeccable — a design language for AI."
    assert says(n, "first, impeccable")
    assert says(n, "a design language")
    assert not says(n, "design a language")
    assert not says(n, "")


def _research() -> list[Research]:
    it = Item(rank=1, name="impeccable", url="https://github.com/pbakaus/impeccable", post_says="")
    r = Research(item=it, url=it.url, host="github.com")
    r.media = [Media(id="i1m1", kind="image", path=Path("x.png"), source=it.url, label="page")]
    return [r]


def test_check_script_drops_what_does_not_hold() -> None:
    narration = (
        "Five GitHub repos blew up today, and one is a robot duck. First up, Impeccable. "
        "It teaches AI coding tools real design taste, with eighty-six thousand stars."
    )
    script = {
        "title": "Top 5",
        "narration": narration,
        "hook": {"line": "5 repos blew up", "say": "five github repos"},
        "outro": {"line": "Bye", "say": "never said"},
        "items": [
            {
                "rank": 1,
                "name": "Impeccable",
                "say": "first up, impeccable",
                "line": "Design taste for AI",
                "url": "https://github.com/pbakaus/impeccable",
                "stat": {"value": 86000, "label": "stars", "say": "eighty-six thousand stars"},
                "shots": [
                    {"media": "i1m1", "say": "first up, impeccable"},
                    {"media": "nope", "say": "real design taste"},
                    {"media": "i1m1", "say": "not in the script"},
                ],
            }
        ],
    }
    out = check_script(script, _research())
    assert out["hook"]["say"] == "five github repos"
    assert "outro" not in out
    it = out["items"][0]
    assert it["url"] == "github.com/pbakaus/impeccable"
    assert it["stat"]["value"] == 86000 and it["stat"]["from"] == "page"
    assert it["shots"] == [{"media": "i1m1", "say": "first up, impeccable", "kind": "image"}]


def test_check_script_needs_a_narration() -> None:
    import pytest

    with pytest.raises(ValueError):
        check_script({"narration": "too short"}, _research())


def test_seconds_for() -> None:
    lo, hi = seconds_for(5, 180)
    assert 50 <= lo < hi <= 70
    assert seconds_for(8, 60)[1] == 60


def _words(text: str, step: float = 0.4) -> list[dict[str, object]]:
    return [{"w": w, "t": round(i * step, 3)} for i, w in enumerate(text.split())]


def test_when_lines_up_hyphenated_numbers() -> None:
    from rasika_worker.roundup import when

    words = _words("It is at eighty-nine thousand stars today")
    assert when(words, "eighty-nine thousand stars") == 1.2
    assert when(words, "eighty nine thousand") == 1.2
    assert when(words, "stars", after=2.5) is None


def test_build_plan_places_each_item_on_its_words() -> None:
    from rasika_worker.roundup import build_plan

    narration = (
        "Five repos blew up today and one is a robot duck . First up Impeccable which teaches AI design "
        "with eighty-nine thousand stars . Next Microduck a tiny robot that walks and stands up . "
        "Taste is next . Follow for more"
    )
    words = _words(narration)
    page = {
        "asset": "a1",
        "kind": "image",
        "item": 1,
        "shows": "the page, first screen",
        "w": 1440,
        "h": 900,
    }
    site = {
        "asset": "a2",
        "kind": "image",
        "item": 2,
        "shows": "the project's own website, first screen",
        "w": 1440,
        "h": 900,
    }
    clip = {
        "asset": "a3",
        "kind": "clip",
        "item": 2,
        "shows": "demo",
        "sec": 20.0,
        "page": "https://github.com/x/duck",
    }
    film = {
        "data": {
            "media": {"m1": page, "m2": site, "m3": clip},
            "roundup": {
                "hook": {"line": "5 repos, one robot duck", "say": "five repos blew up"},
                "outro": {"line": "Taste is next", "say": "taste is next"},
                "items": [
                    {
                        "rank": 1,
                        "name": "Impeccable",
                        "say": "first up impeccable",
                        "line": "Design taste for AI",
                        "url": "github.com/x/impeccable",
                        "stat": {
                            "value": 89000,
                            "label": "GitHub stars",
                            "say": "eighty-nine thousand stars",
                        },
                        "shots": [{"media": "m1", "say": "first up impeccable"}],
                    },
                    {
                        "rank": 2,
                        "name": "Microduck",
                        "say": "next microduck",
                        "line": "A robot duck",
                        "url": "github.com/x/duck",
                        "shots": [
                            {"media": "m2", "say": "next microduck"},
                            {"media": "m3", "say": "a tiny robot"},
                        ],
                    },
                ],
            },
        }
    }
    plan = build_plan({"palette": {}}, film, words, 40.0)
    els = {e["id"]: e for e in plan["elements"]}
    assert els["head1"]["t0"] == when_t(words, "first")
    assert els["stat1"]["type"] == "counter" and els["stat1"]["t0"] == when_t(words, "eighty-nine")
    assert els["stat1"]["to"] == 89 and els["stat1"]["label"] == "thousand GitHub stars"
    card = els["v1_1"]
    assert card["type"] == "browserCard" and card["h"] == round(1000 * 900 / 1440 + 54)
    duck = els["v2_2"]
    assert duck["type"] == "broll" and duck["source"]["provider"] == "asset"
    assert duck["t1"] - duck["t0"] <= 6.0
    assert els["recap"]["lines"][1]["text"] == "Impeccable"
    assert els["recap"]["lines"][2]["text"] == "Microduck"
    assert els["hook1"]["type"] == "browserCard"  # the opening flash of every item's page
    assert plan["captions"]["enabled"]


def when_t(words: list[dict[str, object]], first_word: str) -> float:
    return next(float(str(w["t"])) for w in words if str(w["w"]).lower() == first_word)
