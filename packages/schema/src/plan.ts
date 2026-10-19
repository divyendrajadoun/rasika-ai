/**
 * Plan JSON v1 — the typed description of an edit (SPEC §6.3).
 *
 * The engine turns `(plan, assets, transcript, t)` into DOM state; the planner (Claude) emits it;
 * the validator (`validatePlan`) repairs it. Colours are tokens only — the style decides the hex.
 */
import { z } from "zod";
import { StyleTokens } from "./style";

export const PLAN_VERSION = 1 as const;

/** Colour tokens — elements only ever reference tokens, never raw hex. */
export const ColorToken = z.enum(["mar", "ter", "gold", "goldd", "iv", "stage", "ink"]);
export type ColorToken = z.infer<typeof ColorToken>;

const Sec = z.number().min(0).max(600);
const Px = z.number().min(-4000).max(4000);
const Id = z.string().min(1).max(64);

export const Rect = z.object({ x: Px, y: Px, w: Px.min(0), h: Px.min(0) });
export type Rect = z.infer<typeof Rect>;
export const Point = z.object({ x: Px, y: Px });
export type Point = z.infer<typeof Point>;

export const PlanMeta = z.object({
  durationSec: z.number().positive().max(600),
  fps: z.literal(30),
  width: z.literal(1080),
  height: z.literal(1920),
  language: z.string().min(2).describe("'en' | 'hi' | 'hinglish' | BCP-47 tag"),
  /** script-only reels: no speaker on screen, the footage is a plain stage-coloured plate */
  faceless: z.boolean().optional(),
});
export type PlanMeta = z.infer<typeof PlanMeta>;

export const VideoModeName = z.enum(["full", "zoom", "card", "pip", "arch"]);
export type VideoModeName = z.infer<typeof VideoModeName>;

export const VideoMode = z.object({
  t: Sec,
  mode: VideoModeName,
  zoomPoint: Point.optional().describe("zoom only — the stage point (px) the punch-in centres on"),
  zoomScale: z.number().min(1.2).max(3.5).optional(),
});
export type VideoMode = z.infer<typeof VideoMode>;

export const TextFont = z.enum(["anton", "serif", "kicker", "devanagari"]);
export type TextFont = z.infer<typeof TextFont>;

export const TextLine = z.object({
  text: z.string().min(1).max(80),
  font: TextFont,
  size: z.number().int().min(20).max(320),
  color: ColorToken.optional().describe("omitted → auto by context (light wall vs dark stage)"),
  tracking: z.number().min(0).max(1).optional().describe("letter-spacing in em"),
  lineHeight: z.number().min(0.8).max(2).optional(),
});
export type TextLine = z.infer<typeof TextLine>;

const Timed = {
  id: Id,
  t0: Sec,
  t1: Sec,
  anchorWordIndex: z.number().int().min(0).optional(),
};

export const PosterText = z.object({
  ...Timed,
  type: z.literal("posterText"),
  lines: z.array(TextLine).min(1).max(4),
  top: Px,
  anim: z.enum(["rise", "pop"]).default("rise"),
  left: Px.optional(),
  w: Px.min(100).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  accent: z.enum(["glitch", "sub"]).optional().describe("sfx hint for this line"),
});

export const Counter = z.object({
  ...Timed,
  type: z.literal("counter"),
  from: z.number(),
  to: z.number(),
  label: z.string().max(40),
  top: Px.default(215),
  size: z.number().int().min(60).max(320).default(250),
  duration: z.number().min(0.2).max(5).default(1),
  color: ColorToken.optional(),
});

export const LockCard = z.object({
  ...Timed,
  type: z.literal("lockCard"),
  word: z.string().min(1).max(24),
  kicker: z.string().max(40).default("THE WORD"),
  sub: z.string().max(40),
  blurred: z.boolean().default(true),
  dark: z.boolean().default(false).describe("dark variant for the payoff on the stage"),
});

export const PropPunchIn = z.object({
  ...Timed,
  type: z.literal("propPunchIn"),
  label: z.string().min(1).max(40),
  ring: z.object({ cx: Px, cy: Px, rx: Px.min(10), ry: Px.min(10) }),
  labelTop: Px.default(600),
});

export const FeedPhone = z.object({
  ...Timed,
  type: z.literal("feedPhone"),
  imageId: Id,
  posts: z.number().int().min(3).max(14).default(10),
  dayFrom: z.number().int().min(0).default(1),
  dayTo: z.number().int().min(1).default(30),
  postDays: z.array(z.number().int()).optional().describe("explicit per-post day labels"),
  handle: z.string().max(32).default("trending.jewels"),
  postCaption: z.string().max(60).default("you saw this again"),
  title: z.string().max(40).default("ON YOUR FEED"),
  dayLabel: z.string().max(12).default("DAY"),
});

