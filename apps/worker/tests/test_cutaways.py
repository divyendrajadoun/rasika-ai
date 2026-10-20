import json
from types import SimpleNamespace
from typing import Any

from rasika_worker import animate

WORDS = [{"w": f"w{i}", "t": i * 0.5, "end": i * 0.5 + 0.4} for i in range(60)]  # 30 s


class FakeClient:
    """Answers the cutaway call with a fixed shot list."""

    def __init__(self, shots: list[dict[str, Any]]) -> None:
        self.shots = shots
        self.messages = self

    def stream(self, **_kw: Any) -> Any:
        text = json.dumps({"style": {"palette": []}, "shots": self.shots})
        msg = SimpleNamespace(
            content=[SimpleNamespace(text=text)],
            usage=SimpleNamespace(input_tokens=1, output_tokens=1),
        )

        class Ctx:
            def __enter__(self) -> Any:
                return SimpleNamespace(get_final_message=lambda: msg)

            def __exit__(self, *_a: Any) -> None:
                return None

        return Ctx()


def test_cutaways_snap_space_and_cap() -> None:
    shots = [
        {"at": 0.4, "sec": 3},  # in the opening: dropped
        {"at": 4.12, "sec": 9},  # snapped to 4.0, length capped at 4
        {"at": 9.0, "sec": 3},  # within 3 s of the previous end (8.0 + 3): dropped
        {"at": 12.3, "sec": 1},  # snapped to 12.5, length raised to 2.5
        {"at": 20.0, "sec": 3},  # over the count
    ]
    film, _ = animate.cutaways(FakeClient(shots), "m", WORDS, 30.0, 2, {"palette": {}})
    assert [(s["at"], s["sec"]) for s in film["shots"]] == [(4.0, 4.0), (12.5, 2.5)]


def test_cutaways_never_past_the_end() -> None:
    film, _ = animate.cutaways(
        FakeClient([{"at": 5, "sec": 3}, {"at": 28, "sec": 3}]), "m", WORDS, 30.0, 4, {}
    )
    assert [s["at"] for s in film["shots"]] == [5.0]


def test_insert_cutaways_drops_what_the_scene_covers() -> None:
    plan = {
        "elements": [
            {"id": "a", "type": "posterText", "t0": 4.5, "t1": 6.0},  # starts inside: dropped
            {"id": "b", "type": "posterText", "t0": 3.0, "t1": 7.0},  # 3/4 inside: dropped
            {"id": "c", "type": "posterText", "t0": 0.0, "t1": 30.0},  # mostly outside: kept
            {"id": "d", "type": "posterText", "t0": 10.0, "t1": 12.0},  # outside: kept
        ],
        "sfx": {"auto": True, "intensity": 0.6, "extra": []},
    }
    out = animate.insert_cutaways(plan, [{"at": 4.0, "sec": 4.0}], ["g.fillRect(0,0,W,H);"])
    assert [e["id"] for e in out["elements"]] == ["c", "anim1", "d"]
    scene = out["elements"][1]
    assert (scene["type"], scene["t0"], scene["t1"]) == ("codeScene", 4.0, 8.0)
    assert out["sfx"]["extra"][0]["t"] == 4.0
    assert len(plan["elements"]) == 4  # the input plan is left alone
