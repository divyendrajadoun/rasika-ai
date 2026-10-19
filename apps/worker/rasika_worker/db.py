"""Postgres access for the worker (psycopg, dict rows).

`JobStore` persists progress (`jobs` + `projects.status`); `Repo` reads/writes the project rows
the pipeline needs (assets, transcripts, edit plans, jobs). Column names follow
apps/web/src/db/schema.ts.
"""

from __future__ import annotations

import contextlib
import json
import uuid
from typing import Any

import psycopg
import structlog
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from rasika_worker.protocol import JobStatus

log = structlog.get_logger("rasika.worker.db")


class JobStore:
    """Tolerates an unreachable database (logs a warning) so progress publishing never crashes."""

    def __init__(self, database_url: str) -> None:
        self._url = database_url
        self._conn: psycopg.Connection[Any] | None = None
        self._warned = False

    def _connect(self) -> psycopg.Connection[Any] | None:
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


class Repo:
    """Project data the pipeline reads and writes. Raises on DB errors (the job then fails)."""

    def __init__(self, database_url: str) -> None:
        self._url = database_url
        self._conn: psycopg.Connection[Any] | None = None

    def conn(self) -> psycopg.Connection[Any]:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(
                self._url, autocommit=True, connect_timeout=5, row_factory=dict_row
            )
        return self._conn

    def one(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self.conn().cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None

    def all(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.conn().cursor() as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def exec(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        with self.conn().cursor() as cur:
            cur.execute(sql, params)

    # ── reads ──
    def project(self, project_id: str) -> dict[str, Any] | None:
        return self.one("SELECT * FROM projects WHERE id = %s::uuid", (project_id,))

    def assets(self, project_id: str, kind: str | None = None) -> list[dict[str, Any]]:
        if kind:
            return self.all(
                "SELECT * FROM assets WHERE project_id = %s::uuid AND kind = %s ORDER BY created_at",
                (project_id, kind),
            )
        return self.all(
            "SELECT * FROM assets WHERE project_id = %s::uuid ORDER BY created_at", (project_id,)
        )

    def latest_transcript(self, project_id: str) -> dict[str, Any] | None:
        return self.one(
            "SELECT * FROM transcripts WHERE project_id = %s::uuid ORDER BY version DESC LIMIT 1",
            (project_id,),
        )

    def plan(self, project_id: str, version: int | None = None) -> dict[str, Any] | None:
        if version is None:
            return self.one(
                "SELECT * FROM edit_plans WHERE project_id = %s::uuid ORDER BY version DESC LIMIT 1",
                (project_id,),
            )
        return self.one(
            "SELECT * FROM edit_plans WHERE project_id = %s::uuid AND version = %s",
            (project_id, version),
        )

    def job(self, job_id: str) -> dict[str, Any] | None:
        return self.one("SELECT * FROM jobs WHERE id = %s::uuid", (job_id,))

    # ── writes ──
    def insert_asset(
        self,
        project_id: str,
        user_id: str,
        kind: str,
        storage_key: str,
        filename: str,
        mime: str,
        size_bytes: int,
        meta: dict[str, Any] | None = None,
        asset_id: str | None = None,
    ) -> str:
        aid = asset_id or str(uuid.uuid4())
        self.exec(
            """
            INSERT INTO assets (id, project_id, user_id, kind, storage_key, filename, mime, size_bytes, meta)
            VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET storage_key = EXCLUDED.storage_key,
                size_bytes = EXCLUDED.size_bytes, meta = EXCLUDED.meta
            """,
            (
                aid,
                project_id,
                user_id,
                kind,
                storage_key,
                filename,
                mime,
                size_bytes,
                Jsonb(meta or {}),
            ),
        )
        return aid

    def replace_assets(self, project_id: str, kind: str) -> list[str]:
        """Delete this kind's rows (idempotent re-runs) and return their storage keys."""
        rows = self.assets(project_id, kind)
        self.exec(
            "DELETE FROM assets WHERE project_id = %s::uuid AND kind = %s", (project_id, kind)
        )
        return [r["storage_key"] for r in rows]

    def insert_transcript(self, project_id: str, language: str, words: list[dict[str, Any]]) -> int:
        row = self.one(
            "SELECT COALESCE(MAX(version), 0) + 1 AS v FROM transcripts WHERE project_id = %s::uuid",
            (project_id,),
        )
        version = int(row["v"]) if row else 1
        self.exec(
            "INSERT INTO transcripts (project_id, language, words, version) VALUES (%s::uuid, %s, %s, %s)",
            (project_id, language, Jsonb(words), version),
        )
        return version

    def insert_plan(
        self,
        project_id: str,
        plan: dict[str, Any],
        created_by: str = "llm",
        report: dict[str, Any] | None = None,
    ) -> int:
        row = self.one(
            "SELECT COALESCE(MAX(version), 0) + 1 AS v FROM edit_plans WHERE project_id = %s::uuid",
            (project_id,),
        )
        version = int(row["v"]) if row else 1
        self.exec(
            """INSERT INTO edit_plans (project_id, version, plan, validator_report, created_by)
               VALUES (%s::uuid, %s, %s, %s, %s)""",
            (project_id, version, Jsonb(plan), Jsonb(report) if report else None, created_by),
        )
        return version

    def insert_job(
        self, project_id: str, user_id: str, job_type: str, job_id: str | None = None
    ) -> str:
        jid = job_id or str(uuid.uuid4())
        self.exec(
            "INSERT INTO jobs (id, project_id, user_id, type, status) VALUES (%s::uuid, %s::uuid, %s::uuid, %s, 'uploaded')",
            (jid, project_id, user_id, job_type),
        )
        return jid

    def set_job_type(self, job_id: str, job_type: str) -> None:
        self.exec(
            "UPDATE jobs SET type = %s, updated_at = now() WHERE id = %s::uuid", (job_type, job_id)
        )

    def update_project(self, project_id: str, **fields: Any) -> None:
        cols = {
            "duration_sec": "duration_sec",
            "thumbnail_asset_id": "thumbnail_asset_id",
            "status": "status",
            "title": "title",
            "style_options": "style_options",
        }
        casts = {"thumbnail_asset_id": "::uuid", "style_options": "::jsonb"}
        sets: list[str] = []
        vals: list[Any] = []
        for k, v in fields.items():
            sets.append(f"{cols[k]} = %s" + casts.get(k, ""))
            vals.append(json.dumps(v) if k == "style_options" else v)
        if not sets:
            return
        vals.append(project_id)
        self.exec(
            f"UPDATE projects SET {', '.join(sets)}, updated_at = now() WHERE id = %s::uuid",
            tuple(vals),
        )

    def audit(
        self, user_id: str | None, action: str, entity: str, entity_id: str, meta: dict[str, Any]
    ) -> None:
        self.exec(
            "INSERT INTO audit_log (user_id, action, entity, entity_id, meta) VALUES (%s, %s, %s, %s, %s)",
            (user_id, action, entity, entity_id, Jsonb(meta)),
        )
