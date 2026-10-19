"""Reference matching: cut parsing, shot statistics and the fidelity merge (no ffmpeg, no network)."""

from __future__ import annotations

from rasika_worker.reference import merge_by_fidelity, parse_cuts, parse_json, shot_stats

SHOWINFO = """
[Parsed_showinfo_1 @ 0x1] n:   0 pts:  36036 pts_time:1.2012  pos: 1 fmt:yuv420p
[Parsed_showinfo_1 @ 0x1] n:   1 pts:  39039 pts_time:1.3013  pos: 2 fmt:yuv420p
[Parsed_showinfo_1 @ 0x1] n:   2 pts: 120120 pts_time:4.004   pos: 3 fmt:yuv420p
[Parsed_showinfo_1 @ 0x1] n:   3 pts: 270270 pts_time:9.009   pos: 4 fmt:yuv420p
"""


def test_parse_cuts_merges_flicker_within_200ms() -> None:
    assert parse_cuts(SHOWINFO) == [1.2012, 4.004, 9.009]


def test_shot_stats() -> None:
    lengths, mean, med, cpm = shot_stats([2.0, 5.0, 9.0], 12.0)
    assert lengths == [2.0, 3.0, 4.0, 3.0]
    assert mean == 3.0 and med == 3.0
    assert cpm == 15.0


def test_shot_stats_without_cuts_is_one_shot() -> None:
    lengths, mean, _med, cpm = shot_stats([], 20.0)
    assert lengths == [20.0] and mean == 20.0 and cpm == 0.0


PRESET = {
    "id": "noir-minimal",
    "name": "Noir",
    "tagline": "t",
    "palette": {"stage": "#000000", "mar": "#eeeeee", "ter": "#ff0000", "gold": "#ffcc00", "goldd": "#aa8800", "iv": "#ffffff", "ink": "#000000"},
    "fonts": {"poster": "Anton", "accent": "Instrument Serif", "ui": "Inter", "devanagari": "Mukta", "caption": "Inter"},
    "grain": 0.1,
    "pace": 0.5,
    "captionStyle": "karaoke",
    "captionSize": 70,
    "endCardShape": "arch",
    "pattern": "none",
    "preferredElements": [],
    "motion": {"family": "editorial", "enter": "rise", "exit": "lift", "easing": "spring", "speed": 1, "camera": "glide", "sfxKit": "pop", "texture": "none", "direction": "", "avoidElements": []},
}
PROPOSED = {
    "name": "Ref look",
    "palette": {**PRESET["palette"], "ter": "#2b59ff"},
    "fonts": {"poster": "Space Grotesk", "devanagari": "Noto", "caption": "Comic Sans"},
    "captionStyle": "box",
    "motion": {"direction": "cut every 1.4 s", "enter": "slam", "camera": "cut", "texture": "grid", "family": "hype"},
}


def test_pace_only_changes_direction() -> None:
    out = merge_by_fidelity(PRESET, PROPOSED, "pace")
    assert out["motion"]["direction"] == "cut every 1.4 s"
    assert out["motion"]["enter"] == "rise" and out["palette"]["ter"] == "#ff0000"
    assert out["name"] == "Noir"


def test_camera_adds_motion_but_not_look() -> None:
    out = merge_by_fidelity(PRESET, PROPOSED, "camera")
    assert out["motion"]["enter"] == "slam" and out["motion"]["camera"] == "cut"
    assert out["motion"]["texture"] == "none" and out["palette"]["ter"] == "#ff0000"


def test_look_changes_everything_but_keeps_devanagari_and_known_fonts() -> None:
    out = merge_by_fidelity(PRESET, PROPOSED, "look")
    assert out["palette"]["ter"] == "#2b59ff" and out["captionStyle"] == "box"
    assert out["motion"]["texture"] == "grid" and out["motion"]["family"] == "hype"
    assert out["fonts"]["poster"] == "Space Grotesk"
    assert out["fonts"]["caption"] == "Inter"  # unknown font rejected
    assert out["fonts"]["devanagari"] == "Mukta"


def test_parse_json_strips_fences() -> None:
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_look_also_takes_pacing_end_card_and_elements() -> None:
    """A full match: the reference decides element choice and pacing too, not the template."""
    proposed = {
        **PROPOSED,
        "pace": 0.9,
        "endCardShape": "square",
        "preferredElements": ["posterText", "counter"],
        "motion": {**PROPOSED["motion"], "avoidElements": ["stamp"], "caseStyle": "upper"},
    }
    out = merge_by_fidelity(PRESET, proposed, "look")
    assert out["pace"] == 0.9 and out["endCardShape"] == "square"
    assert out["preferredElements"] == ["posterText", "counter"]
    assert out["motion"]["avoidElements"] == ["stamp"] and out["motion"]["caseStyle"] == "upper"
    # pace / camera fidelity never touch them
    kept = merge_by_fidelity(PRESET, proposed, "camera")
    assert kept.get("pace") == PRESET.get("pace") and kept.get("endCardShape") == PRESET.get("endCardShape")


