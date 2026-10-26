# Rasika landing v2 · "The cut room"

Written before building, following the MotionSites web-builder skill: brief, signature, tokens,
assets, layout, motion and acceptance. v1 (the design-handoff landing) stays in the code base and
is one switch away (see "Switching" at the end).

## 0. Brief
An 8-section landing page for **Rasika**, the AI reel editor for people who talk to camera
(realtors, doctors, coaches, founders), in English and Hindi.
Aesthetic: nocturnal, warm, editorial, quiet UI, the footage carries it.
Signature: **the lens.** The hero plays the raw phone take; a soft circle follows the pointer and
shows the finished Rasika edit underneath, in sync. When nobody points, the lens drifts on its own.
One button opens the whole edit. The product's promise, shown as an interaction.
Fidelity: every link, form, query string, price and id of v1 is kept (list in section 13).

## 1. Stack
Next 15 App Router + React 19, plain CSS scoped under `.v2` (`components/landing-v2/v2.css`), no new
libraries. Existing `DemoVideo` for every clip that should not compete with first paint.

## 2. Fonts
| Role | Family | Weights | Used on |
|---|---|---|---|
| Display + UI | Switzer (local, already loaded) | 400 / 500 / 600 | H1/H2 at 500, body 400, buttons 500 |
| Accent | Instrument Serif (next/font/google, self-hosted at build) | 400 italic | 1–2 accent words per heading, big prices |
| Labels | Switzer 500 uppercase | 11–12px, +0.2em | indices `[ 01 ]`, eyebrows, captions |

## 3. Colour tokens
```css
.v2 { --cin: #0c0908; --cin-2: #151010; --ivory: #f3ebdd; --gold: #e6b450; --gold-mute: #d8b47a;
      --maroon: #5a1520; }
/* cinema sections (hero, how, examples, start, footer): always dark */
.v2-cin   { --bg: var(--cin); --fg: var(--ivory); --mut: rgb(243 235 221 / .62); --line: rgb(243 235 221 / .12); }
/* sheet sections (edit, pricing, faq): follow the site theme */
.v2-sheet { --bg: #f4ede1; --fg: #1b1311; --mut: rgb(27 19 17 / .62); --line: rgb(27 19 17 / .12); }
[data-theme="dark"] .v2-sheet { --bg: #171112; --fg: var(--ivory); ... }
```
Gold is used on three things only: the primary CTA arrow disc, the lens rim, the active marker.
Text steps: 100 headline / 80 nav / 62 body / 45 labels. Selection: gold at 30 %.

## 4. Global utilities
- `.v2-glass`: `rgb(20 14 13 / .55)`, `backdrop-filter: blur(14px) saturate(140%)`, inset rim
  `0 1px 0 rgb(255 255 255 / .08)`, 1px border `rgb(243 235 221 / .10)`.
- Grain: fixed SVG fractal noise (baseFrequency .9, 3 octaves) at opacity .05, pointer-events none.
- Reveal: `[data-rv]` under `html.js` starts `opacity 0; translateY(24px)`, `.is-in` → 0.8 s
  `cubic-bezier(.22,1,.36,1)`, stagger by `--rv-d`. Reduced motion: final state.
- Easing tokens: `--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-ui: cubic-bezier(.4,0,.2,1)`.

## 5. Assets (all Rasika's own renders, nothing third-party)
| Slot | URL | Notes |
|---|---|---|
| hero base | `/demo/before.mp4`, poster `/demo/styles/raw.jpg` | raw phone take, speaker centre, 9:16 |
| hero lens | `/demo/after.mp4`, poster `/demo/after-poster.webp` | the Rasika edit of the same take, synced |
| how: upload | `/demo/before.mp4` | |
| how: look | `/demo/styles/<id>.jpg` × 9 | the coverflow looks |
| how: photos on the word | `/demo/after.mp4` | the edit's photo cards land on spoken words |
| how: preview | `/demo/styles/mikku-royal.mp4` | |
| examples | `/demo/styles/<id>.{jpg,mp4}`, `/demo/briefs/<id>.{jpg,mp4}` | as v1 |

## 6. Layers
z: media 0 → lens 2 → content 10 → nav 40 → menu 60 → grain 90.
Sheets overlap the section above with `margin-top: -48px; border-radius: 48px 48px 0 0`.

## 7. Nav
Fixed, top 16px, three floating pieces at max-width 1280: logo pill (arch glyph + "Rasika", 44px
tall), links pill (glass, 4 links at 14px / 80 %, hover 100 % with a growing underline), right group
(theme toggle 44px glass circle + ivory CTA pill "Edit a reel free"). Gains a soft shadow after
scrollY > 40. Under 860px: logo, CTA, "Menu" → full-screen sheet (links at 34px, staggered 50 ms,
Esc / link / resize close, body scroll locked).

