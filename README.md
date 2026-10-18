# Rasika

AI motion-designed reel editor. Upload a talking video, get poster type, one-word captions,
your photos on the exact spoken word, and sound — rendered to a 1080×1920 MP4.

The full product spec is in [`SPEC.md`](./SPEC.md). The reference pipeline this is built
from lives in [`reference/mikku`](./reference/mikku) (golden composition:
`reference/baisa_bling`).

## Layout

```
apps/web         Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion
apps/worker      Python 3.11 worker: probe · Deepgram transcription (faster-whisper fallback) · chunked Chromium render · sfx mix
packages/engine  Deterministic motion engine (plan JSON → frames); headless harness in dist/
packages/schema  Plan v1 (Zod) · validatePlan · JSON Schema export · style presets
plans/           hand-written plans (baisa_bling.json = the golden reference)
tools/golden     SSIM golden test (engine vs reference composition); tools/gen_plan_models.py
docs/            engine.md, job protocol, costs, phase reports
```

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d          # redis · postgres · rustfs (S3) · worker
pnpm --filter web db:migrate  # create the tables (Drizzle)
pnpm dev                      # web on http://localhost:3000
```

GPU: `docker compose up -d` passes the host NVIDIA GPU to the worker (`deploy.resources` in
`docker-compose.yml`); transcription then takes seconds instead of minutes. Without a GPU the worker
falls back to CPU automatically (set `WHISPER_MODEL=medium` for a lighter box).

Checks: `pnpm check` (lint · typecheck · test · build), `pnpm worker:check`, and the engine golden
test `pnpm golden` (needs the worker venv: Playwright Chromium, Pillow, scikit-image; add
`-- --video <file>` for real footage). `/dev/engine` plays any plan against any video.
Schema changes: `pnpm schema:export && pnpm schema:pydantic` (CI checks both are committed).

Worker CLI (from the repo root, with the worker venv):

```bash
python -m rasika_worker.cli render-local --plan plans/baisa_bling.json --words plans/baisa_bling.words.json   --images reference/baisa_bling/img --video my_take.mp4 -o out/baisa.mp4     # plan + video → MP4, no DB
python -m rasika_worker.cli transcribe-local --audio my_take.mp4 --out words.json
python -m rasika_worker.cli run-plan --project <id> --plan ... --words ... --images DIR   # via the queue
```
Auth is Supabase (set `NEXT_PUBLIC_SUPABASE_*` in `.env`); data lives in the compose Postgres until
you point `DATABASE_URL` at Supabase (then `drizzle/0001_rls.sql` activates row-level security).

## Brand

Name, tagline and colours live in one file: `apps/web/src/config/brand.ts`.
Landing-page copy: `apps/web/src/content/landing.ts`. Pricing: `apps/web/src/config/pricing.ts`.
