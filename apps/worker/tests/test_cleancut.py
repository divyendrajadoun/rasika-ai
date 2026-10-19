"""Clean cut: fillers, repeats and long pauses come out; nothing kept overlaps a removed word."""

from rasika_worker.cleancut import plan_cuts


def w(text: str, t: float, end: float) -> dict[str, object]:
    return {"w": text, "t": t, "end": end}


WORDS = [
    w("So", 0.5, 0.7),
    w("um", 0.9, 1.2),
    w("the", 1.3, 1.4),
    w("the", 1.45, 1.6),
    w("idea", 1.7, 2.0),
    w("is", 4.0, 4.2),
    w("I", 4.3, 4.4),
    w("think", 4.45, 4.7),
    w("I", 4.8, 4.9),
    w("think", 4.95, 5.2),
    w("simple.", 5.3, 5.8),
]


def test_removes_fillers_and_repeats() -> None:
    p = plan_cuts(WORDS, 7.0)
    assert [(r["w"], r["why"]) for r in p.removed] == [
        ("um", "filler"),
        ("the", "repeat"),
        ("I", "repeat"),
        ("think", "repeat"),
    ]


def test_no_kept_range_covers_a_removed_word() -> None:
    p = plan_cuts(WORDS, 7.0)
    for r in p.removed:
        word = WORDS[int(r["i"])]
        mid = (float(word["t"]) + float(word["end"])) / 2  # type: ignore[arg-type]
        assert not any(a <= mid <= b for a, b in p.keep), r


def test_every_kept_word_survives_whole() -> None:
    p = plan_cuts(WORDS, 7.0)
    removed = {int(r["i"]) for r in p.removed}
    for i, word in enumerate(WORDS):
        if i in removed:
            continue
        assert any(a <= float(word["t"]) and float(word["end"]) <= b for a, b in p.keep), word  # type: ignore[arg-type]


def test_long_pause_closes_to_a_breath() -> None:
    p = plan_cuts(WORDS, 7.0)
    # "idea" ends at 2.0 and "is" starts at 4.0: two seconds of air become well under half a second
    assert p.removed_sec > 1.5
    assert p.duration_out < 4.0


def test_a_clean_take_is_left_alone() -> None:
    clean = [w("Hello", 0.2, 0.5), w("there", 0.55, 0.9), w("friend.", 0.95, 1.4)]
    p = plan_cuts(clean, 2.0)
    assert p.removed == [] and len(p.keep) == 1
