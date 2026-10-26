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
  /**
   * where the clip comes from: a Pexels stock clip, or one of the project's own clips (an asset the
   * worker saved, e.g. a repo's demo video found while researching a roundup; `url` is its page)
   */
  source: z
    .discriminatedUnion("provider", [
      z.object({
        provider: z.literal("pexels"),
        id: z.number().int(),
        url: z.string(),
        author: z.string(),
        file: z.string().nullable().optional(),
        duration: z.number().optional(),
      }),
      z.object({
        provider: z.literal("asset"),
        assetId: z.string().min(1).max(64),
        url: z.string(),
        author: z.string(),
        duration: z.number().optional(),
      }),
    ])
    .optional(),
});


// ───────── brief-driven films: website launches, recipes, fights, journeys, music machines ─────────

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .describe("a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner");

/**
 * A browser window holding a real screenshot of the user's website (an `imageId` from the images
 * the worker captured). The page scrolls inside the window over the element's life: `scroll` is
 * how far, 0 = stay at the top, 1 = travel to the bottom of the screenshot.
 */
export const BrowserCard = z.object({
  ...Timed,
  type: z.literal("browserCard"),
  imageId: Id,
  url: z.string().min(1).max(80).describe("shown in the address bar, e.g. linear.app"),
  x: Px.default(60),
  y: Px.default(420),
  w: z.number().min(300).max(1080).default(960),
  h: z.number().min(240).max(1700).default(720),
  scroll: z.number().min(0).max(1).default(0.35),
  tilt: z.number().min(-12).max(12).default(0),
});

/**
 * A glass that fills ingredient by ingredient, each layer labelled with its measure as it pours
 * (a recipe told on screen). `fill` is the share of the glass each layer takes; layers stack.
 */
export const PourGlass = z.object({
  ...Timed,
  type: z.literal("pourGlass"),
  glass: z.enum(["rocks", "highball", "coupe", "martini", "wine", "mug"]).default("rocks"),
  cx: Px.default(540),
  top: Px.default(520),
  size: z.number().int().min(300).max(1100).default(760).describe("height of the glass in px"),
  ice: z.boolean().default(false),
  layers: z
    .array(
      z.object({
        name: z.string().min(1).max(28),
        amount: z.string().min(1).max(16).describe('the measure as written, e.g. "45 ml", "2 dashes"'),
        color: Hex,
        fill: z.number().min(0.01).max(1),
        at: z.number().min(0).describe("seconds after t0 the pour starts"),
        dur: z.number().min(0.3).max(6).default(1.2),
      }),
    )
    .min(1)
    .max(8),
  garnish: z
    .object({ name: z.string().min(1).max(24), kind: z.enum(["citrus", "cherry", "leaf", "olive", "peel"]), at: z.number().min(0) })
    .optional(),
});

/**
 * A fight told as a game HUD: two named health bars, hits that land on the beat with a burst
 * word, a K.O. and the winner's banner. `dmg` is a share of 100.
 */
export const FightHud = z.object({
  ...Timed,
  type: z.literal("fightHud"),
  a: z.object({ name: z.string().min(1).max(20), color: Hex.default("#e2403a") }),
  b: z.object({ name: z.string().min(1).max(20), color: Hex.default("#2f6fe0") }),
  top: Px.default(150),
  hits: z
    .array(
      z.object({
        at: z.number().min(0),
        by: z.enum(["a", "b"]),
        dmg: z.number().min(1).max(100),
        word: z.string().min(1).max(14).default("POW!"),
      }),
    )
    .min(1)
    .max(24),
  koAt: z.number().min(0).optional().describe("seconds after t0; the loser's bar is empty by then"),
  winner: z.enum(["a", "b"]),
});

/**
 * A framed window with countryside rolling past (a train journey), cycling through the seasons
 * with their weather: blossom, sun, falling leaves, snow. Optional cup on the sill.
 */
export const SeasonWindow = z.object({
  ...Timed,
  type: z.literal("seasonWindow"),
  seasons: z.array(z.enum(["spring", "summer", "autumn", "winter"])).min(1).max(4),
  x: Px.default(140),
  y: Px.default(360),
  w: z.number().min(300).max(1080).default(800),
  h: z.number().min(300).max(1700).default(980),
  shape: z.enum(["arch", "rect"]).default("arch"),
  frame: ColorToken.default("goldd"),
  cup: z.boolean().default(true),
});

/**
 * A music machine of ramps, gears, a row of key blocks and a drum. Before `dropAt` its pieces
 * assemble; at `dropAt` the ball drops and every key it lands on plays its note (`key` 0–7 is a
 * scale degree), the drum kicks on `drums`. Every sound is a movement you can see.
 */
