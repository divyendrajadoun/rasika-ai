/**
 * All landing-page copy. Edit freely — components only read from here.
 * Rasika is for anyone who talks to camera: realtors, doctors, coaches, founders, chefs, lawyers…
 */
import { brand } from "@/config/brand";
import { presetCards } from "@/config/presets";

/** How many styles an edit can pick from (the style grid): never typed by hand. */
export const STYLE_COUNT = presetCards.length;

export const nav = {
  links: [
    { label: "How it works", href: "#how" },
    { label: "Examples", href: "#styles" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: { label: "Try it free", href: "/dashboard" },
};

export const hero = {
  headline: "Record one video. Get a pro Reel.",
  /** The two authored lines of the headline (two lines at most, on every width). */
  lines: ["Record one video.", "Get a pro Reel."],
  /** The same sentence as Rasika sets it for a Hindi take: Devanagari, never romanised. */
  hindiLines: ["एक वीडियो रिकॉर्ड करो।", "प्रो रील पाओ।"],
  /** The three live controls on the sentence (the product's own: style, caption timing, language). */
  chips: { style: "Style", captions: "Caption timing", hindi: "Language" },
  sub: "Film yourself talking on your phone and upload it. Rasika adds the captions, big titles, your photos and sound effects, and hands you a finished Instagram Reel in minutes. No editing skills needed.",
  primary: { label: "Make my free Reel", href: "/dashboard/new" },
  secondary: { label: "Watch a real before / after", href: "#before-after" },
  trust: ["First Reel free", "No editing skills", "English & Hindi", "Ready in minutes"],
  demo: {
    after: "/demo/after.mp4",
    afterPoster: "/demo/after-poster.webp",
    alt: "A 90-second reel edited by Rasika: poster typography above the speaker, one-word captions and photo cards landing on spoken words.",
  },
};

export const beforeAfter = {
  title: "Same video. Before and after.",
  sub: "Drag the slider. Left: the plain phone video. Right: the Reel Rasika made from it. Both play together.",
  before: { src: "/demo/before.mp4", label: "Your video" },
  after: { src: "/demo/after.mp4", label: "Rasika Reel" },
  note: "A real video from a small jewellery brand. Yours could be a property tour, a doctor's tip, a class or a recipe. Rasika edits them all the same way.",
};

/** How it works: six steps, each with its own phone screen on the landing. */
export const howItWorks = {
  kicker: "How it works",
  title: "You talk. Rasika does the rest.",
  sub: "Six steps, about four minutes. You only do step one.",
  steps: [
    {
      title: "Upload your video",
      body: "Any video of you talking, straight from your phone, up to 3 minutes. If the internet drops, the upload carries on.",
    },
    {
      title: "Rasika listens",
      body: "It writes down every word you say, in English, Hindi or Hinglish, and notes the exact moment you say it.",
    },
    {
      title: "Pick a look",
      body: `Choose from ${STYLE_COUNT} styles, each with its own fonts, motion and sounds. Or show us a Reel you love and we match it.`,
    },
    {
      title: "Your photos appear on cue",
      body: "Say “balcony” and your balcony photo pops up at that exact second. Just tell us which word goes with which photo.",
    },
    {
      title: "Check the preview",
      body: "A quick preview arrives in about a minute. Want to change a title or move a photo? Tap the word and fix it.",
    },
    {
      title: "Download and post",
      body: "A full-HD vertical video, ready for Instagram. No watermark on paid Reels.",
    },
  ],
};

export const features = {
  title: "What Rasika does for you",
  sub: "Everything a video editor would charge you for, done automatically.",
  items: [
    {
      id: "poster",
      title: "Big bold titles",
      body: "Your main point appears as a big headline above your head, never covering your face. Always a full sentence, never a cut-off fragment.",
    },
    {
      id: "captions",
      title: "Word-by-word captions",
      body: "Every word pops up the moment you say it, so people follow along even with the sound off. Key words get their own colour.",
    },
    {
      id: "image-on-word",
      title: "Your photos, right on time",
      body: "Say “balcony” and the balcony photo lands. Your photos fly in as cards on the exact word that names them.",
    },
    {
      id: "punch-in",
      title: "Automatic zoom-ins",
      body: "When you hold up or point at something, the video zooms in on it and circles it for you.",
    },
    {
      id: "pip",
      title: "Full-screen photo moments",
      body: "For “look at this” moments, your photo fills the screen behind you with a clear label on it.",
    },
    {
      id: "reveal",
      title: "Numbers, steps and reveals",
      body: "Prices count up on screen. “First, second, third” become chapter cards. A word you tease gets a big reveal at the end.",
    },
    {
      id: "sfx",
      title: "Sound effects, already mixed",
      body: "Whooshes, pops and hits land on the right beats, mixed under your voice. Nothing to buy or license.",
    },
    {
      id: "hindi",
      title: "Hindi, English or Hinglish",
      body: "Rasika recognises your language and checks it. Hindi words appear in Hindi script on screen, never in English letters.",
    },
  ],
};

export const styles = {
  title: `${STYLE_COUNT} styles, one take`,
  sub: "Pick a look. Drag to compare it with the raw clip.",
  note2:
    "Every style here was planned and rendered by Rasika from the same real 12-second phone clip — not a mock-up. Each one is a full design system: palette, type, caption format, and its own motion — how lines enter, how the camera cuts, which sounds land.",
  note: "Nine motion families — editorial, kinetic type, whiteboard, chalkboard, hype cut, launch film, paper collage, colour blocks, beat type — each with its own sound kit. Most of the styles were built from the measured rules of the open video-skills community's looks — Apple-style recaps, whiteboard and chalkboard explainers, TikTok retention cuts, launch films, heditor's cinema and podcast sets, ravyn's window and tabloid, ghost-editor's seven looks, Vox paper collages, halftone zines, retro terminals, pixel RPG boxes, Swiss posters, glass keynotes and more — every one planned and rendered inside Rasika, nothing redirected elsewhere. Describe a look in the wizard (“clinic white, navy, fewer effects”) and we map it to the nearest preset.",
  ctaLabel: "Use this style",
};

export const pricing = {
  title: "Simple pricing. No subscription.",
  sub: "Your first Reel is free. After that, buy Reels only when you need them. Credits never expire.",
  once: "One per account",
  perReel: "a reel",
  oneOff: "one-off",
  startFree: "Make my free Reel",
  buy: "Buy",
  note: "1 Reel = a finished Reel up to 90 seconds (longer ones count as 2). Paid Reels can run up to 3 minutes, in full HD (1080 × 1920) with no watermark. Pay by UPI from any app. Credits are added once we confirm the payment, usually within a few hours, and they never expire.",
};

export const faq = {
  title: "Questions, answered",
  items: [
    {
      q: "Do I need to know video editing?",
      a: "No. There is no timeline and nothing to learn. You upload your video, add photos if you want, pick a style, and get a finished Reel. To change a title or move a photo, you tap the word.",
    },
    {
      q: "Is the first Reel really free?",
      a: "Yes. Sign up and make your first Reel, up to 60 seconds, free. No card needed. After that you buy Reels only when you need them.",
    },
    {
      q: "Will it work for my kind of business?",
      a: "If you talk to camera, yes: a property tour, a health tip, a recipe, a legal tip, a product story. Rasika builds the edit from your own words and only uses your photos for what they actually show.",
    },
    {
      q: "Which languages work?",
      a: "English, Hindi and Hinglish. Rasika detects your language and double-checks it, so Hindi never gets mangled into English (or the other way round). Hindi words appear in Hindi script on screen.",
    },
    {
      q: "How long does it take?",
      a: "A quick preview arrives in about a minute. A finished 90-second Reel is usually ready in under four minutes. You can make changes in the browser and render again.",
    },
    {
      q: "Do you keep my videos?",
      a: "Your videos and Reels are kept for 30 days so you can re-edit them, then deleted. You can delete a project yourself at any time.",
    },
    {
      q: "Can I use the Reels for my business?",
      a: "Yes. You own what you make. The fonts are free to use and the sound effects are generated, so there is nothing to clear.",
    },
    {
      q: "What about the photos I use?",
      a: "You upload your own photos and confirm you have the rights to them. Rasika never pulls random photos from the internet into your Reel. The optional image finder only uses openly licensed sources and keeps the credits.",
    },
  ],
};

export const finalCta = {
  title: brand.tagline,
  /** The closing line as two authored lines. */
  lines: ["Your next Reel is", "one video away."],
  sub: "Your first Reel is free. No card needed.",
  after: "Sign in, upload your video, and see the first preview in about a minute.",
  dialogTitle: "Name your Reel",
  dialogExample: "Balcony walkthrough, Tuesday",
  cta: { label: "Make my first Reel", href: "/dashboard/new" },
};

/** One quiet line: what this is · links · year and privacy. */
export const footer = {
  what: "Pro Reels from one phone video",
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
  examples: [
    "Three bedrooms, east facing",
    "Forty minutes, not cream",
    "Zero to ten thousand orders",
  ],
  /** The presets offered under the line; all four set their poster in Anton, the face this page has. */
  styleIds: ["mikku-royal", "boardroom-navy", "tabloid-headline", "festive-bandhani"],
  note: `The poster line, the caption and the lit word use the style's own tokens. The ${STYLE_COUNT} reels below are the full renders.`,
};

export const seo = {
  title: `${brand.name} — Record one video. Get a pro Reel.`,
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
