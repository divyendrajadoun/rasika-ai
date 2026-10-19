# Rasika UI redesign brief (for Claude Design)

Paste everything below the line into Claude Design. It describes the product, every page and
section that exists, the assets that must stay, the technical constraints, and the direction.

---

You are redesigning the complete user interface of **Rasika**, a shipping SaaS that turns one
talking-head take into a motion-designed vertical reel (captions on the exact word, poster typography,
counters, photo cards, stock B-roll, sound design) in 93 styles, plus script-only reels, reference
matching and AI-presenter reels. The product, its copy, its data and every piece of functionality
stay exactly as they are. You are changing how it looks and moves, not what it does.

## 1. What must stay (non-negotiable)

- **Stack:** Next.js 15 App Router, React 19, Tailwind v4 with CSS tokens in `globals.css`
  (`@theme inline`), `next/font/local` (Inter 400/600/800, Anton, Instrument Serif Italic, Tiro
  Devanagari), framer-motion already installed. Add Three.js (`three`, `@react-three/fiber`,
  `@react-three/drei`) and GSAP ScrollTrigger or Lenis if you need them. No other UI frameworks.
- **All existing routes and their behaviour:** `/` (landing), `/login` (magic link + password),
  `/dashboard` (project list), `/dashboard/new` (the wizard), `/dashboard/p/[id]` (project page with
  live progress, transcript panel, outputs, photos, brand), `/privacy`, `/terms`, `/auth/callback`,
  `/dev/engine`.
- **Every landing section and its copy, in this order,** sourced from `src/content/landing.ts`
  (do not rewrite the words; restyle them): Nav · Hero (with the real demo video `/demo/after.mp4`
  + poster `/demo/after-poster.webp`) · Before/After (`/demo/before.mp4` vs `/demo/after.mp4`) ·
  Every industry (8 industry cards, each with three poster lines) · How it works (3 steps) · What
  the edit does (8 feature cards with pure-CSS mini demos) · **Styles** ("93 styles, one take": the
  phone compare slider with the raw clip `/demo/styles/raw.mp4` under the chosen style, the grid of
  93 style cards whose hover plays `/demo/styles/<id>.mp4` with poster `/demo/styles/<id>.jpg`,
  family filter chips + search) · Pricing (3 plans + credit packs) · FAQ · Final CTA · Footer.
  The style demo videos are the heart of the page: they are real renders of the same 12 s take in
  every style and must be shown large and playable, not hidden in a carousel.
- **The wizard** (`/dashboard/new`), five steps along a path that depends on the source:
  Source (My take · Script only · Match a reference · AI presenter) → Upload reel (resumable
  multipart, drag and drop, second drop zone for the reference reel + fidelity choice) or Your
  script (textarea, 12 voices, spoken-length and credit estimate) or Presenter (script, your photo
  or a HeyGen look grid, voice select, three consent checkboxes) → Your photos (up to 15, crop
  dialog, "say when" hints) → Style (93 cards with hover demos, family chips, search, "measured
  from …" credit line, captions / music / stock B-roll toggles, SFX slider, language) → Brand &
  ending (title, name, handle, end line, CTA, rights consent, cost in credits, "Create my edit").
- **The project page:** status pill + live progress bar with the worker's messages (streamed over
  SSE), transcript panel (editable words), the finished reel player with 1080p / 720p downloads,
  photo strip, brand block, Pexels photographer credits line, delete.
- **Brand DNA:** the names of the colour tokens and their meaning stay: `stage #3a0a11`,
  `mar #5a0f1a` (maroon), `ter #c8452f` (terracotta, the primary action), `gold #e6b450`,
  `goldd #9a6a14`, `iv #f6ecd8` (ivory), `ink #1a0a0c`. Light (ivory) and dark (maroon) themes,
  switched with `data-theme`. You may add tokens (surfaces, glass, glows) and re-balance how much
  of each colour is used, but Rasika stays maroon-gold-ivory, never purple-blue-gradient generic.
