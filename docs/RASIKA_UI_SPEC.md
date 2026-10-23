# Rasika: current UI and functionality spec (for a redesign)

Written 2026-10-23 from the code in `apps/web` (Next.js 15 App Router, React 19, Tailwind v4). Everything below describes what exists in the repo today. Where the code alone could not confirm something, it says **unverified**. Section 14 lists observations (things that look wrong or could be better). They are opinions, not facts about intended behaviour.

Live site: https://rasika-ai.netlify.app

---

## 0. Ready-to-paste prompt for the redesigning LLM

> You are redesigning the UI of **Rasika**, an AI reel editor (Next.js 15 App Router, React 19, Tailwind v4, server actions, Supabase auth). The attached document `RASIKA_UI_SPEC.md` is the source of truth for what exists today. Your job is to make the product look and feel more 3D, more current and more premium **without breaking any behaviour**.
>
> **Hard rules (do not break):**
> 1. **Keep every route** listed in section 2, with the same URL, the same auth gating and the same query parameters (`?next=`, `?sent=`, `?error=`, `?email=`, `?mode=password`, `?style=`, `?source=`, `?kind=`, `?title=`, `?project=`, `?industry=`, `?pack=`). Anchors used by in-page links must still exist: `#main`, `#hero`, `#features`, `#styles`, `#pricing`, `#faq`, `#start`, `#download`, and the help anchors `#first-reel`, `#film-from-a-brief`, `#edit-and-export`, `#buy-reels`.
> 2. **Keep every server action and its call shape.** Form-based actions read `FormData` fields by name, so keep the names exactly (`id`, `pack`, `utr`, `email`, `password`, `next`, `reason`, `userId`, `credits`). Object-based actions (`createEdit`, `createScriptEdit`, `createBriefEdit`, `createPresenterEdit`, `createDraftProject`, `recutEdit`, `exportReel`) take the payloads described in sections 7 and 8: do not rename keys. Keep wrapping browser calls in `safeAction()` so a stale page shows the "reload" message instead of crashing.
> 3. **Keep the data contracts**: the zod schemas in `src/lib/wizard-schema.ts`, the wizard `Draft` saved to `localStorage` (`rasika:wizard:<projectId>`), the upload session store (`rasika:uploads`), the theme key (`rasika-theme`), the window events `rasika:theme` and `rasika:glass`, the SSE stream `/api/projects/[id]/events`, and every `/api/*` route and its JSON.
> 4. **Keep all validation rules and limits** (section 7): step gating, max lengths, 15 photos, 3 style images, 6 AI images, 5 free re-edits, plan length limits, credit checks.
> 5. **Keep accessibility**: the skip link, `id="main"` on each page's main, landmark labels, `role="radiogroup"`/`role="radio"`/`aria-checked` on choice grids, `aria-pressed` on toggles, `aria-current` on steps and tabs, `aria-live` on upload and render progress, `role="alert"` on errors, `role="status"` on notices, visible `:focus-visible` outlines, labelled inputs, keyboard access to the compare slider (its range input), Escape closing dialogs and the menu.
> 6. **Keep reduced-motion behaviour**: with `prefers-reduced-motion: reduce` the page must be the finished page (no hidden start states, no orbit, no word clock, no pointer tilt, no glass specular or tilt). Respect `prefers-reduced-transparency` (glass becomes solid).
> 7. **Performance budget**: Lighthouse mobile performance ≥ 0.9 (warn), accessibility ≥ 0.9 (error), SEO ≥ 0.9 (error), best practices ≥ 0.9 (warn), per `apps/web/lighthouserc.json`. Video never competes with first paint: posters are plain `<img>`, grid `<video>` elements get their `src` only on hover/focus or after load plus intersection, with `preload="none"`. Only the hero phone video plays on load. Fonts stay self-hosted through `next/font/local`, and only Switzer is preloaded.
> 8. **3D and motion**: prefer pure CSS 3D (perspective, `preserve-3d`, transforms) and lightweight libraries. No heavy WebGL or Three.js on mobile unless it is lazy-loaded, optional, off under reduced motion, and has a CSS fallback. The existing liquid-glass layer (`liquid-gl`, WebGL with a CSS backdrop fallback) can stay or be replaced by CSS `backdrop-filter`, but real DOM controls must stay on top and clickable.
> 9. **Brand**: keep the maroon / gold / ivory identity (tokens in section 1.3) unless told otherwise. Reel previews inside `[data-ui]` keep the engine's own colours and faces (Anton, Inter, Tiro Devanagari).
> 10. **Copy**: landing copy lives in `src/content/landing.ts` and components read from it; keep that. Restyle freely, but do not invent features, prices or claims. Prices come from `src/config/pricing.ts`, the style count from `presetCards.length` (107 today), the brief kinds from `src/config/briefs.ts` (16).
>
> **You may**: restyle every component, change layouts, add depth, shadows, gradients, radii, 3D cards, scroll-linked motion and new hover states; reorganise the dashboard and wizard visually; fix the observations in section 14. When you change a component, keep its props, its exported names and its client/server status (or say why you changed it), because other files import them.
>
> **Deliver** per-file changes (full file contents), list any new dependency with its exact version and size, and say how reduced motion and a 360 px phone width behave for each new effect.

---

## 1. Tech constraints for UI work

### 1.1 Stack

