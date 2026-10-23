# Rasika: Product Requirements, Growth & Go-To-Market Plan

**Version 1.0 · 23 Oct 2026 · Owner: Divyendra Singh Jadoun (founder)**
**Live product:** https://rasika-ai.netlify.app

> **If you are an LLM reading this:** read §0 first. Everything in §3.1 exists and works today. Everything from §6 onward is a plan, not built. Never describe a planned feature as live in any copy you write. Never invent users, revenue, testimonials, logos or press. Where a fact is missing, write `[FOUNDER TO FILL: …]`.

---

## 0. How to use this document (prompt for another LLM)

Paste the whole document, then this prompt:

```
You are a world-class product strategist, growth marketer and conversion copywriter who has taken
creator tools from zero to $10M ARR (think the early teams behind Captions, OpusClip, Canva and
Notion). You are blunt, specific and allergic to hype words.

Context: the attached PRD for Rasika, an AI reel editor. §3.1 is what exists today; §6+ is the plan.

Rules:
1. Never claim a planned feature is live. Never invent metrics, users, testimonials or press.
2. Every line of copy names a concrete outcome (time saved, a specific reel, a price), never
   adjectives like "revolutionary", "seamless", "unleash", "game-changer", "elevate", "magic".
3. Write for the personas in §4. Default market: India first (English + Hindi), then global English.
4. When you propose a feature, give: the user problem, the smallest version that proves it,
   acceptance criteria, the cost per reel it adds, and which metric in §11 it moves.
5. Ask me for any fact you need instead of guessing; mark gaps as [FOUNDER TO FILL].

Task: [e.g. "Write the Product Hunt launch kit from §13.4" / "Spec Long-to-Shorts (§6.4) in
engineering detail" / "Turn §17 into a day-by-day plan for the next 30 days"].
```

---

## 1. One line, one paragraph, why now

**One line:** Rasika turns one phone video into a studio-edited reel in minutes, and makes whole films from one line of text when you have no video at all.

**One paragraph:** Most small businesses and experts know they should post reels, but editing eats 2–4 hours per reel, or ₹1,500–5,000 per reel paid to a freelancer. Rasika removes the editing step. Upload a talking video (English or Hindi). Rasika cleans the retakes and pauses, writes the on-screen titles, times every caption to the word, lands your photos on the exact word you say them, adds sound design and music, levels loudness for Instagram and renders a 1080×1920 reel. No timeline. No video? Type a brief (a website link, a recipe, two contenders for a fight, a topic) and Rasika writes, designs, scores and renders an animated film.

**Why now**
- Short video is the main growth channel on Instagram, YouTube Shorts, LinkedIn and Facebook. India alone has an estimated ~4 million active creators, most on Instagram, 66% outside the metros (ISB–Hashfame 2025; Kofluence 2026).
- Existing tools are caption-first (Submagic, Captions) or clip-first (OpusClip). None is built around **design** (a real style system), **Hindi done properly** (Devanagari, not romanised) and **films with no footage**.
- LLMs, word-level transcription and programmatic motion design make a full edit cheap enough to sell per reel.

---

## 2. Vision and positioning

**Vision (3 years):** the content studio for every expert and small business that can't afford one: plan → script → shoot (or don't) → edit → design → publish → learn, in one place, in their language.

**Positioning:** For *experts and small businesses who need reels but have no editor*, Rasika is the *AI reel studio* that *turns a phone video or a one-line brief into a designed, captioned, scored reel in minutes*. Unlike *caption apps (Captions, Submagic) and clippers (OpusClip)*, Rasika *designs the whole reel in a real visual style, captions Hindi in Devanagari, and makes films with no footage at all*.

**Brand:** maroon stage, gold accents, ivory text. Craft words, not tech words ("studio", "cut", "take", "render"; never "AI magic"). Tone: a calm senior editor who respects your time.

**Name story:** *Rasika* (Sanskrit) is one who appreciates *rasa*, the essence of a work of art. Tell it on launch.

---

## 3. Current state (23 Oct 2026)

### 3.1 Shipped and working

| Area | What exists |
|---|---|
| **Make a reel** | 3-step wizard: *Your video* → *Style* → *Review & create*. Source switch on step 1: My video · A script · From a brief · Match a reel · AI presenter. Resumable multipart upload. Photos and brand details as optional fold-outs. |
| **Talking-video edit** | Word-level transcription (English + Hindi), retake and filler/pause removal, AI-written titles, word-timed captions, photos placed on the exact word, sound effects, music bed, loudness to −14 LUFS, 1080×1920 render. |
| **Styles** | **107 styles in 9 motion families**: Editorial, Kinetic type, Whiteboard, Chalkboard, Hype cut, Launch film, Paper collage, Colour blocks, Beat type. Each has its own fonts, colours, motion and sound kit. |
| **Films from a brief** | 16 kinds, incl. SaaS launch film from a website URL (captures the real page), 15-second motion showreel, Apple-style app film, recipe explainer, *Versus* comic fight, music machine, storybook journey, animated explainer, editorial explainer, tier list, product film, animate-from-images. |
| **Other sources** | Script-only reels (no speaker), *Match a reel* (edit in the style of a reference), AI presenter. |
| **Edit room** | Click a transcript word to cut it, shift-click for ranges, suggested cuts underlined (retakes, dead air), skip-preview player, *Studio sound* (denoise + compression), re-render (5 free recuts per reel). |
| **Exports** | 9:16, 1:1, 4:5, 16:9 (blurred backdrop fill). |
| **Accounts** | Email sign-up (Supabase Auth, Brevo SMTP). Google sign-in coded, waiting on provider setup. |
| **Billing** | 1 free reel per account. Packs: 1 reel ₹399 · 10 reels ₹2,999 · 30 reels ₹8,000. Manual UPI: QR + UTR → admin approves → credits added. Atomic credit ledger. |
| **Notifications** | Admin email on sign-up and payment; "your reel is ready" email to the user. |
| **Admin** | Approve/reject payments, grant credits, export sign-ups CSV. |
| **Help** | 4 narrated tutorial videos on /help (need re-recording: they show the old 5-step wizard). |
| **Landing page** | 3D hero (curved wall of real reels behind a phone), Examples (4 styles over the raw take + films-from-a-brief rail), features, pricing, FAQ, light/dark. |
| **Security** | RLS on every table; browser roles read-only (fixed 23 Oct); all logic and keys server-side. |

