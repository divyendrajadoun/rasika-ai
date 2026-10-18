import { z } from "zod";
import { presetIds } from "@rasika/schema";
import { creditsForDuration } from "@/config/pricing";

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

export const MAX_DURATION_SEC = 180;

export function creditCost(durationSec: number): number {
  return creditsForDuration(durationSec);
}
