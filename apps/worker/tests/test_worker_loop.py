"""Exercises the consumer loop against an in-memory fake Redis (no server needed)."""

from __future__ import annotations

import json

from rasika_worker.main import Worker
from rasika_worker.protocol import JobMessage, JobType
from rasika_worker.settings import Settings


class FakeRedis:
    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []

    def publish(self, channel: str, msg: str) -> int:
        self.published.append((channel, msg))
        return 1


def test_process_publishes_progress_for_valid_job(tmp_path) -> None:  # type: ignore[no-untyped-def]
    w = Worker(Settings(WORKER_WORK_DIR=str(tmp_path)))
    fake = FakeRedis()
    w.redis = fake  # type: ignore[assignment]
    job = JobMessage(job_id="job-1", project_id="p", user_id="u", type=JobType.RENDER_FINAL)
    w.process(job.model_dump_json())
    assert [c for c, _ in fake.published] == ["rasika:progress:job-1"] * 2
    last = json.loads(fake.published[-1][1])
    assert last["status"] == "done" and last["progress"] == 100
    assert "elapsed_sec" in last["timings"]


def test_process_drops_malformed_message(tmp_path) -> None:  # type: ignore[no-untyped-def]
    w = Worker(Settings(WORKER_WORK_DIR=str(tmp_path)))
    fake = FakeRedis()
    w.redis = fake  # type: ignore[assignment]
    w.process("{not json")
    assert fake.published == []
