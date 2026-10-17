# apps/web

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui · Framer Motion.

```bash
pnpm --filter web dev        # http://localhost:3000
pnpm --filter web build && pnpm --filter web start
pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web test
```

- Brand: `src/config/brand.ts` · Copy: `src/content/landing.ts` · Pricing: `src/config/pricing.ts`
- Theme: `data-theme` on `<html>` (dark maroon default, ivory light), tokens in `src/app/globals.css`
- Fonts: subset woff2 in `src/fonts` (OFL); the TTFs there are used by the OG image route only
- Demo videos: `public/demo/{before,after}.mp4` — replace with your own
- Auth gate: `src/middleware.ts` (**MOCK** cookie session until Phase 2)
