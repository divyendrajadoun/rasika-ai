# Rasika

AI motion-designed reel editor. Upload a talking video, get poster type, one-word captions,
your photos on the exact spoken word, and sound — rendered to a 1080×1920 MP4.

The full product spec is in [`SPEC.md`](./SPEC.md). The reference pipeline this is built
from lives in [`reference/mikku`](./reference/mikku) (golden composition:
`reference/baisa_bling`).

## Layout

```
apps/web         Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion
apps/worker      Python 3.11 render/transcribe worker (Docker, Playwright + ffmpeg)
packages/engine  Deterministic motion engine (plan JSON → frames), zero deps
packages/schema  Zod schemas for the plan JSON + style presets
docs/            job protocol, costs, phase reports
```

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d          # redis · postgres · rustfs (S3) · worker
pnpm dev                      # web on http://localhost:3000
```

Checks: `pnpm check` (lint · typecheck · test · build) and `pnpm worker:check`.

## Brand

Name, tagline and colours live in one file: `apps/web/src/config/brand.ts`.
Landing-page copy: `apps/web/src/content/landing.ts`. Pricing: `apps/web/src/config/pricing.ts`.
