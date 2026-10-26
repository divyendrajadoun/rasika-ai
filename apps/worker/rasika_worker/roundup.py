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

WRITER_SYSTEM = """You write and direct vertical (1080×1920) news-style reels for Rasika from a pasted post that
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