def test_reference_base_preset_is_installed() -> None:
    from pathlib import Path

    from rasika_worker.pipeline import REFERENCE_BASE_PRESET

    root = Path(__file__).resolve().parents[3]
    assert (root / "packages" / "schema" / "presets" / f"{REFERENCE_BASE_PRESET}.json").exists()


def test_parse_json_ignores_a_note_after_the_object() -> None:
    text = '{"a": {"b": 1}}\n\nNote: I kept {fonts} from the template.'
    assert parse_json(text) == {"a": {"b": 1}}


def test_full_bleed_framing_removes_windows_but_keeps_the_end_card() -> None:
    from rasika_worker.planner import keep_full_bleed

    modes = [
        {"t": 0, "mode": "full"},
        {"t": 3, "mode": "card"},
        {"t": 5, "mode": "zoom"},
        {"t": 7, "mode": "pip"},
        {"t": 8, "mode": "arch"},
        {"t": 9, "mode": "full"},
        {"t": 14, "mode": "arch"},
    ]
    out = keep_full_bleed(modes)
    assert [m["mode"] for m in out] == ["full", "zoom", "full", "arch"]
    assert out[-1]["t"] == 14  # the closing arch (the end card) is kept
    assert keep_full_bleed([]) == [{"t": 0, "mode": "full"}]


def test_camera_fidelity_carries_framing() -> None:
    proposed = {**PROPOSED, "motion": {**PROPOSED["motion"], "framing": "full"}}
    assert merge_by_fidelity(PRESET, proposed, "camera")["motion"]["framing"] == "full"
    assert merge_by_fidelity(PRESET, proposed, "pace")["motion"].get("framing") != "full"


def test_image_media_type_follows_the_bytes(tmp_path) -> None:
    """A large PNG is re-encoded to JPEG for the model; its declared type must say JPEG."""
    from PIL import Image

    from rasika_worker.planner import _b64_image

    big = tmp_path / "shot.png"
    Image.effect_noise((1600, 1600), 90).convert("RGB").save(big)  # noise: large on disk
    assert big.stat().st_size > 1_500_000
    assert _b64_image(big)["source"]["media_type"] == "image/jpeg"
    small = tmp_path / "small.png"
    Image.new("RGB", (40, 40), "red").save(small)
    assert _b64_image(small)["source"]["media_type"] == "image/png"


def test_mix_with_a_music_bed_runs(tmp_path) -> None:
    """voice + sfx + a ducked music bed: the voice feeds both the mix and the ducking key."""
    import shutil

    import numpy as np
    import pytest

    from rasika_worker import media, music

    ff = shutil.which("ffmpeg")
    if not ff:
        pytest.skip("ffmpeg not installed")
    voice, bed, sfxw, out = tmp_path / "v.wav", tmp_path / "m.wav", tmp_path / "s.wav", tmp_path / "out.wav"
    music.write(voice, np.sin(np.linspace(0, 2000, 48000 * 2)) * 0.3)
    music.write(sfxw, np.zeros(48000 * 2))
    music.write(bed, music.compose("launch", 2.0))
    media.mix(ff, voice, sfxw, out, music=bed)
    assert out.exists() and out.stat().st_size > 1000


def test_validator_measures_with_the_styles_own_fonts() -> None:
    """The validator page must really load the fonts: a wide grotesk fits at a smaller size than
    Anton, and Anton is not shrunk as if it were a fallback face."""
    import json
    from pathlib import Path

    import pytest

    from rasika_worker.planner import ChromiumValidator
    from rasika_worker.settings import Settings

    s = Settings()
    if not s.engine_bundle.exists():
        pytest.skip("engine bundle not built")
    root = Path(__file__).resolve().parents[3]
    words = [{"w": "x", "t": 0.3, "end": 0.5, "conf": 1}]
    sizes = {}
    v = ChromiumValidator(s)
    try:
        for pid in ("mikku-royal", "showreel-kinetic"):
            style = json.loads((root / "packages" / "schema" / "presets" / f"{pid}.json").read_text(encoding="utf-8"))
            plan = {
                "version": 1,
                "meta": {"durationSec": 5, "fps": 30, "width": 1080, "height": 1920, "language": "en", "faceless": True},
                "style": style,
                "subject": {"faceBox": {"x": 0, "y": 0, "w": 1, "h": 1}, "freeZone": {"x": 0, "y": 150, "w": 1080, "h": 1500}},
                "videoModes": [{"t": 0, "mode": "full"}],
                "captions": {"enabled": False, "y": 1400, "gold": [], "accent": []},
                "sfx": {"auto": True, "intensity": 1},
                "elements": [{"id": "t", "type": "posterText", "t0": 0.3, "t1": 3, "top": 300,
                              "lines": [{"text": "INFRASTRUCTURE", "font": "anton", "size": 300, "color": "iv"}]}],
            }
            sizes[pid] = v(plan, words, [])["plan"]["elements"][0]["lines"][0]["size"]
    finally:
        v.close()
    assert sizes["mikku-royal"] >= 150  # Anton's real width, not a fallback face
    assert sizes["showreel-kinetic"] < sizes["mikku-royal"] * 0.75  # Archivo Black is much wider
