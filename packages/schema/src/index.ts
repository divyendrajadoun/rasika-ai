/**
 * @rasika/schema — Plan JSON contracts.
 *
 * - `plan.ts`: the versioned Plan v1 (meta, style, subject, video modes, captions, the element
 *   union, sfx, end card) and the word-level Transcript.
 * - `validate.ts`: `validatePlan(plan, transcript)` — repairs + reports (SPEC §6.3).
 * - `presets.ts`: the shipped style presets.
 * - `scripts/export.ts` writes `dist/plan.schema.json`, from which the Python worker's pydantic
 *   models are generated (`pnpm --filter @rasika/schema export`).
 */
export * from "./style";
export * from "./plan";
export * from "./validate";
export { presets, defaultPreset } from "./presets";
