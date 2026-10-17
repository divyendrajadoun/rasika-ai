import json

from rasika_worker.protocol import STAGE_MESSAGES, JobMessage, JobStatus, JobType, ProgressUpdate


def test_job_message_roundtrip() -> None:
    msg = JobMessage(job_id="j1", project_id="p1", user_id="u1", type=JobType.PROBE)
    raw = msg.model_dump_json()
    back = JobMessage.model_validate_json(raw)
    assert back == msg
    assert json.loads(raw)["v"] == 1


def test_progress_bounds() -> None:
    upd = ProgressUpdate(job_id="j1", status=JobStatus.PLANNING, progress=42, message="x")
    assert 0 <= upd.progress <= 100
    try:
        ProgressUpdate(job_id="j1", status=JobStatus.PLANNING, progress=101)
    except ValueError:
        pass
    else:
        raise AssertionError("progress > 100 must be rejected")


def test_every_processing_status_has_friendly_copy() -> None:
    for st in JobStatus:
        if st is JobStatus.UPLOADED:
            continue
        assert STAGE_MESSAGES[st], st


def test_blank_parallelism_env_means_unset(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from rasika_worker.settings import Settings

    monkeypatch.setenv("WORKER_RENDER_PARALLELISM", "")
    assert Settings().render_parallelism is None
    monkeypatch.setenv("WORKER_RENDER_PARALLELISM", "4")
    assert Settings().effective_parallelism == 4
