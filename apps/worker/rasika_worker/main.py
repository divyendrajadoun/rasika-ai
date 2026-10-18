"""Worker entrypoint: Redis consumer loop with graceful shutdown, structured logs, a health check,
and the stage handlers from `pipeline.py` (probe · transcribe · render_preview · render_final ·
cleanup; `plan` is a Phase 5 stub)."""

from __future__ import annotations

import json
import logging
import signal
import sys
import time
import traceback
from collections.abc import Callable

import redis
import structlog

from rasika_worker import __version__
from rasika_worker.db import JobStore
from rasika_worker.protocol import JobMessage, JobStatus, JobType, ProgressUpdate
from rasika_worker.settings import Settings, get_settings

log = structlog.get_logger("rasika.worker")

Handler = Callable[[JobMessage, "Publisher"], None]


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), stream=sys.stdout, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level.upper())),
    )


class Publisher:
    """Publishes progress to Redis pub/sub and persists it to Postgres (`jobs`, `projects`)."""

    def __init__(
        self, r: redis.Redis[str], job_id: str, project_id: str, store: JobStore | None = None
    ) -> None:
        self._r = r
        self._job_id = job_id
        self._project_id = project_id
        self._store = store
        self._started = time.monotonic()
        self._last: tuple[JobStatus, int, str] | None = None

    def update(self, status: JobStatus, progress: int, message: str = "", **timings: float) -> None:
        key = (status, progress, message)
        if key == self._last and not timings:  # the render loop polls every second
            return
        self._last = key
        upd = ProgressUpdate(
            job_id=self._job_id,
            status=status,
            progress=progress,
            message=message,
            timings={"elapsed_sec": round(time.monotonic() - self._started, 3), **timings},
        )
        self._r.publish(f"rasika:progress:{self._job_id}", upd.model_dump_json())
        if self._store:
            self._store.update(
                self._job_id, self._project_id, status, progress, message, upd.timings
            )
        log.info("progress", job_id=self._job_id, status=status, progress=progress, message=message)

    def fail(self, error: str) -> None:
        upd = ProgressUpdate(
            job_id=self._job_id, status=JobStatus.FAILED, progress=100, error=error
        )
        self._r.publish(f"rasika:progress:{self._job_id}", upd.model_dump_json())
        if self._store:
            self._store.update(
                self._job_id, self._project_id, JobStatus.FAILED, 100, "", {}, error=error
            )
        log.error("job_failed", job_id=self._job_id, error=error)


def handle_noop(job: JobMessage, pub: Publisher) -> None:
    """Acknowledge-only handler (tests, and the Phase 0 smoke job)."""
    pub.update(JobStatus.PROBING, 10, "Looking at your video…")
    pub.update(JobStatus.DONE, 100, "Noop job acknowledged.")


class Worker:
    def __init__(self, settings: Settings, handlers: dict[JobType, Handler] | None = None) -> None:
        self.settings = settings
        self.redis: redis.Redis[str] = redis.Redis.from_url(
            settings.redis_url, decode_responses=True
        )
        self.store = JobStore(settings.database_url)
        self._handlers = handlers
        self._stop = False

    @property
    def handlers(self) -> dict[JobType, Handler]:
        if self._handlers is None:
            from rasika_worker.pipeline import (
                Pipeline,
            )  # heavy imports (boto3, playwright) stay lazy

            self._handlers = Pipeline(self.settings, self.redis).handlers
        return self._handlers

    def stop(self, *_: object) -> None:
        log.info("shutdown_requested")
        self._stop = True

    def process(self, raw: str) -> None:
        try:
            job = JobMessage.model_validate_json(raw)
        except Exception as exc:  # malformed message: log and drop, never crash the loop
            log.error("bad_job_message", raw=raw[:500], error=str(exc))
            return
        pub = Publisher(self.redis, job.job_id, job.project_id, self.store)
        handler = self.handlers[job.type]
        t0 = time.monotonic()
        try:
            handler(job, pub)
            log.info(
                "job_done", job_id=job.job_id, type=job.type, sec=round(time.monotonic() - t0, 3)
            )
        except Exception as exc:
            user_facing = type(exc).__name__ == "PipelineError"
            tb = traceback.format_exc()
            pub.fail(str(exc) if user_facing else f"{type(exc).__name__}: {exc}")
            log.error("job_exception", job_id=job.job_id, type=job.type, traceback=tb)
            # a copy on disk as well, in case the process's stdout is what broke
            try:
                tb_dir = self.settings.work_dir / "_failures"
                tb_dir.mkdir(parents=True, exist_ok=True)
                (tb_dir / f"{job.job_id}.txt").write_text(tb, encoding="utf-8")
            except OSError:
                pass

    def run(self) -> None:
        s = self.settings
        s.work_dir.mkdir(parents=True, exist_ok=True)
        log.info(
            "worker_start",
            version=__version__,
            queue=s.job_queue,
            parallelism=s.effective_parallelism,
            work_dir=str(s.work_dir),
            engine=str(s.engine_bundle),
            whisper=f"{s.whisper_model}/{s.whisper_device}/{s.whisper_compute_type}",
        )
        signal.signal(signal.SIGTERM, self.stop)
        signal.signal(signal.SIGINT, self.stop)
        while not self._stop:
            try:
                item = self.redis.blpop([s.job_queue], timeout=5)
            except redis.ConnectionError as exc:
                log.warning("redis_unavailable", error=str(exc))
                time.sleep(2)
                continue
            if item is None:
                continue
            _, raw = item
            self.process(raw)
        log.info("worker_stopped")


def healthcheck(settings: Settings) -> int:
    try:
        r: redis.Redis[bytes] = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2)
        r.ping()
        return 0
    except Exception as exc:
        print(json.dumps({"healthy": False, "error": str(exc)}))
        return 1


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    settings = get_settings()
    configure_logging(settings.log_level)
    if "--healthcheck" in argv:
        return healthcheck(settings)
    Worker(settings).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
