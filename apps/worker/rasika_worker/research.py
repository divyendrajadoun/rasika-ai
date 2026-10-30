"""
Researched explainer reels ("Explainer from a topic"): the user gives a topic, an idea or a post
(links are welcome); Rasika researches it, writes a storyboard in the "how it works" reel format
and hyper.py draws it.

  research()          web search (Claude's server-side tool) for facts with their sources, plus a
                      visit to every link the user gave (roundup.research_item: the page, its README
                      pictures and clips) and screenshots of the best sources
  write_storyboard()  the narration and 12–24 scenes from the scene library, each starting on the
                      words it names, every number from the research
  check_storyboard()  keeps only scenes, cards and media that hold up

Facts come from what the research found, never from memory: a number on screen has a source.
"""

from __future__ import annotations

import contextlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rasika_worker import roundup
from rasika_worker.director import RULES
from rasika_worker.reference import parse_json

MAX_LINKS = 4
MAX_SOURCE_SHOTS = 3
FALLBACK_BETA = "server-side-fallback-2026-07-01"


@dataclass
class TopicResearch:
    topic: str
    summary: str = ""
    facts: list[dict[str, str]] = field(default_factory=list)  # {"fact", "source"}
    sources: list[dict[str, str]] = field(default_factory=list)  # {"url", "title"}
    media: list[roundup.Media] = field(default_factory=list)
    pages: list[roundup.Research] = field(default_factory=list)  # the user's own links
    problems: list[str] = field(default_factory=list)

    def as_prompt(self) -> dict[str, Any]:
        return {
            "topic": self.topic,
            "summary": self.summary,
            "facts": self.facts[:30],
            "sources": self.sources[:12],
            "links_the_user_gave": [p.as_prompt() for p in self.pages],
            "media": [m.describe() for m in self.media],
        }


RESEARCH_SYSTEM = """You research a topic for a short vertical explainer reel. Use web search to find what is
true and current about it: what it is, how it works, the key steps, the striking numbers (with their source),
and one surprising detail. Prefer primary sources (official sites, docs, papers, the maker's own pages).
Then answer with ONE JSON object, nothing else:

{"summary": "4–6 sentences a beginner understands",
 "facts": [{"fact": "one checkable statement, numbers exact as the source gives them", "source": "url"}],   // 6–14
 "sources": [{"url": "...", "title": "..."}],                     // the pages you used, best first
 "visual_urls": ["urls of pages that would look good on screen: the product's own site, a demo page"]}   // 0–4

Never state a fact you did not find. If the topic is the user's own story or opinion, research only the
checkable parts and keep the rest as the user gave it."""


def _message(
    client: Any,
    model: str,
    system: str,
    content: Any,
    tools: list[dict[str, Any]] | None,
    max_tokens: int,
) -> tuple[str, dict[str, int]]:
    """One request (with server tools, the turn may pause and is resumed), text out."""
    messages: list[dict[str, Any]] = [{"role": "user", "content": content}]
    usage = {"input_tokens": 0, "output_tokens": 0}
    text = ""
    for _ in range(4):
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools
        try:  # a policy decline is retried on another model by the API (opt-in fallbacks)
            resp = client.beta.messages.create(betas=[FALLBACK_BETA], fallbacks="default", **kwargs)
        except TypeError:  # an SDK without the parameter: plain request
            resp = client.messages.create(**kwargs)
        usage["input_tokens"] += int(getattr(resp.usage, "input_tokens", 0) or 0)
        usage["output_tokens"] += int(getattr(resp.usage, "output_tokens", 0) or 0)
        text = "".join(
            getattr(b, "text", "") or "" for b in resp.content if getattr(b, "type", "") == "text"
        )
        if getattr(resp, "stop_reason", "") == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        if getattr(resp, "stop_reason", "") == "refusal":
            raise ValueError("the request was declined")
        break
    return text, usage