### 3.2 Architecture today
- **Web:** Next.js 15 (App Router, server actions), Tailwind v4, Drizzle + Postgres, on Netlify, deployed by GitHub Actions on push to `main`.
- **Data:** Supabase (Auth, Postgres, S3-compatible storage on the free tier = 1 GB), Upstash Redis job queue.
- **Worker:** Python + ffmpeg; Deepgram (transcription, TTS), Anthropic Claude (planning, titles), Pexels (stock), an avatar provider, Higgsfield (generative video). Runs **in Docker on the founder's PC**.
- **Repo:** `apps/web`, `apps/worker`, `packages/engine`, `packages/schema`, `tools/`.

### 3.3 Known gaps (plan around these honestly)
1. **Rendering runs on one home PC:** no redundancy, throughput of one machine. Biggest launch risk.
2. **Manual UPI only:** no international buyers, no GST invoices, doesn't scale past ~30 orders a day.
3. **Storage 1 GB (free tier):** needs lifecycle deletion or an upgrade before any spike.
4. No analytics, no referral loop, no watermark on free reels, no publishing to Instagram/YouTube.
5. No social proof yet: no testimonials, case studies or usage numbers.
6. Support email on the legal pages is a placeholder.
7. API keys were pasted into chats during the build: **rotate all of them before launch.**

---

## 4. Users

### 4.1 Personas (India first)

| Persona | Who | Job to be done | Today they… | What wins them |
|---|---|---|---|---|
| **The Expert** | Doctor, CA, lawyer, coach, teacher, realtor, trainer; 30–55. | "Turn what I explain to clients every day into reels that bring enquiries." | Record, never post; or pay a freelancer ₹1–5k a reel and wait 3 days. | Looks professional, Hindi done right, zero editing, under ₹300 a reel. |
| **The Small Brand** | D2C founder, jeweller, boutique, café, salon, real-estate agency. | "Post 3–5 reels a week about my products without hiring." | Canva + CapCut at night; inconsistent. | Brand kit, product photos on cue, packs of 30, films from their website. |
| **The Founder / Marketer** | SaaS/startup founder, solo marketer. | "Launch films and explainers without a motion designer." | Fiverr/Upwork at $200–2,000, or skip it. | Launch film from a URL, Apple-style app film, LinkedIn exports. |
| **The Creator** | 5k–200k followers, talking-head or faceless. | "Ship daily without burning out; stand out from the CapCut look." | CapCut templates, Submagic captions. | 107 distinct styles, speed, fun formats, long→shorts (planned). |
| **The Agency** (later) | Social-media agency with 5–50 clients. | "100 reels a month per editor, not 20." | Premiere/CapCut + freelancers. | Workspaces, client brand kits, bulk, white-label. |

### 4.2 Not for now
Long-form YouTubers wanting a full editor; cinematic filmmakers; enterprises needing SSO/SOC 2.

---

## 5. Competitors

List prices from Aug 2026 comparison articles; verify before quoting publicly.

| Product | Core | From | Rasika wins on | They win on |
|---|---|---|---|---|
| **Captions** | Mobile AI editing, avatars, dubbing | ~$9.99/mo | Style system, Hindi, films with no footage | Mobile app, brand, avatars, dubbing |
| **Submagic** | Animated captions, B-roll, zooms | ~$12/mo | Designed reels vs caption overlays; brief films | Price, speed, creator base |
| **OpusClip** | Long video → clips, virality score | ~$15/mo | Short-native design, Hindi | Clipping, scheduling |
| **CapCut** | Free manual editor + templates | Free/Pro | No timeline; done for you | Free, templates, reach |
| **Descript** | Text-based editing | ~$12–24/mo | Reel-first design, no learning curve | Long-form, podcasts |
| **HeyGen / Synthesia** | AI avatars | ~$24+/mo | Your own face and voice; price | Avatar quality, translation |
| **Freelance editor** | Human | ₹1,500–5,000/reel | 10× cheaper, minutes not days | Taste, judgement, revisions |

**Moat to build:** (1) the style library + motion engine, (2) Indian-language quality, (3) brief-to-film formats, (4) performance data on which styles/hooks work per industry (once publishing + analytics ship).

---

## 6. Ecosystem roadmap

Each module: problem → MVP → acceptance criteria (AC) → priority.
**P0** = before launch · **P1** = within 90 days · **P2** = 3–9 months · **P3** = later.

### 6.0 Foundations (P0: do before spending on marketing)
- **Cloud rendering:** workers on rented machines (RunPod / Modal / Hetzner / Fly) autoscaled from the Redis queue; the PC becomes overflow. *AC:* 20 reels in parallel; p95 time-to-reel < 6 min for a 60 s take; no single point of failure.
- **Payments:** Razorpay for India (UPI, cards, GST invoices) + a merchant-of-record for international (Stripe, Lemon Squeezy, Paddle or Dodo Payments). Manual UPI as fallback. *AC:* a US buyer pays by card and gets credits in < 10 s without the admin.
- **Storage lifecycle:** delete raw uploads after 30 days, renders after 90; paid storage. *AC:* alert at 70% full.
- **Analytics:** PostHog events for visit → sign-up → upload → first render → download → purchase → second reel. *AC:* funnel dashboard live.
- **Watermark + "Made with Rasika" end card** on free reels (removed on paid): the viral loop.
- **Referral:** give a friend 1 reel, get 1 reel when they render their first.
- **Support:** real support email, WhatsApp support (India), status page.

