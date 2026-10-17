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