- **Accessibility and performance:** keyboard reachable, visible focus, `prefers-reduced-motion`
  honoured everywhere (no WebGL motion, no parallax), Lighthouse performance ≥ 85 on the landing
  with LCP under 2.5 s on mobile. Text renders before any 3D; the hero video is the LCP element
  today and must stay fast.

## 2. The direction

Trendy, clean, cinematic, with real depth. Think the current wave of WebGL product sites: a
restrained near-monochrome base (ivory in light mode, deep maroon in dark), one hot accent
(terracotta), gold used like foil (hairlines, numerals, highlights), editorial typography with
Anton for display and Instrument Serif italics for the human line, and motion that reveals the
product instead of decorating it.

Three.js, used with discipline:
1. **Hero scene (the signature):** a floating 9:16 "stage" — a thin glass slab with the demo video
   mapped onto it, tilting a few degrees toward the cursor, with gold hairline particles / foil dust
   drifting in shallow depth of field and a soft maroon vignette. On scroll the slab settles into the
   page and hands over to the real `<video>` element. One object, short loop, lazy-loaded after text;
   a static poster fallback on weak devices and when WebGL is unavailable.
2. **Styles section:** the phone compare slider stays 2D (it is a real draggable comparison), but
   the 93-card grid can live on a subtly curved or staggered plane that straightens as you scroll
   into it, with hover lifting a card and playing its demo. Filtering must remain instant.
3. **How it works:** three steps as a scroll-driven sequence: the raw phone clip → words typed on the
   air → poster lines and cards snapping in (you can use the feature cards' existing CSS demos as
   textures or keep them in DOM).
4. Everywhere else WebGL is decorative or absent: pricing, FAQ, login, dashboard, wizard and project
   pages are crisp 2D with micro-interactions only (hover lifts, staggered reveals, progress that
   feels alive).

Motion language: one well-orchestrated page-load reveal (staggered words and cards), scroll-triggered
reveals with easing that decelerates (expo / quint out), 200–400 ms micro-interactions, never bouncy
on text, never linear, and a single "moment" per section. Captions-on-the-word is the product's
soul: echo it once in the hero with words lighting up in sync with the demo audio.

Layout: generous whitespace, asymmetry and overlap allowed (a phone breaking out of its section,
poster type bleeding off the edge), full-bleed video, a sticky nav that compresses, big numerals
(93 styles, 3 steps, ₹ prices) as design elements. Mobile first; the 9:16 demos are the natural
hero on phones.

## 3. Deliverables

1. **Design system:** token sheet (colours per theme, type scale with the three families, spacing,
   radii, shadows / glass, motion durations and curves), with the CSS variable names so they drop
   into `globals.css`.
2. **Landing page design** at 1440 and 390 widths, every section above, with the real demo videos
   placed (use the paths given) and the 93-card grid shown with real card contents (name, tagline,
   family chip, sound chip, "measured from …" line).
3. **Wizard** screens for all four source paths, the style picker with filters, and the final
   review with cost.
4. **Dashboard list, project page (in progress and finished states), login** (both modes).
5. **Three.js spec per scene:** objects, materials, lights, camera moves, what the cursor and scroll
   control, loop length, texture sizes, the fallback image, and the load order (text → video →
   WebGL). Keep triangle counts tiny; no external 3D models — everything is primitives + the real
   video textures + particles.
6. **Animation spec:** per section, what animates, trigger, duration, easing, and the
   reduced-motion variant.
7. **Component map** that names each existing React component (`Nav`, `Hero`, `BeforeAfter`,
   `Industries`, `HowItWorks`, `Features`, `StyleShowcase` with `Compare` and `StyleCard`,
   `Pricing`, `Faq`, `FinalCta`, `Footer`, `Wizard` and its steps, `ProjectCard`, `ProgressView`,
   `TranscriptPanel`) and says what changes visually in each, so an engineer can implement without
   touching data flow.

Do not invent features, plans, prices, testimonials or numbers; use the copy and values that exist.
Where you need a visual that does not exist yet (illustrations, 3D), generate it from the brand
primitives rather than stock imagery.