### 6.1 More styles (P1, ongoing)
- **MVP:** +40 styles in 90 days, new families: *Podcast clip* (waveform + speaker card), *News ticker*, *Notes app*, *Retro VHS*, *Luxury serif*, *Bollywood poster*, *Festival packs* (Diwali, Holi, Eid, Onam, Pongal, Durga Puja, Christmas), *Real-estate listing*, *Clinic trust*, *Finance chart*.
- **Style of the week** drop + email (retention + social content).
- **Live preview** of a style on the user's own first 5 seconds.
- **Steal a style (P2):** upload any reel, Rasika extracts its fonts, colours and pacing into a custom style (extends *Match a reel*).
- *AC:* every style has a demo on the same raw take, tagged by industry and mood, filterable in the wizard.

### 6.2 Languages & captions (P1)
- Native-script captions in **Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Punjabi**; Hinglish handling (choose script).
- **Caption translation:** speak Hindi, show English captions, and vice versa.
- **Dubbing (P2):** your voice in another language; consent + voice-clone safeguards.
- *AC:* word error rate < 10% on a 50-clip test set per language; never romanised unless chosen.

### 6.3 Talking-head studio (P1)
- **Teleprompter + in-browser recorder:** script on screen → record → straight into the edit.
- **Hook lab:** topic → 10 hooks scored for clarity and curiosity → pick one → 30/45/60 s script in the user's own voice (learned from their past transcripts).
- **Punch-in zooms on emphasis, background blur/replace, eye-contact fix, text behind the head.**
- **Multi-take:** upload several clips; Rasika keeps the best take of each sentence.
- *AC:* a first-time user goes topic → script → recording → rendered reel in < 15 min on a phone.

### 6.4 Long video → shorts (P1)
- Upload or paste a link (≤ 2 h podcast, webinar, live, YouTube video). Rasika finds 5–15 self-contained moments (hook, completeness, emotion), reframes to 9:16 with speaker tracking, applies a style, renders.
- Preview suggested clips free at low resolution; 1 credit per clip kept.
- *AC:* ≥ 60% of suggested clips rated "postable" by testers; speaker in frame ≥ 95% of the time.

### 6.5 Motion graphics studio (P1–P2)
- **Motion packs from the brand kit:** logo sting (3 s), follow/subscribe end card, lower third, title card, animated chart from CSV/text, "3 tips" card, quote card, testimonial card.
- **Text to motion:** "animated bar chart of our revenue 2022–2026" → render.
- Export MP4, plus transparent WebM/MOV for people editing in CapCut/Premiere.
- *AC:* brand colours and fonts applied automatically; transparent export opens in CapCut and Premiere.

### 6.6 More brief formats (P1)
Before/after transformation · Myth vs fact · Day in the life (from photos) · Product unboxing from product photos · Property tour from listing photos · Course trailer · Event promo · Testimonial film from a pasted review · News explainer from an article URL · Quiz/poll reel · Launch countdown teaser.

### 6.7 AI presenter & UGC ads (P2)
- **Digital twin** from a 2-minute consent video, or stock presenters; script → presenter reel in any style.
- **UGC ad generator:** product URL → 3 ad variants (hook, presenter, captions, CTA) exported for Meta Ads.
- **Safeguards:** verified consent, no public-figure likeness, optional "AI-generated" label, abuse reporting.

### 6.8 Thumbnails & covers (P1)
Reel cover + YouTube thumbnail: face cut-out, big text, brand colours, 3 variants.

### 6.9 Plan, publish, learn (P2)
- **Planner:** industry + goal → 30-day calendar of ideas, hooks and scripts; one click opens the wizard pre-filled.
- **Publish & schedule** to Instagram (Graph API, Business/Creator accounts), YouTube Shorts, Facebook, LinkedIn; generated captions and hashtags.
- **Analytics:** views, reach, saves per reel; learn what works for this user and industry → recommendations.
- *AC:* schedule a week of reels in < 5 min; daily analytics refresh.

### 6.10 Asset library (P2)
Licensed B-roll + generative B-roll, music with clear commercial licensing ("safe for Reels/Shorts"), SFX, stickers, user uploads library, multiple brand kits.

### 6.11 Teams, agencies, API (P3)
Workspaces, seats, client brand kits, client approval links with comments, bulk create from CSV, white-label share pages, public API + Zapier/Make ("new blog post → reel").

### 6.12 Mobile (P2)
PWA first: installable, "Share to Rasika" share target from the phone gallery, upload from WhatsApp. Native apps later.

### 6.13 Build order (impact × confidence ÷ effort)
1. Foundations (cloud rendering, payments, analytics, watermark + referral)
2. Long → shorts
3. Teleprompter + Hook lab
4. Indian languages
5. +40 styles & festival packs
6. Motion packs
7. Thumbnails/covers
8. Planner + publish + analytics
9. Presenter/UGC ads
10. Teams/API

---

## 7. Core flow requirements (for engineers)

### 7.1 Make a reel
1. Source chosen (default *My video*). MP4/MOV/WebM, ≤ 60 s free / ≤ 180 s paid, size limit [FOUNDER TO FILL].
2. Resumable upload that survives refresh; real progress.
3. Style step: 4 recommended for the detected industry + "see all"; live preview on the user's first 5 s (P1).
4. Review: title, optional photos, brand kit, language, music; credit cost shown; one credit charged atomically on create.
5. Progress: stages (transcribing → planning → designing → rendering) with honest ETA; email on completion.
6. Result: play, download in all aspect ratios, edit room, recut (5 free), share link.

**Non-functional:** p95 time-to-reel ≤ 6 min (60 s take); render success ≥ 98%; failed renders refund the credit automatically; every state recoverable after refresh; WCAG AA; works on a ₹10k Android phone on 4G.

### 7.2 Credits
One credit = one rendered reel or brief film. Recuts free up to 5. Exports free. Long→shorts: one credit per clip kept. Automatic refund on failure (ledger reason `refund`).