export const NoteMachine = z.object({
  ...Timed,
  type: z.literal("noteMachine"),
  top: Px.default(420),
  dropAt: z.number().min(0),
  notes: z
    .array(z.object({ at: z.number().min(0), key: z.number().int().min(0).max(7) }))
    .min(1)
    .max(40),
  drums: z.array(z.number().min(0)).max(40).default([]),
});

/**
 * A tier list (S to D): rows of labelled tiers, and each item drops into its row on the word that
 * ranks it, with a hit. Items are names (a short label on a coloured chip), never faces.
 */
export const TierBoard = z.object({
  ...Timed,
  type: z.literal("tierBoard"),
  title: z.string().min(1).max(40),
  top: Px.default(300),
  tiers: z
    .array(z.object({ label: z.string().min(1).max(3), color: Hex }))
    .min(2)
    .max(6),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(18),
        tier: z.number().int().min(0).max(5).describe("index into tiers"),
        at: z.number().min(0).describe("seconds after t0 the item lands"),
      }),
    )
    .min(1)
    .max(18),
});

/**
 * An explainer's world (the Kurzgesagt register): a scene in three parallax depth layers that
 * dollies slowly, and a small flying host that moves between `host` waypoints and points, taps
 * or reacts. One world per film; the other elements sit in front of it.
 */
export const ExplainerWorld = z.object({
  ...Timed,
  type: z.literal("explainerWorld"),
  world: z.enum(["space", "earth", "city", "ocean", "cell", "lab"]),
  host: z
    .array(
      z.object({
        at: z.number().min(0).describe("seconds after t0 the host arrives here"),
        x: Px,
        y: Px,
        pose: z.enum(["idle", "point", "tap", "wow", "think"]).default("idle"),
      }),
    )
    .max(24)
    .default([]),
  dolly: z.number().min(0).max(1).default(0.4).describe("how far the camera drifts over the film"),
});

/**
 * Quantities as little characters (population, not dots): `count` round figures in a grid; at
 * `at` the first `highlight` of them change colour and hop, with the label. 1 figure = `per`.
 */
export const Crowd = z.object({
  ...Timed,
  type: z.literal("crowd"),
  count: z.number().int().min(2).max(100),
  highlight: z.number().int().min(0).max(100).default(0),
  at: z.number().min(0).default(1).describe("seconds after t0 the highlight lands"),
  per: z.string().max(40).optional().describe('what one figure stands for, e.g. "1 in 10 people"'),
  label: z.string().max(40).optional(),
  top: Px.default(620),
  color: ColorToken.default("iv"),
  hiColor: ColorToken.default("gold"),
});

/**
 * A paper document in the editorial register: a newspaper clipping, a typed document or a
 * letter, cut out and tilted, halftone-screened, and one phrase in it struck by a hand-drawn red
 * marker at `markAt`. The words are real (the brief's own facts); `date` and `source` are optional.
 */
export const DocCard = z.object({
  ...Timed,
  type: z.literal("docCard"),
  kind: z.enum(["newspaper", "document", "letter"]).default("newspaper"),
  masthead: z.string().max(32).optional(),
  headline: z.string().min(1).max(90),
  body: z.string().max(260).optional(),
  date: z.string().max(24).optional(),
  mark: z.string().max(40).optional().describe("a phrase from the headline to strike with the marker"),
  markStyle: z.enum(["underline", "circle", "box"]).default("underline"),
  markAt: z.number().min(0).default(0.8).describe("seconds after t0"),
  x: Px.default(90),
  y: Px.default(520),
  w: z.number().min(400).max(1000).default(900),
  tilt: z.number().min(-8).max(8).default(-2),
});

const Box = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });

/**
 * A screen-studio moment on the real interface: a window holding a screenshot (usually the full
 * page) whose camera zooms to one region per step so that moment fills the window, while a cursor
 * glides to a real control and clicks it. Boxes and cursor points are in the screenshot's pixels
 * (the capture's `targets` give the real positions). The camera never sits still: each step pushes
 * from 1.0 to 1.04 and the next starts where it ended.
 */
