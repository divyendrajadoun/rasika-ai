"""Deepgram response parsing and the fallback chain (no network)."""

from __future__ import annotations

from pathlib import Path

from rasika_worker.transcribe import FallbackTranscriber, TranscriptResult, Word, parse_deepgram

SAMPLE = {
    "metadata": {"request_id": "x"},
    "results": {
        "channels": [
            {
                "detected_language": "hi",
                "language_confidence": 0.95,
                "alternatives": [
                    {
                        "confidence": 0.99,
                        "words": [
                            {
                                "word": "गुस्सा",
                                "punctuated_word": "गुस्सा",
                                "start": 3.68,
                                "end": 4.32,
                                "confidence": 0.99,
                            },
                            {
                                "word": "आना",
                                "punctuated_word": "आना",
                                "start": 4.32,
                                "end": 4.6,
                                "confidence": 0.98,
                            },
                            {
                                "word": "normal",
                                "punctuated_word": "normal",
                                "start": 4.6,
                                "end": 5.0,
                                "confidence": 0.97,
                            },
                            {
                                "word": "है",
                                "punctuated_word": "है,",
                                "start": 5.0,
                                "end": 5.2,
                                "confidence": 0.99,
                            },
                        ],
                    }
                ],
            }
        ]
    },
}


def test_parse_deepgram_keeps_hinglish_and_infers_hindi() -> None:
    r = parse_deepgram(SAMPLE)
    assert [w.w for w in r.words] == ["गुस्सा", "आना", "normal", "है,"]
    assert r.words[0].t == 3.68 and r.words[0].end == 4.32
    assert r.language == "hi" and r.engine == "deepgram"
    assert any("detected hi" in n for n in r.notes)
    # an explicit English hint wins over the script inference
    assert parse_deepgram(SAMPLE, "en").language == "en"
    assert parse_deepgram({"results": {"channels": []}}).words == []


class _Boom:
    name = "boom"

    def transcribe(self, *a: object, **k: object) -> TranscriptResult:
        raise RuntimeError("quota")


class _Ok:
    name = "ok"

    def transcribe(self, *a: object, **k: object) -> TranscriptResult:
        return TranscriptResult("en", 0.9, [Word("hi", 0.0, 0.2, 0.9)], "ok")


def test_fallback_chain_uses_secondary_and_records_why() -> None:
    r = FallbackTranscriber(_Boom(), _Ok()).transcribe(Path("x.wav"))
    assert r.engine == "ok" and r.words[0].w == "hi"
    assert any("fell back from boom" in n for n in r.notes)