### 7.3 Safety & compliance
- Consent line on create ("you own or have rights to this video").
- Presenter/digital twin: verified consent; no public figures.
- Music: licensed only, labelled.
- India: GST invoices; **DPDP Act 2023** (purpose notice, deletion on request). EU/US: GDPR/CCPA basics; the merchant-of-record handles VAT/sales tax.
- State clearly whether uploaded videos are used to improve models [FOUNDER TO FILL].

---

## 8. Unit economics (fill in real numbers)

| Step | Provider | Cost per 60 s reel |
|---|---|---|
| Transcription | Deepgram | [FOUNDER TO FILL] |
| Planning, titles | Claude | [FOUNDER TO FILL] |
| TTS (brief films) | Deepgram Aura | [FOUNDER TO FILL] |
| Stock / generative | Pexels / Higgsfield | [FOUNDER TO FILL] |
| Render compute | PC → cloud | [FOUNDER TO FILL] |
| Storage + egress | Supabase | [FOUNDER TO FILL] |
| **Target gross margin** | | **≥ 75% at ₹300 a reel** |

Rule: every new feature states its added cost per reel before it's built.

---

## 9. Pricing

**Today (India):** first reel free · 1 reel ₹399 · 10 reels ₹2,999 (₹300 each) · 30 reels ₹8,000 (₹267 each).

**Proposed global plans (to test, not decided):**

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 2 reels/month, watermark, 60 s, 720p |
| Creator | $19/mo (₹999) | 15 reels/mo, no watermark, 180 s, all styles, 1 brand kit |
| Pro | $49/mo (₹2,499) | 50 reels/mo, long→shorts, motion packs, scheduling, 3 brand kits |
| Agency | $149/mo | 200 reels, 5 seats, client workspaces, white-label |
| Packs | one-off | keep the current packs for people who dislike subscriptions |

Annual = 2 months free. Any launch offer must be real and honoured.

---

## 10. Non-goals (next 6 months)
A manual timeline editor · output longer than 3 min · enterprise features · native apps (PWA first).

---

## 11. Metrics

| Layer | Metric | Target 90 days after launch |
|---|---|---|
| **North star** | Reels downloaded per week | baseline after 2 weeks |
| Activation | Sign-ups who render a first reel within 24 h | ≥ 45% |
| Time to value | Median sign-up → first reel | ≤ 10 min |
| Quality | Reels downloaded without a recut | ≥ 60% |
| Conversion | Free → paid within 14 days | ≥ 5% |
| Retention | Paying users rendering in week 4 | ≥ 40% |
| Virality | K-factor (watermark + referrals) | ≥ 0.2 |
| Reliability | Render success / p95 time | ≥ 98% / ≤ 6 min |
| Revenue | MRR, ARPU, gross margin | [FOUNDER TO FILL] |

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Launch spike overwhelms the home-PC worker | High | Severe | Cloud workers, queue position shown, cap free sign-ups/hour |
| Manual UPI can't handle volume or foreign buyers | High | High | Razorpay + merchant-of-record before launch |
| Storage fills (1 GB) | High | High | Lifecycle rules + paid plan |
| AI cost exceeds price on long reels | Medium | Medium | Cost gate per feature (§8) |
| Big player copies the styles | Medium | Medium | Weekly style drops, language depth, brief formats |
| Music / likeness legal issues | Medium | High | Licensed library, consent flows, takedown process |
| Leaked API keys | Medium | High | Rotate every key before launch |

---

## 13. Launch & marketing copy

### 13.1 Strategy in one paragraph
Launch India-first where Rasika is uniquely good (Hindi, ₹ pricing, experts and small brands), with founder-led content that *is* the product (every post is a Rasika reel). Then go global through Product Hunt, creator communities and SEO pages for every style, format and industry. Free reel + watermark + referral is the growth loop; weekly style drops are the content engine.

### 13.2 Messaging pillars
1. **Talk to your phone. Post like a studio.** (outcome)
2. **No timeline, ever.** (effort removed)
3. **107 looks, not one caption template.** (difference)
4. **Hindi in Hindi.** Devanagari captions, not romanised. (local truth)
5. **No video? Type one line.** (brief films)
6. **₹300 a reel, not ₹3,000.** (anchor vs freelancers)

**Never use:** revolutionary, seamless, unleash, supercharge, game-changing, elevate, magic, effortless, cutting-edge, "AI-powered" as a headline.

### 13.3 Website copy (draft v2)

**Hero**
- Kicker: *AI reel editor · English & हिन्दी*
- H1: **Talk to your phone. Post like a studio.**
- Sub: *Upload one talking video. Rasika cuts the retakes, writes the titles, times every caption to the word, lands your photos on cue, adds sound and renders the reel. About five minutes. No timeline.*
- CTA: **Make my free reel →** · secondary: *Watch the 2-minute tour*
- Trust row: *First reel free, no card · English + Hindi · 1080×1920 · Ready for Reels, Shorts and LinkedIn*

**Problem strip:** *You know what to say. Editing is the part that never happens. A freelancer costs ₹1,500–5,000 and three days. CapCut costs your evening.*

**How it works**
1. *Upload a phone video.* Retakes, ums and long pauses are fine.
2. *Pick a look.* 107 styles, from editorial to chalkboard to launch film.
3. *Download the reel.* Or click any word to cut it and render again.

**Examples:** *Same take. Different reel. Or no take at all.*

**No footage:** *No video? Type one line. A website link becomes a launch film. A recipe becomes an explainer. Two names become a comic fight.*

**For whom (tabs):** Doctors · Coaches · Realtors · Founders · Brands, each with one reel and one line, e.g. *Doctors: answer one patient question a week, in the language your patients speak.*

**Pricing headline:** *Pay per reel. ₹399 for one, ₹300 each in a pack of ten. Your first reel is free.*

