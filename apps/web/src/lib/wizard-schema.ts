import { z } from "zod";
import { presetIds } from "@rasika/schema";
import { creditsForDuration } from "@/config/pricing";
import { estimateSpokenSeconds, voiceIds } from "@/config/voices";

/** What the "Create my edit" step submits. Shared by the client wizard and the server action. */
export const WizardPhoto = z.object({
  assetId: z.string().uuid(),
  label: z.string().max(60).default(""),
  sayWhen: z.string().max(120).default(""),
  crop: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
});

export const WizardSubmission = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(120),
  sourceAssetId: z.string().uuid(),
  /** reference matching: the uploaded reference reel */
  referenceAssetId: z.string().uuid().optional(),
  fidelity: z.enum(["pace", "camera", "look"]).default("camera"),
  durationSec: z.number().positive().max(180),
  photos: z.array(WizardPhoto).max(15).default([]),
  stylePreset: z.string().refine((id) => presetIds.includes(id), {
    message: "Unknown style preset",
  }),
  styleText: z.string().max(300).default(""),
  options: z.object({
    captions: z.boolean().default(true),
    sfxIntensity: z.number().min(0).max(1).default(0.6),
    music: z.boolean().default(false),
    language: z.enum(["auto", "en", "hi", "hinglish"]).default("auto"),
  }),
  brand: z.object({
    name: z.string().max(60).default(""),
    handle: z.string().max(60).default(""),
    endLine: z.string().max(120).default(""),
    cta: z.string().max(60).default(""),
  }),
  consent: z.literal(true, {
    error: "Please confirm you have the rights to this video and these images.",
  }),
});
export type WizardSubmission = z.infer<typeof WizardSubmission>;

/** "Create my edit" for a script-only reel: no source video — the worker narrates and builds one. */
export const ScriptSubmission = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(120),
  script: z
    .string()
    .trim()
    .min(20, "The script needs at least a sentence or two.")
    .max(6000, "Keep the script under 6 000 characters."),
  voice: z.string().refine((id) => voiceIds.includes(id), { message: "Unknown voice" }),
  photos: z.array(WizardPhoto).max(15).default([]),
  stylePreset: z.string().refine((id) => presetIds.includes(id), {
    message: "Unknown style preset",
  }),
  styleText: z.string().max(300).default(""),
  options: z.object({
    captions: z.boolean().default(true),
    sfxIntensity: z.number().min(0).max(1).default(0.6),
    music: z.boolean().default(false),
  }),
  brand: z.object({
    name: z.string().max(60).default(""),
    handle: z.string().max(60).default(""),
    endLine: z.string().max(120).default(""),
    cta: z.string().max(60).default(""),
  }),
  consent: z.literal(true, {
    error: "Please confirm you have the rights to this script and these images.",
  }),
});
export type ScriptSubmission = z.infer<typeof ScriptSubmission>;

export { estimateSpokenSeconds };

export const MAX_DURATION_SEC = 180;

export function creditCost(durationSec: number): number {
  return creditsForDuration(durationSec);
}
