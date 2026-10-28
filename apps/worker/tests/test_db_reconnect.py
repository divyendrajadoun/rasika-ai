"""A connection dropped while the worker sat idle is reopened, once, instead of failing the job."""

from __future__ import annotations

from typing import Any

import psycopg
import pytest

from rasika_worker.db import Repo


class _Cur:
    def __init__(self, conn: _Conn) -> None:
        self.conn = conn

    def __enter__(self) -> _Cur:
        return self

    def __exit__(self, *a: Any) -> None:
        pass

    def execute(self, sql: str, params: Any) -> None:
        if self.conn.dead:
            self.conn.broken = True
            raise psycopg.OperationalError("consuming input failed: SSL error: unexpected eof")

    def fetchone(self) -> dict[str, Any]:
        return {"id": "p1"}


class _Conn:
    def __init__(self, dead: bool) -> None:
        self.dead, self.broken, self.closed = dead, False, False

    def cursor(self) -> _Cur:
        return _Cur(self)

    def close(self) -> None:
        self.closed = True


def _repo(conns: list[_Conn]) -> Repo:
    repo = Repo("postgresql://unused")
    made = iter(conns)

    def conn() -> Any:
        if repo._conn is None:
            repo._conn = next(made)  # type: ignore[assignment]
        return repo._conn

    repo.conn = conn  # type: ignore[method-assign]
    return repo


def test_dead_connection_is_reopened() -> None:
    first = _Conn(dead=True)
    repo = _repo([first, _Conn(dead=False)])
    assert repo.one("SELECT 1") == {"id": "p1"}
    assert first.closed


def test_gives_up_after_one_retry() -> None:
    repo = _repo([_Conn(dead=True), _Conn(dead=True)])
    with pytest.raises(psycopg.OperationalError):
        repo.one("SELECT 1")