**FAQ must answer:** Is it really no editing? · How good is the Hindi? · Can I change things? · Who owns the video? · Will Instagram mute the music? · What if a render fails? (credit back) · Refunds? · Is my video used to train AI?

**Final CTA:** *Your next reel is already on your phone.* **Make it free →**

### 13.4 Product Hunt kit

- **Tagline options (≤ 60 chars):** *Turn a phone video into a studio-edited reel* · *Talk to your phone, post like a studio* · *107 reel styles, zero timeline*
- **Description (≤ 260 chars):** *Upload a talking video and Rasika cuts retakes, writes titles, times captions to the word, places your photos on cue, adds sound and renders a 9:16 reel. No footage? Type a brief and get an animated film. English + Hindi. First reel free.*
- **Topics:** Video, Artificial Intelligence, Marketing, Social Media.
- **Gallery order:** (1) 30 s before/after split screen; (2) the same take in 8 styles; (3) URL in → launch film out; (4) edit room, click a word to cut; (5) Hindi Devanagari captions; (6) price vs a freelancer. Image 1 must make sense with no text.

**Launch video (≤ 60 s), made in Rasika:**
- 0–3 s: shaky raw phone clip, founder: *"This took me 40 seconds to record…"*
- 3–6 s: hard cut to the finished reel: *"…and this is what Rasika made from it."*
- 6–25 s: upload → style → render; flick through 6 styles on the same take.
- 25–40 s: *"No video? Type one line."* URL → launch film.
- 40–55 s: Hindi take with Devanagari captions; click-to-cut in the edit room.
- 55–60 s: *"Your first reel is free."* + URL.

**Maker's first comment (draft):**
> Hi Product Hunt 👋 I'm Divyendra. I built Rasika because the doctors, coaches and shop owners around me had the same problem: they knew what to say on camera, but editing never happened. A freelancer costs days and money; CapCut costs evenings.
>
> Rasika removes the editing step. Upload a phone video and it cleans retakes and pauses, writes the titles, times captions to every word, drops your photos on the word you say them, adds sound design and renders. No video? Type a brief: a website link becomes a launch film, two names become a comic fight.
>
> Two things I care about: **design** (107 real styles, not one caption template) and **Hindi done right** (Devanagari, not romanised).
>
> Everything in the gallery was rendered by Rasika. Your first reel is free. I'd love your harshest feedback: which style would you actually post, and what's missing?

