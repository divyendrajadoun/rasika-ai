"""AI images for a reel (Higgsfield): the key moments of what is said, drawn to order.

`pick_moments` asks Claude for up to N moments in the transcript that want a picture, each with the
exact word it lands on, a short label and an image prompt written from the script (never inventing
people's likenesses or brands). `Higgsfield.generate` draws one vertical image per prompt.
At most 6 AI images per reel (the product's limit; each image is paid for from the Higgsfield account).
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from rasika_worker.reference import parse_json

MAX_PER_REEL = 6
API = "https://api.higgsfield.ai"
MODEL_PATH = "higgsfield-ai/soul/v2/standard"


class Higgsfield:
    def __init__(self, key: str, secret: str) -> None:
        self.auth = f"Key {key}:{secret}"

    def _call(self, method: str, url: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode() if body is not None else None,
            method=method,
            headers={"Authorization": self.auth, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return dict(json.load(r))
        except urllib.error.HTTPError as e:
            raise RuntimeError(
                f"Higgsfield {e.code}: {e.read().decode(errors='replace')[:200]}"
            ) from e

    def generate(
        self, prompt: str, dest: Path, aspect: str = "9:16", timeout_s: float = 240
    ) -> Path:
        r = self._call(
            "POST", f"{API}/{MODEL_PATH}", {"prompt": prompt[:1500], "aspect_ratio": aspect}
        )
        url = str(r.get("status_url") or "")
        if not url:
            raise RuntimeError(f"Higgsfield did not queue the image: {str(r)[:200]}")
        t0 = time.time()
        while time.time() - t0 < timeout_s:
            time.sleep(3)
            s = self._call("GET", url)
            status = s.get("status")
            if status == "completed" and s.get("images"):
                img = str(s["images"][0]["url"])
                with urllib.request.urlopen(img, timeout=120) as resp:
                    dest.write_bytes(resp.read())
                return dest
            if status in ("failed", "error", "canceled", "nsfw"):
                raise RuntimeError(f"Higgsfield could not draw it ({status})")
        raise RuntimeError("Higgsfield took too long")


MOMENTS_SYSTEM = """You choose the moments of a short vertical video that want a picture, and write the image
prompt for each. You get the transcript (each word with its index), the video's style and any picture
style the user asked for. Return ONE JSON object:
{"moments": [{"word_index": 12, "say_when": "the exact word as spoken", "label": "≤ 4 words",
              "prompt": "a vivid, specific image prompt, vertical 9:16, matching the requested picture style"}]}
Rules: at most {n} moments, spread across the video, only where a picture helps (a thing, a place, a
result); never the first 1.5 s. No real people's likenesses, no logos or brand marks, no text in the
image. Write prompts from what is said; do not invent facts about the speaker's business.
"""


def pick_moments(
    client: Any,
    model: str,
    words: list[dict[str, Any]],
    n: int,
    picture_style: str,
    video_style: str,
) -> list[dict[str, Any]]:
    listing = " ".join(
        f"[{i}]{w.get('w')}" for i, w in enumerate(words) if float(w.get("t", 0)) >= 0
    )
    resp = client.messages.create(
        model=model,
        max_tokens=4000,
        system=MOMENTS_SYSTEM.replace("{n}", str(n)),
        messages=[
            {
                "role": "user",
                "content": f"## Transcript\n\n{listing}\n\n## Video style\n\n{video_style}\n\n"
                f"## Picture style the user wants\n\n{picture_style or 'photorealistic, natural light'}",
            }
        ],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    out: list[dict[str, Any]] = []
    for m in (parse_json(text).get("moments") or [])[:n]:
        try:
            i = int(m.get("word_index"))
        except (TypeError, ValueError):
            continue
        if not 0 <= i < len(words) or float(words[i]["t"]) < 1.5 or not m.get("prompt"):
            continue
        out.append(
            {
                "say_when": str(words[i]["w"]).strip(".,!?;:\"'"),
                "label": str(m.get("label") or "")[:40],
                "prompt": str(m["prompt"])[:1200],
            }
        )
    return out
