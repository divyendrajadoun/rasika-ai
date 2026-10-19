"""Narration for script-only reels: text → voice.wav.

Deepgram Aura-2 (`POST /v1/speak`) on the same key the transcriber uses. Requests are capped at
2 000 characters, so the script is split on sentence ends; every chunk is requested as raw 24 kHz
linear16 PCM and the chunks are joined with a short pause (longer at paragraph breaks) before a WAV
header is written. English voices only — Aura has no Hindi model (see docs/costs.md).
"""

from __future__ import annotations

import json
import re
import struct
import urllib.error
import urllib.parse
import urllib.request
import wave
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

SAMPLE_RATE = 24000
MAX_CHARS = 1900  # Deepgram's limit is 2 000; leave room for the trailing punctuation we add
PAUSE_SENTENCE_SEC = 0.0  # the model already breathes between sentences in one request
PAUSE_PARAGRAPH_SEC = 0.45

#: voice id → (display name, accent, tone); the wizard shows this list
VOICES: dict[str, tuple[str, str, str]] = {
    "aura-2-thalia-en": ("Thalia", "American", "clear, confident, energetic"),
    "aura-2-asteria-en": ("Asteria", "American", "clear, knowledgeable"),
    "aura-2-luna-en": ("Luna", "American", "young, friendly, natural"),
    "aura-2-athena-en": ("Athena", "American", "mature, calm, professional"),
    "aura-2-orion-en": ("Orion", "American", "approachable, calm"),
    "aura-2-zeus-en": ("Zeus", "American", "deep, trustworthy"),
    "aura-2-apollo-en": ("Apollo", "American", "confident, casual"),
    "aura-2-pandora-en": ("Pandora", "British", "smooth, calm, melodic"),
    "aura-2-draco-en": ("Draco", "British", "warm, approachable"),
    "aura-2-theia-en": ("Theia", "Australian", "expressive, sincere"),
    "aura-2-hyperion-en": ("Hyperion", "Australian", "caring, warm"),
    "aura-2-amalthea-en": ("Amalthea", "Filipino", "young, engaging, cheerful"),
}
DEFAULT_VOICE = "aura-2-thalia-en"


def split_script(text: str, max_chars: int = MAX_CHARS) -> list[list[str]]:
    """Paragraphs → sentence chunks of ≤ max_chars each. Returns [[chunk, …] per paragraph]."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\r\n\s*\r\n", text) if p.strip()]
    out: list[list[str]] = []
    for para in paragraphs:
        flat = re.sub(r"\s+", " ", para)
        sentences = re.split(r"(?<=[.!?।])\s+", flat)
        chunks: list[str] = []
        cur = ""
        for s in sentences:
            while len(s) > max_chars:  # a monster sentence: hard-split on a space
                cut = s.rfind(" ", 0, max_chars)
                cut = cut if cut > 0 else max_chars
                if cur:
                    chunks.append(cur)
                    cur = ""
                chunks.append(s[:cut].strip())
                s = s[cut:].strip()
            if len(cur) + len(s) + 1 > max_chars and cur:
                chunks.append(cur)
                cur = s
            else:
                cur = f"{cur} {s}".strip()
        if cur:
            chunks.append(cur)
        if chunks:
            out.append(chunks)
    return out


def write_wav(dest: Path, pcm: bytes, sample_rate: int = SAMPLE_RATE) -> None:
    with wave.open(str(dest), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)


def silence(seconds: float, sample_rate: int = SAMPLE_RATE) -> bytes:
    return struct.pack("<h", 0) * int(seconds * sample_rate)


Synth = Callable[[str], bytes]


@dataclass
class DeepgramTTS:
    api_key: str
    model: str = DEFAULT_VOICE
    timeout: float = 60.0
    endpoint: str = "https://api.deepgram.com/v1/speak"

    def synth_chunk(self, text: str) -> bytes:
        """One request → raw 24 kHz mono linear16 PCM."""
        params = {
            "model": self.model,
            "encoding": "linear16",
            "sample_rate": str(SAMPLE_RATE),
            "container": "none",
        }
        req = urllib.request.Request(
            self.endpoint + "?" + urllib.parse.urlencode(params),
            data=json.dumps({"text": text}).encode("utf-8"),
            headers={"Authorization": f"Token {self.api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310 — fixed https host
                return bytes(resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"Deepgram TTS {exc.code}: {body}") from exc

    def speak(self, script: str, dest: Path) -> float:
        """Narrate the whole script into `dest` (wav); returns the duration in seconds."""
        return narrate(script, dest, self.synth_chunk)


def narrate(script: str, dest: Path, synth: Synth) -> float:
    paragraphs = split_script(script)
    if not paragraphs:
        raise ValueError("The script is empty.")
    parts: list[bytes] = []
    for i, chunks in enumerate(paragraphs):
        if i:
            parts.append(silence(PAUSE_PARAGRAPH_SEC))
        for j, chunk in enumerate(chunks):
            if j and PAUSE_SENTENCE_SEC:
                parts.append(silence(PAUSE_SENTENCE_SEC))
            pcm = synth(chunk)
            if len(pcm) % 2:  # odd byte count would misalign every following sample
                pcm = pcm[:-1]
            parts.append(pcm)
    parts.append(silence(0.6))  # room for the end card
    pcm_all = b"".join(parts)
    write_wav(dest, pcm_all)
    return len(pcm_all) / 2 / SAMPLE_RATE


def estimate_seconds(script: str, words_per_minute: float = 150.0) -> float:
    """Rough spoken length for the wizard's credit estimate (the real one comes from the wav)."""
    words = len(re.findall(r"\S+", script))
    paragraphs = len(split_script(script))
    return words / words_per_minute * 60 + max(0, paragraphs - 1) * PAUSE_PARAGRAPH_SEC + 0.6