**Timeline**
- **T−42 to T−14:** build in public daily (a Rasika reel each day); collect launch-day emails; 100 personal beta DMs; 10+ real testimonials with permission; be genuinely active on Product Hunt from the founder account; create the "coming soon" page.
- **T−14 to T−3:** fix the top 10 beta issues; foundations (§6.0) live; gallery, video, first comment and FAQ replies ready; launch at 12:01 AM PT (Tue–Thu for volume; weekend for an easier #1).
- **Launch day:** founder online 18 h; reply to every comment fast and personally; share everywhere asking for *feedback*, never "upvote me" (Product Hunt penalises vote rings and brand-new accounts); hourly updates on X.
- **T+1 to T+7:** thank-you post with honest numbers; email every sign-up; ship 3 fixes from PH feedback and say so; submit to directories (§17.4).

**Success = top 5 of the day + 500 sign-ups + 50 paying users**, not the badge.

### 13.5 LinkedIn (founder-led)
**Rules:** the first 1–2 lines decide everything; lead with a specific claim or number, never "Excited to announce"; comments and saves outweigh likes; 3–5 posts a week on one theme; native video (the post itself is a Rasika reel).

**Post 1: launch**
> I recorded a 40-second video on my phone in one take.
> Rasika turned it into this reel in 5 minutes. 👇
>
> No timeline. No editor. No "I'll edit it this weekend".
>
> What happened under the hood:
> → cut my two retakes and every long pause
> → wrote the titles
> → timed each caption to the exact word
> → dropped my product photo on the word "ring"
> → added sound and levelled the audio for Instagram
>
> I built Rasika because every doctor, coach and shop owner I know has the same problem: they know what to say, but editing never happens.
>
> Your first reel is free → [link]
> Which industry should I make a demo for next? Comment and I'll make one free.

**Post 2: contrarian**
> Captions aren't editing.
> Most "AI video editors" put bouncing words on your face and call it done.
> A real editor does six things: cuts, structure, titles, B-roll on cue, sound, pacing.
> Here's the same 12-second take in 4 styles, all made by Rasika. Which would you post: 1, 2, 3 or 4?

**Post 3: Hindi**
> Most AI caption tools write Hindi like this: "aap kaise ho".
> Your audience reads it like this: "आप कैसे हो".
> We built Rasika to caption Hindi in Hindi. 🎥

**Post 4: no footage**
> I pasted our website link. Rasika made this 30-second launch film.
> No designer. No After Effects. No stock footage.
> Launching something this month? Comment "film" and I'll make yours free.

**Post 5: weekly build in public (real numbers only)**
> Week 3 of Rasika: [X] reels rendered, [Y] paying users, the bug that cost me a night, and what I'm shipping next.

### 13.6 Instagram / YouTube Shorts engine (every reel made in Rasika)

| Day | Format | Example |
|---|---|---|
| Mon | Before/after | raw take vs Rasika reel, industry rotates |
| Tue | Founder talking-head tip | "3 hooks that work for doctors" |
| Wed | Style drop | "New style: Bollywood Poster", same take |
| Thu | Brief film | "I typed 'chai vs coffee'. Here's the fight." |
| Fri | User reel (with permission) | creator spotlight |

**Talking-head scripts (30–45 s)**
1. *Hook:* "Stop paying ₹3,000 for one reel." → what an editor really does → Rasika does it from a phone take → *first reel free, link in bio.*
2. *Hook:* "If you freeze on camera, do this." → say it in 3 short takes, retakes are fine, Rasika keeps the best.
3. *Hook:* "Doctors: one reel a week, no editor." → pick one patient question, answer it in 40 s in Hindi, upload.
4. *Hook:* "Your captions are in the wrong script." → Devanagari vs romanised.
5. *Hook:* "I made a launch video from a URL." → screen → film.

**Helping-creators series (motion-graphics value content):** "5 caption styles and when to use each" · "Hook formulas that work" · "Why −14 LUFS matters" · "The 3-second rule" · "How to film yourself with just a phone" · "Lighting with a window".

---

## 14. Skills & tools

| Need | Resource | Notes |
|---|---|---|
| Landing, pricing, feature copy | `coreyhaines31/marketingskills` (`copywriting`, `copy-editing` and related skills) | `npx skills add coreyhaines31/marketingskills --skill copywriting --agent claude-code`; give it this PRD as product context |
| Brand voice | brand-voice skills | Feed §2 and §13.2 |
| Frontend design | `frontend-design` skill | Used for the current landing page |
| Video features | tenfoldmarc/video-edit-skill, Melvynx/video-agent-skills, ffmpeg skills | Ideas for motion packs and clipping |
| Launch | Product Hunt official launch guide (producthunt.com/launch) | Vendor guides disagree on numbers |
| Analytics | PostHog | Free tier is enough at launch |
| Payments | Razorpay (India); Stripe / Lemon Squeezy / Paddle / Dodo (global) | Merchant-of-record handles global tax |
| Email | Brevo (already set up); Loops or Resend for lifecycle emails | |

---

## 15. Open questions for the founder
1. Public support email and WhatsApp number?
2. Real cost per reel today (§8)?
3. Willing to test subscriptions, or packs only?
4. Monthly budget for cloud rendering, storage and ads?
5. Are uploaded videos ever used to improve models?
6. Target Product Hunt date?
7. Which 3 industries to lead with in India?
8. Any real beta users or testimonials now?

---

## 16. The complete user-growth strategy (beyond Product Hunt)

Product Hunt is one day. Users come from a **system**: a product that spreads itself, content that compounds, communities that trust you and partners who bring their audiences. This section is that system.

### 16.1 The growth model: four loops

| Loop | How it runs | What to build | Metric |
|---|---|---|---|
| **1. Watermark loop** (product-led) | Free user posts a reel → "Made with Rasika" end card → viewers click → sign up → post their own | A tasteful 1.2 s end card on free reels; a share page per reel with "Make one like this" | Sign-ups per 1,000 reel views |
| **2. Referral loop** | User invites → friend gets 1 reel → friend renders → inviter gets 1 reel | Referral link in the dashboard, after every download, and in the "reel ready" email | Invites per active user; K-factor |
| **3. Content loop** (founder + brand) | Every Rasika post *is* a demo → viewers try → their reels become new content (with permission) | 5 reels a week across Instagram, YouTube Shorts, LinkedIn, X; a user-spotlight pipeline | Profile visits → sign-ups |
| **4. SEO loop** | Each style, format, industry and comparison gets a page with a real demo → ranks → visitors make reels → new demos | Programmatic pages (§16.6) generated from the style and brief configs | Organic sign-ups per week |

**Rule:** no paid traffic until activation ≥ 40% and free→paid ≥ 4%. Fix the bucket before filling it.

### 16.2 Stage plan: first 10 → 100 → 1,000 → 10,000 users

**Stage 0: the first 10 power users (weeks 1–2). Do things that don't scale.**
- Make reels with 10 people you know (doctor, realtor, coach, jeweller, café owner). Sit with them while they use it, in person or on screen share. Note every hesitation; fix it the same day.
- Ask each: "How would you feel if you could no longer use Rasika?" Track the share answering "very disappointed" (target 40%+, the Sean Ellis test).
- Get permission to show their before/after: your first testimonials.

**Stage 1: the first 100 (weeks 2–5). Founder-led outreach.**
- **100 personal DMs, each with value already delivered.** Find people posting raw, unedited reels (Instagram search by city + profession: "dermatologist Jaipur", "realtor Gurgaon"). Run *their* raw reel through Rasika *before* you message, then send: *"I ran your reel from yesterday through a tool I built. Here's the result, free, yours to post."* This beats any pitch.
- **"Comment and I'll make yours free"** posts on LinkedIn and Instagram (§13.5).
- Share in WhatsApp groups you genuinely belong to (alumni, professional associations, local business groups), always with a real reel.
- **Weekly live office hours:** "Send me your raw video, I'll edit it live with Rasika" (Instagram/YouTube Live).

**Stage 2: the first 1,000 (weeks 5–10). Launch moments + communities.**
- Product Hunt (§13.4), Show HN, Indie Hackers, Reddit, directories (§16.4).
- 20 micro-creators (5k–50k followers) in target industries (§16.5).
- Industry communities: doctors, CAs, realtors, coaches (§16.3).
- SEO pages and the weekly style drop begin.

**Stage 3: the first 10,000 (months 3–9). Scale what worked.**
- Double down on the 2 channels with the lowest cost per activated user; cut the rest.
- Affiliates, agency partners, integrations (Shopify app, Zapier).
- Paid ads with before/after creatives, only when unit economics allow (§16.8).
- New Indian languages (Marathi, Tamil, Telugu, Bengali): each is a regional launch moment.
- International: the Indian diaspora first (Hindi + English), then English-speaking experts in the US/UK/UAE/SEA.

### 16.3 Industry playbooks (India first)

| Industry | Where they gather | Hook | Offer |
|---|---|---|---|
| **Doctors / clinics** | IMA city chapters, specialty WhatsApp groups, LinkedIn | "Answer one patient question a week, in Hindi, without an editor" | 3 free reels for clinics; patient-education style pack |
| **Realtors** | City broker WhatsApp groups, property-portal agent forums, LinkedIn | "Every listing walkthrough becomes a reel in 5 minutes" | Property-tour format; agency pack of 30 |
| **Coaches / educators** | Instagram, YouTube, course platforms (Graphy, Exly, Teachable) | "One class recording → 10 reels" (with long→shorts) | Course-platform partnerships; student discount |
| **CAs / finance** | ICAI networks, LinkedIn, Telegram finance groups | "Explain one tax rule a week before your competitor does" | Finance-chart style; tax-season calendar |
| **D2C / small brands** | Shopify India community, D2C founder groups, Instagram | "Your product photo lands on the word you say it" | Product film from photos; 30-reel pack |
| **Restaurants / cafés** | Food-delivery partner groups, local food creators | "Your menu in 30 seconds" | Recipe/menu format |
| **SaaS founders** | LinkedIn, X, Indie Hackers, Product Hunt | "Paste your URL, get a launch film" | Free launch film for the first 50 founders launching on PH |
| **Fitness / yoga** | Instagram, gym-owner groups | "Form tips with captions that hit every rep" | Beat-type styles |

Each industry gets a landing page (`/for/doctors`), 3 demo reels, a 10-idea content calendar, an outreach list of 100 and one partner (an association or community).

### 16.4 Launch platforms & directories (staggered, all of them)

| When | Platform | Angle |
|---|---|---|
| Week −2 | BetaList; Product Hunt "coming soon" page | waitlist |
| Launch day | **Product Hunt** | full kit (§13.4) |
| Launch +1 | **Hacker News, Show HN** | technical: word-timed captions, retake detection, a motion engine without After Effects; link a technical write-up |
| Launch +2 | Indie Hackers | founder story with real numbers |
| Launch +3 | Reddit: r/SideProject, r/InstagramMarketing, r/smallbusiness, r/IndiaStartups, r/NewTubers, r/socialmedia | value-first post with a demo; follow each subreddit's rules |
| Launch week | AI directories: There's An AI For That, Futurepedia, Toolify, TopAI.tools, SaaSHub, AlternativeTo (as an alternative to Submagic, Captions, OpusClip, CapCut) | listings |
| Launch +2 weeks | India: Inc42, YourStory, Entrackr pitches; Startup India; Nasscom communities | press + community |
| Month 2 | Lifetime-deal sites (AppSumo), optional, only with cloud capacity and a cap | cash + users; risk of low-fit users |
| Ongoing | Peerlist, Uneed, Microlaunch, Fazier and similar | small, steady |

### 16.5 Creator & partner programme
- **Micro-creator seeding:** 20 creators (5k–50k) per quarter in target industries; 60 days of free reels; ask for honest use, not ads. Fans become affiliates.
- **Affiliates:** 30% recurring for 12 months; tracked links; monthly payouts (e.g. Rewardful/Tolt on top of the payment provider).
- **Agency partners:** 10 social-media agencies on a white-label pilot at 40% off; a case study after 30 days.
- **Education partners:** coaching programmes and course platforms bundle Rasika for their students.
- **Associations:** one session at a medical association, realtors' meet or CA study circle: "Post one reel a week in 10 minutes", live demo.
- **Integrations:** Shopify app (product → reel), Zapier/Make (new blog post → reel).

### 16.6 SEO & content marketing

**Programmatic pages (generated from config, each with a real render):**
- `/styles/<style>`, 107+ pages: name, demo, best for, how to use
- `/films/<format>`, 16+ pages, e.g. "recipe explainer video maker"
- `/for/<industry>`, 15 pages
- `/vs/<competitor>`, 6 honest comparison pages (Submagic, Captions, OpusClip, CapCut, Descript, freelancers)
- `/how-to/<task>`: "how to add Hindi captions to Instagram reels", "how to remove ums from a video", "how to make a video from a website", "how to edit reels without CapCut"
- Hindi pages for Hindi searches (e.g. "रील कैसे एडिट करें")

**Free tools (lead magnets that rank):** hook generator · romanised → Devanagari caption converter · reel script writer · loudness (LUFS) checker · caption style previewer. Each ends with "Make the reel →".

**Long-form (2 a month):** industry guides ("Reels for realtors: the complete guide"), data posts (only with real data), founder build-in-public essays.

### 16.7 Activation & onboarding (turn sign-ups into users)
- **Try before sign-up (P1):** pick a style on the landing page and watch it play on a sample take; then ask for an email.
- **No video ready?** Offer "Make a 15-second film from one line now" so value arrives in under 3 minutes.
- **Sample video** button for people who just want to see it work.
- **One question at sign-up:** "What do you do?" → recommended styles, example scripts and a content calendar for that industry.
- **Onboarding checklist:** ① first reel ② the same take in a second style ③ cut one word in the edit room ④ add your brand kit ⑤ invite a friend (free reel).
- **Lifecycle email / WhatsApp:**
  - Day 0: "Your free reel is waiting. Here's a 40-second script for a [industry]."
  - Reel ready: download link + "see it in 2 more styles (free recuts)".
  - Day 2, no reel yet: "Stuck on what to say? 5 hooks for [industry]."
  - Day 5: a user spotlight from their industry.
  - Day 7: "₹300 a reel in a pack of ten" + referral link.
  - Weekly: Style of the week.
- **Win-back at 30 days inactive:** "A new style, already applied to your last take" (if cost allows).

### 16.8 Monetisation & conversion levers
- The free reel shows full quality (no crippled preview) but carries the end card; removing it is a reason to pay.
- Upsell packs at the moment of delight: right after the first download.
- "10 reels for the month" bundle that includes a content calendar.
- GST invoices unlock business buyers.
- Annual plans for agencies and power users.
- **Paid ads only when CAC < ⅓ of 90-day revenue per user.** Creatives: before/after split screens made in Rasika, industry-specific, Hindi + English. Start on Meta (Instagram feed + Reels) in India at ₹1–2k a day; 5 creatives × 3 audiences; kill losers after 3 days.

### 16.9 Retention (why they come back)
- Content calendar + weekly nudge: "Your Tuesday reel: here's the idea and the script."
- Style of the week; festival packs (Diwali, Holi, Eid, Independence Day, New Year) released 2 weeks before each date.
- Gentle streaks: "4 weeks in a row."
- Performance feedback once publishing ships: "Your chalkboard reels get 2× more saves."
- Brand kit + saved favourite styles make every next reel faster.

### 16.10 Community & trust
- **Rasika Creators** WhatsApp community (India) + Discord (global): a weekly challenge; the best reel is featured and earns credits.
- Public changelog and a roadmap voting board: users watch their requests ship.
- **Wall of reels** on the website: real user reels, with permission, filterable by industry.
- Fast, human support: the founder replies personally for the first 6 months.
- Plain privacy promise ("your video is yours; never used to train models"), only if true.

### 16.11 PR & founder brand
- Angles: *an Indian founder built an AI editor that captions Hindi in Hindi* · *₹300 reels for India's 4 million creators* · *how doctors use AI to post patient education in Hindi*.
- Targets: YourStory, Inc42, Entrackr, Economic Times, Mint; creator and startup podcasts; YouTubers who review AI tools (send a free account and a reel made from *their* content).
- Speak at startup meetups, college fests (student creators) and industry association events.

### 16.12 International expansion
1. Indian diaspora (US, UK, UAE, Canada): same Hindi + English messaging.
2. English-speaking experts and small businesses via Product Hunt, comparison pages and LinkedIn.
3. Next languages by size and competition: Spanish, Brazilian Portuguese, Indonesian, Arabic, each with native-script captions and a regional launch.
- Local-currency pricing through the merchant-of-record; purchasing-power pricing for emerging markets.

### 16.13 Weekly operating rhythm

| Day | Growth work |
|---|---|
| Mon | Funnel review (sign-ups, activation, conversion, churn); choose ONE metric to move this week |
| Tue | Ship one growth experiment (copy, onboarding step, SEO pages) |
| Wed | Style drop + content batch (record 5 talking-head takes, render them in Rasika) |
| Thu | Outreach: 20 personalised DMs with pre-made reels + 2 partner conversations |
| Fri | 3 × 15-min user calls; read every support message; update the roadmap |
| Daily | One post (rotate platforms); reply to every comment the same day |

**Experiment log:** hypothesis · metric · change · audience · duration · result · keep/kill.

### 16.14 First experiments
1. Hero CTA: "Make my free reel" vs "Edit my first reel free".
2. Sign-up wall before upload vs after choosing a style.
3. Default style per industry vs one default for everyone.
4. End card on vs off for free reels → effect on referral sign-ups.
5. Headline price "₹300 a reel" vs "₹2,999 for 10".
6. No-video users: sample video vs "make a film from one line now".
7. DMs with a pre-made reel vs a plain message.
8. Hindi landing page vs English for Hindi-speaking visitors.

### 16.15 Budget scenarios (monthly)

| Scenario | Spend | Mix |
|---|---|---|
| **Bootstrap** | ₹10–25k | cloud render + storage, free analytics tier, creator seeding paid in credits, organic only |
| **Push** | ₹50k–1.5L | + micro-creator fees, Meta ad tests at ₹1k/day, PR outreach, a part-time content helper |
| **Scale** | ₹3L+ | + ads at proven CAC, affiliate payouts, agency programme, one growth hire |

---

## 17. 90-day calendar

| Weeks | Product | Growth |
|---|---|---|
| 1–2 | Cloud workers, Razorpay + global payments, PostHog, watermark + referral, storage lifecycle, rotate keys, re-record tutorials, real support email | 10 power users in person; daily build-in-public; waitlist |
| 3–4 | Teleprompter + Hook lab MVP, onboarding checklist, industry question, +10 styles, `/for/<industry>` and `/styles/<style>` pages | 100 DMs with pre-made reels; 10 testimonials; first micro-creators; WhatsApp community |
| 5 | Load test (50 parallel renders), fix the top beta issues, sample video | **Product Hunt** → Show HN → Indie Hackers → Reddit → directories |
| 6–8 | Long → shorts MVP, 2 more Indian languages, thumbnails/covers | Affiliates live; agency pilots; India press pitches; first association talk |
| 9–12 | Motion packs, content planner, Instagram publishing (beta), a festival pack timed to the next festival | Comparison pages; first Meta ad tests if funnel targets are met; monthly style drops; cut the weakest channels |

**90-day goals (to confirm):** 3,000 sign-ups · 45% activation · 150 paying customers · 5 agency pilots · 2 channels with a proven cost per activated user.

---

## Sources (research, Oct 2026)
- Product Hunt launch guide (official): https://www.producthunt.com/launch
- Launch playbooks (vendor blogs, numbers rough): https://app.getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026 · https://hub.causo.ai/guides/product-hunt-launch-2026-realistic-playbook · https://blog.innmind.com/how-to-launch-on-product-hunt-in-2026 · https://www.tooljunction.io/guides/product-hunt-launch-checklist-2026
- Competitor pricing comparisons: https://www.castmagic.io/blog/opus-clip-alternatives · https://jupitrr.com/alternatives/submagic-alternatives · https://pictory.ai/blog/opusclip-alternatives
- Marketing skills: https://www.vibeindex.ai/skills/coreyhaines31/marketingskills/copywriting · https://claudecodeformarketers.com/blog/claude-code-skills-for-marketers/
- LinkedIn practice: https://postsyncer.com/blog/best-practices-for-linkedin-posts · https://unfractional.substack.com/p/linkedins-2026-algorithm
- India creator economy: https://www.isb.edu/news/press-releases/india-s-creator-economy-enters-a-new-phase-as-non-metro-creators-become-the-majority-reveals-isb-hashfame-report · https://www.coherentmi.com/industry-reports/india-creator-economy-market · https://www.storyboard18.com/amp/how-it-works/creator-economy-in-india-hits-rs-3500-crore-fueled-by-ecomm-fmcg-sectors-kofluence-73457.htm