def research(
    topic: str,
    out: Path,
    client: Any,
    model: str,
    ffmpeg: str = "ffmpeg",
    ffprobe: str = "ffprobe",
    web: bool = True,
) -> tuple[TopicResearch, dict[str, int]]:
    """Facts with sources, the user's links visited, screenshots of the best sources."""
    out.mkdir(parents=True, exist_ok=True)
    r = TopicResearch(topic=topic.strip())
    usage = {"input_tokens": 0, "output_tokens": 0}
    # the user's own links: the page, its README pictures and clips
    for i, url in enumerate(roundup.links_in(topic)[:MAX_LINKS], start=1):
        gh = roundup.github_repo(url)
        item = roundup.Item(rank=i, name=gh[1] if gh else url, url=url, post_says="")
        page = roundup.research_item(item, out / f"link{i}", ffmpeg, ffprobe)
        r.pages.append(page)
        r.media.extend(page.media)
        r.problems.extend(page.problems)
    if web:
        try:
            text, u = _message(
                client,
                model,
                RESEARCH_SYSTEM,
                f"## The topic, as the user gave it\n\n{topic[:6000]}",
                [{"type": "web_search_20260209", "name": "web_search", "max_uses": 6}],
                16000,
            )
            for k in usage:
                usage[k] += u[k]
            found = parse_json(text)
            r.summary = str(found.get("summary") or "")[:1500]
            r.facts = [
                {"fact": str(f.get("fact") or "")[:300], "source": str(f.get("source") or "")[:300]}
                for f in found.get("facts") or []
                if isinstance(f, dict) and f.get("fact")
            ][:20]
            r.sources = [
                {"url": str(s.get("url") or "")[:300], "title": str(s.get("title") or "")[:160]}
                for s in found.get("sources") or []
                if isinstance(s, dict) and s.get("url")
            ][:12]
            shots = [u for u in found.get("visual_urls") or [] if isinstance(u, str)]
        except Exception as exc:
            r.problems.append(f"web research: {exc}")
            shots = []
        # screenshots of the best sources the user did not already give
        known = {p.url for p in r.pages}
        n = 0
        for url in shots + [s["url"] for s in r.sources]:
            if n >= MAX_SOURCE_SHOTS or url in known:
                continue
            known.add(url)
            try:
                got = roundup.capture_pages(url, out / f"source{n + 1}")
            except Exception as exc:
                r.problems.append(f"screenshot {url[:80]}: {exc}")
                continue
            if got and not blank(got[0][1]):
                label, path = got[0]
                r.media.append(
                    roundup.Media(
                        id=f"s{n + 1}",
                        kind="image",
                        path=path,
                        source=url,
                        label=f"{label} of {url[:80]}",
                        width=1440,
                        height=900,
                    )
                )
                n += 1
    return r, usage


# ───────────────────────────── the storyboard ─────────────────────────────

STORY_SYSTEM = (
    """You write and storyboard vertical (1080×1920) explainer reels in the "how it works" format: a
warm paper stage, heavy uppercase headlines with one accent word, step pills, cards that slide in, and
two-to-three-word captions on the voice. A new scene every 2–3 seconds: write the number of scenes the brief
asks for ("scenes"), never fewer. You get the topic, the research
(facts with sources, the user's own links) and the media we saved (ids, what each shows).
Return ONE JSON object, nothing else:

{"title": "short project title",
 "narration": "the full voice-over, as spoken",
 "emphasis": ["words the captions colour"],      // 8–16 of the key words (numbers colour themselves)
 "scenes": [ … ]}

Scenes (in order; each has "say": the exact narration words where it starts, 2–6 words, copied verbatim):
- {"type":"headline","say":…,"title":"1–3 short lines separated by \\n, ≤ 18 chars each, one *accent* word",
   "serif":"optional italic line ≤ 40 chars", "pill":"optional KICKER · LABEL", "card": optional card}
- {"type":"step","say":…,"pill":"STEP 2 · SHORT LABEL","title":"optional line ≤ 22 chars, one *accent*","card": card}
- {"type":"compare","say":…,"title":"A → *B* (≤ 18 chars)","left":{"text":"≤ 90 chars" | "media":id,"tag":"≤ 14"},
   "right":{"media":id | "text":…,"tag":"≤ 14"}}
- {"type":"cta","say":…,"lead":"comment","word":"ONE WORD","tail":"to get the *full guide*."}   // last scene only
Cards: {"kind":"chat","messages":[{"who":"me"|"ai","name":"Me"|"Claude"|…,"text":"≤ 120 chars"}]}   // 1–3
       {"kind":"code","title":"file name","lines":["≤ 44 chars", …]}    // 3–8 lines, real-looking
       {"kind":"phone","media":id,"tag":"optional ≤ 16"}  {"kind":"browser","media":id,"url":"host/path"}
       {"kind":"image","media":id}  {"kind":"grid","media_list":[ids]}   // 3–12
       {"kind":"stats","stats":[{"value":"52","label":"≤ 22 chars"}]}   // 1–3, real numbers only
       {"kind":"list","items":["≤ 28 chars, one *accent* word", …]}  // 2–4
       {"kind":"quote","text":"≤ 140 chars","source":"who said it"}

How to write it (this is what makes people stay):
- The first scene is the hook, on screen from frame 0: a bold claim or result in ≤ 6 words, one accent word,
  often a serif line under it and a phone or card showing the result. The first sentence makes them want
  the answer.
- Pace like a fast reel: one sentence or half a sentence per scene. A step can take two or three scenes in a
  row (same pill, a new title or card for each beat): the picture changes whenever the voice moves on.
- Then the steps or parts, each a pill + one card that SHOWS it (a chat for an idea, code for the build, a
  phone/browser for the real thing, stats for numbers, a list for what you get). Vary the cards; never the
  same card kind twice in a row.
- Spoken English: short sentences, everyday words, one idea per sentence, ~2.5 words a second.
- Every number on screen and in the voice comes from the research facts. No invented quotes or stats.
- Use the media ids given for anything real (pages, demos); use chat/code/list/stats when nothing real fits.
- End with the call to action scene ("comment WORD to get …" unless the user gave their own CTA).
- Length: the range you are given."""
    + RULES
)


