"""Worker entrypoint.

Phase 0: a real Redis consumer loop with graceful shutdown, structured logs and
a health check. Job handlers are registered in `HANDLERS`; until Phase 4 the
only handler is `noop`, which acknowledges the message and reports 100 %.
"""

from __future__ import annotations

import json
import logging
import signal
import sys
import time
from collections.abc import Callable

import redis
import structlog

from rasika_worker import __version__
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
    """Publishes progress to Redis pub/sub (Postgres persistence lands in Phase 2)."""

    def __init__(self, r: redis.Redis[str], job_id: str) -> None:
        self._r = r
        self._job_id = job_id
        self._started = time.monotonic()

    def update(self, status: JobStatus, progress: int, message: str = "", **timings: float) -> None:
        upd = ProgressUpdate(
            job_id=self._job_id,
            status=status,
            progress=progress,
            message=message,
            timings={"elapsed_sec": round(time.monotonic() - self._started, 3), **timings},
        )
        self._r.publish(f"rasika:progress:{self._job_id}", upd.model_dump_json())
        log.info("progress", job_id=self._job_id, status=status, progress=progress, message=message)

    def fail(self, error: str) -> None:
        upd = ProgressUpdate(
            job_id=self._job_id, status=JobStatus.FAILED, progress=100, error=error
        )
        self._r.publish(f"rasika:progress:{self._job_id}", upd.model_dump_json())
        log.error("job_failed", job_id=self._job_id, error=error)


def handle_noop(job: JobMessage, pub: Publisher) -> None:
    """Placeholder handler so the queue round-trips end-to-end in Phase 0."""
    pub.update(JobStatus.PROBING, 0, "Looking at your video…")
    pub.update(JobStatus.DONE, 100, "Your reel is ready")


HANDLERS: dict[JobType, Handler] = {t: handle_noop for t in JobType}


class Worker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.redis: redis.Redis[str] = redis.Redis.from_url(
            settings.redis_url, decode_responses=True
        )
        self._stop = False

    def stop(self, *_: object) -> None:
        log.info("shutdown_requested")
        self._stop = True

    def process(self, raw: str) -> None:
        try:
            job = JobMessage.model_validate_json(raw)
        except Exception as exc:  # malformed message: log and drop, never crash the loop
            log.error("bad_job_message", raw=raw[:500], error=str(exc))
            return
        pub = Publisher(self.redis, job.job_id)
        handler = HANDLERS[job.type]
        t0 = time.monotonic()
        try:
            handler(job, pub)
            log.info(
                "job_done", job_id=job.job_id, type=job.type, sec=round(time.monotonic() - t0, 3)
            )
        except Exception as exc:
            pub.fail(f"{type(exc).__name__}: {exc}")

    def run(self) -> None:
        s = self.settings
        s.work_dir.mkdir(parents=True, exist_ok=True)
        log.info(
            "worker_start",
            version=__version__,
            queue=s.job_queue,
            parallelism=s.effective_parallelism,
            work_dir=str(s.work_dir),
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
