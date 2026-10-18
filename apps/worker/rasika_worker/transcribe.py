"""Transcription with word-level timestamps (SPEC §7.2).

`Transcriber` is the interface; `FasterWhisperTranscriber` is the default (local, CPU int8 or
GPU); `HostedTranscriber` is the adapter stub for a vendor API. Language is auto-detected and then
**verified** by decoding a short window in both `en` and `hi` — Whisper forced to the wrong language
emits low-confidence non-words, which the score below catches.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import structlog

from rasika_worker.settings import Settings

log = structlog.get_logger("rasika.worker.transcribe")

Progress = Callable[[float, str], None]
DEVANAGARI = ("ऀ", "ॿ")


@dataclass
class Word:
    w: str
    t: float
    end: float
    conf: float

    def as_dict(self) -> dict[str, Any]:
        return {"w": self.w, "t": self.t, "end": self.end, "conf": self.conf}


@dataclass
class TranscriptResult:
    language: str
    language_probability: float
    words: list[Word]
    engine: str
    notes: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return " ".join(w.w for w in self.words)


class Transcriber(Protocol):
    name: str

    def transcribe(
        self,
        audio16k: Path,
        language_hint: str = "auto",
        on_progress: Progress | None = None,
        vocabulary: list[str] | None = None,
    ) -> TranscriptResult: ...


# ── language verification ────────────────────────────────────────────────────


def script_ratio(text: str, lang: str) -> float:
    """Share of letters in the script we expect for `lang` (Devanagari for hi, ASCII for en)."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    if lang == "hi":
        hits = sum(1 for c in letters if DEVANAGARI[0] <= c <= DEVANAGARI[1])
    else:
        hits = sum(1 for c in letters if c.isascii())
    return hits / len(letters)


def language_score(lang: str, words: list[Word]) -> float:
    """0..1 — how much the decode looks like real speech in `lang`.

    mean word confidence × script consistency × token variety (garbage decodes repeat tokens or
    produce very long ones).
    """
    if not words:
        return 0.0
    conf = sum(w.conf for w in words) / len(words)
    text = " ".join(w.w for w in words)
    script = script_ratio(text, lang)
    toks = [w.w.lower() for w in words]
    variety = len(set(toks)) / len(toks)
    too_long = sum(1 for t in toks if len(t) > 18) / len(toks)
    return conf * (0.4 + 0.6 * script) * (0.5 + 0.5 * variety) * (1 - 0.8 * too_long)


def choose_language(
    detected: str, detected_p: float, scores: dict[str, float], hint: str
) -> tuple[str, str]:
    """Pick the language: explicit hints win; otherwise the better-scoring probe, unless the
    detector is confident and agrees with a decent probe."""
    if hint in ("en", "hi"):
        return hint, "hint"
    if hint == "hinglish":
        return "hi", "hinglish→hi (Devanagari on screen)"
    if not scores:
        return (detected if detected in ("en", "hi") else "en"), "detector"
    best = max(scores, key=lambda k: scores[k])
    if detected in scores and detected != best:
        # Keep the detector only when it is very sure and its decode is not clearly worse.
        if detected_p >= 0.9 and scores[detected] >= 0.8 * scores[best]:
            return detected, f"detector p={detected_p:.2f} kept over probe"
        return best, f"probe overruled detector ({detected} p={detected_p:.2f}): scores {scores}"
    if detected not in scores and scores[best] < 0.25:
        return (detected if detected in ("en", "hi") else "en"), "both probes weak; detector"
    return best, f"probe scores {scores}"


# ── faster-whisper ───────────────────────────────────────────────────────────