## 8. Hero
Grid `minmax(0,1fr) clamp(280px, 30vw, 400px)`, gap 72px, container 1280px, min-height 100dvh,
padding 128px top / 72px bottom. Copy vertically centred left; lens frame right.
| Element | Copy | Style |
|---|---|---|
| Badge | chip "EN · हिं" + "The AI reel editor for people who talk to camera" | glass pill, 13.5px, chip 11.5px gold on gold/14 % |
| H1 | Talk to your phone. / Post like a *studio.* | Switzer 500, `clamp(46px, 6.4vw, 100px)`, lh .95, −.045em; "studio." Instrument Serif italic, gold-mute, +.02em |
| Sub | hero.sub | 17.5px / 1.55, 62 %, max-width 34rem |
| CTA 1 | Make my free reel → `/dashboard/new` | ivory pill 15px 500, 8px 8px 8px 24px, gold 40px disc with → (rotates −45° on hover) |
| CTA 2 | Watch the 2-minute tour → `/help` | glass pill, ▶ glyph |
| Strip | hero.trust joined by thin pipes | 13px, 50 % |
Lens frame: 9:16, radius 28px, 1px ivory/12 % ring, shadow `0 40px 90px -30px rgb(0 0 0 / .8)`.
Caption under it: "RAW TAKE" left · "POINT TO SEE THE EDIT" right (11px, +.2em, 45 %) and a text
button "Show the whole edit" / "Back to the raw take" (aria-pressed).
Mobile (<900px): one column, frame 74vw max 340px under the CTAs, strip wraps.

## 9. Sections
1. **How it works** `#how`, cinema. `[ 01 ]` · H2 "One take in. / A finished reel *out.*" · sub.
   Desktop: left a sticky 9:16 stage (top 14vh, height min(72vh, 640px)), right six steps, each
   min-height 64vh, `01 ——` index, title 30px/500, body 17px 62 %. The step crossing the middle
   of the viewport (IO rootMargin −45 % 0 −45 %) is active: full opacity, others 32 %. The stage
   crossfades six screens (600 ms): upload (raw take + progress chip), transcript (words light up
   one by one), pick a look (3×3 looks, one ringed gold), photos on the word (the edit), preview
   (a style render + "Preview" chip), ready (poster + file card). Only the active screen's video
   plays. Mobile: stage sticky at top 64px, 46vh, steps scroll under it.
2. **What the edit does** `#features`, sheet. `[ 02 ]` · H2 "Everything a motion designer / would
   do *by hand.*" · right: beforeAfter.sub. Grid `clamp(300px, 32vw, 420px) 1fr`: the v1 compare
   plate (drag, `#ba-frame`, range `#ba-slider` = percent edited, synced clips, note hover shows
   the whole edit) sticky on the left; the eight notes as a two-column numbered list with hairlines.
3. **Examples** `#styles`, cinema sheet. `[ 03 ]` · H2 "Same take. Different reel. / Or no take
   *at all.*" Compare plate with Play/Pause + range + "Use this style" (`/dashboard/new?style=id`),
   four hover-play tiles, "See all N styles" (`/dashboard/new`). Then "Films from a brief": a
   scroll-snap rail of 9:16 cards (hover plays) → `/dashboard/new?source=brief&kind=id`.
4. **Pricing** `#pricing`, sheet. `[ 04 ]` · H2 "Pay per reel. / Never a *subscription.*" · sub.
   Four cards (radius 28, padding 28): name, price in Instrument Serif 64px, per-reel line, blurb,
   button. Recommended = inverse card (cinema colours) with a gold "Recommended" chip. Links as v1.
   Under 900px: a scroll-snap rail. Note below at 14px.
5. **FAQ** `#faq`, same sheet. Left sticky H2 "Questions, / *answered.*"; right `<details name=faq>`
   rows with hairlines, a + that turns into × (rotate 45°, 300 ms). First open. JSON-LD kept.
6. **Start** `#start`, cinema. H2 "Feel your reel. / Don't just *post it.*" + finalCta.after.
   Right: the edit playing in a 9:16 frame with the v1 form on glass over its lower half
   (title input, source chips, presenter only when enabled, submit pushes
   `/dashboard/new?source&title`).
7. **Footer**: links row as v1 + a ghost "Rasika" wordmark (18vw, ivory 5 %, clipped).

## 10. Motion
| Element | Trigger | Delay | Duration | From → to |
|---|---|---|---|---|
| nav | load | 0 | .8 s | y −16 → 0, opacity |
| badge | load | .15 s | .8 s | y 24 → 0, opacity |
| H1 words | load | .25 + i·.08 s | .7 s | blur 10 → 0, y 40 → −4 → 0, opacity |
| sub, CTAs, strip | load | .7 / .8 / .9 s | .8 s | y 24 → 0 |
| lens frame | load | .4 s | 1.2 s | scale 1.04 → 1, opacity |
| sections | in view 15 % | i·.08 s | .8 s | y 24 → 0 |
Lens: lerp .12 to the pointer, radius 0 → 118px (`@property --lr`, .45 s); idle drift Lissajous
`x = .5 + .26 sin(.5t)`, `y = .5 + .2 sin(.83t)`. Not animated: backgrounds, headings after entry.
Reduced motion: everything at rest state, lens parked centre, no drift.

## 13. Kept from v1 (acceptance)
Nav links `#how #styles #pricing #faq`, CTA `/dashboard`; theme toggle; hero `/dashboard/new` and
`/help`; How it works six steps; `#ba-frame`, `#ba-slider` percent edited; style compare,
`/dashboard/new?style=`, four tiles, see-all link; films `/dashboard/new?source=brief&kind=`;
packs `/dashboard/new`, `/dashboard/credits?pack=`; FAQ JSON-LD + one-open details; start form
`/dashboard/new?source=&title=` with the presenter option gated; footer links; page JSON-LD.

## Switching
`/` renders `LANDING_VERSION` from `app/page.tsx` (env `NEXT_PUBLIC_LANDING` = `v1` | `v2`
overrides it). `/v1` and `/v2` always show each version (noindex, canonical `/`).