export const Stamp = z.object({
  ...Timed,
  type: z.literal("stamp"),
  text: z.string().min(1).max(24),
});

export const ChapterCard = z.object({
  ...Timed,
  type: z.literal("chapterCard"),
  number: z.string().min(1).max(4),
  line: z.string().min(1).max(60),
  italicLine: z.string().max(60),
});

const ImageCardSpec = {
  imageId: Id,
  label: z.string().max(40).default(""),
  x: Px,
  y: Px,
  w: Px.min(100),
  h: Px.min(100),
  tilt: z.number().min(-20).max(20).default(0),
  objectPosition: z.string().max(20).default("50% 50%"),
};
export const ImageCard = z.object({ ...Timed, type: z.literal("imageCard"), ...ImageCardSpec });
export const ImageCardSpecSchema = z.object(ImageCardSpec);

export const SplitCards = z.object({
  ...Timed,
  type: z.literal("splitCards"),
  cards: z.tuple([ImageCardSpecSchema, ImageCardSpecSchema]),
  stagger: z.number().min(0).max(1).default(0.15),
});

export const PatternId = z.enum(["jaali", "arches", "bandhani", "leheriya", "solid", "blocks"]);
export type PatternId = z.infer<typeof PatternId>;

export const BleedPlate = z
  .object({
    ...Timed,
    type: z.literal("bleedPlate"),
    imageId: Id.optional(),
    patternId: PatternId.optional(),
    kicker: z.string().max(40),
    title: z.string().min(1).max(40),
    objectPosition: z.string().max(20).default("50% 50%"),
    labelTop: Px.default(210),
  })
  .refine((p) => Boolean(p.imageId) !== Boolean(p.patternId), {
    message: "bleedPlate needs exactly one of imageId or patternId",
  });

export const FilmStrip = z.object({
  ...Timed,
  type: z.literal("filmStrip"),
  imageIds: z.array(Id).min(1).max(3),
  objectPositions: z.array(z.string().max(20)).optional(),
  kicker: z.string().max(40),
  title: z.string().min(1).max(40),
  focusRing: z
    .object({ cx: Px, cy: Px, r: Px.min(10), at: z.number().min(0), dur: z.number().min(0.1) })
    .optional(),
  travel: Px.default(160).describe("how far the strip slides left over its life"),
});

export const PatternCard = z.object({
  ...Timed,
  type: z.literal("patternCard"),
  pattern: PatternId,
  label: z.string().max(40),
  x: Px,
  y: Px,
  w: Px.min(100),
  h: Px.min(100),
  tilt: z.number().min(-20).max(20).default(0),
});

export const Equation = z.object({
  ...Timed,
  type: z.literal("equation"),
  left: z.string().min(1).max(30),
  right: z.string().min(1).max(30),
  top: Px.default(230),
  leftSize: z.number().int().min(40).max(320).default(150),
  rightSize: z.number().int().min(40).max(320).default(130),
  leftColor: ColorToken.optional(),
  rightColor: ColorToken.optional(),
});

export const Reveal = z.object({
  ...Timed,
  type: z.literal("reveal"),
  word: z.string().min(1).max(24),
  devanagari: z.string().max(24).optional(),
  definition: z.string().max(60).optional(),
  top: Px.default(170),
  burst: z
    .object({
      seed: z.number().int().default(7),
      count: z.number().int().min(0).max(200).default(46),
      cx: Px.default(540),
      cy: Px.default(330),
    })
    .default({ seed: 7, count: 46, cx: 540, cy: 330 }),
});

export const StrikeLine = z.object({
  ...Timed,
  type: z.literal("strikeLine"),
  text: z.string().min(1).max(40),
  top: Px.default(520),
  size: z.number().int().min(30).max(200).default(72),
  strikeAt: z.number().min(0).default(1.3).describe("seconds after t0 the strike starts"),
  strikeDur: z.number().min(0.1).default(0.5),
  strikeWidth: Px.min(50).default(640),
  color: ColorToken.optional(),
});

export const Chips = z.object({
  ...Timed,
  type: z.literal("chips"),
  items: z
    .array(
      z.object({
        text: z.string().min(1).max(24),
        at: z.number().min(0).describe("seconds after t0 this chip pops"),
        bg: ColorToken.default("mar"),
        color: ColorToken.default("iv"),
      }),
    )
    .min(1)
    .max(6),
  x: Px.default(60),
  y: Px.default(230),
  size: z.number().int().min(30).max(160).default(76),
});

