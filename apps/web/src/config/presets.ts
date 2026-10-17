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
    kicker: "HOW DO YOU KNOW",
    big: "YOUR TASTE",
    italic: "in jewellery?",
    caption: "taste",
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
