/**
 * All landing-page copy. Edit freely — components only read from here.
 * Rasika is for anyone who talks to camera: realtors, doctors, coaches, founders, chefs, lawyers…
 */
import { brand } from "@/config/brand";

export const nav = {
  links: [
    { label: "Industries", href: "#industries" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Styles", href: "#styles" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: { label: "Get started", href: "/dashboard" },
};

export const hero = {
  /** Words rise one by one; the word in `goldWord` is coloured gold. */
  headline: "TALK TO YOUR PHONE. POST LIKE A STUDIO.",
  goldWord: "STUDIO",
  sub: "Realtors, doctors, coaches, founders — upload one talking video. Rasika writes the titles, times every caption, lands your photos on the exact word, adds sound, and renders the reel. Minutes, not days.",
  primary: { label: "Edit my first reel — free", href: "/dashboard" },
  secondary: { label: "Watch a real before / after", href: "#before-after" },
  trust: ["Any industry", "English + Hindi", "1080 × 1920", "No timeline, ever"],
  demo: {
    after: "/demo/after.mp4",
    afterPoster: "/demo/after-poster.webp",
    alt: "A 90-second reel edited by Rasika: poster typography above the speaker, one-word captions and photo cards landing on spoken words.",
  },
};

export const beforeAfter = {
  eyebrow: "Before / after",
  title: "Same take. Different reel.",
  sub: "Drag the handle. The raw phone clip is on the left, the Rasika edit on the right — playing in sync.",
  before: { src: "/demo/before.mp4", label: "Raw clip" },
  after: { src: "/demo/after.mp4", label: "Rasika edit" },
  note: "Real footage from a small jewellery brand. Yours might be a listing, a clinic, a classroom or a kitchen — the craft is the same.",
};

export const industries = {
  eyebrow: "Every industry",
  title: "You already know what to say. We make it look like you hired a studio.",
  sub: "Pick your world. The phone shows a real take rendered by Rasika in the style we suggest for that industry; the beat on the left is what it designs from your words.",
  realNote:
    "Real footage, real render — a jewellery founder's take. Your listing, clinic or kitchen gets the same craft in the style you pick.",
  items: [
    {
      id: "real-estate",
      preset: "bold-creator",
      label: "Real estate",
      who: "Realtors & builders",
      line: "“Three bedrooms, east-facing balcony, one crore eighteen.”",
      poster: ["3 BHK", "EAST-FACING", "balcony"],
      counter: { from: 0, to: 118, suffix: " L", label: "ALL INCLUSIVE" },
      card: "BALCONY VIEW",
      caption: "balcony",
      chapter: "01 · THE BALCONY",
    },
    {
      id: "doctors",
      preset: "clinic-clean",
      label: "Doctors & clinics",
      who: "Doctors, dentists, physios",
      line: "“Three reasons you wake up at 3 am — and the one nobody tells you.”",
      poster: ["WHY YOU WAKE", "AT 3 AM", "the honest answer"],
      counter: { from: 0, to: 3, suffix: "", label: "REASONS" },
      card: "LATE DINNER",
      caption: "thyroid",
      chapter: "03 · SCREENS",
    },
    {
      id: "coaches",
      preset: "creator-yellow",
      label: "Coaches & educators",
      who: "Tutors, trainers, course creators",
      line: "“The rule I give every student before an exam.”",
      poster: ["ONE RULE", "BEFORE", "every exam"],
      counter: { from: 0, to: 90, suffix: "%", label: "PASS RATE" },
      card: "THE 2-MINUTE RULE",
      caption: "revise",
      chapter: "02 · THE RULE",
    },
    {
      id: "founders",
      preset: "noir-minimal",
      label: "Founders & D2C",
      who: "Product, fashion, food brands",
      line: "“We went from zero to ten thousand orders without an ad.”",
      poster: ["ZERO TO", "10,000 ORDERS", "no ads"],
      counter: { from: 0, to: 10000, suffix: "", label: "ORDERS" },
      card: "THE FIRST BATCH",
      caption: "orders",
      chapter: "01 · THE BET",
    },
    {
      id: "food",
      preset: "cinema-bebas",
      label: "Restaurants & chefs",
      who: "Cafés, cloud kitchens, home chefs",
      line: "“The secret to our butter chicken is forty minutes, not cream.”",
      poster: ["THE SECRET", "40 MINUTES", "not cream"],
      counter: { from: 0, to: 40, suffix: " MIN", label: "ON LOW FLAME" },
      card: "THE GRAVY",
      caption: "simmer",
      chapter: "02 · THE GRAVY",
    },
    {
      id: "fitness",
      preset: "sage-wellness",
      label: "Fitness & wellness",
      who: "Trainers, yoga, nutrition",
      line: "“Lose the belly without losing your lunch: three swaps.”",
      poster: ["THREE SWAPS", "NOT", "a diet"],
      counter: { from: 0, to: 3, suffix: "", label: "SWAPS" },
      card: "SWAP ONE: ROTI",
      caption: "protein",
      chapter: "01 · ROTI",
    },
    {
      id: "law-finance",
      preset: "boardroom-navy",
      label: "Lawyers & finance",
      who: "CAs, advisors, legal explainers",
      line: "“Before you sign a rent agreement, read clause eleven.”",
      poster: ["READ", "CLAUSE 11", "before you sign"],
      counter: { from: 0, to: 11, suffix: "", label: "THE CLAUSE" },
      card: "LOCK-IN PERIOD",
      caption: "deposit",
      chapter: "01 · THE DEPOSIT",
    },
    {
      id: "agencies",
      preset: "editorial-ivory",
      label: "Agencies",
      who: "Social teams running many clients",
      line: "“Forty client reels a month, one brand kit each, no editor on payroll.”",
      poster: ["40 REELS", "A MONTH", "per editor"],
      counter: { from: 0, to: 40, suffix: "", label: "REELS / MONTH" },
      card: "CLIENT KIT",
      caption: "approved",
      chapter: "02 · THE KIT",
    },
  ],
};

export const howItWorks = {
  eyebrow: "How it works",
  title: "Three steps. No timeline.",
  steps: [
    {
      n: "01",
      line: "UPLOAD YOUR VIDEO",
      italic: "a phone selfie clip, 15 s to 3 min",
      body: "Phone footage is fine. HEVC, MOV, MP4 — up to 600 MB, resumable if your network drops.",
    },
    {
      n: "02",
      line: "ADD PHOTOS & PICK A STYLE",
      italic: "“show this when I say balcony”",
      body: "Drop in listing photos, before/afters, product shots or slides. Tell us which word they belong to. Pick a preset or describe your look.",
    },
    {
      n: "03",
      line: "PREVIEW, TWEAK, DOWNLOAD",
      italic: "change a title, retime a photo",
      body: "A quick preview lands in a minute, the full 1080 × 1920 render a couple of minutes later. Edit in the browser, render again, post.",
    },
  ],
};

export const features = {
  eyebrow: "What the edit does",
  title: "Everything a motion designer would do by hand.",
  items: [
    {
      id: "poster",
      title: "Poster typography",
      body: "Your key line as big poster type on the wall above your head — never over your face. Always a complete thought, never a fragment.",
    },
    {
      id: "captions",
      title: "One-word captions",
      body: "Every word pops in on time. Feelings turn gold; names, numbers and places turn terracotta.",
    },
    {
      id: "image-on-word",
      title: "Photos on the exact word",
      body: "Say “balcony”, the balcony lands. Your photos fly in as tilted cards on the word that names them.",
    },
    {
      id: "punch-in",
      title: "Punch-in on the thing",
      body: "A zoom on what you are holding or pointing at, with a ring drawing around it.",
    },
    {
      id: "pip",
      title: "Picture-in-picture plates",
      body: "Full-bleed photos behind you for “look at this” moments, with labels that read.",
    },
    {
      id: "reveal",
      title: "Numbers, chapters, reveals",
      body: "Prices roll in as counters. “First, second, third” become chapter cards. A teased word gets revealed at the payoff with a riser and an impact.",
    },
    {
      id: "sfx",
      title: "Sound design",
      body: "Whooshes, pops, ticks and subs placed on the beat sheet, mixed under your voice. Nothing to license.",
    },
    {
      id: "hindi",
      title: "English, Hindi, Hinglish",
      body: "We detect the language and verify it. Hindi words appear on screen in Devanagari — never romanised.",
    },
  ],
};

export const styles = {
  eyebrow: "26 styles, one take",
  title: "Pick a look. Drag to compare it with the raw clip.",
  sub: "Every style here was planned and rendered by Rasika from the same real 12-second phone clip — not a mock-up. Each one is a full design system: palette, type, caption format, and its own motion — how lines enter, how the camera cuts, which sounds land.",
  note: "Nine motion families — editorial, kinetic type, whiteboard, chalkboard, hype cut, launch film, paper collage, colour blocks, beat type — each with its own sound kit. Twelve of the styles were built from the measured rules of the open video-skills community's looks (Apple-style recaps, whiteboard explainers, 3Blue1Brown lessons, TikTok retention cuts, launch films, Shenghua slams, Spotlight promos, Showreel blocks, motionmaxxing, kinetic typography, brand clips, SaaS launch cards) and run entirely inside Rasika. Describe a look in the wizard (“clinic white, navy, fewer effects”) and we map it to the nearest preset.",
  ctaLabel: "Use this style",
};

export const pricing = {
  eyebrow: "Pricing",
  title: "Start free. Pay when it pays off.",
  sub: "Prices in INR with UPI and cards. International? Toggle to USD.",
  creditsTitle: "Or buy credits",
  creditsSub: "1 credit = 1 reel up to 90 s. Longer reels use more credits.",
  perMonth: "/ mo",
};

export const faq = {
  eyebrow: "FAQ",
  title: "Questions, answered.",
  items: [
    {
      q: "Does it work for my industry?",
      a: "If you talk to camera, yes. Rasika designs the edit from your own words — a listing, a diagnosis explainer, a recipe, a legal tip, a product story. It never imports another industry's vocabulary, and it only uses your photos for what they actually show.",
    },
    {
      q: "Which languages work?",
      a: "English, Hindi and Hinglish today. We detect the language and verify it on a short probe, so Hindi speech never gets mangled into English (or the other way round). Hindi words appear in Devanagari on screen.",
    },
    {
      q: "How long does it take?",
      a: "Transcription and design take a few minutes. A quick preview arrives first; a 90-second final render is usually under four minutes. You can edit in the browser before you render again.",
    },
    {
      q: "Do I need any editing skill?",
      a: "No. There is no timeline. You upload, add photos, pick a style and get a reel. If you want to change a title or move a photo to a different word, you click the word.",
    },
    {
      q: "Do you keep my videos?",
      a: "Source videos and outputs are kept for 30 days by default so you can re-edit, then deleted. Frames extracted for rendering are deleted right after the render. You can delete a project instantly at any time.",
    },
    {
      q: "Can I use the reels commercially?",
      a: "Yes. You own what you render. Fonts are open-licensed (OFL) and sound effects are generated, so there is nothing to clear.",
    },
    {
      q: "What about image rights?",
      a: "You upload your own photos and confirm you have the rights. Rasika never pulls photos from the web into your reel. The optional image finder uses openly licensed sources only, with attribution stored.",
    },
  ],
};

export const finalCta = {
  title: brand.tagline,
  sub: "Your first reel is free. No card needed.",
  cta: { label: "Edit my first reel", href: "/dashboard" },
};

export const footer = {
  columns: [
    {
      title: "Product",
      links: [
        { label: "Industries", href: "#industries" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Styles", href: "#styles" },
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Contact", href: `mailto:${brand.email}` },
        { label: "Instagram", href: brand.social.instagram },
        { label: "X", href: brand.social.x },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
      ],
    },
  ],
  madeIn: brand.madeIn,
};

export const seo = {
  title: `${brand.name} — Talk to your phone. Post like a studio.`,
  description: brand.description,
  keywords: [
    "AI reel editor",
    "talking head video editor",
    "reels for real estate agents",
    "reels for doctors",
    "reels for coaches",
    "motion graphics for reels",
    "Instagram reel captions",
    "Hindi captions",
  ],
};