/**
 * Stock B-roll: a cutaway to a portrait stock clip (Pexels) found from `query`. The worker fills
 * `source` once a clip is chosen; the engine shows the clip's frames inside the video wrapper for
 * the element's window (so a `card`-mode B-roll sits in the card). 1.2–6 s, never in the first
 * 1.5 s, ≥ 1.5 s of the speaker between two of them.
 */
export const Broll = z.object({
  ...Timed,
  type: z.literal("broll"),
  /** concrete, visual, English: "hands polishing a gold ring, macro" */
  query: z.string().min(3).max(80),
  /** optional source tag drawn bottom-left ("archive", "2019", "stock") */
  label: z.string().max(40).optional(),
  source: z
    .object({
      provider: z.literal("pexels"),
      id: z.number().int(),
      url: z.string(),
      author: z.string(),
      file: z.string().nullable().optional(),
      duration: z.number().optional(),
    })
    .optional(),
});

export const PlanElement = z.discriminatedUnion("type", [
  PosterText,
  Broll,
  Counter,
  LockCard,
  PropPunchIn,
  FeedPhone,
  Stamp,
  ChapterCard,
  ImageCard,
  SplitCards,
  BleedPlate,
  FilmStrip,
  PatternCard,
  Equation,
  Reveal,
  StrikeLine,
  Chips,
]);
export type PlanElement = z.infer<typeof PlanElement>;
export type PlanElementInput = z.input<typeof PlanElement>;
export type ElementType = PlanElement["type"];
export const ELEMENT_TYPES = PlanElement.options.map(
  (o) => o.shape.type.value as ElementType,
) as readonly ElementType[];

export const SfxType = z.enum(["whoosh", "pop", "tick", "glitch", "impact", "riser", "sub"]);
export type SfxType = z.infer<typeof SfxType>;

export const SfxCue = z.object({
  t: Sec,
  type: SfxType,
  dur: z.number().min(0.05).max(5).optional(),
  gain: z.number().min(0).max(1.5).default(0.8),
  repeat: z.number().int().min(1).max(40).optional(),
  every: z.number().min(0.03).max(2).optional(),
});
export type SfxCue = z.infer<typeof SfxCue>;

export const Captions = z.object({
  enabled: z.boolean().default(true),
  y: Px.default(1400),
  gold: z.array(z.string()).default([]).describe("emotion / theme words → gold serif italic"),
  accent: z.array(z.string()).default([]).describe("nouns, names, numbers → terracotta Anton"),
});
export type Captions = z.infer<typeof Captions>;

export const Subject = z.object({
  faceBox: Rect,
  freeZone: Rect.describe("where poster type may go — the wall above the head"),
  prop: z.object({ label: z.string().max(40), point: Point }).optional(),
});
export type Subject = z.infer<typeof Subject>;

export const EndCard = z.object({
  brand: z.string().min(1).max(40),
  line1: z.string().min(1).max(60),
  line2: z.string().max(60).optional(),
  handle: z.string().max(40).optional(),
  bgImageId: Id.optional(),
  t0: Sec.optional().describe("defaults to the last 'arch' mode switch, else duration − 2.5"),
});
export type EndCard = z.infer<typeof EndCard>;

export const Plan = z.object({
  version: z.literal(PLAN_VERSION),
  meta: PlanMeta,
  style: StyleTokens,
  subject: Subject,
  videoModes: z.array(VideoMode).min(1),
  captions: Captions,
  elements: z.array(PlanElement),
  sfx: z.object({
    auto: z.boolean().default(true),
    intensity: z.number().min(0).max(1).default(0.8),
    extra: z.array(SfxCue).optional(),
  }),
  endCard: EndCard.optional(),
});
export type Plan = z.infer<typeof Plan>;
export type PlanInput = z.input<typeof Plan>;

/** Word-level transcript the engine and validator consume. */
export const TranscriptWord = z.object({
  w: z.string(),
  t: Sec,
  end: Sec.optional(),
  conf: z.number().min(0).max(1).optional(),
});
export type TranscriptWord = z.infer<typeof TranscriptWord>;
export const Transcript = z.object({
  language: z.string().min(2),
  words: z.array(TranscriptWord),
});
export type Transcript = z.infer<typeof Transcript>;

/** Versioned envelope kept for callers that only need meta + style. */
export const PlanEnvelope = Plan.pick({ version: true, meta: true, style: true });
export type PlanEnvelope = z.infer<typeof PlanEnvelope>;
