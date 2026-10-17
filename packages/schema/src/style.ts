import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const Palette = z.object({
  stage: hex,
  mar: hex,
  ter: hex,
  gold: hex,
  goldd: hex,
  iv: hex,
  ink: hex,
});
export type Palette = z.infer<typeof Palette>;

export const FontRole = z.enum(["anton", "serif", "kicker", "devanagari", "caption"]);
export type FontRole = z.infer<typeof FontRole>;

export const StyleTokens = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string(),
  palette: Palette,
  fonts: z.object({
    poster: z.string(),
    accent: z.string(),
    ui: z.string(),
    devanagari: z.string(),
    caption: z.string(),
  }),
  grain: z.number().min(0).max(1),
  pace: z.number().min(0).max(1),
  captionStyle: z.enum(["one-word", "phrase", "off"]),
  captionSize: z.number().int().min(40).max(140),
  endCardShape: z.enum(["arch", "rounded", "square"]),
  pattern: z.enum(["jaali", "arches", "bandhani", "leheriya", "none"]),
  preferredElements: z.array(z.string()),
});
export type StyleTokens = z.infer<typeof StyleTokens>;
