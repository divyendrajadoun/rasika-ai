/**
 * Brand config — the ONE place to rename the product or change its colours.
 * Everything (metadata, nav, OG image, footer, theme CSS variables) reads from here.
 */
export const brand = {
  name: "Rasika",
  /** Short meaning shown in a few places (footer, about copy). */
  meaning: "Sanskrit: one who truly feels beauty, not just sees it.",
  tagline: "Your next Reel is one video away.",
  description:
    "Upload a video of yourself talking. Rasika adds captions, big titles, your photos and sound effects, and gives you a finished Instagram Reel in minutes. English and Hindi. First Reel free.",
  domain: "rasika.app",
  handle: "@rasika.app",
  email: "hello@rasika.app",
  madeIn: "Made in India",
  colors: {
    stage: "#3a0a11",
    maroon: "#5a0f1a",
    terracotta: "#c8452f",
    gold: "#e6b450",
    goldDark: "#9a6a14",
    ivory: "#f6ecd8",
    ink: "#1a0a0c",
  },
  fonts: {
    poster: "Anton",
    accent: "Instrument Serif",
    ui: "Inter",
    devanagari: "Tiro Devanagari Hindi",
  },
  social: {
    instagram: "https://instagram.com/rasika.app",
    x: "https://x.com/rasika_app",
  },
} as const;

export type Brand = typeof brand;
