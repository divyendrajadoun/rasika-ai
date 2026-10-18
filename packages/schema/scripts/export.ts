/**
 * Writes the JSON Schema for Plan v1 and the Transcript to packages/schema/plan.schema.json.
 * The Python worker's pydantic models are generated from this file (see apps/worker/Makefile-ish
 * script `pnpm schema:pydantic`). CI fails if the committed output is stale.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as S from "../src/plan";
import { Palette, StyleTokens } from "../src/style";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..");
mkdirSync(out, { recursive: true });

// Named $defs (pydantic class names) instead of __schema0…
const named: Record<string, z.ZodType> = {
  Plan: S.Plan,
  PlanMeta: S.PlanMeta,
  Subject: S.Subject,
  Rect: S.Rect,
  Point: S.Point,
  VideoMode: S.VideoMode,
  VideoModeName: S.VideoModeName,
  Captions: S.Captions,
  EndCard: S.EndCard,
  SfxCue: S.SfxCue,
  SfxType: S.SfxType,
  ColorToken: S.ColorToken,
  TextFont: S.TextFont,
  TextLine: S.TextLine,
  PatternId: S.PatternId,
  PlanElement: S.PlanElement,
  PosterText: S.PosterText,
  Counter: S.Counter,
  LockCard: S.LockCard,
  PropPunchIn: S.PropPunchIn,
  FeedPhone: S.FeedPhone,
  Stamp: S.Stamp,
  ChapterCard: S.ChapterCard,
  ImageCard: S.ImageCard,
  ImageCardSpec: S.ImageCardSpecSchema,
  SplitCards: S.SplitCards,
  BleedPlate: S.BleedPlate,
  FilmStrip: S.FilmStrip,
  PatternCard: S.PatternCard,
  Equation: S.Equation,
  Reveal: S.Reveal,
  StrikeLine: S.StrikeLine,
  Chips: S.Chips,
  Transcript: S.Transcript,
  TranscriptWord: S.TranscriptWord,
  StyleTokens,
  Palette,
};
for (const [id, schema] of Object.entries(named)) z.globalRegistry.add(schema, { id });

const Bundle = z.object({ plan: S.Plan, transcript: S.Transcript, sfxCue: S.SfxCue });
const schema = z.toJSONSchema(Bundle, {
  target: "draft-2020-12",
  io: "input",
  unrepresentable: "any",
  cycles: "ref",
  reused: "inline",
}) as Record<string, unknown>;

schema.$id = "https://rasika.app/schema/plan-v1.json";
schema.title = "RasikaPlanBundle";
schema.description =
  "Rasika Plan v1 (edit description), word-level Transcript and SFX cue. Generated — do not edit.";

const text = JSON.stringify(schema, null, 2) + "\n";
writeFileSync(resolve(out, "plan.schema.json"), text);
console.log(`wrote plan.schema.json (${text.length} bytes)`);
