# apps/worker

Python 3.11 worker: consumes jobs from Redis, probes/transcribes/renders, writes outputs to S3.

```bash
cd apps/worker
python -m venv .venv && . .venv/Scripts/activate   # or source .venv/bin/activate
pip install -e ".[dev]"
python -m rasika_worker.main            # needs REDIS_URL (docker compose up redis)
ruff check . && mypy rasika_worker && pytest -q
```

Protocol: see `docs/job-protocol.md`. Stage handlers arrive in Phase 4.