| Thing | Value |
|---|---|
| Framework | Next.js 15.5.28, App Router, `output: "standalone"`, React 19.1, `reactStrictMode`, `poweredByHeader: false` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css`, `shadcn/tailwind.css` import. A shadcn `components.json` exists, but no `components/ui` folder is used. |
| Icons | `lucide-react` 0.475 (tree-shaken via `optimizePackageImports`) |
| Other UI libs | `liquid-gl` 3.0.0 (glass), `react-easy-crop` (photo crop), `qrcode` (UPI QR, server side). `framer-motion` 12 and `@base-ui/react` are installed, but no import was found in `src` (unverified that they are unused at runtime). |
| Auth | Supabase (`@supabase/ssr`); `src/middleware.ts` refreshes the session cookie |
| Data | Drizzle ORM on Postgres; jobs are queued in Redis for a Python worker |
| Server actions | body size limit 2 MB |
| Browsers | Chrome/Edge ≥ 109, Firefox ≥ 115, Safari/iOS ≥ 16.4 (`browserslist`) |
| Hosting | Netlify (`@netlify/plugin-nextjs`). `/demo/*` is served with `Cache-Control: public, max-age=31536000, immutable`. |

### 1.2 How styling works

- `src/app/globals.css` imports Tailwind, `tw-animate-css`, shadcn's CSS and `./components.css`. It defines every token in `@theme inline`, so utilities such as `bg-bg`, `bg-surface`, `bg-raised`, `text-text`, `text-muted`, `text-accent`, `text-accent-ink`, `bg-field`, `text-muted-foreground`, `text-destructive` exist. It also holds the base layer and the layout, type, button, input and motion classes.
- `src/app/components.css` holds the page component classes: hero chips, compare slider, tiles, segmented control, plans table, status pills, glass, FAQ tiles, closing dialog, field input.
- `src/components/landing/hero3d.css` holds the 3D hero and the films rail; `hero.tsx` imports it.
- Dark mode is a custom variant: `@custom-variant dark (&:is([data-theme="dark"] *));`.
- Every Tailwind radius token is `0px` (`--radius-sm` to `--radius-4xl`, and `--radius: 0`). The house direction is square. The app screens, though, use many explicit radii (`rounded-[8px]` cards, `rounded-[6px]` chips, `rounded-full` pills, `rounded-[18px]` glass bars, `rounded-[20px]` tab bar, `rounded-[22px]` login panel). In practice the landing is square and the app is softly rounded.
- The direction written in the CSS comments is "flat surfaces told apart by a tone step, no gradients, no shadows at rest, no hairlines". The 3D hero is the deliberate exception (gradients, glows, shadows, grain).

### 1.3 Design tokens (exact names and values)

**Brand palette** (`:root`, the same in both themes; these are also the reel engine's colour names)

| Token | Value | Role |
|---|---|---|
| `--stage` | `#3a0a11` | deep maroon stage: hero background, `theme-color` |
| `--mar` | `#5a0f1a` | maroon |
| `--ter` | `#c8452f` | terracotta: checkbox `accent-color`, some inline error and link text |
| `--gold` | `#e6b450` | gold: lit caption word, hero accents, the "New reel" tab disc |
| `--goldd` | `#9a6a14` | dark gold |
| `--iv` | `#f6ecd8` | ivory: hero text, primary hero CTA |
| `--ink` | `#1a0a0c` | near-black ink |

**Page roles, light theme** (`:root` and `[data-theme="light"]`: "bone ground, oxblood ink")

| Token | Value |
|---|---|
| `--bg` | `#f1f0ec` |
| `--surface` | `#e8e6e0` |
| `--raised` | `#dedbd3` |
| `--text` | `#2b0a10` |
| `--muted-ink` | `#5a4a4d` |
| `--accent` | `#9a6a14` |
| `--accent-strong` | `#7d5610` |
| `--accent-ink` | `#f3f2ee` |
| `--field-1` / `--field-1-ink` / `--field-1-muted` | `#3a0a11` / `#f0efeb` / `#d3c6bc` (the inverted oxblood chapter) |
| `--destructive` | `#a8231b` |
| `--border` | `rgba(43,10,16,0.14)` |
| `--input` | `rgba(43,10,16,0.18)` |
| `--ring` | `var(--accent)` |
| `--popover` | `#f8f7f4` |
| `--chart-1` … `--chart-5` | `#9a6a14`, `#3a0a11`, `#c8452f`, `#6b5a5d`, `#e6b450` |

**Page roles, dark theme** (`[data-theme="dark"]`: "warm near-black, elevation by lightness alone")

| Token | Value |
|---|---|
| `--bg` | `#120406` |
| `--surface` | `#1f0b0e` |
| `--raised` | `#2d1317` |
| `--text` | `#f0ebe4` |
| `--muted-ink` | `#bba99f` |
| `--accent` | `#e6b450` |
| `--accent-strong` | `#f0c76a` |
| `--accent-ink` | `#1a0a0c` |
| `--field-1` / `-ink` / `-muted` | `#f1f0ec` / `#2b0a10` / `#5a4a4d` (the field inverts to bone) |
| `--destructive` | `#ff8a66` |
| `--border` / `--input` | `rgba(240,235,228,0.14)` / `rgba(240,235,228,0.18)` |
| `--popover` | `var(--raised)` |

The shadcn names (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent-foreground`, `--sidebar-*`) all map onto the role tokens above.

**Type scale** (`:root`)

| Token | Value | Used by |
|---|---|---|
| `--step-small` | `clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)` | `.small`, `text-small` |
| `--step-body` | `clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)` | body, buttons |
| `--step-lead` | `clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)` | `.lead` |
| `--step-head` | `clamp(2rem, 1.3rem + 3.2vw, 4rem)` | `.head` (section titles) |
| `--step-display` | `clamp(3.5rem, 1rem + 7.5vw, 8.5rem)` | `.display` (the hero overrides it inline with `clamp(2.6rem, 7.4vw, 6.2rem)`) |
| `--step-closing` | `clamp(2.5rem, 1.2rem + 4.4vw, 4.5rem)` | closing CTA headline |

**Spacing**: `--margin: clamp(1rem, 2.2vw, 2rem)` (page side margin), `--gutter: clamp(0.75rem, 1.4vw, 1.5rem)`, `--section-gap: clamp(4rem, 2.5rem + 4.5vw, 7.5rem)`.

**Motion tokens**: `--t-press: 140ms`, `--t-hover: 180ms`, `--t-ui: 240ms`, `--t-reveal: 800ms`, `--stagger-line: 90ms`, `--stagger-item: 70ms`. Easings (in `@theme`): `--ease-out: cubic-bezier(0.22,1,0.36,1)`, `--ease-expo: cubic-bezier(0.16,1,0.3,1)`, `--ease-in-out: cubic-bezier(0.76,0,0.24,1)`, `--ease-soft: cubic-bezier(0.33,1,0.68,1)`, `--ease-exit: cubic-bezier(0.55,0.055,0.675,0.19)`.

**Base layer**: body uses `--step-body`, line-height 1.5, letter-spacing −0.005em, `overflow-x: clip`, antialiased. h1–h4 are weight 600, letter-spacing −0.03em, line-height 0.98, `text-wrap: balance`. `p` has `text-wrap: pretty`. `::selection` is accent on accent-ink. `:focus-visible` is a 2px solid accent outline with a 2px offset. `scroll-behavior: smooth` (auto under reduced motion).

### 1.4 Fonts and how they load

All are self-hosted with `next/font/local` in `src/app/layout.tsx` (files in `src/fonts/`), all `display: swap`:

| CSS variable | Font | Weights | Preloaded | Use |
|---|---|---|---|---|
| `--font-switzer` | Switzer | 400, 500, 600 | yes | the whole site and app (`--font-sans`, `--font-display`, `--font-heading`) |
| `--font-inter` | Inter | 400, 600, 800 | no | reel captions inside `[data-ui]` (`--font-reel-text`) |
| `--font-anton` | Anton | 400 | no | reel poster type inside `[data-ui]` (`--font-reel`) |
| `--font-tiro` | Tiro Devanagari Hindi | 400 | no; `unicode-range U+0900-097F, U+A8E0-A8FF` | Devanagari (`--font-devanagari`) |

`src/config/brand.ts` also lists "Instrument Serif" as an accent face, but the web app does not load it (unverified whether the render engine does).

### 1.5 Light/dark theme mechanism

- An inline script in `<head>` (`src/app/layout.tsx`) runs before paint. It adds class `js` to `<html>` and reads `localStorage['rasika-theme']`. If no valid value is saved, the default is **dark for any path starting with `/dashboard`** and **light everywhere else**. It sets `data-theme` on `<html>`; on any error it sets light.
- `<html>` is rendered with `data-theme="light"` and `suppressHydrationWarning`.
- `ThemeToggle` (`src/components/theme-toggle.tsx`, client) flips `data-theme`, saves `rasika-theme`, and dispatches a `rasika:theme` window event so the glass re-tints. It is a 44px round icon button: Moon on light (`aria-label="Switch to the dark theme"`), Sun on dark; `aria-pressed` is true in dark.
- `/admin` uses the dashboard shell, but its path does not start with `/dashboard`, so it defaults to light unless a theme was saved.

### 1.6 Utility and component classes

| Class | What it does |
|---|---|
| `.wrap`, `.container-x` | full width, `padding-inline: var(--margin)` |
| `.grid12` | 12-column grid with `column-gap: var(--gutter)` |
| `.section` / `.section-tight` | vertical padding of `--section-gap` / 60% of it |
| `.display`, `.head`, `.lead`, `.small`, `.measure` (max 62ch) | type styles |
| `.lines .line` with `[data-line]` | line-mask headline reveal (1.7) |
| `.button` (legacy aliases `.btn-ter`, `.btn-outline-gold`) | flat 48px button, `--text` fill on `--bg` ink, square, 0.97 press scale, hover (fine pointers only) turns accent; disabled = 50% opacity |
| `.button-accent` | accent fill; hover `--accent-strong` |
| `.button-ghost` (and `.btn-outline-gold`) | surface fill; hover raised |
| `.button-field` | inverted button for the highlighted pricing card |
| `.link` | underline fades in on hover (fine pointers) |
| `.input` | 48px, surface fill, no border, square, accent focus outline; `textarea.input` grows; `select.input` has no native arrow |
| `.icon-btn` | 40px muted icon button |
| `.panel`, `.panel-raised` | surface / raised background |
| `.field` | inverted chapter: oxblood ground, ivory ink; locally re-maps `--text`, `--muted-ink`, `--surface`, `--raised` |
| `.tile` (+ `.is-active`) | style or film tile: surface, raised on hover/focus; active = ink fill with bg-coloured text |
| `.seg`, `.seg-4` | segmented control (2px gaps, 6px radius); the `aria-pressed="true"` button is ink-filled; `.seg-4` is 2×2 below 640px, 4 across above |
| `.chip`, `.chip-range`, `.chip-switch` | glass chips and a custom range slider (`.chip-range` is used under the Examples compare plate; `.chip` and `.chip-switch` are left over from an earlier hero) |
| `.compare-handle`, `.compare-knob`, `.compare-tag` | parts of the before/after slider |
| `.plans`, `.is-rec`, `.is-rec-block` | pricing table and cards; the recommended item gets the accent background |
| `.app-bar` | bg with a 1px bottom border (defined; no usage found) |
| `.label` | 14px, weight 500, muted, block, 8px bottom margin; sits above fields |
| `.pill`, `.pill-neutral`, `.pill-active`, `.pill-positive`, `.pill-negative` | 22px status pills with dark-theme variants (`#dcfae5/#04250e`, `#ffedea/#831c1e`; dark `#172a1d/#3fc07a`, `#2a1716/#ff8a66`) |
| `.faq-tile` | `<details>` tile; open = accent fill; the plus icon turns into a minus |
| `.dialog`, `.field-input` | the closing CTA's glass form (20px radius) and its 44px, 6px-radius inputs |
| `.say` | typed-headline input style (defined; no current usage) |
| `.reel-poster`, `.reel-caption`, `.arch` | reel fragment typography (inside `[data-ui]`) |
| `.hero3d-*`, `.films-rail` | section 3.2 and 3.4 |

### 1.7 The reveal and load-motion system

Start states apply only when `<html>` has class `js` **and** the user allows motion (`prefers-reduced-motion: no-preference`). The content is always in the server HTML, so a no-JS or reduced-motion visitor sees the finished page.

- `[data-load]`: starts at `opacity: 0; translateY(12px)` and plays `load-rise` (500ms, `--ease-out`) after `var(--d, 420ms)`. Each element sets `--d` inline.
- `.lines [data-line]`: each line starts at `translateY(105%)` inside an `overflow: hidden` `.line` and plays `line-up` (900ms, `--ease-expo`) after `var(--i) * 110ms + 150ms`.
- `[data-reveal]`: starts at `opacity: 0; translateY(24px)`; adding `.is-in` transitions it in (700ms opacity, 900ms transform, delay `--i × --stagger-item`). `src/components/motion/reveal.tsx` adds `.is-in` once, when the element passes 88% of the viewport (one shared IntersectionObserver, `rootMargin: 0px 0px -12% 0px`). Under reduced motion it adds `.is-in` straight away.
- `.shutter` (with `[data-reveal]`): `clip-path: inset(0 0 100% 0)` opens to `inset(0)` in 1100ms `--ease-in-out`. Used on the Features compare plate.
- A global reduced-motion rule forces every animation and transition to 0.01ms and one iteration.

### 1.8 Liquid glass (`data-glass`)

`src/components/motion/liquid-glass.tsx` (client, renders nothing) is mounted on the landing page, the dashboard shell (so also `/admin`) and the login page. After `window.load`, `document.fonts.ready` and a settle delay (1300ms, or 0 under reduced motion) it dynamically imports `liquid-gl` and turns every `[data-glass="<kind>"]` element into a refracting pane. The pane is drawn on a canvas **under** the element, so the real controls stay on top (`content: false`; CSS gives children `pointer-events: auto`). It rebuilds on every route change and cleans up on unmount.

| Attribute | Meaning |
|---|---|
| `data-glass="bar"` | floating nav, app bar, phone tab bar. z-index 60, dark glass `rgba(28,7,11,0.62)`, 18px radius, ivory ink `#f3efe9` |
| `data-glass="chip"` | z 12 (no current usage) |
| `data-glass="knob"` | the compare-slider lens: magnify 1.35, z 14, no pointer events |
| `data-glass="tag"` | compare labels, z 13, `rgba(12,12,12,0.45)` |
| `data-glass="panel"` | large frosted panes (closing dialog, login panel, wizard action bar), z 20. Tint bone `rgba(241,240,236,0.8)` on light, `rgba(26,8,11,0.7)` on dark |
| `data-glass-snapshot="#id"` | refract only that region (sharper, cheaper) |
| `data-glass-tint="rgba(…)"` | a custom dye |
| `data-glass-shadow="false"` | no drop shadow (pane sits in the flow) |
| `data-liquid-ignore` | left out of snapshots (set on every glass pane, and on the phone menu sheet) |

Fallback before the library runs, or without WebGL: `background: var(--glass-tint, rgba(18,4,6,0.42)); backdrop-filter: blur(14px) saturate(1.35)`. Under `prefers-reduced-transparency: reduce` the glass is solid `var(--glass-solid, #2b0a10)`. Under reduced motion there is no fade-in, no specular, no tilt and no interaction. Events: `rasika:glass` (re-snapshot; an optional selector in `event.detail` scopes it) and `rasika:theme` (re-tint). Helper: `refreshGlass(scope?)`.

### 1.9 `[data-ui]`

Marks a "product fragment": the compare plates, the closing dialog, the reel fragments. Inside it the product's own conventions apply (small radii, filled controls, reel fonts). It is a convention plus a few selectors, not a component.

### 1.10 Client vs server components

- **Server** (no `"use client"`): every `page.tsx` and `layout.tsx`; `landing/pricing.tsx`, `landing/faq.tsx`, `landing/footer.tsx`; `brand/wordmark.tsx`, `brand/reel-fragment.tsx`; `dashboard/project-card.tsx` (server-action forms; renders the client `StatusPill`); `dashboard/try-gallery.tsx` (reads the filesystem with `existsSync`, so it must stay on the server); `dashboard/transcript-panel.tsx`.
- **Client**: `landing/nav.tsx`, `landing/hero.tsx`, `landing/features.tsx`, `landing/style-showcase.tsx`, `landing/brief-films.tsx`, `landing/final-cta.tsx`; `theme-toggle.tsx`, `style-filter.tsx`; `motion/reveal.tsx`, `motion/liquid-glass.tsx`; `brand/demo-video.tsx`; every file in `wizard/`; `dashboard/mobile-tabs.tsx`, `dashboard/status-pill.tsx`, `dashboard/progress-view.tsx`, `dashboard/edit-room.tsx`, `dashboard/export-shapes.tsx`; `app/error.tsx`; `dev/engine-dev.tsx`.
- Pages that read the session or the database are `dynamic = "force-dynamic"` (dashboard, new, project, credits, order, admin, dev engine).

### 1.11 Performance notes (as built)

- Only Switzer is preloaded; the reel faces load on demand.
- Grid and rail tiles show a lazy `<img>` poster. Their `<video>` has no `src` until hover or focus, with `preload="none"`.
- `DemoVideo` (Features plate, closing CTA) waits for `window.load`, then sets `src` when the element comes within 200px of the viewport.
- The Examples compare plate uses `preload="none"` and plays or pauses with an IntersectionObserver (threshold 0.3); the raw clip is re-synced to the styled clip every 250ms if they drift more than 0.12s.
- The **hero phone video** is the exception: `autoPlay muted loop playsInline preload="metadata"` with a webp poster, loaded at once. The hero ring's first 6 posters are `loading="eager"`, the rest lazy.
- Demo media: `public/demo` is about 141 MB (200 files in `styles/`: one `.mp4` and one `.jpg` per style plus `raw.mp4/.jpg`; 32 files in `briefs/`: 16 kinds × `.mp4` + `.jpg`; plus `before.mp4` 1.4 MB, `after.mp4` 1.6 MB, `after-poster.webp` 16 KB). `public/tutorials` is about 23 MB.

---

## 2. Sitemap and auth gating

`src/middleware.ts` runs on `/dashboard/:path*`, `/admin/:path*`, `/login` and `/api/:path*`. Signed out on `/dashboard*` or `/admin*` → redirect to `/login?next=<path+query>`. Signed in on `/login` → redirect to `next` (if it starts with `/` and not `//`) or `/dashboard`. Pages also call `requireUser()` (redirects to `/login?next=…`, and creates a profile with the free plan and 1 credit on first visit, emailing the admins). API routes return `401 {"error":"Not signed in"}` via `requireApiUser()`.

| Route | File | Who | What |
|---|---|---|---|
| `/` | `app/page.tsx` | everyone | landing (section 3). Emits SoftwareApplication JSON-LD with the paid packs as offers. |
| `/login` | `app/login/page.tsx` | signed out (signed-in users are redirected) | sign in / sign up (section 5) |
| `/auth/callback` | `app/auth/callback/route.ts` | anyone (route handler) | Supabase magic-link / confirmation / OAuth return; redirects to `next`, or to `/login?sent=confirmed` or `/login?error=…` |
| `/help` | `app/(legal)/help/page.tsx` | everyone | four tutorial videos (section 10). Uses the legal layout, not the app shell. |
| `/terms` | `app/(legal)/terms/page.tsx` | everyone | Terms (marked as a draft for legal review) |
| `/privacy` | `app/(legal)/privacy/page.tsx` | everyone | Privacy Policy (marked "Draft, for legal review.") |
| `/dashboard` | `app/dashboard/page.tsx` | signed in | project grid, empty state, "Try something new" gallery |
| `/dashboard/new` | `app/dashboard/new/page.tsx` | signed in | the wizard; query `style`, `project`, `industry`, `source`, `title`, `kind`. With 0 credits and no `project`, shows a "used your free reel" panel instead. |
| `/dashboard/p/[id]` | `app/dashboard/p/[id]/page.tsx` | signed in owner (404 otherwise) | progress, edit room, export, sidebar. `#download` anchors the Export section. |
| `/dashboard/credits` | `app/dashboard/credits/page.tsx` | signed in | balance, packs, orders; `?pack=` highlights a pack |
| `/dashboard/credits/[id]` | `app/dashboard/credits/[id]/page.tsx` | signed in owner (404 otherwise) | one UPI order: QR, UTR form, status; `?error=` shows a UTR error |
| `/admin` | `app/admin/page.tsx` (layout reuses the dashboard shell) | signed in with an email in `ADMIN_EMAILS`, otherwise 404 | stats, payments to confirm, sign-ups, credit grants |
| `/admin/signups.csv` | `app/admin/signups.csv/route.ts` | admin | CSV download of sign-ups |
| `/dev/engine` | `app/dev/engine/page.tsx` | signed in (not gated by middleware, but `requireUser` redirects) | developer player for edit plans; `?project=<id>` loads your upload. Linked from each project's Export section. |
| `/api/uploads/create` | POST | signed in | start a multipart video upload (413 too large, 415 not a video, 404 project) |
| `/api/uploads/[assetId]` | GET, POST | signed in | upload session status / part URLs / complete (410 session expired, 409 conflicts) |
| `/api/uploads/image` | POST, DELETE | signed in | small image/thumbnail/presenter upload, and delete a photo (413, 415, 409 "Up to 15 photos per reel") |
| `/api/images/generate` | POST, GET | signed in | start and poll an AI image (503 when not set up, 409 at 6 AI images or 15 photos) |
| `/api/images/suggest` | POST | signed in | draft picture prompts from a script |
| `/api/briefs/ideas` | POST | signed in | Claude writes three briefs for a kind (503 when not set up) |
| `/api/projects/[id]/events` | GET (SSE) | signed in owner | job status stream, about 20 s per connection, then the client reconnects |
| `/robots.txt`, `/sitemap.xml` | `robots.ts`, `sitemap.ts` | everyone | robots disallows `/dashboard`, `/login`, `/api`; the sitemap lists `/`, `/terms`, `/privacy` |
| `/icon`, `/opengraph-image` | `icon.tsx`, `opengraph-image.tsx` | everyone | generated favicon (a gold-bordered terracotta arch on maroon) and OG image |
| any unknown path | `app/not-found.tsx` | everyone | 404 page (section 11) |
| runtime errors | `app/error.tsx` | everyone | "Something needs a reload" (section 11) |

Server actions (all in `"use server"` files):

| Action | File | Called with |
|---|---|---|
| `sendMagicLink`, `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, `signOut` | `app/login/actions.ts` | form fields `email`, `password`, `next` |
| `createEdit`, `createScriptEdit`, `createBriefEdit`, `createPresenterEdit`, `createDraftProject(title)` | `app/dashboard/actions.ts` | objects (section 7) |
| `deleteProject`, `duplicateProject`, `retryEdit` | `app/dashboard/actions.ts` | form field `id` |
| `recutEdit`, `exportReel` | `app/dashboard/actions.ts` | objects (section 8) |
| `buyPack`, `submitUtr` | `app/dashboard/credits/actions.ts` | form fields `pack`; `id`, `utr` |
| `approvePayment`, `rejectPayment`, `grantCredits` | `app/admin/actions.ts` | form fields `id`; `id`, `reason`; `userId`, `credits` |

Object actions return `{ ok: true, projectId } | { ok: false, error }`. Form actions redirect.

---

## 3. Landing page (`/`)

Order in `app/page.tsx`: `Nav` → `<main id="main">` [`Hero`, `Features`, `StyleShowcase`, `Pricing`, `Faq`, `FinalCta`] → `Footer` → `LiquidGlass` → JSON-LD. The page is light (bone) by default; the hero is always maroon, and the closing section is the inverted `.field`.

### 3.1 Nav (see also section 4)

Floating glass bar over the hero. Links: **How it works** (`/help`), **Examples** (`#styles`), **Pricing** (`#pricing`), **FAQ** (`#faq`). Action: **Edit a reel free** (`/dashboard`, so signed-out visitors land on `/login?next=/dashboard`).

### 3.2 Hero (`components/landing/hero.tsx` + `hero3d.css`, client) — `#hero`

**Purpose**: say what Rasika does and show real output at once.

**Copy (exact)**
- Kicker pill: a pulsing gold dot + "AI reel editor · English & हिन्दी"
- H1 (two authored lines): "Talk to your phone." / "Post like a studio."
- Sub: "Realtors, doctors, coaches, founders — upload one talking video. Rasika writes the titles, times every caption, lands your photos on the exact word, adds sound, and renders the reel. Minutes, not days."
- Primary CTA: "Make my free reel →" → `/dashboard/new`
- Ghost CTA: "▶ Watch the 2-minute tour" → `/help`
- Trust line: "Any industry · English + Hindi · 1080 × 1920 · No timeline, ever"
- Phone badge under the phone: "RENDERED BY RASIKA" (uppercase, letter-spaced)

**Layout**: full-bleed maroon section (`background: var(--stage)`, `min-height: 100svh`, top padding 104px so it starts under the floating nav). Centred column: kicker, H1 (max 14ch, ivory, `clamp(2.6rem, 7.4vw, 6.2rem)`, line-height 0.96, letter-spacing −0.045em), sub (max 58ch, ivory at 78%), the two CTAs (wrap and centre), trust line (13px, ivory at 60%). Under it, the 3D stage.

**The 3D stage (pure CSS)**:
- `.hero3d-stage`: `perspective: 1150px` (800px on phones), `perspective-origin: 50% 30%`, height `phone-w × 2.17 + 90px`, horizontal mask that fades both edges (transparent → black at 14% / 86%), `pointer-events: none`, `aria-hidden`.
- `.hero3d-tilt`: `preserve-3d`, `transform: rotateX(calc(-5deg + var(--tilt-x))) rotateY(var(--tilt-y))`, eased by a 900ms `--ease-expo` transition.
- `.hero3d-ring`: a ring of 16 poster cards (`--n: 16`). Each card is `rotateY(i × 360°/n) translateZ(--R) rotateY(180deg)` with `backface-visibility: hidden`, so only the far half of the ring faces the viewer and the wall always sits behind the phone. Cards are 9:16, 14px radius, a thin gold ring shadow, a light-to-maroon gradient overlay, the image slightly desaturated and darkened. The ring is pushed back `translateZ(-0.18 × R)` and orbits once every **90s** (`hero3d-orbit`, linear, infinite).
- Wall images, in order (`/demo/<id>.jpg`): `styles/launch-spotlight`, `briefs/versus`, `styles/mikku-royal`, `briefs/recipe`, `styles/katana-pop`, `briefs/explainer`, `styles/vox-paper`, `briefs/launch`, `styles/neon-pop`, `briefs/journey`, `styles/tabloid-headline`, `briefs/tierlist`, `styles/cinema-bebas`, `briefs/editorial`, `styles/comic-pop`, `briefs/product`.
- `.hero3d-phone`: a phone (aspect 9:19.5, radius 15% of its width, a maroon-to-black gradient bezel, gold hairline, deep shadow and a gold glow) at `translateZ(140px)`, with a notch. It plays `/demo/after.mp4` (poster `/demo/after-poster.webp`), muted, looping, autoplay.
- `.hero3d-floor`: a blurred gold radial "floor" glow below.
- Background: `.hero3d-glow` (radial gold and terracotta glows over a vertical maroon gradient, drifting every 18s, alternate) and `.hero3d-grain` (SVG fractal-noise grain at 9%, overlay blend).
- Size variables: desktop `--R: 560px`, `--card-w: 190px`, `--phone-w: 236px`; ≤1023px `430 / 150 / 200`; ≤639px `300 / 104 / 168`.

**Interactions and animation**:
- **Caption word clock**: after 1.3s, one word of the headline lights every 400ms (about 150 words a minute): class `is-lit` turns it gold, lifts it 0.04em, scales it 1.03 and adds a gold text-shadow. After the last word it waits 3 beats, then a few blank beats, then starts again. Off under reduced motion.
- **Pointer tilt**: on fine pointers only, `pointermove` (rAF-throttled) sets `--tilt-x` = −y×6° and `--tilt-y` = x×10° from the pointer's position in the window. Off on coarse pointers and under reduced motion.
- **Load sequence**: kicker (`--d: 60ms`), H1 lines (line-up), sub (380ms), CTAs (460ms), trust line (520ms); the stage rises in (`hero3d-in`, 1400ms, delay 380ms, from `translateY(40px) scale(0.96)`).
- **Hover**: primary CTA lifts 2px with a bigger gold shadow and its arrow slides 4px; ghost CTA brightens its border and fill.
- Reduced motion: no orbit, no pulse, no drift, no stage entrance, no word clock, no tilt. The phone video still autoplays.

**Must preserve**: the two links and their targets, the H1 as real text in an `<h1>`, the trust facts, `aria-hidden` on the decorative stage, the poster-first loading.

### 3.3 Features: "What the edit does" (`components/landing/features.tsx`, client) — `#features`

**Purpose**: the real before/after, with eight margin notes that name what the edit does.

**Copy**
- H2: "What the edit does". Sub: "Everything a motion designer would do by hand."
- Beside it: "Drag the handle. The raw phone clip is on the left, the Rasika edit on the right — playing in sync."
- Notes (title — body):
  1. Poster typography — "Your key line as big poster type on the wall above your head — never over your face. Always a complete thought, never a fragment."
  2. One-word captions — "Every word pops in on time. Feelings turn gold; names, numbers and places turn terracotta."
  3. Photos on the exact word — "Say “balcony”, the balcony lands. Your photos fly in as tilted cards on the word that names them."
  4. Punch-in on the thing — "A zoom on what you are holding or pointing at, with a ring drawing around it."
  5. Picture-in-picture plates — "Full-bleed photos behind you for “look at this” moments, with labels that read."
  6. Numbers, chapters, reveals — "Prices roll in as counters. “First, second, third” become chapter cards. A teased word gets revealed at the payoff with a riser and an impact."
  7. Sound design — "Whooshes, pops, ticks and subs placed on the beat sheet, mixed under your voice. Nothing to license."
  8. English, Hindi, Hinglish — "We detect the language and verify it. Hindi words appear on screen in Devanagari — never romanised."
- Caption under the plate: "Real footage from a small jewellery brand. Yours might be a listing, a clinic, a classroom or a kitchen — the craft is the same."
- Plate tags: "Raw clip" (left), "Rasika edit" (right).

**Layout**: `.grid12`. Desktop (lg): title block in columns 1–4 (right-aligned), helper text in 5–9; below, notes 1–4 in a 4-column left rail (absolutely placed, 168px apart, right-aligned, min-height 676px), the 9:16 plate in the middle 4 columns (max 380px), notes 5–8 in the right rail. Tablet/phone: plate first, then the notes as a 1- or 2-column grid (`sm:grid-cols-2`).

**Interactions**:
- Compare plate: `/demo/before.mp4` (poster `/demo/styles/raw.jpg`) under `/demo/after.mp4` (poster `/demo/after-poster.webp`), the edit clipped with `clip-path: inset(0 0 0 pos%)`; the handle is a 3px ivory line with a 60px glass lens knob. Pointer down/drag sets the position (pointer capture, `touch-none`). A hidden `<input type="range" id="ba-slider">` (visible on keyboard focus) controls it, labelled "Comparison position", `aria-valuetext="N percent edited"`. Videos re-sync every 250ms.
- Hovering or focusing a note (each is `tabIndex=0`) pulls the handle to 100% so the whole edit shows, and dims the other notes to 40%.
- The plate is a `Reveal kind="shutter"` (clip wipe on scroll).
- Both videos use `DemoVideo` (start after load + in view).

### 3.4 Examples (`components/landing/style-showcase.tsx` + `brief-films.tsx`, client) — `#styles`

**Purpose**: show the style range on the same take, and the films made with no footage.

**Copy**
- Label: "Examples". H2: "Same take. Different reel. Or no take at all."
- Sub: "Every clip here is real Rasika output. Pick a look to see it over the raw phone video, or scroll the films made from nothing but a brief."
- Label over the tiles: "From your video · 107 styles, here are four"
- Button: "See all 107 styles when you make a reel" → `/dashboard/new`
- Second block label: "No video at all". H3: "Films from a brief". Sub: "Give a website, a recipe, two contenders or a single line. Rasika writes, scores and designs the whole film."
- Hint: "Hover to play · Scroll for more →" ("Hover to play" only from md).

**Part A, the style compare** (desktop: plate sticky in columns 1–4, tiles in 6–12; phone: stacked):
- Four tiles: Launch spotlight (`launch-spotlight`), Mikku royal (`mikku-royal`), Katana pop (`katana-pop`), Vox paper (`vox-paper`); the display names come from the preset tokens. Each tile is a `.tile` button with a 9:16 poster, the style name and "<family label> · <badge>". `aria-pressed` marks the active one (ink fill). Hover/focus attaches the video src and plays it (fades in); leaving pauses and rewinds. Click makes it the active style. Grid: 2 columns on phones, 4 from `sm`.
- Compare plate (`#style-frame`, max 380px): the raw clip (`/demo/styles/raw.mp4`) under the chosen style's demo (`demoSrc(id)`), handle at 58% to start, draggable, a glass knob and tags "Raw" / "<style name>". Below: a **Pause/Play** link-button (`aria-pressed`), a `.chip-range` slider ("Reveal the styled version"), the style's name and tagline, and an accent button **Use this style** → `/dashboard/new?style=<id>`. Changing the style reloads the clip and restarts both from 0. Plays only while 30% visible.

**Part B, the films rail**: a `<ul class="films-rail">` of all 16 brief kinds, horizontally scrolling with `scroll-snap-type: x mandatory`, columns `clamp(150px, 19vw, 230px)`, bleeding to the screen edges (negative margin = `--margin`). Each `FilmTile` is a link to `/dashboard/new?source=brief&kind=<id>` with a 9:16 poster (`/demo/briefs/<id>.jpg`), hover/focus video (`/demo/briefs/<id>.mp4`), the kind's title and "You give: …". Tile titles: SaaS launch film, 15-second motion showreel, Apple-style app film, Recipe explainer, Versus: a comic fight, Music machine, Storybook journey, Animated explainer, Editorial explainer, Tier list, Animate anything, Product film, Referral promo, Hype launch, Landing-page fly-over, Diagram explainer.

`BriefFilms` (a standalone `#films` section with the same tiles in a grid) still exists in `brief-films.tsx` but is not rendered; only `FilmTile` is used.

### 3.5 Pricing (`components/landing/pricing.tsx`, server) — `#pricing`

**Copy**: H2 "Pricing". Sub: "Your first reel is free. After that, buy reels when you need them: no subscription."

Four cards (`md` 2 columns, `lg` 4), from `config/pricing.ts`:

| Card | Price line | Under it | Blurb | Button → |
|---|---|---|---|---|
| First reel | Free | "One per account" | "Free when you sign up. Up to 60 s." | "Make my free reel" → `/dashboard/new` |
| 1 reel | ₹399 | "₹399 a reel · one-off" | "One reel, when you need it." | "Buy 1 reel" → `/dashboard/credits?pack=one` |
| 10 reels (**highlighted**, accent card, `.button-field`) | ₹2,999 | "₹300 a reel · one-off" | "For posting every week." | "Buy 10 reels" → `/dashboard/credits?pack=ten` |
| 30 reels | ₹8,000 | "₹267 a reel · one-off" | "For brands and busy studios." | "Buy 30 reels" → `/dashboard/credits?pack=thirty` |

Name and price are set large (`clamp(1.75rem, 3vw, 2.5rem)`). Non-highlighted cards are `.panel`. Note under the grid (14px): "1 reel = a finished reel up to 90 s (longer ones use 2). Paid reels can run up to 3 minutes, in 1080 × 1920 with no watermark. Pay by UPI from any app; credits are added once we confirm the payment, usually within a few hours, and they never expire."

Credits rule: `creditsForDuration(sec) = max(1, ceil(sec / 90))`. Plans: Free = 60 s max, Paid ("creator") = 180 s max.

### 3.6 FAQ (`components/landing/faq.tsx`, server) — `#faq`

H2 "Questions, answered" (sticky at `top-24` on lg, columns 1–4). Seven `<details name="faq">` tiles in columns 5–12 (same `name`, so one is open at a time; the first starts open). Open tile = accent fill. Emits FAQPage JSON-LD. Questions:
1. Does it work for my industry?
2. Which languages work?
3. How long does it take?
4. Do I need any editing skill?
5. Do you keep my videos?
6. Can I use the reels commercially?
7. What about image rights?

(Answers are in `content/landing.ts` → `faq.items`; keep them verbatim. Note that answer 5 says sources are kept 30 days, while the draft privacy page says projects are kept until you delete them — see section 14.)

### 3.7 Closing CTA "First step, already open" (`components/landing/final-cta.tsx`, client) — `#start`

**Layout**: a full-bleed `.field` (oxblood, ivory ink), `min-height: 90svh`, `.grid12`. Left (md 6 / lg 5 columns): the headline in two lines, "Feel your reel." / "Don't just post it." (`--step-closing`, line-up reveal), then "You sign in, the take uploads, and the first preview is back in about a minute." Right: the finished reel (`DemoVideo`, `/demo/after.mp4`, 18px radius, 70–78% width, max 400px) with a glass form lying over its lower edge (`data-glass="panel"`, snapshot `#start`, tint `rgba(30,8,12,0.55)`, no shadow; absolutely placed at bottom 8% from md, overlapping upward on phones with `-mt-[38%]`).

**Form** (`aria-labelledby="start-title"`):
- Title "Name your reel"; text input `#reel-title` (sr-only label "Reel title"), default "Balcony walkthrough, Tuesday", maxLength 80.
- "Where the reel comes from": `.seg.seg-4` (`role="group" aria-label="Source"`) with **My take**, **Script only**, **Match a reference**, and **AI presenter** (only when the server has a HeyGen key, `presenterEnabled`). Note: no "From a brief" option here.
- Submit: **Edit my first reel** (accent, 52px) → `router.push("/dashboard/new?source=<source>&title=<title>")`.
- Under it: "Your first reel is free. No card needed."

### 3.8 Footer (`components/landing/footer.tsx`, server)

After a large empty gap (`pt-[20svh]`, `lg:pt-[30svh]`), one small line in three parts (stacked on phones, a 3-column baseline grid on lg): "Reels from one phone take · Made in India" | links Contact (`mailto:hello@rasika.app`), Instagram (`https://instagram.com/rasika.app`, new tab), X (`https://x.com/rasika_app`, new tab), Terms (`/terms`) | "© <year> · Privacy" (`/privacy`).

### 3.9 Copy defined but not shown

`content/landing.ts` also exports `howItWorks` (three steps), `showcase` (a type-a-line demo), `beforeAfter.title` ("Same take. Different reel."), `styles.note`/`note2`, and `hero.secondary` ("Watch a real before / after" → `#before-after`, an anchor that no longer exists). These are not rendered today (the landing redesign removed those sections). `pricing.test.ts` imports some of them, so do not delete them without updating the test.

---

## 4. Nav, footer, theme toggle, mobile behaviour

**Landing nav** (`components/landing/nav.tsx`, client):
- `<header class="wrap sticky top-3 z-[60] -mb-[76px] pt-3">`: it floats 12px from the top and takes no room in the flow (negative margin), so the hero starts under it.
- `<nav data-glass="bar" aria-label="Primary">`, 52px tall, 18px radius, dark glass with ivory ink over light and dark pages alike.
- Left: the `Wordmark` ("Rasika", 17px, weight 500, links to `/`, `aria-label="Rasika home"`). Centre (md+): the four `.link` items, 44px tall. Right: theme toggle (md+), "Edit a reel free" (`.link`, medium), and on phones a "Menu" text button (`aria-expanded`, `aria-controls="menu-sheet"`).
- **Phone menu**: a full-screen sheet (`role="dialog" aria-modal="true" aria-label="Menu"`, `data-liquid-ignore`, bg/text tokens): wordmark + "Close", the four links set at `.head` size, a full-width "Edit a reel free" `.button`, then the theme toggle. Escape closes it; body scroll is locked while open; tapping a link closes it. Focus is not trapped or moved into the sheet (unverified beyond reading the code; no focus management exists).

**Dashboard bar**: see section 6. **Legal/help header**: a plain 64px row: wordmark, theme toggle, "Home" link. **Login header**: wordmark only. **404**: wordmark only.

**Theme toggle**: section 1.5. On the landing it is in the bar (md+) and in the phone menu. In the dashboard bar it is always visible. On legal pages it is in the header.

**Footer**: only on the landing (section 3.8).

---

## 5. Auth screens (`/login`, `app/login/page.tsx`, server)

**Layout**: full-height `<main id="main">`. On lg+, the right 62% of the screen plays the finished reel (`/demo/after.mp4`, poster webp, autoplay, muted, loop, `aria-hidden`), `#login-stage`. The form sits in a glass panel (`data-glass="panel"`, snapshot `#main`, no shadow, 22px radius, max 440px, `lg:ml-[20%]`) so on desktop it overlaps the video edge. On phones and tablets there is no video, just the panel. Inputs and buttons here use `rounded-[10px]`.

**Header copy**: H1 "Sign in". Sub: "We email you a link. No password." (magic mode) or "With your email and password." (`?mode=password`).

**Notices** (`role="status"`, surface boxes), driven by `?sent=`:
- `sent=link`: "Check your inbox" / "We sent a magic link to **<email>**. Open it on this device to continue."
- `sent=confirmed`: "Your email is confirmed" / "Sign in below to continue[, with Google or your email]."
- `sent=confirm`: "Confirm your email" / "We sent a confirmation link to **<email>**. After confirming, sign in with your password."

**Errors** (`role="alert"`, destructive text): `?error=email` → "That doesn't look like an email address."; any other `?error=` value is shown decoded (Supabase messages, "Password must be at least 8 characters.", "Google sign-in is unavailable", "Missing auth code").

**Google button**: rendered only when the server env `GOOGLE_SIGNIN === "1"`: a full-width `.button` with the four-colour Google "G" SVG and "Continue with Google" (form → `signInWithGoogle`, hidden `next`), then "or with your email".

**Magic-link mode (default)**: hidden `next`; Email field (`id="email" name="email" type="email" inputMode="email" autoComplete="email" required`, placeholder "you@brand.in", prefilled from `?email=`); "Send magic link" button; link "Use a password instead" → `/login?next=…&mode=password`.

**Password mode**: Email (`name="email"`), Password (`name="password" type="password" autoComplete="current-password" required minLength=8`); a 2-column row: "Sign in" (submit → `signInWithPassword`) and "Create account" (ghost; `formAction={signUpWithPassword}`); link "Use a magic link instead".

**Footer line**: "By continuing you agree to Rasika's Terms and Privacy." with links.

**Behaviour**: `next` is sanitised to a same-site path (default `/dashboard`). Magic link validates the email shape; sign-up enforces 8+ characters and, if Supabase needs confirmation, returns `sent=confirm`. `/auth/callback` exchanges the PKCE code or verifies the OTP token hash. If the link was opened in another browser ("code verifier" error) it sends the user to `/login?sent=confirmed`. Sign out (dashboard bar) → `/`.

---

## 6. Dashboard shell, project grid and cards

### 6.1 Shell (`app/dashboard/layout.tsx`, server; also wraps `/admin`)

- `<div data-app class="min-h-dvh">`. Theme defaults to dark on `/dashboard*`.
- Top bar: `<header class="wrap sticky top-3 z-[60] pt-3">` → `data-glass="bar"`, 52px, 18px radius.
  - Left: Wordmark → `/dashboard`; nav (`aria-label="Dashboard"`, hidden below `sm`): Projects, New edit, Credits, Help, and Admin (admins only).
  - Right: "**N** credit(s)" link → `/dashboard/credits` (title "Credits left: buy more"), the email (lg+, truncated at 200px), the theme toggle, and a "Sign out" button (a form posting to `signOut`).
- `<main id="main" class="wrap py-8 pb-28 sm:py-10">` (the extra bottom padding clears the phone tab bar).
- `MobileTabs` and `LiquidGlass`.

### 6.2 Phone tab bar (`components/dashboard/mobile-tabs.tsx`, client)

Below `sm` only: `<nav aria-label="App">`, fixed 12px from the bottom and sides, `z-[70]`, `padding-bottom: env(safe-area-inset-bottom)`. A `data-glass="bar"` 4-column list with a 20px radius and a drop shadow. Tabs (icon above an 11px label, 56px tall): **Projects** (LayoutGrid; active on `/dashboard` and `/dashboard/p/*`), **New reel** (Plus inside a gold disc `bg-[var(--gold)] text-[var(--ink)]`), **Credits** (Coins), **Help** (CircleHelp). Active tab: `aria-current="page"`, `text-text font-semibold`; others `text-muted`. Help goes to `/help`, which is outside the shell, so the tab bar disappears there.

### 6.3 Projects page (`app/dashboard/page.tsx`, server)

**With projects**: H1 "Projects", sub "N reel(s) · M credit(s) left", a "New edit" `.button` on the right. Grid: 2 columns on phones, 3 on lg, 4 on xl (gap 12px/16px). Then the "Try something new" gallery.

**Empty state**: H1 "No edits yet"; "Upload a talking reel, or paste a script, and the first preview is back in about a minute."; a surface card: "Your first reel is free." / "N credit(s) on the <plan> plan · 1 credit = 1 reel up to 90 s." / buttons "Create your first edit" (→ `/dashboard/new`) and link "Watch how it works (2 min)" (→ `/help`). Then the gallery.

### 6.4 Project card (`components/dashboard/project-card.tsx`, server)

An `<article>` (surface, 8px radius):
- Thumbnail link (aspect 9:12, `#111` background) → `/dashboard/p/<id>`: the presigned thumbnail, or a placeholder (a raised half-pill "speaker" shape). The **status pill** sits top-left.
- Title (`h2`, truncated, linked), meta "<duration> · <style label> · <date en-IN, e.g. 23 Oct 2026>". Duration format: "45 s" or "1:30"; "—" if unknown. Style label: the preset name, or "<name> (from your reference)" / "Matched from your reference" for reference projects.
- Actions row: **Open** (link), **Duplicate** (form, `sm+` only), **Download** (→ `/dashboard/p/<id>#download`), **Delete** (form, `sm+` only, right-aligned, turns destructive on hover). Delete happens instantly, with no confirmation.

**Status pill** (`components/dashboard/status-pill.tsx`, client): labels — draft "Draft", uploaded "Queued", probing "Checking video", transcribing "Transcribing", awaiting_transcript_review "Review transcript", planning "Designing edit", awaiting_plan_review "Ready to preview", rendering_preview "Rendering preview", ready_preview "Preview ready", rendering_final "Rendering", done "Done", failed "Failed", canceled "Canceled". Tone: done/ready_preview/awaiting_plan_review → positive; failed → negative; active statuses (uploaded, probing, transcribing, planning, rendering_preview, rendering_final) → active with a dot and "NN%"; else neutral. While active, each pill opens its own EventSource to `/api/projects/<id>/events` and reconnects 1.5s after each ~20s stream ends.

### 6.5 "Try something new" (`components/dashboard/try-gallery.tsx`, server)

H2 "Try something new", "Every way to make a reel. Each card says what you give and what you get." Then:
1. "Start from footage or a script": 4 cards (sm 2, lg 4 columns) — My video (`?source=take`), Match a reference (`?source=reference`), Script only (`?source=script`), AI presenter (`?source=presenter`; shown even when presenters are off). Each says "You give:" and "You get:".
2. One block per brief group, headed "Films animate anything", "Films from your website", "Films from a topic", "Films fun formats" (the group title lower-cased after "Films"), with its blurb and cards for each kind (poster at 9:10 cropped to the top, title, blurb, "You give:") → `/dashboard/new?source=brief&kind=<id>`.
3. "Looks that need something from you": "Any of the 107 styles works on a talking clip; these work best when you give them a little more." Cards for presets with a how-to (`punchy-fun`, `ai-studio`, `vox-paper`, `cut-paper-vivid`, `paper-cut-red`, `clean-cut-mono`, `tier-list`, `podcast-glow`) showing the poster and the first how-to step → `/dashboard/new?source=take&style=<id>`.

---

## 7. The wizard (`/dashboard/new`)

### 7.1 Entry and server props (`app/dashboard/new/page.tsx`)

`requireUser("/dashboard/new")`. If `credits < 1` and there is no `?project=`, it renders a panel instead of the wizard: "You've used your free reel" / "Buy reels to keep going: 1 for ₹399, 10 for ₹2,999, 30 for ₹8,000. Pay by UPI from any app; no subscription." / button "Buy reels" → `/dashboard/credits`.

Otherwise `<Wizard>` gets: `initialStyle` (`?style`, used only if it matches `^[a-z-]+$`, else the default `mikku-royal`), `initialIndustry` (`?industry`, seeds the style text from an industry hint: real-estate, doctors, coaches, founders, food, fitness, law-finance, agencies), `initialSource` (`?source`: take | script | reference | presenter | brief, default take), `initialTitle` (`?title`, cut to 80 chars), `initialKind` (`?kind`, a brief kind; its example fields are prefilled), `resumeProjectId` (`?project`), `credits`, `maxSeconds` (60 Free / 180 Paid), `planName` ("Free" / "Paid"), `stockEnabled` (Pexels key), `aiImagesEnabled` (Higgsfield keys), `presenterEnabled` (HeyGen key and at least one voice), `voices`, `looks` (HeyGen catalogue).

### 7.2 Paths per source

| Source (`mode`) | Steps (labels) |
|---|---|
| `take` (My video) | Your video → Style → Review & create |
| `reference` (Match a reel) | Your video → Edit options → Review & create (the reference clip uploads on the first step) |
| `script` (A script) | Your script → Style → Review & create |
| `presenter` (AI presenter) | Presenter → Style → Review & create |
| `brief` (From a brief) | Your brief → Review & create (each brief kind has its own look, so no style step) |

Photos and brand details are not steps: they are on the Review step (photos as an optional fold-out). The code still has `source` and `photos` step ids and their components, but no path uses them (section 14).

### 7.3 Frame and step indicator

`max-w-3xl` centred column:
- Small muted line: "New edit · step X of N".
- H1 (1.75rem): the current step's label.
- `<ol aria-label="Steps">` of step chips (36px, 6px radius): current = ink fill, bold, `aria-current="step"`; done = surface (clickable, goes back); ahead = surface + muted, `disabled` when the current step is not complete. Clicking only ever goes back or stays (forward chips never advance).
- **Source switch** (only on step index 0, above the step's content): `SourceSwitch`, a row of 40px round chips (`role="radiogroup" aria-label="Where the reel comes from"`, each `role="radio" aria-checked`), with an icon and a short label: My video (Clapperboard), A script (FileText), Match a reel (ScanSearch), From a brief (Sparkles), AI presenter (UserRound; disabled and 50% opacity when presenters are off, title "Needs an avatar provider"). Active = ink fill. Under the chips, the chosen source's one-line blurb:
  - take: "Upload a talking-head clip. We time every word and design the edit around you."
  - script: "No footage. Paste a script; a voice narrates it and the engine draws the whole film."
  - reference: "Upload your take and a reel you love. We measure its pacing, camera and look, then cut yours the same way."
  - brief: "No footage at all. Give a website, a recipe, two contenders or a line, and we write, score and design the film."
  - presenter: "A script and one photo become a presenter video."
  Changing the source resets to step 0 (other entered data stays in the draft).

### 7.4 Step "Your video" (`components/wizard/step-upload.tsx`)

**Idle**: a `<label for="reel">` drop zone (min 256px tall, surface, 2px dashed border, 8px radius; drag-over = raised + ink border): Upload icon, "Drop your reel here", "or tap to choose · MP4, MOV, HEVC · up to {maxSeconds} s on {planName}", "Uploads resume automatically if your connection drops." Hidden `<input type="file" id="reel" accept="video/*,.mp4,.mov,.m4v,.hevc" class="sr-only">`. Wrong type → "Please choose an MP4, MOV or HEVC video." (`role="alert"`).

**Flow and states** (`aria-live="polite"` area):
1. `probing` — "Reading the file…": the browser reads duration, width, height and grabs a thumbnail. If the clip is longer than the plan allows, it shows "This clip is N s. Your {plan} plan allows up to {max} s." but still uploads (Continue stays disabled).
2. `openSession` — resumes a matching session from `localStorage['rasika:uploads']` (fingerprint = name|size|lastModified, prefixed `ref:` for references) or starts a new multipart upload via `/api/uploads/create`. Parts are 8 MiB (minimum 5 MiB, doubled if over 10,000 parts).
3. `uploading` — a 8px progress bar (accent fill on raised track) and "Uploading NN% · X MB of Y MB · Z MB/s · part a of b". Button **Pause** (aborts, state `paused`: "Paused").
4. `paused` / `error` — button **Resume** (re-runs with the same file, resuming parts).
5. `finishing` — "Finishing…"; the thumbnail is uploaded as a separate small asset (not for references).
6. `done` — "Uploaded" (accent, bold).
Always: **Choose another** (aborts and deletes the session, back to idle). The card shows the thumbnail (9:16, 96px/128px wide), filename, "size · N s · W×H". Server limits: 600 MB by default (`MAX_UPLOAD_MB`), 413 if too large, 410 "Upload session expired; start again".

On first upload, the wizard sets the project title to the filename without its extension (if no title yet).

**Reference mode** adds, under the first upload: label "The reference" and either "Upload your own take first; the reference attaches to it." or, once the take is uploaded, "Now the reel whose style you want. We measure its cuts, camera moves, colours, type and captions, write a style from them, and edit your take to match it. No preset to pick." plus a second drop zone (`id="reference-reel"`): "Drop the reel you want to match" / "or tap to choose · MP4, MOV · up to 3 min · we measure it, we never reuse it". Max 180 s.

**Gate**: Continue needs the upload complete, not too long, and (reference mode) the reference complete.

### 7.5 Step "Your script" (`components/wizard/step-script.tsx`)

- "Write it the way you would say it. One paragraph per idea — each paragraph becomes a beat."
- Label "Script" with a live counter "N words · about S s spoken" (estimate: words/150 per minute + 0.45 s per extra paragraph + 0.6 s). Textarea `#script-text`, min-height 256px, maxLength 6000, placeholder "Most people buy jewellery for the wrong reason.\n\nThey buy the shine. The shine is gone in a month…", `aria-invalid` when too long. Help: "Numbers are read as digits; write “twenty twenty-six” if you want it spoken as a year. English only for now — the narration voices do not speak Hindi yet." Too long → (`role="alert"`) "Spoken, this runs about N s; your {plan} plan allows {max} s. Trim it or upgrade."
- "Voice": a radiogroup of 12 voice cards (sm 2, lg 3 columns), each name + "accent · tone": Thalia, Asteria, Luna, Athena, Orion, Zeus, Apollo (American), Pandora, Draco (British), Theia, Hyperion (Australian), Amalthea (Filipino). Default Thalia. "Narrated by {name}. The voice is recorded once per edit; re-editing in another style reuses it."
- Cost box: "Cost: N credit(s) at the estimated length — the same rate as an uploaded take of that length."
- **Gate**: at least 20 characters and not too long. On Continue, a draft project is created (`createDraftProject(title || first line || "Script reel")`) so photos can upload against it.

### 7.6 Step "Presenter" (`components/wizard/step-presenter.tsx`, only when presenters are on)

- "A script and one face become a presenter video, then edited like any take. Rendering the presenter uses avatar credits from your account."
- Script textarea (min-height 192px, maxLength 4000) with a word/seconds counter.
- "Presenter": two choice cards: **Your photo** ("One clear, front-facing portrait of an adult you have the rights to. We animate the face and lip-syncs the script.") with a "Choose photo / Change photo / Uploading…" control and a 64px preview (JPG/PNG; the first upload creates the draft project), or **A stock presenter** ("One of our licensed photo avatars. No upload, no rights to clear.") which opens a radiogroup grid of HeyGen looks (3:4 previews, 3–6 columns).
- "Voice": a `<select>` "Choose a voice…" with optgroups "Your voices" (private) and "Presenter voices" ("name · language · gender").
- Three required checkboxes: "I own the rights to this photo and script, or have the person's permission." / "The person shown is an adult." / "The photo and script are sent to our avatar provider to render the video."
- **Gate** (`presenterReady`): script ≥ 20 chars, a voice, a photo or look, all three boxes, and not too long.

### 7.7 Step "Your brief" (`components/wizard/step-brief.tsx`)

- "No footage needed. Pick the kind of film; we write it, score it and design it, using only what you give us."
- Four sections (`aria-label` = group title), each with a title, blurb and a radiogroup of kind cards (sm 2 columns; card = title, blurb, "You give: …"; selected = 2px ink ring):
  - **Animate anything** — "Show a style you love, give a rough idea: every frame is drawn in code, scored, and checked against your style." → Animate anything.
  - **From your website** — "Give a link: we capture the real page, its controls, colours and words." → SaaS launch film, 15-second motion showreel, Apple-style app film, Product film, Referral promo, Hype launch, Landing-page fly-over.
  - **From a topic** — "Give a topic or a recipe: we write it, design it and (for some) narrate it." → Recipe explainer, Animated explainer, Editorial explainer, Diagram explainer.
  - **Fun formats** — "Fights, tier lists, machines and storybooks." → Versus: a comic fight, Music machine, Storybook journey, Tier list.
- Picking a kind prefills its example fields (keeps what the user already typed, except a topic that was just another kind's example).
- The form panel for the chosen kind: its title, "You get: …", "The look: {preset name}. {tagline}", then **BriefIdeas**, then the kind's fields.
- **BriefIdeas** (`components/wizard/brief-ideas.tsx`): "No idea yet? Let Claude write the brief" / "Type a rough idea, or leave it empty, and get three briefs to choose from. Picking one fills the form below; you can still change every word.[ You still give the link to your page.]" Input (maxLength 600, placeholder "Rough idea (optional): e.g. something for my bakery's Diwali week") and a button "Write ideas for me" / "Writing…" / "Three more". POST `/api/briefs/ideas` `{kind, idea}`. Results: up to three cards (title, a 4-line preview of the fields, "Use this" / "Filled in below ✓", `aria-pressed`). Errors inline in terracotta.
- **Fields by type** (labels, limits):
  - `url` → "Website link" (or "Website link (optional)" for Diagram), `type="url"`, placeholder e.g. "https://linear.app", help "A public page of the product. We open it, take real screenshots and use its own words; we never invent features or numbers."
  - `recipe` → textarea, max 1500. `subject` / `topic` → textarea, max 600. Labels vary by kind ("Recipe", "What's the story?", "What should it explain?", "What are we ranking?", "Story or topic").
  - `focus` → textarea, max 400 ("What should it focus on? (optional)" / "The programme in a line (optional)" / "Words or an ending (optional)").
  - `seconds` → "Length" select: "The usual (N s)" plus the kind's options (e.g. 20/30/40).
  - `contenders` → "Red corner", "Blue corner" (max 40 each), "Who wins?" select ("Let the story decide", A, B), help "People, brands or ideas all work. It roasts what they do, never their looks or identity."
  - `line` → "The line that types out" (max 60), "Closing words" (max 30).
  - `closing` → "Closing statement" (max 60), "Italic tail (short)" (max 40), with help about the end card.
  - `presets` (Animate only) → "Start from an example" chips: Hummingbird explainer, Kids' story, Product ad, Science explainer, Milestone (each fills topic and length).
  - `narrate` (Animate only) → "Narration" checkbox: "A voice tells it over the music, with captions. Off: music only."
- **Gate** (`briefReady`, same as the server): link kinds need a URL matching `^https?://host.tld…`; fly-over also a closing statement; recipe ≥ 15 chars; journey subject ≥ 10; explainer/editorial/tierlist/diagram/animate topic ≥ 6; versus both names; machine a line. On Continue a draft project is created (title or the kind's title).

Brief kinds, their look and max length (for the credit estimate): launch (saas-launch, 32 s), showreel (showreel-kinetic, 16), app (porcelain-keynote, 32), recipe (recipe-explainer, 32), versus (versus-arcade, 62, narrated), machine (music-machine, 22), journey (grand-budapest, 32), explainer (kurz-explainer, 62, narrated), editorial (vox-paper, 62, narrated), tierlist (tier-list, 40, narrated), animate (animate-studio, 31), product (porcelain-keynote, 62), referral (porcelain-keynote, 16), hype (porcelain-keynote, 32), flyover (porcelain-keynote, 15), diagram (porcelain-keynote, 62).

### 7.8 Step "Style" / "Edit options" (`components/wizard/step-style.tsx`, `components/style-filter.tsx`)

**Style picker** (not shown in reference mode):
- Header: label "Style" and "Each style has its own motion and sound — hover a card to watch it on a real take."
- **Family chips** (`role="tablist" aria-label="Filter styles by motion family"`, each `role="tab" aria-selected`, 36px square chips; active ink): All 107, Editorial 24, Kinetic type 16, Whiteboard 3, Chalkboard 1, Hype cut 20, Launch film 19, Paper collage 10, Colour blocks 10, Beat type 4 (counts from the presets; chips show only families that have presets).
- **Search** (`type="search"`, "Search styles…", `aria-label="Search styles"`), matches name, tagline and family label. No match: "No style matches that — try another word."
- **Grid** (`role="radiogroup" aria-label="Style preset"`, sm 2, lg 4 columns): each `PresetButton` (`role="radio" aria-checked`): 9:16 poster (lazy) with the video attached and played on hover/focus, a badge ("Default" for Mikku royal, "New" for newer looks) top-left, name, 2-line tagline, "measured from {repo · style}" for community looks, and two chips: family label and sound kit (Pop & whoosh, Soft clicks, Marker on board, Chalk, Zaps & drops, Cinematic, Silent). Selected = 2px ink ring. All 107 render at once (no pagination or virtualisation).
- **How to get this look** (`aria-live="polite"`, for the 8 presets with a how-to): numbered steps, and if the look wants Clean cut on a recorded take and it is off, a terracotta link "Turn on Clean cut for this look".

**Reference mode** instead shows: "The look comes from your reference reel" / "We measure its cuts, camera moves, colours, type, captions and texture, write a style from them, and edit your take that way. Your words and footage stay yours; the reference is only measured, never reused."

**Style text**: `#style-text` textarea, max 300. Label "Describe your style (optional)" (reference: "Anything to note about the reference? (optional)"). Placeholders "e.g. clean clinic white with navy accents, fewer effects, bigger captions" / "e.g. copy the yellow captions and the fast cuts; ignore the logo in the corner". Help "We map this to safe design tokens (palette, fonts, pace). It never changes your words." / "The style director reads this alongside the reference. It never changes your words."

**Options** (a 2-column grid of surface cards, checkboxes use `accent-color: var(--ter)`):
| Control | Default | Notes |
|---|---|---|
| Captions (checkbox) | on | "In the style's own format, on the exact word" |
| Music bed (checkbox) | off | "Music made for your reel, ducked under your voice" |
| Sound effects (range 0–1, step 0.05) | 0.6 | shows "60%"; "The sound kit comes from the style; this sets how loud it lands." |
| Stock B-roll (checkbox) | off | disabled at 60% opacity without a Pexels key; then the copy reads "Needs a Pexels API key on the worker (PEXELS_API_KEY) — not set" |
| Clean cut (checkbox, recorded takes only) | off | "Take out the ums and uhs, words said twice and long pauses before we edit (the cut is yours to download)"; turning it off also turns off Hook first |
| Hook first (checkbox, recorded takes only) | off | "Your strongest line plays in the first two seconds, even if you said it later (turns on Clean cut)" |
| Animated scenes (checkbox + select 1–4, full width) | off, 2 | "Short animations drawn in code cut in on your key lines while you keep talking… Adds about 5 minutes."; when on, a "Look (optional)" input, max 160 |
| Language (select) | Auto-detect (verified) | English, Hindi (Devanagari captions), Hinglish |

"Recorded takes" means `take` and `reference` modes. Script and presenter modes do not show Clean cut / Hook first.

### 7.9 Step "Review & create" (`components/wizard/step-brand.tsx` + fold-out)

1. **Photos fold-out**: a `<details>` surface box, open by default when photos exist (or for an Animate brief). Summary: "Add photos (optional · N added)" or, for Animate, "Style images (optional…)". Inside: `StepPhotos`.
2. **StepBrand**: "Name your reel and create it. Brand details are optional; they land on the end card." Fields (all `.input`, `.label` above):
   - Project title — max 120, placeholder "What is your taste?" (full width)
   - Brand name — max 60, "Khanna Homes"
   - Handle or website — max 60, "@khannahomes"
   - End-card line — max 120, "Default: your last sentence"
   - Call to action — max 60, "Comment KATANA · DM to order"
   - Phones only (`md:hidden`): "By creating, you confirm this footage is yours or you have permission to use it. Rasika only edits your own footage: no face swaps, voice clones or generated likenesses."

**Photos** (`components/wizard/step-photos.tsx`):
- Copy: "Optional. Add up to 15 photos. Tell us which word each one belongs to — “show this when I say *balcony*”." (Animate: "Add 1–3 images of a style you love… They guide the look only… Skip this and we choose a style for the topic.")
- A dashed `<label for="photos">` button "Add photos" / "Add style images" / "Uploading N…" with "(n/15)" or "(n/3)"; hidden multi-file input `accept="image/*"`, disabled at the max. JPG, PNG, WebP, HEIC, HEIF only ("{name}: use JPG, PNG, WebP or HEIC."); over the limit: "Up to 15 photos per reel (N skipped)." Server cap 25 MB per image (default).
- Each photo row (sm 2 columns): a 96px 4:5 preview (crop approximated with object-position/scale), **Label** input (max 60, placeholder "Label (e.g. “East-facing balcony”)", `aria-label="Label for photo N"`), **Show when I say…** input (max 120, optional), **Crop / Re-crop** button, and a trash icon button "Remove photo" (also DELETEs the asset on the server).
- **Crop dialog** (`components/wizard/crop-dialog.tsx`): `role="dialog" aria-modal="true" aria-label="Crop photo"`, a bottom sheet on phones and a centred 512px card on larger screens, black 70% backdrop. `react-easy-crop` area (52vh / 420px), aspect chips (4:5 polaroid default, 1:1, 3:4, 9:16; `aria-pressed`), "Auto-trim screenshot UI" (detects status/nav bars and shows "Trimmed …" or "No screenshot chrome detected"), a Zoom range 1–4, Cancel and "Apply crop". Escape closes. Crop is saved in source pixels `{x, y, w, h}`.
- **AI images** (`components/wizard/ai-images.tsx`, shown only when AI images are set up and the mode is not brief): "No photos? Let AI draw them" / "Up to 6 AI images per reel (N made, M left). Each picture lands on the word it illustrates. No real people's faces, logos or text in the images." Controls: "Picture style" input (max 120); "Draw my key moments automatically" checkbox + count select 1–6 (default off, 4); "Or describe a picture and draw it now" input (max 1200, needs 8+ chars) with "Draw it" / "Drawing…" ("About 30 seconds…"; polls every 3s up to 80 times; errors "The image took too long; try again", "The image failed (…)"); for script/presenter modes "Suggest pictures from my script" which lists editable prompt cards with "Draw this" / "Skip".

**Sticky action bar** (all steps): a wrapper `sticky bottom-[92px] z-20 sm:bottom-4` (so on phones it floats above the tab bar), containing a `data-glass="panel"` bar (18px radius):
- **Back** (`.button-ghost`, disabled on step 0).
- Not last step: **Continue** (disabled when the step is not complete or a request is pending; "One moment…" while creating the draft project).
- Last step: on md+ the consent line "By creating, you confirm this footage is yours or you have permission to use it."; then "Cost: **N credit(s)** · you have M"; then **Create my edit** ("Creating…"), disabled while pending or when `credits < cost`. Consent is implicit: the constant `consent = true` is always sent (clicking Create is the confirmation).

**Cost**: `creditCost(duration)` = `max(1, ceil(sec/90))`. Duration = the uploaded clip's length (take/reference), the script estimate (script/presenter), or the brief kind's max seconds capped at the plan max (brief). If duration is unknown, cost shows 1.

**Errors**: a wizard-level `<p role="alert">` in a surface box with `#ff8a66` text, above the action bar. Sources: zod messages from the server ("Please confirm you have the rights…", "Unknown style preset", "The script needs at least a sentence or two."), plan limits ("Your Free plan allows reels up to 60 s. This one is N s."), credits ("This edit needs N credit(s); you have M."), "Upload the reel first", "Upload the reference reel first", "Upload a photo or choose a stock presenter", "Project not found", or the stale-page message from `safeAction`: "Rasika was just updated. Reload the page and try again; your upload and settings are saved."

**Submission payloads** (keep these keys):
- `createEdit` (take/reference): `{ projectId, title, sourceAssetId, referenceAssetId?, fidelity: "look", durationSec, photos: [{assetId, label, sayWhen, crop?}], stylePreset, styleText, options: {captions, sfxIntensity, music, language, broll, animated, animatedCount, animatedLook, aiImages?, aiImageCount?, aiImageStyle?, cleanCut, hookFirst}, brand: {name, handle, endLine, cta}, consent: true }`. `cleanCut` is sent as true when Hook first is on.
- `createScriptEdit`: `{ projectId, title, script, voice, photos, stylePreset, styleText, options: {captions, sfxIntensity, music, broll, animated…, aiImages…}, brand, consent }`.
- `createPresenterEdit`: `{ projectId, title, script, voiceId, lookId|null, photoAssetId|null, photos, stylePreset, styleText, options: {…, language}, brand, consent, presenterConsent }`.
- `createBriefEdit`: `{ projectId, title, kind, url?, recipe?, subject?, topic?, narrate? (animate only), focus?, seconds?, closeLine?, closeTail?, a?, b?, winner, line?, end?, photos, options: {sfxIntensity}, brand, consent }`.
- On success: the draft key is removed from localStorage and the router goes to `/dashboard/p/<projectId>`.

**Draft persistence**: the whole `Draft` (step, mode, upload, reference, fidelity, script, presenter, scriptProjectId, brief, photos, style, ai, brand, title) is saved to `localStorage['rasika:wizard:<projectId>']` on every change once a project id exists (upload's project or the draft project). `?project=<id>` restores it. Upload sessions resume separately through `rasika:uploads`.

---

## 8. Project page (`/dashboard/p/[id]`)

Layout: a 2-column grid on lg (`1fr 360px`): main column and a sidebar. Single column below lg (sidebar after the main content).

**Header**: "Projects" back link (muted), H1 = title, meta "<duration> · <style label> · N credit(s)[ · “<style text>”]".

### 8.1 Draft state
If the project is still a draft: a surface card "This reel hasn't been submitted yet." + "Continue setup" → `/dashboard/new?project=<id>`.

### 8.2 Progress view (`components/dashboard/progress-view.tsx`, client)
A surface section (`aria-live="polite"`):
- H2 = the status label (or "Something went wrong" when failed), and "NN%" at the right while active.
- A line: the worker's latest message, or the stage copy ("Your reel is in the queue.", "Looking at your video…", "Timing every word…", "Designing your edit…", "Making a quick preview…", "Rendering in full quality…", "Your reel is ready.").
- While active: a 4px progress bar (accent on raised, min 3%, width transition 700ms).
- Seven stage marks (2 columns on phones, 4 from sm): Uploaded, Checking video, Transcribing, Designing, Preview, Final render, Done. Done stages = ink dot, current = accent dot (`aria-current="step"`), ahead = raised dot and muted text. Waiting states sit half a step after their stage.
- **Retry**: when failed, or when an active job has had no update for 120 s, a raised box with "This run failed. Retrying starts again from the video check; nothing is charged twice." or "No progress report for N min. The worker may have been restarted." and a **Retry this edit** button (form → `retryEdit`, field `id`).
- Footer: "You can close this page: your reel keeps rendering, and it will be here when you come back."
- **Live updates**: `useJobEvents` opens `EventSource('/api/projects/<id>/events')` while the status is active; the server polls the DB each second and sends changes for about 20 s; the client reconnects 1.5 s after each stream ends. When a job goes from active to not active, the page calls `router.refresh()` so the reel, editor and exports appear.

### 8.3 Edit room (`components/dashboard/edit-room.tsx`, client)
Shown when the project has a recorded take with a transcript (not for brief films). Otherwise, if there is a transcript, a read-only **Transcript** panel ("N words · <language> · vN", an open `<details>` "Every word, timed", each word shows its timestamp on hover).

- H2 "Edit" and a live line: "<m:ss.s> take · cutting N word(s) (about S s) · about <m:ss.s> left".
- "Click a word to cut it, click again to keep it. Shift-click cuts or restores everything in between. Every edit starts from your original take, so nothing is lost."
- Grid on md+: a 200px column with the original take `<video controls>` (9:16) and a checkbox "Preview: skip cut words" (default on), and a surface panel with:
  - Toolbar: "Cut N suggested words" / "Keep the suggested words" (toggles all suggestions) or "No fillers, repeats or retakes found."; "Keep every word" (clears all cuts; disabled when none); a legend: dotted gold underline "filler / repeat", dotted coral underline "earlier take".
  - The transcript as inline word buttons (max height 420px, scrolls, `lang` = transcript language). Each word: `aria-pressed` = cut; title "m:ss.s · reason · cut". Cut words are struck through at 60% opacity; suggested words have a dotted underline (`#d9a441` filler/repeat, `#ff8a66` earlier take); the word under the playhead gets `bg-accent/25`. Click toggles and seeks the video to that word; shift-click applies the anchor word's state to the whole range.
- **Skip preview**: a rAF loop follows the playhead (binary search for the current word) and, when preview is on and the video is playing, jumps over cut ranges.
- Below: **Render this edit** ("Starting…"), disabled unless something changed (cuts or studio sound), while pending, or while a render runs; a **Studio sound** checkbox "(cleans hum, hiss and room noise)"; while busy: "A render is running; you can render this edit when it ends."; errors inline in `#ff8a66`.
- Note: "Rendering the edit designs the reel again on the cut take (a couple of minutes). Re-edits of this reel are not charged again. Every reel is levelled to −14 LUFS, the loudness Reels, Shorts, TikTok and YouTube play at."
- `recutEdit({ projectId, transcriptVersion, removed: number[], studioSound })`. Limits: **5 re-edits per reel** ("Each reel includes 5 re-edits; start a new edit for more."), must keep at least one word, project must be idle ("Wait for the current render to finish"), "That transcript is gone; reload the page". On success: refresh and smooth-scroll to the top.

### 8.4 Export (`#download`)
- H2 "Export".
- **Final ready**: a `<video controls>` of the 1080p output (max 320px wide, 9:16); buttons **Download 1080p MP4** (`download`) and, if present, **720p share copy** (ghost); a muted line "X MB · plan vN · rendered in N parallel chunks"; Pexels credits ("Stock footage via Pexels: author, author…", linked) when B-roll was used; then **Other shapes**.
- **Only preview ready**: the 540p preview video and "540p preview · the full-quality render follows."
- **Nothing yet**: "A plan exists; the final MP4 appears here once the render finishes." or "Your reel appears here as soon as it is rendered."
- Always: a muted link "Open in the engine dev player" (→ `/dev/engine?project=<id>`) and " · normalised 1080p proxy ready" when a proxy exists.

**Other shapes** (`components/dashboard/export-shapes.tsx`, client): label "Other shapes", three cards (sm 3 columns): Square 1:1 ("LinkedIn, X, the Instagram grid"), Portrait 4:5 ("Instagram and Facebook feed, LinkedIn"), Wide 16:9 ("YouTube, X, presentations"). Each: "Make this shape" ("Starting…") or, when made, "Download" + "Make again". Disabled while busy or pending. Footer: "Exporting… this takes about a minute; the page updates when it is ready." (busy) or "Reels, Shorts and TikTok take the 9:16 download above as it is." `exportReel({ projectId, format: "1:1" | "4:5" | "16:9" })`; needs a finished 1080p render ("Render the reel first").

### 8.5 Sidebar
- "Your reel": the source video player (9:16) and "filename · N MB", or "No video uploaded."
- "Photos (N)": a 3-column grid of 4:5 images with the label and “say when” under each.
- "Brand & ending": Brand (name · handle or "—"), End card line (or "Speaker's last sentence (default)"), CTA.
- **Duplicate** and **Delete** (ghost buttons, side by side; forms with field `id`). Duplicate copies the project (title + " (copy)", status draft, same style and brand, copies the source video, images and thumbnail) and opens it. Delete soft-deletes (sets `deletedAt`, status canceled) at once, with no confirmation, and returns to `/dashboard`.

---

## 9. Credits and billing UI

### 9.1 `/dashboard/credits`
- H1 "Credits". "You have **N** credit(s). 1 credit = 1 reel up to 90 s. Credits never expire."
- If UPI is configured: three pack cards (md 3 columns): name, price, "₹X a reel · blurb", and a form button **Pay ₹X by UPI** (field `pack`). The `?pack=` pack (or, without it, the highlighted 10-pack) gets a 2px accent ring. If UPI is not configured: "Payments are not switched on yet. Please check back soon."
- Help: "Pay from any UPI app (GPay, PhonePe, Paytm, your bank). After paying, enter the 12-digit UTR from the payment details; credits are added once we confirm it, usually within a few hours."
- "Your orders" (last 20): "N reel(s) · ₹X · <ref>", the date, and a status link → the order page. Status words: created "Waiting for your payment", submitted "Paid · we're confirming it", paid "Credits added", rejected "Not matched".
- `buyPack` reuses an open unpaid order for the same pack, otherwise creates one, then redirects to it.

### 9.2 `/dashboard/credits/[id]` (one order)
- "Credits" back link, H1 "N reel(s) · ₹X", "Order <ref>".
- **paid**: "Payment confirmed: N credits added." + "Make a reel".
- **submitted**: "Thanks! We're confirming your payment." / "UTR … We match it against our bank statement, usually within a few hours, and the credits appear on your account. You can close this page."
- **rejected**: "We couldn't match this payment." + the admin's reason (or "The UTR did not match a payment we received.") + what to do.
- **created** (the pay flow), two numbered surface cards:
  1. "1 · Pay ₹X": a 200px white QR (server-rendered SVG, `role="img"`, `aria-label="UPI QR code for ₹X to <vpa>"`), "Scan with any UPI app, or on your phone:", button **Open my UPI app** (a `upi://` deep link), and "Or pay ₹X to **<vpa>** (<payee>) and add **<ref>** in the note." (select-all on the VPA and ref).
  2. "2 · Send us the UTR": help text, then a form: hidden `id`, input `name="utr"` (`inputMode="numeric"`, `pattern="[0-9 ]{12,15}"`, required, placeholder "12-digit UTR", `aria-label="UTR"`), button **I've paid**. Errors from `?error=`: "The UTR is the 12-digit number in your UPI app's payment details." or "This UTR has already been sent for another order."
  - Footer: "Credits are added once we confirm the payment, usually within a few hours. Please pay the exact amount so we can match it."
- Submitting moves the order to `submitted` and emails the admins.

### 9.3 `/admin`
In the dashboard shell (Admin link in the bar for admins).
- H1 "Admin" + "Download sign-ups (CSV)" (ghost) → `/admin/signups.csv`.
- Six stat tiles (2/3/6 columns): Accounts, New in 24 h, Made a reel, Paying, To confirm, Revenue (last 30 orders).
- "Payments to confirm": help text; "Nothing waiting." or a card per order: amount, "UTR <utr>" (select-all), "Ref <ref>", reels, email, "sent <date IST>"; actions **Approve · add N credit(s)** (form `id`) and a reject form (input `reason` "Reason (shown to the buyer)" + **Reject**).
- "Sign-ups (N)": a horizontally scrolling table (min 900px): Email, Name, Joined, Sign-in (provider, "(unconfirmed)" for unconfirmed email), Last seen, Reels, Credits, Paid, Give credits (number input `credits`, default 1, −100…1000, + "Give"; hidden `userId`).
- "Decided payments": "✓/✗ ₹X · UTR … · email · date · reason".
- "Back to the dashboard" link.

---

## 10. Help page (`/help`)

In the `(legal)` layout: plain header (wordmark, theme toggle, "Home"), a reading column (`max-w-[72ch]`, the layout styles `h1` as `.head`, `h2` as `.lead` semibold, paragraphs max 62ch, links underlined).
- H1 "How to use Rasika". "Four short videos, each under two minutes, with sound."
- Four sections (each `id` for anchoring, `scroll-mt-8`): H2, a line, and a `<video controls playsInline preload="none">` (16:9, 10px radius, poster jpg):
  1. `#first-reel` — "1 · Make your first reel" (`/tutorials/rasika-how-to-1-first-reel.mp4`)
  2. `#film-from-a-brief` — "2 · Make a film without a camera"
  3. `#edit-and-export` — "3 · Edit your reel and export it"
  4. `#buy-reels` — "4 · Buy more reels"
- A final "Make my free reel" button → `/dashboard/new`.
- Metadata description: "Four short videos: your first reel, a film without a camera, editing and exports, buying reels."
- `docs/RASIKA_PRD.md` says these videos need re-recording because they show the old 5-step wizard (not verified by watching them).

---

## 11. Global states

| State | Where | What it shows |
|---|---|---|
| Runtime error | `app/error.tsx` (client) | H1 "Something needs a reload", "Rasika may have been updated while this page was open. Your uploads, drafts and credits are saved; reloading picks up where you left off.", buttons "Reload the page" and "Try again" (ghost), and "Reference <digest>" when present. Renders inside the root layout, so no app bar. |
| 404 | `app/not-found.tsx` | Wordmark header, `.head` "This page isn't in the edit.", "The link may be old, or the reel it pointed at was deleted.", button "Back to the start" → `/`. Also used for other users' projects/orders and non-admins on `/admin`. |
| Stale server action | `lib/safe-action.ts` | returns `{ok:false, error: "Rasika was just updated. Reload the page and try again; your upload and settings are saved."}` |
| Loading | none | there are no `loading.tsx` files and no skeletons. Pending states are button labels ("One moment…", "Creating…", "Starting…", "Writing…", "Drawing…", "Uploading N…"). |
| Toasts | none | no toast system; notices are inline boxes (`role="status"`) and errors inline text (`role="alert"` in most places). |
| Empty states | dashboard ("No edits yet"), admin ("Nothing waiting."), style search ("No style matches that — try another word."), export ("Your reel appears here as soon as it is rendered."), sidebar ("No video uploaded."), editor ("No fillers, repeats or retakes found.") | |
| No credits | `/dashboard/new` | "You've used your free reel" panel (section 7.1) |
| Payments off | credits pages | "Payments are not switched on yet…" |
| Email when ready | worker (`notify.py`) | an email is sent when the reel is ready (per the latest commit; not part of the web UI) |

---

## 12. Accessibility and reduced motion (as implemented)

- **Skip link** in the root layout: "Skip to content" → `#main` (sr-only, visible on focus as an accent box top-left). Every page has a `main#main`.
- **Focus**: global `:focus-visible` 2px accent outline. Inputs keep the outline. Buttons have no custom focus ring beyond it.
- **Landmarks and labels**: `nav aria-label="Primary"`, `"Dashboard"`, `"App"`; `ol aria-label="Steps"`; groups labelled ("Source", "Where the reel comes from", "Style preset", "Voice").
- **Choice controls**: `role="radiogroup"` + `role="radio"` + `aria-checked` (source switch and cards, style grid, voices, brief kinds, presenter looks); `aria-pressed` (showcase tiles, play/pause, segmented source, brief ideas, crop aspects, edit-room words, theme toggle); `role="tablist"`/`role="tab"`/`aria-selected` for family chips (note: these filter a list; there are no tab panels).
- **Live regions**: upload progress and the render progress view are `aria-live="polite"`; the how-to box too. Errors use `role="alert"` (wizard error, upload errors, photo errors, script too-long, login error); login notices use `role="status"`.
- **Media**: decorative videos are `aria-hidden` or muted with an `aria-label`; posters have `alt` where meaningful; the hero 3D stage is `aria-hidden`; the compare plates have a labelled range input (Features: hidden until focused; Examples: always visible); the QR has `role="img"` with a text label and the VPA is also printed as text.
- **Dialogs**: the phone menu and crop dialog have `role="dialog" aria-modal="true"` and close on Escape. Neither traps focus or returns focus on close.
- **Language**: `<html lang="en">`; the editor transcript sets `lang` to the transcript language; Devanagari has its own font.
- **Reduced motion** (`prefers-reduced-motion: reduce`): all `[data-load]`, `[data-line]`, `[data-reveal]`, `.shutter` start states are skipped; all animations/transitions are cut to 0.01ms; the hero ring does not orbit, the dot does not pulse, the glow does not drift, the stage does not enter; the caption clock and pointer tilt do not start; the glass skips the fade, specular, tilt and interaction; smooth scrolling is off. Autoplaying videos (hero phone, login background, compare plates when in view) still play.
- **Reduced transparency**: glass panes become solid.
- **Touch**: pointer tilt and hover video are fine-pointer/hover features; on touch the tiles show posters and tapping selects or navigates. Hover button colour changes are limited to `(hover: hover) and (pointer: fine)`.

---

## 13. Component inventory

| File (under `apps/web/src`) | Purpose | Client/Server | Key props / exports |
|---|---|---|---|
| `app/layout.tsx` | root: fonts, metadata, theme script, skip link | server | — |
| `app/page.tsx` | landing composition + JSON-LD | server | — |
| `app/globals.css`, `app/components.css` | tokens, base, classes | CSS | — |
| `components/landing/nav.tsx` | floating glass nav + phone menu | client | `Nav({className?})` |
| `components/landing/hero.tsx` + `hero3d.css` | 3D curved wall hero, word clock, tilt | client | `Hero()` |
| `components/landing/features.tsx` | before/after plate + 8 notes | client | `Features()` |
| `components/landing/style-showcase.tsx` | Examples: 4-style compare + films rail | client | `StyleShowcase()` |
| `components/landing/brief-films.tsx` | film tiles (and an unused section) | client | `FilmTile({kind})`, `BriefFilms()` |
| `components/landing/pricing.tsx` | 4 pack cards | server | `Pricing()` |
| `components/landing/faq.tsx` | accordion + FAQ JSON-LD | server | `Faq()` |
| `components/landing/final-cta.tsx` | closing field + glass first-step form | client | `FinalCta({presenterEnabled?})` |
| `components/landing/footer.tsx` | one-line footer | server | `Footer()` |
| `components/theme-toggle.tsx` | light/dark icon button | client | `ThemeToggle({className?})` |
| `components/style-filter.tsx` | family chips + search hook | client | `useStyleFilter(cards, initial?)`, `FamilyChips({counts,total,value,onChange,tone?})` |
| `components/motion/reveal.tsx` | scroll reveal wrapper | client | `Reveal({children,className?,index?,kind?:"rise"|"shutter",as?})` |
| `components/motion/liquid-glass.tsx` | liquidGL layer | client | `LiquidGlass()`, `refreshGlass(scope?)` |
| `components/brand/demo-video.tsx` | poster-first lazy looping video | client | `DemoVideo({src,poster?,alt,className?,start?:"load"|"view",priority?})`, forwards ref to `<video>` |
| `components/brand/wordmark.tsx` | "Rasika" home link | server | `Wordmark({className?,href?})` |
| `components/brand/reel-fragment.tsx` | reel poster/caption fragment from style tokens | server (pure) | `ReelFragment({tokens,line,lit?,mode?,className?})`, `reelColours(t)` (no current usage found) |
| `app/login/page.tsx` | sign-in screen | server | searchParams `next, error, sent, email, mode` |
| `app/login/actions.ts` | auth actions | server actions | see section 5 |
| `app/(legal)/layout.tsx` | legal/help shell | server | — |
| `app/(legal)/help/page.tsx` | tutorials | server | — |
| `app/dashboard/layout.tsx` | app shell, glass bar | server | — |
| `components/dashboard/mobile-tabs.tsx` | phone tab bar | client | `MobileTabs()` |
| `app/dashboard/page.tsx` | projects grid / empty state | server | — |
| `components/dashboard/project-card.tsx` | one project tile | server | `ProjectCard({project})`, `fmtDuration(sec)` |
| `components/dashboard/status-pill.tsx` | status pill + SSE hook | client | `StatusPill({projectId,status,progress})`, `useJobEvents(projectId, initial)`, `STATUS_LABEL` |
| `components/dashboard/try-gallery.tsx` | "Try something new" | server (uses `fs`) | `TryGallery()` |
| `app/dashboard/new/page.tsx` | wizard entry / no-credit panel | server | searchParams `style, project, industry, source, title, kind` |
| `components/wizard/wizard.tsx` | wizard state machine, sticky bar, submit | client | `Wizard({initialStyle?, initialIndustry?, initialSource?, initialTitle?, initialKind?, resumeProjectId?, credits, maxSeconds, planName, stockEnabled?, aiImagesEnabled?, presenterEnabled?, voices?, looks?})`, `BrandState` |
| `components/wizard/step-source.tsx` | source switch (used) + source cards (unused) | client | `SourceSwitch({value,onChange,presenterEnabled?})`, `StepSource(...)`, `SourceMode` |
| `components/wizard/step-upload.tsx` | resumable video upload | client | `StepUpload({value,maxSeconds,planName,onChange,kind?,projectId?})`, `UploadResult` |
| `components/wizard/step-script.tsx` | script + voice | client | `StepScript({value,maxSeconds,planName,onChange})`, `defaultScriptState`, `SCRIPT_MAX_CHARS` |
| `components/wizard/step-presenter.tsx` | HeyGen presenter | client | `StepPresenter({value,projectId,voices,looks,onChange,onNeedProject})`, `presenterReady`, `defaultPresenterState` |
| `components/wizard/step-brief.tsx` | brief kinds + fields | client | `StepBrief({value,onChange})`, `briefReady`, `defaultBriefState`, `BriefState` |
| `components/wizard/brief-ideas.tsx` | Claude-written briefs | client | `BriefIdeas({kind,needsLink,onPick})` |
| `components/wizard/step-style.tsx` | style grid + options | client | `StepStyle({value,onChange,stockEnabled?,fromReference?,recorded?})`, `StyleState` |
| `components/wizard/step-photos.tsx` | photos / style images | client | `StepPhotos({projectId,value,onChange,purpose?,ai?,onAi?,aiEnabled?,script?})`, `PhotoItem` |
| `components/wizard/ai-images.tsx` | AI image generation | client | `AiImages({projectId,photos,onPhotos,value,onChange,script?})`, `defaultAiImages` |
| `components/wizard/crop-dialog.tsx` | crop modal | client | `CropDialog({src,initial?,onClose,onApply})`, `CropRect` |
| `components/wizard/step-brand.tsx` | title + brand fields | client | `StepBrand({value,title,onTitle,onChange})` |
| `app/dashboard/p/[id]/page.tsx` | project page | server | — |
| `components/dashboard/progress-view.tsx` | live render progress + retry | client | `ProgressView({projectId,initial})` |
| `components/dashboard/edit-room.tsx` | transcript editor | client | `EditRoom({projectId,data,busy,studioSound})` |
| `components/dashboard/transcript-panel.tsx` | read-only transcript | server | `TranscriptPanel({transcript})` |
| `components/dashboard/export-shapes.tsx` | 1:1 / 4:5 / 16:9 exports | client | `ExportShapes({projectId,ready,busy})` |
| `app/dashboard/credits/page.tsx`, `[id]/page.tsx`, `actions.ts` | billing | server | — |
| `app/admin/page.tsx`, `actions.ts`, `signups.csv/route.ts` | admin | server | — |
| `app/error.tsx` | error boundary | client | — |
| `app/not-found.tsx` | 404 | server | — |
| `components/dev/engine-dev.tsx` | developer plan player | client | `EngineDev({project})` |
| `lib/safe-action.ts` | stale-action guard | shared | `safeAction(call)`, `STALE_PAGE` |
| `lib/wizard-schema.ts` | zod submission schemas | shared | `WizardSubmission`, `ScriptSubmission`, `BriefSubmission`, `PresenterSubmission`, `creditCost` |
| `lib/upload/multipart-client.ts`, `plan.ts` | upload engine | client / pure | `openSession`, `uploadParts`, `completeUpload`, `abortUpload`, `uploadSmall`, `ACCEPTED_VIDEO`, `ACCEPTED_IMAGE`, `formatBytes` |
| `config/presets.ts` | 107 style cards, labels, demo paths | shared | `presetCards`, `allPresetCards`, `FAMILY_LABEL`, `SFX_LABEL`, `PRESET_SOURCE`, `PRESET_HOW_TO`, `demoSrc`, `defaultPresetId`, `projectStyleLabel` |
| `config/briefs.ts` | 16 brief kinds in 4 groups | shared | `BRIEF_KINDS`, `BRIEF_GROUPS`, `briefKind` |
| `config/pricing.ts` | packs, plans, credit rule | shared | `packs`, `paidPacks`, `plans`, `creditsForDuration`, `formatPrice`, `perReel` |
| `config/voices.ts` | 12 narration voices | shared | `VOICES`, `DEFAULT_VOICE`, `estimateSpokenSeconds` |
| `config/brand.ts` | name, colours, socials | shared | `brand` |
| `content/landing.ts` | all landing copy | shared | `nav`, `hero`, `features`, `beforeAfter`, `styles`, `pricing`, `faq`, `finalCta`, `footer`, `seo`, `STYLE_COUNT` (+ unused `howItWorks`, `showcase`) |

---

## 14. Observations (known issues and opportunities)

These are things noticed while reading the code. They are labelled observations, not confirmed bugs.

1. **Tutorial videos are out of date.** `docs/RASIKA_PRD.md` says the four /help videos show the old 5-step wizard; the wizard now has 2–3 steps. The hero promises a "2-minute tour" while /help offers four videos.
2. **Dead wizard paths.** The `source` step (`StepSource` cards) and the standalone `photos` step are in the code but in no path. Their copy is also stale: `StepSource` says "Five ways in…" and "15 films" (there are 16 kinds); the "Skip photos" label can never show. A redesign can drop or reuse them, but must keep `SourceSwitch`.
3. **Forward step chips do nothing.** In the step indicator, chips ahead of the current step are enabled when the step is complete, but clicking them never advances.
4. **Hard-coded error colour.** Errors use `#ff8a66` (and `var(--ter)`) in both themes. On the light bone ground `#ff8a66` has weak contrast. A `--destructive` token exists (`#a8231b` light, `#ff8a66` dark) and should be used.
5. **Undefined classes.** `polaroid` (photo previews) and `button-secondary` ("Suggest pictures from my script") are used but not defined in any CSS file, so they render unstyled.
6. **Radius inconsistency.** All radius tokens are 0, but the app uses 4/6/8/10/12/14/18/20/22px and full radii ad hoc. A redesign should define a real radius scale.
7. **Developer details shown to users.** The B-roll toggle says "Needs a Pexels API key on the worker (PEXELS_API_KEY) — not set"; the export section shows "plan vN · rendered in N parallel chunks" and an "Open in the engine dev player" link; presets show "measured from <github repo>".
8. **No confirmation on Delete.** Project delete is instant from the card and the sidebar (soft delete, but there is no undo in the UI).
9. **No loading UI.** No `loading.tsx` or skeletons for the dashboard, project page or credits; server pages render only after the data loads.
10. **Mobile tab bar disappears on Help.** The Help tab goes to `/help`, which uses the legal layout, so the app shell and tab bar are gone there.
11. **Dialogs do not manage focus.** The phone menu and crop dialog have no focus trap and do not return focus on close.
12. **Family chips use tab roles** without tab panels; a radiogroup or toggle-button group would be more accurate.
13. **Hero video and reduced motion.** The hero phone video and the login background video autoplay even under reduced motion; there is no pause control on the hero.
14. **Style grid weight.** All 107 style cards render at once with posters; fine on desktop, heavy on phones. Virtualising or paginating by family would help. The landing's "Examples" shows only 4 styles, and there is no public page with all styles.
15. **Closing CTA lacks "From a brief".** The landing's final form offers My take / Script only / Match a reference / AI presenter, but not From a brief, the most "no camera" option.
16. **AI presenter card always shows in "Try something new"**, even when presenters are disabled; the wizard then shows the switch chip disabled.
17. **Unused content and CSS.** `howItWorks`, `showcase`, `hero.secondary` (pointing at a missing `#before-after`), `.say`, `.chip`, `.chip-switch`, `.app-bar`, `BriefFilms`, `ReelFragment` are unused. `framer-motion` and `@base-ui/react` are installed without imports (unverified).
18. **Copy mismatch on retention.** The FAQ says sources and outputs are kept 30 days; the draft privacy page says projects are kept until you delete them. Worth reconciling before redesigning copy.
19. **Duplicate opens a "Continue setup" draft** with no saved wizard draft (the localStorage key belongs to the old project), so resuming may start the wizard fresh (unverified at runtime).
20. **Retry on brief films.** `retryEdit` needs a source video; for a brief film it silently does nothing (unverified at runtime).
21. **Wizard title limits differ**: the landing form allows 80 characters, the wizard caps the incoming title at 80, the review field allows 120.
22. **`/admin` theme default** is light while the rest of the app shell defaults to dark.
23. **Opportunity for 3D without cost**: the hero already proves a pure-CSS 3D approach. The same technique (perspective cards, a light tilt on fine pointers, depth shadows) could carry into style cards, project cards, the pricing highlight and the wizard's choice cards, all gated by reduced motion and `(hover: hover) and (pointer: fine)`.
