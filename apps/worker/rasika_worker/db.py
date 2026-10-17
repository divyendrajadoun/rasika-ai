"""Persist job progress to Postgres (`jobs` + `projects.status`) — the dashboard reads it via SSE.

Tolerates an unreachable database (logs a warning) so the worker never crashes on it.
"""

from __future__ import annotations

import contextlib
import json

import psycopg
import structlog

from rasika_worker.protocol import JobStatus

log = structlog.get_logger("rasika.worker.db")


class JobStore:
    def __init__(self, database_url: str) -> None:
        self._url = database_url
        self._conn: psycopg.Connection | None = None
        self._warned = False

    def _connect(self) -> psycopg.Connection | None:
        if self._conn is not None and not self._conn.closed:
            return self._conn
        try:
            self._conn = psycopg.connect(self._url, autocommit=True, connect_timeout=3)
            self._warned = False
            return self._conn
        except Exception as exc:
            if not self._warned:
                log.warning("db_unavailable", error=str(exc))
                self._warned = True
            return None

    def update(
        self,
        job_id: str,
        project_id: str,
        status: JobStatus,
        progress: int,
        message: str,
        timings: dict[str, float],
        error: str | None = None,
    ) -> None:
        conn = self._connect()
        if conn is None:
            return
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE jobs
                       SET status = %s, progress = %s, message = %s, error = %s,
                           timings = timings || %s::jsonb, updated_at = now()
                     WHERE id = %s::uuid
                    """,
                    (status.value, progress, message, error, json.dumps(timings), job_id),
                )
                cur.execute(
                    "UPDATE projects SET status = %s, updated_at = now() WHERE id = %s::uuid",
                    (status.value, project_id),
                )
        except Exception as exc:
            log.warning("db_update_failed", job_id=job_id, error=str(exc))
            with contextlib.suppress(Exception):
                conn.close()
            self._conn = None