def write_storyboard(
    client: Any,
    model: str,
    r: TopicResearch,
    seconds: tuple[float, float],
    cta: str | None = None,
    max_images: int = 8,
) -> tuple[dict[str, Any], dict[str, int]]:
    from rasika_worker.planner import _b64_image

    lo, hi = seconds
    need = [max(8, round(lo / 3.0)), max(10, round(hi / 2.5))]
    brief = {
        "length_seconds": [round(lo), round(hi)],
        "words": [round(lo * 2.5), round(hi * 2.5)],
        "scenes": need,
        "call_to_action": cta or None,
        **r.as_prompt(),
    }
    content: list[dict[str, Any]] = [
        {"type": "text", "text": "## The brief\n\n" + json.dumps(brief, ensure_ascii=False)}
    ]
    for m in [m for m in r.media if m.kind == "image"][:max_images]:
        with contextlib.suppress(Exception):
            content.append({"type": "text", "text": f"Media {m.id}: {m.label}"})
            content.append(_b64_image(m.path))
    text, usage = _message(client, model, STORY_SYSTEM, content, None, 16000)
    sb = check_storyboard(parse_json(text), {m.id: m for m in r.media})
    if len(sb["scenes"]) < need[0]:  # too slow for a reel: one more try, told exactly why
        again = content + [
            {
                "type": "text",
                "text": f"Your storyboard had {len(sb['scenes'])} usable scenes; this length needs "
                f"{need[0]}–{need[1]}. Write it again with that many (split steps into beats).",
            }
        ]
        text2, u2 = _message(client, model, STORY_SYSTEM, again, None, 16000)
        for k in usage:
            usage[k] += u2[k]
        with contextlib.suppress(ValueError):
            sb2 = check_storyboard(parse_json(text2), {m.id: m for m in r.media})
            if len(sb2["scenes"]) > len(sb["scenes"]):
                sb = sb2
    return sb, usage


def check_storyboard(sb: dict[str, Any], media: dict[str, Any]) -> dict[str, Any]:
    """Keep what holds: scenes whose words the narration says (the first always starts at 0), cards of
    known kinds, media we saved, stats with a real number. Raises when nothing usable is left."""
    narration = str(sb.get("narration") or "").strip()
    if len(narration.split()) < 15:
        raise ValueError("the writer returned no narration")
    kinds = {"chat", "code", "phone", "browser", "grid", "stats", "list", "quote", "image"}
    out_scenes: list[dict[str, Any]] = []
    for i, s in enumerate(sb.get("scenes") or []):
        if not isinstance(s, dict) or s.get("type") not in ("headline", "step", "compare", "cta"):
            continue
        if i and not roundup.says(narration, str(s.get("say") or "")):
            continue
        card = s.get("card")
        if isinstance(card, dict):
            k = str(card.get("kind") or "")
            if k not in kinds:
                s.pop("card", None)
            elif k in ("phone", "browser", "image") and str(card.get("media") or "") not in media:
                # no real picture: say it with words instead
                s["card"] = (
                    {"kind": "list", "items": [str(card.get("tag") or s.get("title") or "")[:28]]}
                    if card.get("tag") or s.get("title")
                    else None
                )
                if not s["card"]:
                    s.pop("card")
            elif k == "grid":
                ids = [x for x in card.get("media_list") or [] if x in media]
                if len(ids) < 3:
                    s.pop("card")
                else:
                    card["media_list"] = ids[:12]
            elif k == "stats":
                st = [
                    x
                    for x in card.get("stats") or []
                    if isinstance(x, dict) and re.search(r"\d", str(x.get("value") or ""))
                ]
                if not st:
                    s.pop("card")
                else:
                    card["stats"] = st[:3]
        if s["type"] == "compare":
            for side in ("left", "right"):
                d = s.get(side) or {}
                if d.get("media") and d["media"] not in media:
                    d.pop("media")
                    d.setdefault("text", "")
        out_scenes.append(s)
    if len(out_scenes) < 3:
        raise ValueError("the storyboard has too few usable scenes")
    return {
        "title": str(sb.get("title") or "")[:120],
        "narration": narration,
        "emphasis": [str(w)[:30] for w in sb.get("emphasis") or []][:20],
        "scenes": out_scenes[:30],
        "terms": [str(t)[:40] for t in sb.get("terms") or [] if str(t).strip()][
            :3
        ],  # director.plan
    }


def blank(path: Path) -> bool:
    """A screenshot that is (nearly) one flat colour: a page that blocked us or never drew."""
    try:
        from PIL import Image, ImageStat

        with Image.open(path) as im:
            return float(ImageStat.Stat(im.convert("L").resize((144, 90))).stddev[0]) < 14.0
    except Exception:
        return True


def seconds_for(cap: float) -> tuple[float, float]:
    return (min(40.0, cap), min(65.0, cap))
