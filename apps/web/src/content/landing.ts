/**
 * All landing-page copy. Edit freely — components only read from here.
 * Rasika is for anyone who talks to camera: realtors, doctors, coaches, founders, chefs, lawyers…
 */
import { brand } from "@/config/brand";
import { presetCards } from "@/config/presets";

/** How many styles an edit can pick from (the style grid): never typed by hand. */
const STYLE_COUNT = presetCards.length;

export const nav = {
  links: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Styles", href: "#styles" },
    { label: "Films", href: "#films" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Help", href: "/help" },
  ],
  cta: { label: "Edit a reel free", href: "/dashboard" },
};

export const hero = {
  headline: "Talk to your phone. Post like a studio.",
  /** The two authored lines of the headline (two lines at most, on every width). */
  lines: ["Talk to your phone.", "Post like a studio."],
  /** The same sentence as Rasika sets it for a Hindi take: Devanagari, never romanised. */
  hindiLines: ["फ़ोन से बोलो।", "स्टूडियो जैसा पोस्ट करो।"],
  /** The three live controls on the sentence (the product's own: style, caption timing, language). */
  chips: { style: "Style", captions: "Caption timing", hindi: "Language" },
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
  title: "Same take. Different reel.",
  sub: "Drag the handle. The raw phone clip is on the left, the Rasika edit on the right — playing in sync.",
  before: { src: "/demo/before.mp4", label: "Raw clip" },
  after: { src: "/demo/after.mp4", label: "Rasika edit" },
  note: "Real footage from a small jewellery brand. Yours might be a listing, a clinic, a classroom or a kitchen — the craft is the same.",
};

export const howItWorks = {
  title: "How it works",
  sub: "Three steps. No timeline.",
  steps: [
    {
      lead: "First, upload your take.",
      line: "Upload your video",
      italic: "a phone selfie clip, 15 s to 3 min",
      body: "Phone footage is fine. HEVC, MOV, MP4 — up to 600 MB, resumable if your network drops.",
    },
    {
      lead: "Then add photos and pick a style.",
      line: "Add photos & pick a style",
      italic: "“show this when I say balcony”",
      body: "Drop in listing photos, before/afters, product shots or slides. Tell us which word they belong to. Pick a preset or describe your look.",
    },
    {
      lead: "Then preview, tweak, download.",
      line: "Preview, tweak, download",
      italic: "change a title, retime a photo",
      body: "A quick preview lands in a minute, the full 1080 × 1920 render a couple of minutes later. Edit in the browser, render again, post.",
    },
  ],
};

export const features = {
  title: "What the edit does",
  sub: "Everything a motion designer would do by hand.",
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
  title: `${STYLE_COUNT} styles, one take`,
  sub: "Pick a look. Drag to compare it with the raw clip.",
  note2: "Every style here was planned and rendered by Rasika from the same real 12-second phone clip — not a mock-up. Each one is a full design system: palette, type, caption format, and its own motion — how lines enter, how the camera cuts, which sounds land.",
  note: "Nine motion families — editorial, kinetic type, whiteboard, chalkboard, hype cut, launch film, paper collage, colour blocks, beat type — each with its own sound kit. Most of the styles were built from the measured rules of the open video-skills community's looks — Apple-style recaps, whiteboard and chalkboard explainers, TikTok retention cuts, launch films, heditor's cinema and podcast sets, ravyn's window and tabloid, ghost-editor's seven looks, Vox paper collages, halftone zines, retro terminals, pixel RPG boxes, Swiss posters, glass keynotes and more — every one planned and rendered inside Rasika, nothing redirected elsewhere. Describe a look in the wizard (“clinic white, navy, fewer effects”) and we map it to the nearest preset.",
  ctaLabel: "Use this style",
};

export const pricing = {
  title: "Pricing",
  sub: "Your first reel is free. After that, buy reels when you need them: no subscription.",
  once: "One per account",
  perReel: "a reel",
  oneOff: "one-off",
  startFree: "Make my free reel",
  buy: "Buy",
  note: "1 reel = a finished reel up to 90 s (longer ones use 2). Paid reels can run up to 3 minutes, in 1080 × 1920 with no watermark. Pay by UPI from any app; credits are added once we confirm the payment, usually within a few hours, and they never expire.",
};

export const faq = {
  title: "Questions, answered",
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
  /** The closing line as two authored lines. */
  lines: ["Feel your reel.", "Don't just post it."],
  sub: "Your first reel is free. No card needed.",
  after: "You sign in, the take uploads, and the first preview is back in about a minute.",
  dialogTitle: "Name your reel",
  dialogExample: "Balcony walkthrough, Tuesday",
  cta: { label: "Edit my first reel", href: "/dashboard/new" },
};

/** One quiet line: what this is · links · year and privacy. */
export const footer = {
  what: "Reels from one phone take",
  links: [
    { label: "Contact", href: `mailto:${brand.email}` },
    { label: "Instagram", href: brand.social.instagram },
    { label: "X", href: brand.social.x },
    { label: "Terms", href: "/terms" },
  ],
  privacy: { label: "Privacy", href: "/privacy" },
  madeIn: brand.madeIn,
};

/** The showcase: a spoken line you can type, set the way the reel sets it. */
export const showcase = {
  title: "Type a line. It is set like the reel.",
  initial: "Read clause eleven first",
  examples: ["Three bedrooms, east facing", "Forty minutes, not cream", "Zero to ten thousand orders"],
  /** The presets offered under the line; all four set their poster in Anton, the face this page has. */
  styleIds: ["mikku-royal", "boardroom-navy", "tabloid-headline", "festive-bandhani"],
  note: `The poster line, the caption and the lit word use the style's own tokens. The ${STYLE_COUNT} reels below are the full renders.`,
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