class FasterWhisperTranscriber:
    name = "faster-whisper"

    def __init__(self, settings: Settings) -> None:
        self.s = settings
        self._model: Any = None

    def model(self) -> Any:
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "faster-whisper is not installed: pip install -e '.[ml]'"
                ) from exc
            log.info(
                "whisper_load",
                model=self.s.whisper_model,
                device=self.s.whisper_device,
                compute=self.s.whisper_compute_type,
            )
            self._model = WhisperModel(
                self.s.whisper_model,
                device=self.s.whisper_device,
                compute_type=self.s.whisper_compute_type,
                download_root=str(self.s.whisper_cache_dir) if self.s.whisper_cache_dir else None,
            )
        return self._model

    @staticmethod
    def _words(segments: Any) -> list[Word]:
        out: list[Word] = []
        for seg in segments:
            for w in seg.words or []:
                txt = (w.word or "").strip()
                if not txt:
                    continue
                out.append(
                    Word(
                        txt,
                        round(float(w.start), 3),
                        round(float(w.end), 3),
                        round(float(w.probability), 3),
                    )
                )
        return out

    def transcribe(
        self,
        audio16k: Path,
        language_hint: str = "auto",
        on_progress: Progress | None = None,
        vocabulary: list[str] | None = None,
    ) -> TranscriptResult:
        from faster_whisper import decode_audio

        report = on_progress or (lambda p, m: None)
        model = self.model()
        audio = decode_audio(str(audio16k), sampling_rate=16000)
        duration = len(audio) / 16000
        notes: list[str] = []

        # 1. detect on the first 30 s
        report(0.05, "Listening for the language…")
        detected, detected_p = "en", 0.0
        if language_hint not in ("en", "hi", "hinglish"):
            _, info = model.transcribe(
                audio[: 16000 * 30], beam_size=1, vad_filter=True, without_timestamps=True
            )
            detected, detected_p = str(info.language), float(info.language_probability)
            notes.append(f"detected {detected} p={detected_p:.2f}")

        # 2. verify with a short decode in both en and hi (reference lesson: hi on English = garbage)
        scores: dict[str, float] = {}
        if language_hint not in ("en", "hi", "hinglish"):
            probe = audio[: 16000 * 12]
            for lg in ("en", "hi"):
                segs, _ = model.transcribe(
                    probe, language=lg, beam_size=1, word_timestamps=True, vad_filter=True
                )
                scores[lg] = round(language_score(lg, self._words(segs)), 3)
        language, why = choose_language(detected, detected_p, scores, language_hint)
        notes.append(f"chose {language}: {why}")
        log.info("language", language=language, why=why, detected=detected, p=detected_p)

        # 3. full pass with word timestamps + VAD
        report(0.15, "Timing every word…")
        prompt = ", ".join(vocabulary) if vocabulary else None
        segments, _info = model.transcribe(
            audio,
            language=language,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
            condition_on_previous_text=True,
            initial_prompt=prompt,
        )
        words: list[Word] = []
        for seg in segments:
            words.extend(self._words([seg]))
            if duration > 0:
                done_s, total_s = int(float(seg.end)), int(duration)
                report(
                    0.15 + 0.8 * min(1.0, float(seg.end) / duration),
                    f"Timing every word… {done_s // 60}:{done_s % 60:02d} of {total_s // 60}:{total_s % 60:02d}",
                )
        # monotonic, de-overlapped times
        for i in range(1, len(words)):
            if words[i].t < words[i - 1].t:
                words[i].t = words[i - 1].t
            if words[i - 1].end > words[i].t:
                words[i - 1].end = words[i].t
        report(1.0, "Transcript ready")
        return TranscriptResult(language, detected_p, words, self.name, notes)


class HostedTranscriber:
    """// MOCK: adapter stub for a hosted speech-to-text API with word timestamps + Hindi.

    The vendor is the user's choice (SPEC §7.2). Until it is configured this raises a clear
    error so a job fails loudly rather than returning fake words.
    """

    name = "hosted"

    def __init__(self, settings: Settings) -> None:
        self.s = settings

    def transcribe(
        self,
        audio16k: Path,
        language_hint: str = "auto",
        on_progress: Progress | None = None,
        vocabulary: list[str] | None = None,
    ) -> TranscriptResult:
        raise NotImplementedError(
            "TRANSCRIBER=hosted is an adapter stub; set TRANSCRIBER=faster-whisper or implement the vendor call"
        )


def make_transcriber(settings: Settings) -> Transcriber:
    if settings.transcriber == "hosted":
        return HostedTranscriber(settings)
    return FasterWhisperTranscriber(settings)


def is_finite(x: float) -> bool:
    return not (math.isnan(x) or math.isinf(x))
