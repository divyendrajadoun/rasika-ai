"""sfx.py is used as-is from the reference pipeline; this pins its behaviour."""

import numpy as np

from rasika_worker import sfx


def test_build_is_deterministic_and_bounded() -> None:
    spec = {
        "duration": 3,
        "bpm": 0,
        "cues": [
            {"t": 0.5, "type": "whoosh", "dur": 0.45, "gain": 0.8},
            {"t": 1.0, "type": "pop"},
            {"t": 1.2, "type": "tick", "repeat": 4, "every": 0.12},
            {"t": 2.0, "type": "riser", "dur": 0.8},
            {"t": 2.8, "type": "impact"},
            {"t": 2.8, "type": "sub"},
        ],
    }
    a = sfx.build(spec)
    b = sfx.build(spec)
    assert a.shape == (sfx.SR * 3,)
    assert np.array_equal(a, b)
    assert np.max(np.abs(a)) <= 0.9
    assert np.max(np.abs(a)) > 0.1


def _fake_library(tmp_path, monkeypatch) -> None:
    """Three takes each of whoosh and pop, as tiny real-sound WAVs, in place of sfx_lib/."""
    import json
    import wave

    lib = {}
    for role, dur in (("whoosh", 0.5), ("pop", 0.1)):
        for k in range(3):
            n = int(sfx.SR * dur)
            t = np.arange(n) / sfx.SR
            x = np.sin(2 * np.pi * (300 + 100 * k) * t) * np.sin(np.pi * t / dur) * 0.08
            name = f"{role}_{k}.wav"
            with wave.open(str(tmp_path / name), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(sfx.SR)
                w.writeframes((x * 32767).astype(np.int16).tobytes())
            lib.setdefault(role, []).append({"file": name, "dur": dur, "peak_t": dur / 2})
    (tmp_path / "manifest.json").write_text(json.dumps(lib))
    monkeypatch.setattr(sfx, "LIB", tmp_path)
    sfx.library.cache_clear()
    sfx._take.cache_clear()


def test_real_takes_vary_thin_out_and_keep_their_level(tmp_path, monkeypatch) -> None:
    _fake_library(tmp_path, monkeypatch)
    picker = sfx._Picker(np.random.default_rng(1))
    files = [picker("whoosh")["file"] for _ in range(20)]
    assert all(
        a != b for a, b in zip(files, files[1:], strict=False)
    )  # never the same take twice running
    assert len(set(files)) == 3

    crowded = {
        "duration": 4,
        "kit": "toon",
        "cues": [{"t": 1.0 + i * 0.05, "type": "pop"} for i in range(10)],
    }
    one = {"duration": 4, "kit": "toon", "cues": [{"t": 1.0, "type": "pop"}]}
    a, b = sfx.build(crowded), sfx.build(one)
    # ten pops within half a second play as one, not ten stacked
    assert np.max(np.abs(a)) < 1.5 * np.max(np.abs(b))
    # and a quiet take stays quiet: no normalising to full scale
    assert np.max(np.abs(b)) < 0.3
    sfx.library.cache_clear()
    sfx._take.cache_clear()


def test_effects_drop_under_the_voice(tmp_path, monkeypatch) -> None:
    import wave

    _fake_library(tmp_path, monkeypatch)
    n = sfx.SR * 4
    voice = np.zeros(n)
    voice[: sfx.SR * 2] = np.sin(2 * np.pi * 200 * np.arange(sfx.SR * 2) / sfx.SR) * 0.3
    vp = tmp_path / "voice.wav"
    with wave.open(str(vp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sfx.SR)
        w.writeframes((voice * 32767).astype(np.int16).tobytes())
    spec = {"duration": 4, "kit": "toon", "voice": str(vp), "seed": 3}
    talking = sfx.build({**spec, "cues": [{"t": 1.0, "type": "whoosh", "dur": 0.5}]})
    quiet = sfx.build({**spec, "cues": [{"t": 3.0, "type": "whoosh", "dur": 0.5}]})
    # the same kind of sound is quieter while the voice speaks than in its pause
    assert np.max(np.abs(talking)) < np.max(np.abs(quiet))
    sfx.library.cache_clear()
    sfx._take.cache_clear()
