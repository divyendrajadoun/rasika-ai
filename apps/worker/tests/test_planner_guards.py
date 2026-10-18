"""The planner never accepts a truncated or empty answer (a fake Anthropic client, no network)."""

from __future__ import annotations

import json
import pathlib
from types import SimpleNamespace
from typing import Any

import pytest

from rasika_worker.planner import Planner, PlannerInput
from rasika_worker.settings import Settings

ROOT = pathlib.Path(__file__).resolve().parents[3]


class FakeMessages:
    def __init__(self, answers: list[tuple[str, dict[str, Any] | None]]) -> None:
        self.answers = answers
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        stop, plan = self.answers.pop(0)
        content = [SimpleNamespace(type="tool_use", input=plan)] if plan is not None else []
        usage = SimpleNamespace(
            input_tokens=10,
            output_tokens=5,
            cache_read_input_tokens=0,
            cache_creation_input_tokens=0,
        )
        return SimpleNamespace(content=content, usage=usage, stop_reason=stop)

    def stream(self, **kwargs: Any) -> Any:
        """The planner streams (large outputs); the fake returns a context manager."""
        outer = self

        class _Stream:
            def __enter__(self) -> Any:
                return self

            def __exit__(self, *exc: object) -> None:
                return None

            def get_final_message(self) -> Any:
                return outer.create(**kwargs)

        return _Stream()


def fake_client(answers: list[tuple[str, dict[str, Any] | None]]) -> Any:
    return SimpleNamespace(messages=FakeMessages(answers))


def passthrough_validator(
    plan: dict[str, Any], words: list[dict[str, Any]], ids: list[str]
) -> dict[str, Any]:
    return {"ok": True, "plan": plan, "issues": []}


def make_input() -> PlannerInput:
    return PlannerInput(
        duration_sec=90.0,
        language="en",
        words=[{"w": "hi", "t": 0.2}],
        subject={},
        style={},
        style_text=None,
        brand={},
        images=[],
        keyframes=[],
    )


def good_plan() -> dict[str, Any]:
    plan = json.loads((ROOT / "plans" / "baisa_bling.json").read_text(encoding="utf-8"))
    plan.pop("$schema", None)
    return plan


def test_truncated_answer_is_retried_then_rejected() -> None:
    client = fake_client([("max_tokens", {}), ("max_tokens", {})])
    p = Planner(Settings(ANTHROPIC_API_KEY="x"), client)
    with pytest.raises(RuntimeError, match="token limit"):
        p.plan(make_input(), passthrough_validator)
    assert len(client.messages.calls) == 2
    assert "cut off" in client.messages.calls[1]["messages"][-1]["content"]


def test_truncated_then_good_answer_is_accepted() -> None:
    client = fake_client([("max_tokens", {}), ("tool_use", good_plan())])
    p = Planner(Settings(ANTHROPIC_API_KEY="x"), client)
    res = p.plan(make_input(), passthrough_validator)
    assert res.ok and res.report["elements"] == 47


def test_empty_plan_is_a_failure_not_a_style() -> None:
    client = fake_client([("tool_use", {"elements": [], "videoModes": [{"t": 0, "mode": "full"}]})])
    p = Planner(Settings(ANTHROPIC_API_KEY="x"), client)
    with pytest.raises(RuntimeError, match="elements"):
        p.plan(make_input(), passthrough_validator)
    assert Planner.min_elements(90) == 11 and Planner.min_elements(10) == 3
