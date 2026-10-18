import { presets as schemaPresets, type StyleTokens } from "@rasika/schema";

/** Style presets come from packages/schema; this adds landing-page preview copy. */
export interface PresetCard {
  tokens: StyleTokens;
  /** Three poster lines shown in the looping mini preview. */
  preview: { kicker: string; big: string; italic: string; caption: string };
  badge?: string;
}

const previewCopy: Record<string, PresetCard["preview"]> = {
  "mikku-royal": {
    kicker: "THE ONE THING",
    big: "NOBODY TELLS YOU",
    italic: "before you buy",
    caption: "honestly",
  },
  "katana-pop": {
    kicker: "STOP SCROLLING",
    big: "READ THIS",
    italic: "no, really.",
    caption: "really",
  },
  "noir-minimal": {
    kicker: "THE ONE THING",
    big: "NOBODY SAYS",
    italic: "about founders",
    caption: "founders",
  },
  "bold-creator": { kicker: "DAY 30", big: "RESULTS", italic: "are in", caption: "results" },
  "creator-yellow": {
    kicker: "THE REAL REASON",
    big: "YOU'RE STUCK",
    italic: "nobody says it",
    caption: "stuck",
  },
  "editorial-ivory": {
    kicker: "THE QUIET LUXURY",
    big: "OF LESS",
    italic: "a note on taste",
    caption: "less",
  },
  "clinic-clean": {
    kicker: "THREE REASONS",
    big: "YOU WAKE AT 3AM",
    italic: "the honest answer",
    caption: "honest",
  },
  "brutalist-acid": {
    kicker: "SHIP IT",
    big: "THIS WEEK",
    italic: "not next quarter",
    caption: "ship",
  },
  "cinema-bebas": {
    kicker: "OLD DELHI",
    big: "AT 5 AM",
    italic: "before the city wakes",
    caption: "dawn",
  },
  "paper-collage": {
    kicker: "HOW RENT",
    big: "ACTUALLY WORKS",
    italic: "clause eleven",
    caption: "clause",
  },
  "neon-pop": { kicker: "STOP", big: "SCROLLING", italic: "this is for you", caption: "you" },
  "sage-wellness": {
    kicker: "ONE BREATH",
    big: "BEFORE YOU EAT",
    italic: "the two-minute rule",
    caption: "breathe",
  },
  "boardroom-navy": {
    kicker: "BEFORE YOU SIGN",
    big: "READ CLAUSE 11",
    italic: "the lock-in period",
    caption: "deposit",
  },
  "festive-bandhani": {
    kicker: "THIS DIWALI",
    big: "GIFT RAS",
    italic: "not just gold",
    caption: "diwali",
  },
};

export const presetCards: PresetCard[] = schemaPresets.map((tokens) => ({
  tokens,
  preview: previewCopy[tokens.id] ?? {
    kicker: "YOUR STORY",
    big: "YOUR WORDS",
    italic: "your style",
    caption: "style",
  },
  badge: tokens.id === "mikku-royal" ? "Default" : undefined,
}));

export const defaultPresetId = "mikku-royal";
