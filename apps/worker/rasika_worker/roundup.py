"""
Roundup films from a pasted post: "today's top 5 GitHub repos", "3 AI tools worth trying", any list
of things with links. The user pastes the post; Rasika reads it, visits every link and comes back
with a narrated (or presented) reel where each item's real page, demo clip and numbers are on screen
while the voice talks about it.

  split_post()      the post → its items (rank, name, link, what the post says), one fast-model call,
                    with a no-model fallback that cuts the post at its links
  research_item()   one link → facts (GitHub's own numbers for a repo), screenshots of the page and
                    its README, and the README's own images and demo clips, every request guarded
                    against private addresses and capped in size
  write()           one Claude call turns the items and what was found into the narration and, per
                    item, the exact spoken phrase each visual lands on
  check_script()    keeps only phrases the narration really says and media that really exist

Facts come from the post and the pages, never from the model's memory: star counts are GitHub's at
the time of the visit, and what only the post claims ("619 stars in one day") is said as the post's.
"""

from __future__ import annotations

import base64
import contextlib
import json
import re
import subprocess
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

from rasika_worker.brief import UnsafeUrlError, check_url
from rasika_worker.director import RULES
from rasika_worker.reference import parse_json

URL_RE = re.compile(r"https?://[^\s<>()\[\]\"'`]+")
GITHUB_RE = re.compile(
    r"^https?://(?:www\.)?github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$"
)
MAX_ITEMS = 8
MAX_IMAGE_BYTES = 12_000_000
MAX_CLIP_BYTES = 40_000_000
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 RasikaBriefBot"
# README pictures that are not pictures of the project
NOT_MEDIA = re.compile(
    r"shields\.io|badge|badgen\.net|codecov|travis-ci|circleci|/actions/workflows/|star-history|"
    r"contrib\.rocks|buymeacoffee|ko-fi|opencollective|sponsor|discord(app)?\.com/api|\.svg(\?|$)",
    re.I,
)
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif")
CLIP_EXT = (".mp4", ".webm", ".mov", ".m4v")


# ───────────────────────────── the post ─────────────────────────────


@dataclass
class Item:
    rank: int
    name: str
    url: str
    post_says: str  # the post's own words about this item


def links_in(text: str) -> list[str]:
    """Every link in the post, in order, once each, without trailing punctuation."""
    seen: list[str] = []
    for m in URL_RE.finditer(text):
        u = m.group(0).rstrip(".,;:!?…)")
        if u not in seen:
            seen.append(u)
    return seen


def github_repo(url: str) -> tuple[str, str] | None:
    m = GITHUB_RE.match(url.strip())
    if not m:
        return None
    owner, repo = m.group(1), m.group(2)
    if owner.lower() in ("orgs", "topics", "trending", "search", "settings", "features", "about"):
        return None
    return owner, repo


def split_by_links(text: str) -> list[Item]:
    """No model: each item is the text that ends with its link, plus what follows up to the next
    item's opening line (a numbered line, or a blank line before the next block)."""
    links = links_in(text)[:MAX_ITEMS]
    items: list[Item] = []
    for i, u in enumerate(links):
        start = text.find(u)
        prev_end = text.find(links[i - 1]) + len(links[i - 1]) if i else 0
        nxt = text.find(links[i + 1]) if i + 1 < len(links) else len(text)
        # the item's heading is the last numbered line before its link
        before = text[prev_end:start]
        heads = list(re.finditer(r"(?m)^\s*\d{1,2}[.)]\s+.+$", before))
        head_at = prev_end + heads[-1].start() if heads else prev_end
        tail = text[start + len(u) : nxt]
        nexthead = re.search(r"(?m)^\s*\d{1,2}[.)]\s+.+$", tail)
        tail = tail[: nexthead.start()] if nexthead else tail
        chunk = (text[head_at:start] + tail).strip()
        gh = github_repo(u)
        name = gh[1] if gh else (urlparse(u).hostname or u)
        items.append(Item(rank=i + 1, name=name, url=u, post_says=chunk[:900]))
    return items


SPLIT_SYSTEM = """You read a social media post that lists several things with links (repos, tools, products,
articles) and return ONE JSON object, nothing else:

{"topic": "what the list is, ≤ 60 chars", "items": [{"rank": 1, "name": "the item's name as people say it",
 "url": "its link, copied exactly from the post", "post_says": "everything the post says about it, ≤ 600 chars"}],
 "closing": "the post's own closing take, ≤ 300 chars, or null"}

Rules: items in the post's order; one per link that names a thing (skip links to the poster's own profile,
newsletters or shorteners that are not an item); `url` must be a link that appears in the post; never add
facts the post does not state."""


def split_post(
    text: str, client: Any = None, model: str = ""
) -> tuple[str, list[Item], str | None]:
    """(topic, items, closing). Falls back to cutting at the links when no model is given or the
    model's answer does not hold up (a link that is not in the post, or no items)."""
    text = text.strip()
    fallback = ("", split_by_links(text), None)
    if client is None or not model:
        return fallback
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=3000,
            system=SPLIT_SYSTEM,
            messages=[{"role": "user", "content": text[:12000]}],
        )
        out = parse_json("".join(getattr(b, "text", "") for b in resp.content))
    except Exception:
        return fallback
    real = set(links_in(text))
    items: list[Item] = []
    for x in out.get("items") or []:
        u = str(x.get("url") or "").rstrip(".,;:!?…)")
        if u not in real:
            continue
        items.append(
            Item(
                rank=len(items) + 1,
                name=str(x.get("name") or "").strip()[:60] or u,
                url=u,
                post_says=str(x.get("post_says") or "").strip()[:900],
            )
        )
        if len(items) >= MAX_ITEMS:
            break
    if not items:
        return fallback
    closing = out.get("closing")
    return str(out.get("topic") or "")[:80], items, (str(closing)[:400] if closing else None)


# ───────────────────────────── guarded fetching ─────────────────────────────


