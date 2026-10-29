#!/usr/bin/env python3
"""
Fetch candidate sound effects from Openverse (https://openverse.org) for Rasika's real-sound library.

Only public-domain recordings (CC0 / Public Domain Mark): a reel made in Rasika can be posted anywhere with no
credit line. Each role has a few searches; every hit is downloaded once with its metadata (creator, landing page,
licence) next to it, for curate.py to slice, measure and pick from.

The anonymous API allows 20 requests a minute and 200 a day, so searches are paced and cached.

  python tools/sfx/fetch_openverse.py --out .work-e2e/sfx/cand [--roles whoosh,pop] [--per 30]
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.openverse.org/v1/audio/"
UA = {"User-Agent": "rasika-sfx-curation/1.0 (+https://rasika-ai.netlify.app)"}

#: role -> searches. Roles are what the cue lists ask for (sfx.py); the words are what people tag them with.
QUERIES: dict[str, list[str]] = {
    "whoosh": ["whoosh", "soft whoosh", "swoosh", "air whoosh"],
    "swish": ["swish", "fast swoosh", "swipe"],
    "pop": ["pop", "mouth pop", "bubble pop", "cork pop"],
    "click": ["mouse click", "button click", "click"],
    "tick": ["tick", "wood tick", "clock tick"],
    "tap": ["tap", "wood knock", "finger tap", "knock"],
    "thud": ["thud", "soft thud", "cardboard thud", "book drop"],
    "impact": ["impact", "cinematic hit", "boom"],
    "paper": ["paper", "page turn", "paper slide"],
    "scribble": ["marker writing", "pen scribble", "pencil writing", "chalk writing"],
    "chime": ["chime", "ding", "glockenspiel", "sparkle"],
    "riser": ["riser", "uplifter", "rising whoosh"],
    "sub": ["sub drop", "bass drop", "low boom"],
    "glitch": ["glitch", "digital glitch"],
    "key": ["keyboard typing", "key press", "typewriter key"],
    "shutter": ["camera shutter"],
    "stamp": ["rubber stamp", "stamp"],
    "popper": ["party popper", "confetti"],
}


def search(q: str, page_size: int) -> list[dict]:
    params = {
        "q": q,
        "license": "cc0,pdm",
        "length": "shortest",
        "page_size": str(page_size),
    }
    url = API + "?" + urllib.parse.urlencode(params)
    # an uncached search can take 40 s on the API's side
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=150) as r:
                return json.loads(r.read())["results"]
        except TimeoutError:
            if attempt == 2:
                raise
            time.sleep(10)
    return []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=".work-e2e/sfx/cand")
    ap.add_argument("--roles", default="")
    ap.add_argument(
        "--per",
        type=int,
        default=20,
        help="results per search (the anonymous API allows 20)",
    )
    ap.add_argument("--pause", type=float, default=3.5, help="seconds between requests")
    a = ap.parse_args()
    out = Path(a.out)
    roles = [r for r in a.roles.split(",") if r] or list(QUERIES)
    seen: set[str] = set()
    for role in roles:
        d = out / role
        d.mkdir(parents=True, exist_ok=True)
        for q in QUERIES[role]:
            cache = d / f"_search_{q.replace(' ', '_')}.json"
            if cache.exists() and json.loads(cache.read_text(encoding="utf-8")):
                hits = json.loads(cache.read_text(encoding="utf-8"))
            else:
                try:
                    hits = search(q, a.per)
                except Exception as e:  # noqa: BLE001 - a failed search is skipped, the rest go on
                    print(f"  search failed {role}/{q}: {e}")
                    continue
                cache.write_text(json.dumps(hits, indent=1), encoding="utf-8")
                time.sleep(a.pause)
            got = 0
            for h in hits:
                if h["id"] in seen or h.get("license") not in ("cc0", "pdm"):
                    continue
                if (h.get("duration") or 0) > 12000:  # ms: long recordings are beds, not effects
                    continue
                seen.add(h["id"])
                ext = (h.get("filetype") or "mp3").lower()
                f = d / f"{h['id']}.{ext}"
                if not f.exists():
                    try:
                        with urllib.request.urlopen(
                            urllib.request.Request(h["url"], headers=UA), timeout=40
                        ) as r:
                            f.write_bytes(r.read())
                    except Exception as e:  # noqa: BLE001
                        print(f"  download failed {h['url']}: {e}")
                        continue
                meta = {
                    k: h.get(k)
                    for k in (
                        "id",
                        "title",
                        "creator",
                        "creator_url",
                        "license",
                        "license_version",
                        "license_url",
                        "foreign_landing_url",
                        "source",
                        "duration",
                        "tags",
                    )
                }
                meta["query"] = q
                meta["file"] = f.name
                (d / f"{h['id']}.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
                got += 1
            print(f"{role:9s} {q!r}: {len(hits)} hits, {got} new")


if __name__ == "__main__":
    main()
