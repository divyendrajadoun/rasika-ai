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

/**
 * Motion vocabulary — what makes two presets *move* differently, not just look different.
 *
 * family      the overall choreography the engine and the planner follow
 *             editorial  poster type above the head, tilted photo cards, lock → reveal (the house style)
 *             kinetic    typography-only, centred, mixed case, hard cuts, 1–2 s holds (Apple recap feel)
 *             whiteboard a marker draws each thought; taped sketches; wipes between ideas
 *             chalk      dim-and-reveal lesson on a board: one claim or equation at a time
 *             hype       retention cut: slams, punch-ins, stamps, something new every 2 s
 *             launch     product film: straight cards, soft shadows, pushes into what is named
 *             collage    paper cut-outs, tape, marker notes
 *             blocks     flat colour-block motion graphics: solid plates, chips, square cards, hard cuts
 *             beat       beat-synced kinetic type: per-letter entrances, scale pops, nothing holds still
 * enter/exit  how typography and cards arrive and leave (`type` = typewriter, letter by letter
 *             left to right with a cursor; `letters` = per-letter pop)
 * easing      spring (overshoot) · snap (fast decel) · smooth (cubic) · soft (slow quint) ·
 *             steps (stop-motion: every move lands in 4 held poses — paper / print looks)
 * speed       entrance duration multiplier (0.6 twice as fast … 1.6 slower)
 * camera      how video modes change: glide (0.5 s) · cut (hard) · whip (0.22 s) · still (no breathing) ·
 *             push (hard cuts plus a slow push-in on every unframed shot — motion on every frame)
 * sfxKit      the sound palette the worker synthesises the cues with
 * texture     stage backdrop behind the framed video (replaces the dot pattern): paper, board,
 *             grid, dots, vignette, gradient, halftone (print dots), scan (CRT lines), lines
 *             (ruled notebook), grain (coarse film)
 * direction   markdown for the planner: beat structure + vocabulary for this style
 */
export const MotionFamily = z.enum([
  "editorial",
  "kinetic",
  "whiteboard",
  "chalk",
  "hype",
  "launch",
  "collage",
  "blocks",
  "beat",
]);
export type MotionFamily = z.infer<typeof MotionFamily>;

export const EnterKind = z.enum([
  "rise",
  "pop",
  "slam",
  "slide",
  "fade",
  "draw",
  "blur",
  "letters",
  "mask",
  "type",
]);
export type EnterKind = z.infer<typeof EnterKind>;
export const ExitKind = z.enum(["lift", "dive", "cut", "wipe", "fade"]);
export type ExitKind = z.infer<typeof ExitKind>;
export const EasingKind = z.enum(["spring", "snap", "smooth", "soft", "steps"]);
export type EasingKind = z.infer<typeof EasingKind>;
export const CameraKind = z.enum(["glide", "cut", "whip", "still", "push"]);
export type CameraKind = z.infer<typeof CameraKind>;
export const SfxKit = z.enum(["pop", "click", "marker", "chalk", "hype", "cinematic", "none"]);
export type SfxKit = z.infer<typeof SfxKit>;
export const TextureKind = z.enum([
  "none",
  "paper",
  "board",
  "grid",
  "dots",
  "vignette",
  "gradient",
  "halftone",
  "scan",
  "lines",
  "grain",
]);
export type TextureKind = z.infer<typeof TextureKind>;

export const CaseStyle = z.enum(["auto", "upper", "sentence"]);
export type CaseStyle = z.infer<typeof CaseStyle>;

export const Motion = z.object({
  family: MotionFamily.default("editorial"),
  /** poster-type case: auto = the family's habit (editorial / hype / collage / beat shout) */
  caseStyle: CaseStyle.default("auto"),
  enter: EnterKind.default("rise"),
  exit: ExitKind.default("lift"),
  easing: EasingKind.default("spring"),
  speed: z.number().min(0.5).max(1.6).default(1),
  camera: CameraKind.default("glide"),
  sfxKit: SfxKit.default("pop"),
  texture: TextureKind.default("none"),
  direction: z.string().max(4000).default(""),
  /** element types the planner should not use in this style */
  avoidElements: z.array(z.string()).default([]),
});
export type Motion = z.infer<typeof Motion>;
export type MotionInput = z.input<typeof Motion>;

export const DEFAULT_MOTION: Motion = Motion.parse({});

/** Fill a possibly-missing / partial motion block (plans written before motion existed). */
export function motionOf(style: { motion?: Partial<Motion> | undefined }): Motion {
  return style.motion ? { ...DEFAULT_MOTION, ...style.motion } : DEFAULT_MOTION;
}

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
  /**
   * one-word: the mikku pop, one word at a time · phrase: up to three words, no highlight ·
   * karaoke: 2–3 words with the spoken word lit in `captionAccent` · box: the spoken word on a
   * solid box · clean: full sentences in the lower third, no animation · off
   */
  captionStyle: z.enum(["one-word", "phrase", "karaoke", "box", "clean", "off"]),
  /** Colour token for the highlighted caption word / box (default gold). */
  captionAccent: z.enum(["gold", "goldd", "ter", "mar", "iv"]).default("gold"),
  captionSize: z.number().int().min(40).max(140),
  endCardShape: z.enum(["arch", "rounded", "square"]),
  pattern: z.enum(["jaali", "arches", "bandhani", "leheriya", "none"]),
  preferredElements: z.array(z.string()),
  motion: Motion.prefault({}),
});
export type StyleTokens = z.infer<typeof StyleTokens>;
