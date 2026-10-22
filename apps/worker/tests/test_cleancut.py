"""Clean cut: fillers, repeats and long pauses come out; nothing kept overlaps a removed word."""

import pytest

from rasika_worker.cleancut import plan_cuts, plan_kept, suggest


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


def test_hook_moves_to_the_front_without_touching_its_neighbours() -> None:
    ws = [
        w("Hi", 0.2, 0.4),
        w("there.", 0.45, 0.8),
        w("Um", 1.0, 1.2),
        w("money", 1.3, 1.6),
        w("is", 1.65, 1.8),
        w("fake.", 1.85, 2.3),
        w("Here", 3.0, 3.2),
        w("is", 3.25, 3.4),
        w("why.", 3.45, 3.9),
    ]
    p = plan_cuts(ws, 5.0, hook=(2, 5))
    assert p.moved
    first = p.keep[0]
    assert first[0] >= 1.2 and first[1] < 3.0  # the hook alone: no "Um", no "Here"
    assert p.keep[1][0] == 0.0  # then the take from the top


def said(text: str, start: float = 0.0) -> list[dict[str, object]]:
    """Words 0.4 s apart; "|" is a 1.2 s pause (a new sentence for the cut)."""
    out: list[dict[str, object]] = []
    t = start
    for tok in text.split():
        if tok == "|":
            t += 1.2
            continue
        out.append(w(tok, t, t + 0.3))
        t += 0.4
    return out


def test_false_start_and_retake_keep_the_last_take() -> None:
    words = said(
        "So today I want | So today I want to show you my kitchen. "
        "It has three burners. It has three big burners. That is all."
    )
    runs = [(r["i0"], r["i1"], r["why"]) for r in suggest(words)]
    assert runs == [(0, 3, "retake"), (13, 16, "retake")]
    kept = " ".join(
        str(words[i]["w"]) for i in range(len(words)) if not any(a <= i <= b for a, b, _ in runs)
    )
    assert kept == "So today I want to show you my kitchen. It has three big burners. That is all."


def test_different_lines_are_not_retakes() -> None:
    words = said("I sell rings. | We ship to Delhi. | Order today.")
    assert suggest(words) == []


def test_plan_kept_cuts_exactly_the_removed_words() -> None:
    p = plan_kept(WORDS, 7.0, {4, 5})
    assert [r["w"] for r in p.removed] == ["idea", "is"]
    for i in (4, 5):
        mid = (float(WORDS[i]["t"]) + float(WORDS[i]["end"])) / 2  # type: ignore[arg-type]
        assert not any(a <= mid <= b for a, b in p.keep)
    with pytest.raises(ValueError):
        plan_kept(WORDS, 7.0, set(range(len(WORDS))))