class _Guard(urllib.request.HTTPRedirectHandler):
    """Every redirect hop is checked like the first address."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_Guard)


def fetch(url: str, limit: int, accept: str = "*/*", timeout: float = 20) -> tuple[bytes, str]:
    """(body, content type) of a public URL, refused past `limit` bytes."""
    safe = check_url(url)
    req = urllib.request.Request(safe, headers={"User-Agent": UA, "Accept": accept})
    with _opener.open(req, timeout=timeout) as r:
        ctype = str(r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        size = int(r.headers.get("Content-Length") or 0)
        if size and size > limit:
            raise ValueError(f"too large ({size} bytes)")
        body = r.read(limit + 1)
        if len(body) > limit:
            raise ValueError("too large")
        return body, ctype


def github_facts(owner: str, repo: str) -> dict[str, Any]:
    """GitHub's own numbers for a repo (public API, no key: 60 requests an hour is plenty here)."""
    body, _ = fetch(
        f"https://api.github.com/repos/{owner}/{repo}", 2_000_000, "application/vnd.github+json"
    )
    d = json.loads(body)
    return {
        "full_name": d.get("full_name"),
        "description": d.get("description"),
        "stars": d.get("stargazers_count"),
        "forks": d.get("forks_count"),
        "language": d.get("language"),
        "topics": (d.get("topics") or [])[:8],
        "homepage": d.get("homepage") or None,
        "license": (d.get("license") or {}).get("spdx_id"),
        "created": (d.get("created_at") or "")[:10],
        "updated": (d.get("pushed_at") or "")[:10],
        "default_branch": d.get("default_branch") or "HEAD",
    }


def github_readme(owner: str, repo: str) -> tuple[str, str]:
    """(markdown, its folder URL on raw.githubusercontent.com, for relative links)."""
    body, _ = fetch(
        f"https://api.github.com/repos/{owner}/{repo}/readme",
        3_000_000,
        "application/vnd.github+json",
    )
    d = json.loads(body)
    text = base64.b64decode(d.get("content") or "").decode("utf-8", "replace")
    dl = str(d.get("download_url") or "")
    base = (
        dl.rsplit("/", 1)[0] + "/"
        if dl
        else f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/"
    )
    return text, base


def readme_media(md: str, base: str) -> list[tuple[str, str]]:
    """(url, alt) of the README's own pictures and clips, in order, without badges and logos of
    other services. Relative paths resolve against the README's folder; blob links become raw."""
    found: list[tuple[int, str, str]] = []  # (position in the README, url, alt)
    pats = [
        r"!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)",  # ![alt](url "title")
        r"<img[^>]*?src=[\"']([^\"']+)[\"'][^>]*?(?:alt=[\"']([^\"']*)[\"'])?",  # <img src alt>
        r"<video[^>]*?src=[\"']([^\"']+)[\"']",
        r"<source[^>]*?src=[\"']([^\"']+)[\"']",
        r"(?m)^\s*(https://github\.com/user-attachments/assets/[\w-]+)\s*$",  # pasted clip
        r"(https://[^\s)\"'<>]+\.(?:mp4|webm|mov|gif))",
    ]
    for i, p in enumerate(pats):
        for m in re.finditer(p, md, re.I):
            if i == 0:
                alt, u = m.group(1), m.group(2)
            elif i == 1:
                u, alt = m.group(1), m.group(2) or ""
            else:
                u, alt = m.group(1), ""
            u = u.strip()
            if not u or u.startswith(("data:", "#", "mailto:")):
                continue
            u = urljoin(base, u)
            bm = re.match(r"https://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/(.+)$", u)
            if bm:
                u = f"https://raw.githubusercontent.com/{bm.group(1)}/{bm.group(2)}/{bm.group(3)}"
            if NOT_MEDIA.search(u):
                continue
            if any(u == f for _, f, _ in found):
                continue
            found.append((m.start(), u, alt.strip()[:80]))
    return [(u, alt) for _, u, alt in sorted(found)]  # the README's own order


# ───────────────────────────── research ─────────────────────────────


@dataclass
class Media:
    id: str
    kind: str  # "image" | "clip"
    path: Path
    source: str  # where it came from (credit)
    label: str  # what it shows, for the writer
    width: int = 0
    height: int = 0
    duration: float = 0.0

    def describe(self) -> dict[str, Any]:
        d: dict[str, Any] = {"id": self.id, "kind": self.kind, "shows": self.label}
        if self.width:
            d["size"] = f"{self.width}x{self.height}"
        if self.duration:
            d["sec"] = round(self.duration, 1)
        return d


@dataclass
class Research:
    item: Item
    url: str
    host: str
    facts: dict[str, Any] = field(default_factory=dict)
    page: dict[str, Any] = field(default_factory=dict)  # title, description, readme excerpt
    media: list[Media] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    def as_prompt(self) -> dict[str, Any]:
        return {
            "rank": self.item.rank,
            "name": self.item.name,
            "url": self.url,
            "post_says": self.item.post_says,
            "facts_from_the_page": self.facts,
            "page": self.page,
            "media": [m.describe() for m in self.media],
            "could_not": self.problems or None,
        }


def _ffprobe_size(ffprobe: str, path: Path) -> tuple[int, int, float]:
    try:
        out = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height:format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout
        d = json.loads(out)
        s = (d.get("streams") or [{}])[0]
        return (
            int(s.get("width") or 0),
            int(s.get("height") or 0),
            float((d.get("format") or {}).get("duration") or 0),
        )
    except Exception:
        return 0, 0, 0.0


def _to_mp4(ffmpeg: str, src: Path, dest: Path, max_sec: float = 20) -> bool:
    """A GIF or WebM/MOV demo as a plain H.264 MP4 (even sides, ≤ 20 s), or False."""
    try:
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-v",
                "error",
                "-i",
                str(src),
                "-t",
                str(max_sec),
                "-an",
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30",
                "-pix_fmt",
                "yuv420p",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                "-movflags",
                "+faststart",
                str(dest),
            ],
            capture_output=True,
            timeout=180,
            check=True,
        )
        return dest.exists() and dest.stat().st_size > 1000
    except Exception:
        return False


