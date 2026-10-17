# Phase 1 report — Landing page (2026-10-18)

## Built

All eleven sections from SPEC §5, copy in `src/content/landing.ts`, pricing in `src/config/pricing.ts`:
nav (wordmark, links, theme toggle, Get started) · hero (CSS rising words, "STUDIO" in gold, arch-masked
phone demo, trust row) · before/after split slider with synced playback · 01/02/03 chapter cards ·
8-feature grid with looping CSS mini demos · style gallery (4 presets, palette-driven previews, deep link
to `/dashboard/new?style=`) · who it's for · pricing (INR/USD toggle, credit packs) · FAQ (accordion +
FAQPage JSON-LD) · final CTA band · footer ("Made in Rajasthan"). Plus: OG image route, favicon route,
sitemap, robots, SoftwareApplication JSON-LD, `/terms` and `/privacy` drafts, 404 page, dark (maroon)
default theme + ivory light theme persisted in localStorage, reduced-motion support, skip link.

Auth flow: `Get started` → `/login` (MOCK magic link, cookie session) → `/dashboard` empty state →
sign out. Middleware gates `/dashboard/*`.

## Acceptance

| Check                                     | Result                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| Looks right at 360 / 768 / 1440           | ✅ screenshots reviewed, no horizontal overflow, no console errors |
| Get started → auth → `/dashboard`         | ✅ scripted with Playwright (sign-in, sign-out, re-gate)    |
| Lighthouse mobile accessibility / SEO     | ✅ 100 / 100 (best practices 100)                           |
| Lighthouse mobile performance ≥ 90        | ⚠️ **86–89 on localhost** (3 runs); see below              |

## Performance notes (honest)

Measured on `next start` on this Windows machine. Observed first paint is 0.4–0.5 s at 4× CPU
throttle, LCP is the hero poster image. The simulated score stays just under 90 because on localhost
every JS chunk and font finishes downloading before the first paint, so Lighthouse's Lantern model
counts all of them on the LCP critical path (simulated LCP 3.3 s). Work already done to get here:
CSS-only motion on the landing (no Framer Motion in this bundle: page JS 84 → 16 kB), fonts subset to
woff2 (1.5 MB → ~200 kB), poster-first lazy video, batched reveal scheduling. Remaining budget is the
Next/React runtime (102 kB) and a 319 ms first layout (4×) that I have not chased further.
CI asserts a11y/SEO ≥ 0.9 as errors and performance ≥ 0.9 as a warning until this is resolved on a
real deploy (Vercel edge + CDN changes the picture).

## Mocked / placeholders

- `src/middleware.ts`, `src/app/login/actions.ts`: `// MOCK:` cookie session (Phase 2 → Supabase Auth).
- `/dashboard` and `/dashboard/new` are shells (Phase 2 builds the grid and wizard).
- `/public/demo/after.mp4` is a 32 s, 540×960 cut of the Baisa Bling reel; `before.mp4` is a generated
  placeholder because the raw selfie footage was not in the materials provided.
- Terms / Privacy are drafts marked for legal review.

## Decisions to review

1. **Landing-page motion is CSS keyframes, not Framer Motion.** Framer stays a dependency for the editor
   (Phase 6); on the landing it cost ~1.2 s of throttled main-thread time before first paint.
2. **Before/after is one phone frame with a draggable split**, not two separate phones side by side.
   Both clips play in sync underneath the divider; easy to change if you prefer two frames.
3. Eyebrow labels use dark-gold/gold instead of terracotta for WCAG AA contrast; terracotta buttons use
   pure white text (ivory on terracotta is 4.49:1, just under AA).