export const ScreenFocus = z.object({
  ...Timed,
  type: z.literal("screenFocus"),
  imageId: Id,
  url: z.string().max(80).optional().describe("shown in the address bar; omit for a frameless screen"),
  x: Px.default(40),
  y: Px.default(380),
  w: z.number().min(300).max(1080).default(1000),
  h: z.number().min(300).max(1700).default(1180),
  steps: z
    .array(
      z.object({
        at: z.number().min(0).describe("seconds after t0 this step's zoom starts"),
        box: Box.describe("the region of the screenshot that fills the window"),
        cursor: z.object({ x: z.number(), y: z.number() }).optional().describe("where the cursor goes (screenshot px)"),
        click: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(12),
});

/**
 * The film's through-line object: one shape that carries from scene to scene, changing size,
 * place, corner radius and colour on every key, optionally holding a real crop (the product's own
 * button, then its logo) and a word. It never appears from nothing: it grows from its first key.
 */
export const ThroughLine = z.object({
  ...Timed,
  type: z.literal("throughLine"),
  keys: z
    .array(
      z.object({
        at: z.number().min(0),
        x: Px,
        y: Px,
        w: z.number().min(8).max(1400),
        h: z.number().min(8).max(2200),
        radius: z.number().min(0).max(1000).default(24),
        fill: Hex.default("#111111"),
        imageId: Id.optional().describe("a crop shown inside (the real button, the logo)"),
        text: z.string().max(40).optional(),
        textColor: Hex.default("#ffffff"),
      }),
    )
    .min(2)
    .max(16),
});

/**
 * A 3D fly-over of a landing page: the page lies on a bright studio floor; one continuous camera
 * glides down it looking up the page, rises to show the whole page as one strip, dives into the
 * hero and lands it as a card under a two-line title. Focus is thin: what crosses the middle of the
 * frame is sharp. Phases are shares of the element's life.
 */
export const PageFlyover = z.object({
  ...Timed,
  type: z.literal("pageFlyover"),
  imageId: Id.describe("the full-page screenshot"),
  heroImageId: Id.optional().describe("the first-screen screenshot (the card the dive lands on)"),
  logoImageId: Id.optional(),
  brand: z.string().max(40).optional(),
  line: z.string().min(1).max(60).describe("the closing statement"),
  tail: z.string().max(60).optional().describe("the short italic tail"),
  floor: Hex.default("#f2f3f6"),
});

/**
 * A whole explanation as one diagram in one continuous space: parts (nodes) joined by flows
 * (edges). Each step zooms into one part, shows one concrete example beside it, then the camera
 * pulls back as the part locks in; `focus` null = the whole diagram. Parts appear on the step that
 * first names them; flows draw and animate in the direction things move. Layout is fixed.
 */
export const DiagramZoom = z.object({
  ...Timed,
  type: z.literal("diagramZoom"),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        label: z.string().min(1).max(28),
        x: z.number().min(0).max(1000).describe("centre, in a 1000×1400 diagram space"),
        y: z.number().min(0).max(1400),
        shape: z.enum(["circle", "box", "pill"]).default("box"),
      }),
    )
    .min(2)
    .max(9),
  edges: z
    .array(z.object({ from: z.string(), to: z.string(), label: z.string().max(24).optional() }))
    .max(14)
    .default([]),
  steps: z
    .array(
      z.object({
        at: z.number().min(0),
        focus: z.string().nullable().describe("a node id, or null for the whole diagram"),
        example: z.string().max(48).optional().describe("one concrete example, ≤ 7 words"),
      }),
    )
    .min(1)
    .max(10),
  top: Px.default(240),
});

/**
 * One shot drawn by code (the /animate studio): the body of a function
 * `draw(g, t, W, H, rnd, S)` that paints a 1080×1920 canvas for time `t` (seconds since t0).
 * `g` is a CanvasRenderingContext2D, `rnd` a seeded random (same numbers every frame), `S` the
 * helpers (ease, lerp, clamp, noise, spring, mix). Pure function of t: no timers, no network.
 */
export const CodeScene = z.object({
  ...Timed,
  type: z.literal("codeScene"),
  code: z.string().min(20).max(24000),
  seed: z.number().int().min(0).max(1e9).default(7),
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
  BrowserCard,
  PourGlass,
  FightHud,
  SeasonWindow,
  NoteMachine,
  TierBoard,
  ExplainerWorld,
  Crowd,
  DocCard,
  ScreenFocus,
  ThroughLine,
  PageFlyover,
  DiagramZoom,
  CodeScene,
]);
export type PlanElement = z.infer<typeof PlanElement>;
export type PlanElementInput = z.input<typeof PlanElement>;
export type ElementType = PlanElement["type"];
export const ELEMENT_TYPES = PlanElement.options.map(
  (o) => o.shape.type.value as ElementType,
) as readonly ElementType[];

export const SfxType = z.enum(["whoosh", "pop", "tick", "glitch", "impact", "riser", "sub", "note", "pour"]);
export type SfxType = z.infer<typeof SfxType>;

export const SfxCue = z.object({
  t: Sec,
  type: SfxType,
  dur: z.number().min(0.05).max(5).optional(),
  gain: z.number().min(0).max(1.5).default(0.8),
  repeat: z.number().int().min(1).max(40).optional(),
  every: z.number().min(0.03).max(2).optional(),
  pitch: z.number().int().min(-12).max(24).optional().describe("semitones above C5, for `note`"),
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
