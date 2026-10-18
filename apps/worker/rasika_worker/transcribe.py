"""Transcription with word-level timestamps (SPEC §7.2).

`Transcriber` is the interface. `DeepgramTranscriber` (hosted, seconds per reel, Hinglish-aware)
is used when a key is set, with `FasterWhisperTranscriber` (local, GPU or CPU int8) as the automatic
fallback; both produce the same word list. Language is auto-detected and then
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
            root = str(self.s.whisper_cache_dir) if self.s.whisper_cache_dir else None
            try:
                self._model = WhisperModel(
                    self.s.whisper_model,
                    device=self.s.whisper_device,
                    compute_type=self.s.whisper_compute_type,
                    download_root=root,
                )
                if self.s.whisper_device == "cuda":
                    # a load can succeed and the first encode still fail without CUDA libs:
                    # probe with half a second of silence so we fall back before a real job
                    import numpy as np

                    list(self._model.transcribe(np.zeros(8000, dtype=np.float32), beam_size=1)[0])
            except Exception as exc:
                if self.s.whisper_device == "cpu":
                    raise
                log.warning("whisper_gpu_unavailable", error=str(exc)[:200], fallback="cpu/int8")
                self._model = WhisperModel(
                    self.s.whisper_model, device="cpu", compute_type="int8", download_root=root
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


class DeepgramTranscriber:
    """Hosted transcription with word timestamps (Deepgram Nova-3): seconds per reel, no model
    to load. `language=multi` keeps code-switched speech honest — Hindi in Devanagari, English words
    in Latin script — which is what Hinglish captions need."""

    name = "deepgram"
    URL = "https://api.deepgram.com/v1/listen"

    def __init__(self, settings: Settings) -> None:
        self.s = settings
        if not settings.deepgram_api_key:
            raise RuntimeError("DEEPGRAM_API_KEY is not set")

    def _params(self, language_hint: str) -> dict[str, str]:
        p = {"model": self.s.deepgram_model, "smart_format": "true", "punctuate": "true"}
        if language_hint == "en":
            p["language"] = "en"
        else:  # auto / hi / hinglish: multilingual keeps English words in Latin script
            p["language"] = "multi"
        return p

    def transcribe(
        self,
        audio16k: Path,
        language_hint: str = "auto",
        on_progress: Progress | None = None,
        vocabulary: list[str] | None = None,
    ) -> TranscriptResult:
        import json
        import urllib.error
        import urllib.parse
        import urllib.request

        report = on_progress or (lambda p, m: None)
        report(0.1, "Sending the audio to Deepgram…")
        params = self._params(language_hint)
        if vocabulary:
            # keyterm prompting: brand names and photo labels spelled the way the user wrote them
            params["keyterm"] = " ".join(v for v in vocabulary if v)[:200]
        url = self.URL + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(
            url,
            data=audio16k.read_bytes(),
            method="POST",
            headers={
                "Authorization": f"Token {self.s.deepgram_api_key}",
                "Content-Type": "audio/wav",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Deepgram {exc.code}: {exc.read().decode()[:200]}") from exc
        report(0.9, "Timing every word…")
        return parse_deepgram(data, language_hint)


def parse_deepgram(data: dict[str, Any], language_hint: str = "auto") -> TranscriptResult:
    """Deepgram JSON → words; the transcript language is inferred from the script actually used
    (≥ 40 % Devanagari letters → hi), which also covers Hinglish correctly."""
    ch = (data.get("results", {}).get("channels") or [{}])[0]
    alt = (ch.get("alternatives") or [{}])[0]
    words: list[Word] = []
    for w in alt.get("words", []) or []:
        txt = str(w.get("punctuated_word") or w.get("word") or "").strip()
        if not txt:
            continue
        words.append(
            Word(
                txt,
                round(float(w["start"]), 3),
                round(float(w["end"]), 3),
                round(float(w.get("confidence", 0.0)), 3),
            )
        )
    text = " ".join(w.w for w in words)
    ratio = script_ratio(text, "hi")
    if language_hint in ("en", "hi"):
        language = language_hint
    else:
        language = "hi" if ratio >= 0.4 else "en"
    conf = float(ch.get("language_confidence") or alt.get("confidence") or 0.0)
    notes = [f"deepgram {language}: devanagari share {ratio:.2f}"]
    if ch.get("detected_language"):
        notes.append(f"deepgram detected {ch['detected_language']}")
    return TranscriptResult(language, conf, words, "deepgram", notes)


class FallbackTranscriber:
    """Try the fast hosted engine first; on any error fall back to local faster-whisper so a
    network or quota problem never fails a job."""

    name = "deepgram+faster-whisper"

    def __init__(self, primary: Transcriber, secondary: Transcriber) -> None:
        self.primary = primary
        self.secondary = secondary

    def transcribe(
        self,
        audio16k: Path,
        language_hint: str = "auto",
        on_progress: Progress | None = None,
        vocabulary: list[str] | None = None,
    ) -> TranscriptResult:
        try:
            return self.primary.transcribe(audio16k, language_hint, on_progress, vocabulary)
        except Exception as exc:
            log.warning("transcriber_fallback", primary=self.primary.name, error=str(exc)[:200])
            res = self.secondary.transcribe(audio16k, language_hint, on_progress, vocabulary)
            res.notes.append(f"fell back from {self.primary.name}: {str(exc)[:120]}")
            return res


def make_transcriber(settings: Settings) -> Transcriber:
    mode = settings.transcriber
    if mode == "deepgram":
        return DeepgramTranscriber(settings)
    if mode == "auto" and settings.deepgram_api_key:
        return FallbackTranscriber(
            DeepgramTranscriber(settings), FasterWhisperTranscriber(settings)
        )
    return FasterWhisperTranscriber(settings)


def is_finite(x: float) -> bool:
    return not (math.isnan(x) or math.isinf(x))
