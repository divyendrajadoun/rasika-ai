# Phase 0 report — Repo & foundations (2026-10-18)

## Built

- pnpm workspace + Turborepo (`apps/web`, `apps/worker`, `packages/engine`, `packages/schema`), shared
  `tsconfig.base.json`, Prettier, ESLint (flat config), `.editorconfig`.
- `packages/schema`: Zod plan envelope + `StyleTokens`; the four presets as JSON (Mikku Royal default).
- `packages/engine`: the deterministic toolkit ported 1:1 from `template.html` (easings, `prog`, `lerp`,
  seeded `rng`, transform styles, frame index) with unit tests. Fonts shipped in `packages/engine/fonts`.
- `apps/worker`: Python 3.11, pydantic settings, Redis consumer loop with graceful shutdown + healthcheck,
  job/progress protocol models, `sfx.py` wrapped as a module, Dockerfile on the Playwright base image,
  ruff + mypy (strict) + pytest (7 tests).
- `docker-compose.yml`: redis · postgres · **RustFS** (S3) · bucket init · worker (+ `--profile full` web).
- `.env.example` with every key documented; `docs/job-protocol.md`; `docs/costs.md`; GitHub Actions CI
  (web lint/typecheck/test/build + Lighthouse CI, worker ruff/mypy/pytest, Docker build).
- Brand config: `apps/web/src/config/brand.ts`.

## Acceptance

- `pnpm check` (lint · typecheck · test · build) green; `pnpm worker:check` green.
- `docker compose up -d --build`: redis, postgres, rustfs healthy, bucket created, worker up.
  A smoke job pushed to `rasika:jobs` was consumed and published `probing → done` progress.
- CI config is in place; it has not run yet because the repo has no remote.

## Mocked / deferred

- Worker handlers are a `noop` placeholder until Phase 4.
- Postgres persistence of job progress lands with the schema in Phase 2 (pub/sub only for now).

## Decisions to review

1. **RustFS instead of MinIO for local S3.** `minio/minio` is gone from Docker Hub and `quay.io/minio`
   now requires auth, so neither image is pullable. RustFS is MinIO-API-compatible; production is R2.
2. **Own git repository.** The folder sits inside the huge, mostly-untracked `F:/a_openai` repo, so Rasika
   got its own `git init` (branch `main`) to keep commits clean.
3. Packages export TypeScript source directly (`transpilePackages` in Next) — no build step for now.
