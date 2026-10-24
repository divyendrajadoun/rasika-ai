"""Many clips → one take: order by the script or the recording, earlier takes dropped, air trimmed."""

from rasika_worker.assemble import (
    Clip,
    arrange_as_picked,
    arrange_by_script,
    arrange_recorded,
    kept_seconds,
    parse_model_order,
    speech_span,
)


def clip(cid: str, text: str, start: float = 1.0, gap: float = 0.4, tail: float = 2.0) -> Clip:
    words, t = [], start
    for tok in text.split():
        words.append({"w": tok, "t": round(t, 2), "end": round(t + 0.3, 2)})
        t += gap
    return Clip(cid, f"Clip {cid}", words, round(t + tail, 2))


def test_speech_span_trims_the_air_around_the_words() -> None:
    c = clip("a", "um hello there friends", start=2.0)
    a, b = speech_span(c.words, c.duration)
    assert a == 2.4 - 0.25  # the filler at the start does not count as speech
    assert b == round(3.2 + 0.3 + 0.45, 3)


def test_silent_clip_stays_whole() -> None:
    assert speech_span([], 4.0) == (0.0, 4.0)


def test_script_order_wins_over_recording_order() -> None:
    script = "Three mistakes people make with money. First, no emergency fund. Second, no insurance. Follow for more."
    clips = [
        clip("1", "second no insurance"),
        clip("2", "follow for more"),
        clip("3", "three mistakes people make with money"),
        clip("4", "first no emergency fund"),
    ]
    kept = [d.id for d in arrange_by_script(clips, script) if d.keep]
    assert kept == ["3", "4", "1", "2"]


def test_script_keeps_the_closer_take_of_a_line() -> None:
    script = "Three mistakes people make with money. First, no emergency fund."
    clips = [
        clip("1", "three mistakes uh people make with my money"),
        clip("2", "three mistakes people make with money"),
        clip("3", "first no emergency fund"),
    ]
    out = {d.id: d for d in arrange_by_script(clips, script)}
    assert out["2"].keep and out["3"].keep
    assert not out["1"].keep and "another take" in out["1"].why


def test_script_drops_off_script_and_silent_clips() -> None:
    script = "Three mistakes people make with money."
    clips = [clip("1", "three mistakes people make with money"), clip("2", "is this thing recording okay"), Clip("3", "Clip 3", [], 3.0)]
    out = {d.id: d for d in arrange_by_script(clips, script)}
    assert out["1"].keep
    assert out["2"].why == "not in the script"
    assert out["3"].why == "no speech"


def test_recorded_order_drops_earlier_takes_and_false_starts() -> None:
    clips = [
        clip("1", "so today I want to"),
        clip("2", "so today I want to show you three tricks"),
        clip("3", "okay"),
        clip("4", "the first trick is simple"),
    ]
    out = arrange_recorded(clips)
    assert [d.id for d in out if d.keep] == ["2", "4"]
    by = {d.id: d for d in out}
    assert by["1"].why == "earlier take of Clip 2"
    assert by["3"].why == "too short to use"


def test_picked_order_is_exact() -> None:
    clips = [clip("1", "a b c"), clip("2", "d e f"), clip("3", "g h i")]
    out = arrange_as_picked(clips, ["3", "1", "3", "nope"])
    assert [d.id for d in out if d.keep] == ["3", "1"]
    assert [d.why for d in out if not d.keep] == ["left out by you"]


def test_model_answer_is_validated() -> None:
    clips = [clip("1", "a b c"), clip("2", "d e f"), clip("3", "g h i")]
    good = parse_model_order('Sure: {"order": [3, 1], "dropped": [{"clip": 2, "why": "retake"}]}', clips)
    assert good is not None
    assert [d.id for d in good if d.keep] == ["3", "1"]
    assert [d.why for d in good if not d.keep] == ["retake"]
    assert parse_model_order('{"order": [1, 1]}', clips) is None
    assert parse_model_order('{"order": [7]}', clips) is None
    assert parse_model_order("no json here", clips) is None


def test_kept_seconds_counts_only_the_trimmed_kept_clips() -> None:
    clips = [clip("1", "a b c"), clip("2", "d e f")]
    out = arrange_as_picked(clips, ["1"])
    assert kept_seconds(out) == round(out[0].end - out[0].start, 3)
