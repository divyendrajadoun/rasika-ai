/**
 * @rasika/schema — Plan JSON contracts.
 *
 * Phase 0 ships only the versioned envelope and the style-token shape that the
 * landing page and brand config share. Phase 3 fills in the full Plan schema
 * (elements, video modes, captions, sfx, end card) and the JSON-Schema export.
 */
import { z } from "zod";

export const PLAN_VERSION = 1 as const;

/** Colour tokens — elements only ever reference tokens, never raw hex. */
export const ColorToken = z.enum(["mar", "ter", "gold", "goldd", "iv", "stage", "ink"]);
export type ColorToken = z.infer<typeof ColorToken>;

export * from "./style";
import { StyleTokens } from "./style";

export const PlanMeta = z.object({
  durationSec: z.number().positive().max(180),
  fps: z.literal(30),
  width: z.literal(1080),
  height: z.literal(1920),
  language: z.string().min(2),
});
export type PlanMeta = z.infer<typeof PlanMeta>;

/** Versioned envelope. Phase 3 extends this with the full element union. */
export const PlanEnvelope = z.object({
  version: z.literal(PLAN_VERSION),
  meta: PlanMeta,
  style: StyleTokens,
});
export type PlanEnvelope = z.infer<typeof PlanEnvelope>;

export { presets, defaultPreset } from "./presets";