def capture_pages(url: str, out: Path, timeout_ms: int = 25000) -> list[tuple[str, Path]]:
    """Two screenshots of a page in headless Chromium at 1440×900: its first screen and, for a
    GitHub repo, the top of its README. Requests to private addresses are aborted."""
    from playwright.sync_api import sync_playwright

    safe = check_url(url)
    out.mkdir(parents=True, exist_ok=True)
    checked: dict[str, bool] = {}

    def allowed(req_url: str) -> bool:
        h = urlparse(req_url).hostname or ""
        if not h:
            return True
        if h not in checked:
            try:
                check_url(f"https://{h}")
                checked[h] = True
            except UnsafeUrlError:
                checked[h] = False
        return checked[h]

    shots: list[tuple[str, Path]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            ctx = browser.new_context(
                viewport={"width": 1440, "height": 900},
                device_scale_factor=1,
                user_agent=UA,
                color_scheme="dark",
            )
            ctx.route("**/*", lambda r: r.continue_() if allowed(r.request.url) else r.abort())
            page = ctx.new_page()
            page.goto(safe, wait_until="domcontentloaded", timeout=timeout_ms)
            with contextlib.suppress(Exception):
                page.wait_for_load_state("networkidle", timeout=8000)
            page.add_style_tag(
                content="[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i]{display:none!important}"
            )
            page.wait_for_timeout(600)
            first = out / "page.png"
            page.screenshot(path=str(first))
            shots.append(("the page, first screen", first))
            readme = page.query_selector("article.markdown-body, #readme")
            if readme:
                box = readme.bounding_box()
                if box and box["y"] > 300:
                    page.evaluate(f"window.scrollTo(0, {max(0, int(box['y']) - 40)})")
                    page.wait_for_timeout(500)
                    rd = out / "readme.png"
                    page.screenshot(path=str(rd))
                    shots.append(("the README, top", rd))
        finally:
            browser.close()
    return shots


def research_item(
    item: Item,
    out: Path,
    ffmpeg: str = "ffmpeg",
    ffprobe: str = "ffprobe",
    max_images: int = 3,
    max_clips: int = 2,
    capture: bool = True,
) -> Research:
    """Facts, screenshots and the README's own media for one item. Every failure is recorded in
    `problems` and the rest carries on: a reel with fewer visuals beats no reel."""
    out.mkdir(parents=True, exist_ok=True)
    try:
        url = check_url(item.url)
    except UnsafeUrlError as exc:
        return Research(item=item, url=item.url, host="", problems=[str(exc)])
    host = urlparse(url).hostname or ""
    r = Research(item=item, url=url, host=host)
    n = 0

    def add(kind: str, path: Path, source: str, label: str) -> None:
        nonlocal n
        n += 1
        w, h, d = _ffprobe_size(ffprobe, path)
        if kind == "image" and (w < 240 or h < 160):
            return  # icons and avatars
        if kind == "clip" and d < 1.0:
            return
        r.media.append(
            Media(
                id=f"i{item.rank}m{n}",
                kind=kind,
                path=path,
                source=source,
                label=label,
                width=w,
                height=h,
                duration=d if kind == "clip" else 0.0,
            )
        )

    gh = github_repo(url)
    md, base = "", ""
    if gh:
        try:
            r.facts = github_facts(*gh)
        except Exception as exc:
            r.problems.append(f"GitHub numbers: {exc}")
        try:
            md, base = github_readme(*gh)
            r.page["readme"] = re.sub(r"<[^>]+>|!\[[^\]]*\]\([^)]*\)", "", md)[:3500]
        except Exception as exc:
            r.problems.append(f"README: {exc}")

    if capture:
        try:
            for label, path in capture_pages(url, out / "pages"):
                add("image", path, url, label)
        except Exception as exc:
            r.problems.append(f"screenshot: {exc}")
        home = str(r.facts.get("homepage") or "")
        if home.startswith(("http://", "https://")) and urlparse(home).hostname != host:
            try:
                site = capture_pages(home, out / "site")
                if site:
                    add("image", site[0][1], home, "the project's own website, first screen")
            except Exception as exc:
                r.problems.append(f"website screenshot: {exc}")

    if md:
        images = clips = 0
        for k, (u, alt) in enumerate(readme_media(md, base)):
            if images >= max_images and clips >= max_clips:
                break
            ext = Path(urlparse(u).path).suffix.lower()
            want_clip = ext in CLIP_EXT or ext == ".gif" or "user-attachments/assets" in u
            if (want_clip and clips >= max_clips) or (not want_clip and images >= max_images):
                continue
            try:
                body, ctype = fetch(u, MAX_CLIP_BYTES if want_clip else MAX_IMAGE_BYTES)
            except Exception as exc:
                r.problems.append(f"media {u[:80]}: {exc}")
                continue
            is_video = ctype.startswith("video/") or ext in CLIP_EXT
            is_gif = ctype == "image/gif" or ext == ".gif"
            if is_video or is_gif:
                raw = out / f"media_{k}{ext or ('.gif' if is_gif else '.mp4')}"
                raw.write_bytes(body)
                mp4 = out / f"clip_{k}.mp4"
                if _to_mp4(ffmpeg, raw, mp4):
                    add("clip", mp4, u, alt or "a demo clip from the README")
                    clips += 1
            elif ctype.startswith("image/") or ext in IMAGE_EXT:
                img = out / f"image_{k}{ext if ext in IMAGE_EXT else '.png'}"
                img.write_bytes(body)
                before = len(r.media)
                add("image", img, u, alt or "a picture from the README")
                images += len(r.media) - before
    return r


# ───────────────────────────── the script ─────────────────────────────

WORDS_PER_SEC = 2.5

WRITER_SYSTEM = (
    """You write and direct vertical (1080×1920) news-style reels for Rasika from a pasted post that
lists several things (GitHub repos, tools, products). You get the post's items, what we found on each link
(the page's own facts, numbers and the pictures/clips we saved, with ids) and the screenshots themselves.
Return ONE JSON object, nothing else:

{
  "title": "short project title",
  "narration": "the full voice-over script, as spoken",
  "hook": {"line": "on-screen hook, ≤ 7 words", "say": "the exact words of the narration it lands on (2–6 words)"},
  "items": [{
    "rank": 1,
    "name": "display name, ≤ 24 chars",
    "say": "the exact narration words that open this item (2–6 words, usually its name)",
    "line": "the one takeaway on screen, ≤ 7 words",
    "url": "the item's link without https://, ≤ 60 chars",
    "stat": null | {"value": 86000, "label": "≤ 3 words, e.g. GitHub stars", "say": "exact narration words where the number is spoken", "from": "page|post"},
    "shots": [{"media": "a media id we gave you", "say": "exact narration words this visual lands on (2–6 words)"}]
  }],
  "outro": {"line": "on-screen closing line, ≤ 7 words", "say": "exact narration words it lands on"}
}

How to write the narration (this is what makes people watch to the end):
- Hook first, within the first sentence (≤ 14 words): the count plus the most surprising item as a tease
  ("Five GitHub repos blew up today, and one of them is a walking robot duck."). No "Hey guys", no
  "In this video".
- Then each item in the post's order, 8–12 seconds each, in this shape: its name and what it is in plain
  words a non-developer understands (one sentence); one striking concrete detail (a number, what it
  actually does, who made it if the page says so); one short line on why it matters or who it is for.
- Spoken English: short sentences, everyday words, contractions. Explain jargon or drop it ("an AI agent —
  an assistant that actually does tasks on your computer"). No hype words without a fact behind them.
- Numbers: round them the way people say them ("eighty-six thousand stars"). Star counts and other page
  numbers come from facts_from_the_page (that is today's number); a claim only the post makes ("619 stars
  in one day") is said as given, never inflated. Never invent a number, a feature or a person's name.
- Close with one line that ties the list together (the post's closing take, if it has one), then a short
  call to action ("Follow for tomorrow's list." unless the user gave their own CTA).
- Total length: the range you are given, at about 2.5 words a second.

How to direct the visuals:
- Every item gets 1–3 `shots`, in the order they appear, each on words said while it should show
  (≥ 2.5 s apart). Prefer the README's demo clip or picture for "what it does", and the page screenshot
  when the item is named. Only use media ids we gave you; an item with none gets an empty list.
- `stat` only for a number the narration actually says.
- Every `say` must be copied exactly from your narration (same words, same order)."""
    + RULES
)


def write(
    client: Any,
    model: str,
    topic: str,
    research: list[Research],
    closing: str | None,
    seconds: tuple[float, float],
    cta: str | None = None,
    max_images: int = 14,
) -> tuple[dict[str, Any], dict[str, int]]:
    """The narration and the per-item directions, from one Claude call (screenshots attached)."""
    from rasika_worker.planner import _b64_image

    lo, hi = seconds
    brief = {
        "topic": topic or None,
        "length_seconds": [round(lo), round(hi)],
        "words": [round(lo * WORDS_PER_SEC), round(hi * WORDS_PER_SEC)],
        "post_closing_take": closing,
        "call_to_action": cta or None,
        "items": [x.as_prompt() for x in research],
    }
    user: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": "## The brief\n\n" + json.dumps(brief, ensure_ascii=False, default=str),
        }
    ]
    sent = 0
    for x in research:
        for m in x.media:
            if m.kind != "image" or sent >= max_images:
                continue
            with contextlib.suppress(Exception):
                img = _b64_image(m.path)
                user.append({"type": "text", "text": f"Media {m.id} ({x.item.name}): {m.label}"})
                user.append(img)
                sent += 1
    resp = client.messages.create(
        model=model,
        max_tokens=6000,
        system=WRITER_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    usage = {
        "input_tokens": int(getattr(resp.usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(resp.usage, "output_tokens", 0) or 0),
    }
    script = check_script(parse_json(text), research)
    return script, usage


def _norm(s: str) -> list[str]:
    return re.findall(r"[\w']+", s.lower())


def says(narration: str, phrase: str) -> bool:
    """True when the phrase's words occur, in order and next to each other, in the narration."""
    n, p = _norm(narration), _norm(phrase)
    if not p:
        return False
    return any(n[i : i + len(p)] == p for i in range(len(n) - len(p) + 1))


def check_script(script: dict[str, Any], research: list[Research]) -> dict[str, Any]:
    """Drop what does not hold: phrases the narration never says, media ids we never saved, stats
    whose spoken moment is missing. Raises when the narration itself is missing."""
    narration = str(script.get("narration") or "").strip()
    if len(_norm(narration)) < 20:
        raise ValueError("the writer returned no narration")
    known = {m.id: m for x in research for m in x.media}
    out: dict[str, Any] = {"title": str(script.get("title") or "")[:120], "narration": narration}
    for key in ("hook", "outro"):
        v = script.get(key) or {}
        if isinstance(v, dict) and says(narration, str(v.get("say") or "")):
            out[key] = {"line": str(v.get("line") or "")[:60], "say": str(v["say"])}
    items: list[dict[str, Any]] = []
    for it in script.get("items") or []:
        if not isinstance(it, dict):
            continue
        clean: dict[str, Any] = {
            "rank": int(it.get("rank") or len(items) + 1),
            "name": str(it.get("name") or "")[:24],
            "line": str(it.get("line") or "")[:60],
            "url": str(it.get("url") or "").replace("https://", "").replace("http://", "")[:60],
            "say": str(it.get("say") or ""),
        }
        if not says(narration, clean["say"]):
            clean["say"] = ""
        st = it.get("stat")
        value = st.get("value") if isinstance(st, dict) else None
        if isinstance(st, dict) and value is not None and says(narration, str(st.get("say") or "")):
            with contextlib.suppress(TypeError, ValueError):
                clean["stat"] = {
                    "value": float(value),
                    "label": str(st.get("label") or "")[:30],
                    "say": str(st["say"]),
                    "from": "post" if st.get("from") == "post" else "page",
                }
        shots = []
        for s in it.get("shots") or []:
            mid = str((s or {}).get("media") or "")
            if mid in known and says(narration, str(s.get("say") or "")):
                shots.append({"media": mid, "say": str(s["say"]), "kind": known[mid].kind})
        clean["shots"] = shots
        items.append(clean)
    out["items"] = items
    return out


def seconds_for(n_items: int, cap: float) -> tuple[float, float]:
    """About 10 s an item plus a hook and an ending, inside the plan's cap."""
    lo = 6 + 8.5 * n_items + 4
    hi = 6 + 11.5 * n_items + 5
    hi = min(hi, cap)
    return min(lo, hi), hi


__all__ = [
    "Item",
    "Media",
    "Research",
    "check_script",
    "fetch",
    "github_repo",
    "links_in",
    "readme_media",
    "research_item",
    "says",
    "seconds_for",
    "split_by_links",
    "split_post",
    "write",
]


# ───────────────────────────── the plan ─────────────────────────────

W, H = 1080, 1920
TOP_BAND = 150  # the item's header sits here
MEDIA_Y = 440  # the visual's box: x 40–1040, y 440–1120; the item's number counts up under it
MEDIA_H = 680
BAR_H = 54  # a browser card's address bar
STAT_TOP = 1170
CAPTION_Y = 1600
CLIP_MAX = 6.0  # the engine's cap on one cutaway
PAGE_LABELS = ("the page", "the README", "the project's own website")


def when(words: list[dict[str, Any]], phrase: str, after: float = 0.0) -> float | None:
    """The time the phrase starts being spoken (its first word), at or after `after`."""
    p = _norm(phrase)
    if not p:
        return None
    # one entry per token, so "eighty-nine" (one word, two tokens) still lines up with the phrase
    toks: list[tuple[str, float]] = []
    for w in words:
        for tok in _norm(str(w.get("w") or "")):
            toks.append((tok, float(w["t"])))
    for i in range(len(toks) - len(p) + 1):
        if toks[i][1] + 1e-6 < after:
            continue
        if [x for x, _ in toks[i : i + len(p)]] == p:
            return toks[i][1]
    return None


def _host(url: str) -> str:
    u = url if "://" in url else "https://" + url
    h = urlparse(u).hostname or url
    path = urlparse(u).path.strip("/")
    return (h + ("/" + path if path else ""))[:60]


def build_plan(
    style: dict[str, Any],
    film: dict[str, Any],
    words: list[dict[str, Any]],
    duration: float,
    presenter: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The roundup's edit, fixed by its script: no planner call. Per item, from the moment its name
    is spoken: a header (#n, the name, the takeaway), its visuals one after another on the words the
    writer chose (page screenshots in a browser window, README pictures as cards, demo clips full
    frame), its number counting up on the spoken number; the hook and the closing line as big type;
    captions under everything.

    With an AI presenter (`presenter` = the source's subject from the keyframes): the presenter
    fills the frame for the hook and the closing line; for each item it shrinks to the corner
    bubble (pip) under the item's visuals, and a demo clip cuts away to full frame. The number goes
    into the header instead of a counter, and the captions sit above the bubble."""
    lay = PRESENTER_LAYOUT if presenter else VOICE_LAYOUT
    modes: list[dict[str, Any]] = [{"t": 0, "mode": "full"}]
    data = film.get("data") or {}
    script = data.get("roundup") or {}
    media = data.get("media") or {}
    items = [x for x in script.get("items") or [] if isinstance(x, dict)]
    els: list[dict[str, Any]] = []
    sfx: list[dict[str, Any]] = []
    last_clip_end = -10.0

    # each item's window: from its opening words to the next item's (or the outro)
    starts: list[float] = []
    for it in items:
        t = when(words, str(it.get("say") or ""), starts[-1] if starts else 0.0)
        if t is None:  # not found: a little after the previous one
            t = (starts[-1] + 6.0) if starts else 3.0
        starts.append(min(t, duration - 1.0))
    outro = script.get("outro") or {}
    t_out = when(words, str(outro.get("say") or ""), starts[-1] if starts else 0.0)
    end_last = t_out if t_out is not None else duration
    hook = script.get("hook") or {}
    first = starts[0] if starts else duration

    if hook.get("line") and first > 1.2:
        els.append(_poster("hook", 0.15, first - 0.1, 230, [hook["line"]], 112))
    if hook.get("line") and first > 1.2 and lay["montage"]:
        # a flash of every item's own page under the hook line: the whole list in the first seconds
        pages: list[str] = []
        for it in items:
            rank = int(it.get("rank") or len(pages) + 1)
            mine = [
                k for k, v in media.items() if v.get("item") == rank and v.get("kind") == "image"
            ]
            site = [k for k in mine if str(media[k].get("shows") or "").startswith("the project's")]
            if mine:
                pages.append((site or mine)[0])
        span = (first - 0.1) - 0.7
        if pages and span >= 0.6 * len(pages):
            step = span / len(pages)
            for k, mid in enumerate(pages):
                a = 0.7 + k * step
                els.append(_visual(f"hook{k + 1}", a, a + step, media[mid], "", top=620))
                if k:
                    sfx.append({"t": round(a, 3), "type": "tick", "gain": 0.45})
    for i, it in enumerate(items):
        t0 = starts[i]
        t1 = starts[i + 1] if i + 1 < len(items) else end_last
        if t1 - t0 < 1.0:
            continue
        rank = int(it.get("rank") or i + 1)
        if i:
            sfx.append(
                {"t": round(max(0.0, t0 - 0.12), 3), "type": "whoosh", "dur": 0.45, "gain": 0.5}
            )
        head = [
            {"text": f"#{rank}", "font": "kicker", "size": 44, "color": "gold"},
            {"text": str(it.get("name") or "")[:40] or f"#{rank}", "font": "anton", "size": 92},
        ]
        if it.get("line"):
            head.append(
                {"text": str(it["line"])[:60], "font": "kicker", "size": 36, "color": "goldd"}
            )
        st = it.get("stat")
        if not lay["counter"] and isinstance(st, dict) and len(head) < 4:
            head.append({"text": _spoken(st)[:60], "font": "kicker", "size": 36, "color": "gold"})
        if presenter:  # the item's visuals take the frame; the presenter goes to the bubble
            modes.append({"t": round(t0 + 0.2, 3), "mode": "pip"})
        els.append(
            {
                "id": f"head{rank}",
                "type": "posterText",
                "t0": round(t0, 3),
                "t1": round(t1 - 0.05, 3),
                "top": TOP_BAND,
                "left": 60,
                "w": 960,
                "align": "left",
                "anim": "rise",
                "lines": head,
            }
        )
        # its visuals, each until the next one (the first holds from the item's start)
        shots = [s for s in it.get("shots") or [] if str(s.get("media")) in media]
        if not shots:  # the page screenshot, if the writer chose nothing
            mine = [
                k for k, v in media.items() if v.get("item") == rank and v.get("kind") == "image"
            ]
            shots = [{"media": mine[0], "say": ""}] if mine else []
        times: list[float] = []
        for k, s in enumerate(shots):
            t = when(words, str(s.get("say") or ""), t0) if k else t0
            t = t0 if t is None else max(t, (times[-1] + 1.5) if times else t0)
            times.append(min(t, t1 - 0.6))
        # a clip plays at most 6 s with ≥ 1.5 s between two clips (the engine's cutaway rules); the
        # rest of its window shows the item's page, as does a clip that would come too soon
        page = next(
            (
                k
                for k, v in media.items()
                if v.get("item") == rank and str(v.get("shows") or "").startswith(PAGE_LABELS)
            ),
            None,
        )
        url = str(it.get("url") or "")
        for k, s in enumerate(shots):
            a, b = times[k], (times[k + 1] if k + 1 < len(shots) else t1)
            if b - a < 0.6:
                continue
            m = media[str(s["media"])]
            if m.get("kind") == "clip":
                a = max(a, 1.5)
                if a - last_clip_end < 1.5 or b - a < 1.2:
                    if page:
                        els.append(
                            _visual(f"v{rank}_{k + 1}", a, b, media[page], url, lay["media_y"])
                        )
                    continue
                cut = min(b, a + CLIP_MAX)
                els.append(_visual(f"v{rank}_{k + 1}", a, cut, m, url, lay["media_y"]))
                last_clip_end = cut
                if presenter:  # the clip cuts away to full frame, then back to the bubble
                    modes.append({"t": round(a, 3), "mode": "full"})
                    modes.append({"t": round(cut, 3), "mode": "pip"})
                if b - cut >= 0.6 and page:
                    els.append(
                        _visual(f"v{rank}_{k + 1}p", cut, b, media[page], url, lay["media_y"])
                    )
                continue
            els.append(_visual(f"v{rank}_{k + 1}", a, b, m, url, lay["media_y"]))
        if isinstance(st, dict) and lay["counter"]:
            ts = when(words, str(st.get("say") or ""), t0)
            if ts is not None and ts < t1 - 1.0:
                # as it is said: 89,058 stars counts up to "89" over "THOUSAND GITHUB STARS"
                value, label = float(st["value"]), str(st.get("label") or "")[:30] or "stars"
                if value >= 10_000:
                    value, label = round(value / 1000), f"thousand {label}"[:40]
                els.append(
                    {
                        "id": f"stat{rank}",
                        "type": "counter",
                        "t0": round(ts, 3),
                        "t1": round(min(t1 - 0.05, ts + 2.6), 3),
                        "from": 0,
                        "to": value,
                        "label": label,
                        "top": STAT_TOP,
                        "size": 150,
                        "duration": 1.2,
                        "color": "gold",
                    }
                )
                sfx.append({"t": round(ts + 1.2, 3), "type": "pop", "gain": 0.55})
    if presenter and t_out is not None:
        modes.append({"t": round(t_out, 3), "mode": "full"})
    if outro.get("line") and t_out is not None and duration - t_out > 1.0:
        els.append(_poster("outro", t_out, duration - 0.05, lay["outro_top"], [outro["line"]], 104))
        # the recap: every name, so the last frame is worth a screenshot
        names = [str(it.get("name") or "") for it in items if it.get("name")]
        if names and duration - t_out > 2.2:
            half = (len(names) + 1) // 2
            rows = [" · ".join(names[:half]), " · ".join(names[half:])]
            els.append(
                {
                    "id": "recap",
                    "type": "posterText",
                    "t0": round(t_out + 0.8, 3),
                    "t1": round(duration - 0.05, 3),
                    "top": lay["recap_top"],
                    "left": 60,
                    "w": 960,
                    "align": "center",
                    "anim": "rise",
                    "lines": [
                        {"text": "TODAY'S LIST", "font": "kicker", "size": 40, "color": "gold"},
                        *[{"text": r[:80], "font": "anton", "size": 54} for r in rows if r],
                    ],
                }
            )

    return {
        "version": 1,
        "meta": {
            "durationSec": round(duration, 2),
            "fps": 30,
            "width": W,
            "height": H,
            "language": "en",
            "faceless": not presenter,
        },
        "style": style,
        "subject": presenter
        or {
            "faceBox": {"x": 0, "y": 0, "w": 1, "h": 1},
            "freeZone": {"x": 0, "y": 150, "w": W, "h": 1400},
        },
        "videoModes": _tidy_modes(modes),
        "captions": {"enabled": True, "y": lay["caption_y"], "gold": [], "accent": []},
        "sfx": {"auto": False, "intensity": 0.7, "extra": sfx},
        "elements": els,
    }


VOICE_LAYOUT: dict[str, Any] = {
    "media_y": MEDIA_Y,
    "caption_y": CAPTION_Y,
    "counter": True,
    "montage": True,
    "outro_top": 420,
    "recap_top": 900,
}
# the presenter's bubble (pip) covers x 674–1041, y 1193–1846: visuals above it, captions between
PRESENTER_LAYOUT: dict[str, Any] = {
    "media_y": 360,
    "caption_y": 1110,
    "counter": False,
    "montage": False,
    "outro_top": 230,
    "recap_top": 1380,
}


def _spoken(st: dict[str, Any]) -> str:
    """A stat as it is said: 89,058 GitHub stars → "89K GITHUB STARS"."""
    v = float(st.get("value") or 0)
    label = str(st.get("label") or "")
    num = f"{round(v / 1000)}K" if v >= 10_000 else f"{v:,.0f}"
    return f"{num} {label}".strip()


def _tidy_modes(modes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """In time order, one per moment, without repeats of the mode already on."""
    out: list[dict[str, Any]] = []
    for m in sorted(modes, key=lambda x: float(x["t"])):
        if out and abs(float(out[-1]["t"]) - float(m["t"])) < 0.05:
            out[-1] = m
        elif not out or out[-1]["mode"] != m["mode"]:
            out.append(m)
    return out


def _poster(
    eid: str, t0: float, t1: float, top: float, lines: list[str], size: int
) -> dict[str, Any]:
    return {
        "id": eid,
        "type": "posterText",
        "t0": round(t0, 3),
        "t1": round(t1, 3),
        "top": top,
        "left": 60,
        "w": 960,
        "align": "center",
        "anim": "rise",
        "lines": [{"text": x[:60], "font": "anton", "size": size} for x in lines],
    }


def _visual(
    eid: str, t0: float, t1: float, m: dict[str, Any], url: str, top: float = MEDIA_Y
) -> dict[str, Any]:
    """A page screenshot in a browser window sized to the screenshot, a README picture as a card,
    a clip full frame."""
    base = {"id": eid, "t0": round(t0, 3), "t1": round(t1, 3)}
    page = _host(str(m.get("page") or url))
    if m.get("kind") == "clip":
        return {
            **base,
            "type": "broll",
            "query": "demo clip from the project",
            "label": page[:40],
            "source": {
                "provider": "asset",
                "assetId": str(m["asset"]),
                "url": str(m.get("url") or url),
                "author": page,
                "duration": float(m.get("sec") or 0) or None,
            },
        }
    label = str(m.get("shows") or "")
    if label.startswith(PAGE_LABELS):
        mw, mh = float(m.get("w") or 1440), float(m.get("h") or 900)
        return {
            **base,
            "type": "browserCard",
            "imageId": str(m["asset"]),
            "url": _host(str(m.get("url") or url))[:80],
            "x": 40,
            "y": top,
            "w": 1000,
            "h": round(min(MEDIA_H, 1000 * mh / mw + BAR_H)),
            "scroll": 0.25 if label.startswith("the README") else 0.0,
            "tilt": 0,
        }
    w, h = float(m.get("w") or 16), float(m.get("h") or 9)
    cw = 960.0
    ch = max(200.0, min(float(MEDIA_H), cw * h / w))
    if ch == MEDIA_H:
        cw = max(300.0, MEDIA_H * w / h)
    return {
        **base,
        "type": "imageCard",
        "imageId": str(m["asset"]),
        "label": "",
        "x": round((W - cw) / 2),
        "y": round(top + (MEDIA_H - ch) / 2),
        "w": round(cw),
        "h": round(ch),
        "tilt": 0,
        "objectPosition": "50% 50%",
    }


# ───────────────────────────── the designed looks ─────────────────────────────

#: the looks a roundup can wear (engine/src/roundup.ts LOOKS); colours mirror the engine's so the
#: captions match the scenes
LOOKS: dict[str, dict[str, str]] = {
    "signal": {
        "bg": "#06070b",
        "ink": "#f3f5f9",
        "accent": "#7cf5c4",
        "muted": "#7f8896",
        "display": "Space Grotesk",
        "ui": "JetBrains Mono",
    },
    "frontpage": {
        "bg": "#f2ede3",
        "ink": "#141311",
        "accent": "#cf2a1f",
        "muted": "#6b645a",
        "display": "Playfair Display Roman",
        "ui": "IBM Plex Mono",
    },
    "loud": {
        "bg": "#ffd60a",
        "ink": "#0d0d0d",
        "accent": "#ffffff",
        "muted": "#1d1d1d",
        "display": "Archivo Black",
        "ui": "Space Grotesk",
    },
    "keynote": {
        "bg": "#09080d",
        "ink": "#ffffff",
        "accent": "#ffb36b",
        "muted": "#a7a3b2",
        "display": "Inter",
        "ui": "Inter",
    },
    "terminal": {
        "bg": "#040704",
        "ink": "#c9ffcf",
        "accent": "#3dff6e",
        "muted": "#5c8a62",
        "display": "IBM Plex Mono",
        "ui": "IBM Plex Mono",
    },
}
DEFAULT_LOOK = "signal"
SCENE_CAPTION_Y = 1640
OVERLAP = 0.7  # seconds a scene stays under the next one's entrance


def look_style(
    base: dict[str, Any],
    look: str,
    colors: dict[str, str] | None = None,
    fonts: dict[str, str] | None = None,
) -> dict[str, Any]:
    """The plan's style tokens in the look's colours and type, so the captions belong to the scenes."""
    lk = {**LOOKS.get(look, LOOKS[DEFAULT_LOOK]), **(colors or {}), **(fonts or {})}
    style: dict[str, Any] = json.loads(json.dumps(base))
    pal = dict(style.get("palette") or {})
    light = _luma(lk["bg"]) > 0.55
    pal.update(
        {
            "stage": lk["bg"],
            "iv": lk["ink"] if not light else "#ffffff",
            "ink": lk["ink"] if light else "#050505",
            "gold": lk["accent"] if look != "loud" else "#0d0d0d",
            "ter": lk["accent"] if look != "loud" else "#0d0d0d",
            "goldd": lk["muted"],
            "mar": lk["bg"],
        }
    )
    style["palette"] = pal
    fs = dict(style.get("fonts") or {})
    fs.update({"poster": lk["display"], "ui": lk["ui"], "caption": lk["display"]})
    style["fonts"] = fs
    return style


def _luma(hex_: str) -> float:
    h = hex_.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def build_scenes(
    style: dict[str, Any],
    film: dict[str, Any],
    words: list[dict[str, Any]],
    duration: float,
    look: str = DEFAULT_LOOK,
    colors: dict[str, str] | None = None,
    fonts: dict[str, str] | None = None,
) -> dict[str, Any]:
    """The roundup as designed scenes (engine `roundupScene`): an intro where the hook lands over
    every item's page, one scene per item from the moment its name is spoken (its pages on a
    moving camera, its number counting up on the spoken number), a full-frame cutaway for a demo
    clip after which the scene resumes, and the recap. Captions run under it all."""
    look = look if look in LOOKS else DEFAULT_LOOK
    data = film.get("data") or {}
    script = data.get("roundup") or {}
    media = data.get("media") or {}
    items = [x for x in script.get("items") or [] if isinstance(x, dict)]
    total = max(1, len(items))
    extra: dict[str, Any] = {"look": look}
    if colors:
        extra["colors"] = colors
    if fonts:
        extra["fonts"] = fonts
    els: list[dict[str, Any]] = []
    sfx: list[dict[str, Any]] = []

    starts: list[float] = []
    for it in items:
        t = when(words, str(it.get("say") or ""), starts[-1] if starts else 0.0)
        if t is None:
            t = (starts[-1] + 6.0) if starts else 3.0
        starts.append(min(t, duration - 1.0))
    outro = script.get("outro") or {}
    t_out = when(words, str(outro.get("say") or ""), starts[-1] if starts else 0.0)
    end_last = (
        t_out if t_out is not None and t_out > (starts[-1] if starts else 0) + 1 else duration
    )

    def first_page(rank: int) -> str | None:
        mine = [k for k, v in media.items() if v.get("item") == rank and v.get("kind") == "image"]
        site = [k for k in mine if str(media[k].get("shows") or "").startswith("the project's")]
        pick = (site or mine or [None])[0]
        return str(media[pick]["asset"]) if pick else None

    names = [str(it.get("name") or "")[:40] for it in items]
    thumbs = [
        x for x in (first_page(int(it.get("rank") or i + 1)) for i, it in enumerate(items)) if x
    ]
    hook = script.get("hook") or {}
    first = starts[0] if starts else duration
    if first > 0.8:
        els.append(
            {
                "id": "intro",
                "type": "roundupScene",
                "phase": "intro",
                "t0": 0.0,
                "t1": round(first, 3),
                "total": total,
                "hook": str(hook.get("line") or "")[:90],
                "names": names,
                "thumbs": thumbs[:12],
                **extra,
            }
        )
        for k in range(len(thumbs)):
            sfx.append(
                {
                    "t": round(0.6 + k * max(0.5, first - 0.9) / max(1, len(thumbs)), 3),
                    "type": "tick",
                    "gain": 0.4,
                }
            )

    last_clip_end = -10.0
    for i, it in enumerate(items):
        t0 = starts[i]
        t1 = starts[i + 1] if i + 1 < len(items) else end_last
        if t1 - t0 < 1.0:
            continue
        rank = int(it.get("rank") or i + 1)
        sfx.append({"t": round(max(0.0, t0 - 0.1), 3), "type": "whoosh", "dur": 0.45, "gain": 0.55})
        # the item's pictures in order; its first clip becomes a cutaway
        shots: list[dict[str, Any]] = []
        clip: tuple[float, float, dict[str, Any]] | None = None
        for s in it.get("shots") or []:
            m = media.get(str(s.get("media")))
            if not m:
                continue
            at = when(words, str(s.get("say") or ""), t0)
            at = t0 if at is None or not shots else max(at, t0)
            if m.get("kind") == "clip":
                a = max(at, t0 + 2.2, 1.5)  # the scene lands first
                b = min(t1 - 0.8, a + CLIP_MAX)
                if clip is None and b - a >= 1.5 and a - last_clip_end >= 1.5:
                    clip = (a, b, m)
                continue
            label = str(m.get("shows") or "")
            shots.append(
                {
                    "imageId": str(m["asset"]),
                    "at": round(max(0.0, (at if shots else t0) - t0), 3),
                    "kind": "page" if label.startswith(PAGE_LABELS) else "picture",
                }
            )
        if not shots:
            p = first_page(rank)
            if p:
                shots = [{"imageId": p, "at": 0.0, "kind": "page"}]
        # each shot holds at least 1.6 s
        for k in range(1, len(shots)):
            shots[k]["at"] = max(shots[k]["at"], shots[k - 1]["at"] + 1.6)
        scene: dict[str, Any] = {
            "type": "roundupScene",
            "phase": "item",
            "rank": rank,
            "total": total,
            "name": str(it.get("name") or "")[:40],
            "line": str(it.get("line") or "")[:80],
            "url": _host(str(it.get("url") or ""))[:80],
            "shots": shots[:6],
            **extra,
        }
        st = it.get("stat")
        if isinstance(st, dict):
            ts = when(words, str(st.get("say") or ""), t0)
            if ts is not None and ts < t1 - 1.0:
                value, label = float(st["value"]), str(st.get("label") or "")[:30] or "stars"
                if value >= 10_000:
                    value, label = round(value / 1000), f"thousand {label}"[:40]
                scene["stat"] = {"value": value, "label": label, "at": round(ts - t0, 3)}
                sfx.append({"t": round(ts + 0.3, 3), "type": "pop", "gain": 0.5})
        if clip:
            a, b, m = clip
            els.append(
                {**scene, "id": f"item{rank}", "t0": round(t0, 3), "t1": round(a, 3), "offset": 0}
            )
            page = _host(str(m.get("page") or it.get("url") or ""))
            els.append(
                {
                    "id": f"clip{rank}",
                    "type": "broll",
                    "t0": round(a, 3),
                    "t1": round(b, 3),
                    "query": "demo clip from the project",
                    "label": page[:40],
                    "source": {
                        "provider": "asset",
                        "assetId": str(m["asset"]),
                        "url": str(m.get("url") or ""),
                        "author": page[:60],
                        "duration": float(m.get("sec") or 0) or None,
                    },
                }
            )
            last_clip_end = b
            if t1 - b >= 0.6:
                els.append(
                    {
                        **scene,
                        "id": f"item{rank}b",
                        "t0": round(b, 3),
                        "t1": round(t1, 3),
                        "offset": round(b - t0, 3),
                    }
                )
        else:
            els.append(
                {**scene, "id": f"item{rank}", "t0": round(t0, 3), "t1": round(t1, 3), "offset": 0}
            )
        # the scene holds under the next one while it arrives (no gap to black between scenes)
        if els[-1].get("type") == "roundupScene":
            els[-1]["t1"] = round(min(duration, float(els[-1]["t1"]) + OVERLAP), 3)

    if t_out is not None and duration - t_out > 1.0:
        els.append(
            {
                "id": "outro",
                "type": "roundupScene",
                "phase": "outro",
                "t0": round(t_out, 3),
                "t1": round(duration, 3),
                "total": total,
                "hook": str(outro.get("line") or "")[:90],
                "names": names,
                "thumbs": thumbs[:12],
                **extra,
            }
        )
    return {
        "version": 1,
        "meta": {
            "durationSec": round(duration, 2),
            "fps": 30,
            "width": W,
            "height": H,
            "language": "en",
            "faceless": True,
        },
        "style": look_style(style, look, colors, fonts),
        "subject": {
            "faceBox": {"x": 0, "y": 0, "w": 1, "h": 1},
            "freeZone": {"x": 0, "y": 150, "w": W, "h": 1400},
        },
        "videoModes": [{"t": 0, "mode": "full"}],
        "captions": {"enabled": True, "y": SCENE_CAPTION_Y, "gold": [], "accent": []},
        "sfx": {"auto": False, "intensity": 0.7, "extra": sfx},
        "elements": els,
    }


# ───────────────────────────── matching a reference reel ─────────────────────────────

MATCH_SYSTEM = """You are the art director of Rasika's roundup reels. The user uploaded a reel whose style they
want their roundup to have. You get measurements of it (cut pace, brightness, colourfulness, its dominant
colours) and eight stills. Choose the closest of our five layouts and dress it in the reference's colours and
type. Return ONE JSON object, nothing else:

{"look": "signal|frontpage|loud|keynote|terminal",
 "colors": {"bg": "#rrggbb", "ink": "#rrggbb", "accent": "#rrggbb", "muted": "#rrggbb"},
 "fonts": {"display": "one of the allowed fonts", "ui": "one of the allowed fonts"},
 "why": "one sentence: what in the reference led to this"}

The layouts:
- signal: dark tech; glowing 3D screenshot cards, outlined mono rank numerals, a moving grid.
- frontpage: editorial print; paper, serif headlines, taped clippings, a marker underline.
- loud: bold pop; a solid colour block per item, giant numerals, stickers, hard shadows, bouncy.
- keynote: polished keynote; drifting colour light, glass panels, big rounded screens, soft motion.
- terminal: hacker; scanlines, typed monospace commands, a green preview turning to colour.

Rules: colours come from the reference's own dominant colours (bg is its main background, ink reads on bg at
4.5:1 or more, accent is its most striking highlight, muted is a quieter tone of ink). Fonts must be in the
allowed list; pick the closest in feel (condensed, serif, mono, geometric…). Fast cutting and saturated colour
lean to loud; dark and techy to signal or terminal; light and print-like to frontpage; soft gradients and big
clean type to keynote. Never copy the reference's footage or words: only its look."""

HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def match_reference(
    client: Any, model: str, report: Any, fonts_allowed: list[str]
) -> dict[str, Any]:
    """The closest look in the reference reel's colours and type (validated; falls back to the look's
    own colours and fonts for anything that does not hold)."""
    from rasika_worker.planner import _b64_image

    measured = {
        k: v for k, v in report.as_dict().items() if k not in ("stills", "cuts", "shot_lengths")
    }
    user: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": "## Measured\n\n"
            + json.dumps(measured)
            + "\n\n## Allowed fonts\n\n"
            + ", ".join(fonts_allowed),
        },
        {"type": "text", "text": "## Stills"},
    ]
    for p in list(report.stills)[:8]:
        user.append(_b64_image(Path(p)))
    resp = client.messages.create(
        model=model,
        max_tokens=800,
        system=MATCH_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    out = parse_json("".join(getattr(b, "text", "") for b in resp.content))
    look = str(out.get("look") or "")
    look = look if look in LOOKS else DEFAULT_LOOK
    base = LOOKS[look]
    colors = {
        k: str((out.get("colors") or {}).get(k) or base[k])
        for k in ("bg", "ink", "accent", "muted")
    }
    colors = {k: (v if HEX_RE.match(v) else base[k]) for k, v in colors.items()}
    if _contrast(colors["bg"], colors["ink"]) < 4.5:  # unreadable: keep the look's own pair
        colors["bg"], colors["ink"] = base["bg"], base["ink"]
    fonts = {k: str((out.get("fonts") or {}).get(k) or base[k]) for k in ("display", "ui")}
    fonts = {k: (v if v in fonts_allowed else base[k]) for k, v in fonts.items()}
    return {"look": look, "colors": colors, "fonts": fonts, "why": str(out.get("why") or "")[:200]}


def _contrast(a: str, b: str) -> float:
    def lum(h: str) -> float:
        h = h.lstrip("#")
        out = []
        for i in (0, 2, 4):
            c = int(h[i : i + 2], 16) / 255
            out.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]

    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
