"""Transcript correction suggestions (SPEC §7.2) with the cheap model.

The model returns a same-length word list (safe fixes applied: casing, proper nouns, spellings,
punctuation) plus `suggestions` it is unsure about. We verify the shape (same count, each word
still recognisably the same token) and keep the original timings. Anything that fails the check
is dropped, so a bad model answer can never corrupt the transcript.
"""

from __future__ import annotations

import difflib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger("rasika.worker.transcript_fix")
PROMPT = Path(__file__).resolve().parents[1] / "prompts" / "transcript-fixes.md"
_STRIP = re.compile(r"[^\w]", re.UNICODE)


@dataclass
class FixResult:
    words: list[dict[str, Any]]
    changed: int
    suggestions: list[dict[str, Any]] = field(default_factory=list)
    applied: list[dict[str, Any]] = field(default_factory=list)
    rejected: int = 0
    usage: dict[str, int] = field(default_factory=dict)


def _same_token(a: str, b: str) -> bool:
    na, nb = _STRIP.sub("", a.lower()), _STRIP.sub("", b.lower())
    if not na or not nb:
        return False
    if na == nb:
        return True
    return difflib.SequenceMatcher(None, na, nb).ratio() >= 0.6 or (
        na.isdigit() != nb.isdigit() and len(nb) <= 12
    )


def merge_fixes(
    words: list[dict[str, Any]], fixed: list[str]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    """Apply `fixed` onto `words` where the token is recognisably the same; keep timings."""
    if len(fixed) != len(words):
        raise ValueError(f"word count mismatch: {len(fixed)} vs {len(words)}")
    out: list[dict[str, Any]] = []
    applied: list[dict[str, Any]] = []
    rejected = 0
    for i, (w, f) in enumerate(zip(words, fixed, strict=True)):
        new = dict(w)
        f = (f or "").strip()
        if f and f != w["w"]:
            if _same_token(w["w"], f):
                new["w"] = f
                applied.append({"index": i, "from": w["w"], "to": f})
            else:
                rejected += 1
        out.append(new)
    return out, applied, rejected


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start : end + 1])  # type: ignore[no-any-return]


def suggest_fixes(
    client: Any,
    model: str,
    words: list[dict[str, Any]],
    brand: str | None = None,
    labels: list[str] | None = None,
    industry: str | None = None,
    language: str = "en",
) -> FixResult:
    if not words:
        return FixResult([], 0)
    system = PROMPT.read_text(encoding="utf-8")
    ctx = [f"language: {language}"]
    if brand:
        ctx.append(f"brand: {brand}")
    if labels:
        ctx.append("photo labels: " + ", ".join(labels))
    if industry:
        ctx.append(f"industry: {industry}")
    body = "\n".join(ctx) + "\n\nwords:\n" + "\n".join(f"{i}|{w['w']}" for i, w in enumerate(words))
    resp = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": body}],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    usage = {"input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens}
    try:
        data = _parse_json(text)
        fixed = [str(x) for x in data.get("words", [])]
        merged, applied, rejected = merge_fixes(words, fixed)
        suggestions = [s for s in data.get("suggestions", []) if isinstance(s, dict)]
    except Exception as exc:
        log.warning("transcript_fix_unusable", error=str(exc))
        return FixResult(words, 0, usage=usage)
    log.info(
        "transcript_fixed",
        applied=len(applied),
        rejected=rejected,
        suggestions=len(suggestions),
        **usage,
    )
    return FixResult(merged, len(applied), suggestions, applied, rejected, usage)
