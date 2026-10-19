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
    broll: z.boolean().default(false),
    cleanCut: z.boolean().default(false),
    hookFirst: z.boolean().default(false),
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
    broll: z.boolean().default(false),
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

/** "Create my film" for a film made from a brief (config/briefs.ts): the worker writes and designs it. */
export const BriefSubmission = z
  .object({
    projectId: z.string().uuid(),
    title: z.string().max(120).default(""),
    kind: z.enum([
      "launch",
      "showreel",
      "app",
      "recipe",
      "versus",
      "machine",
      "journey",
      "explainer",
      "editorial",
      "tierlist",
      "product",
      "referral",
      "hype",
      "flyover",
      "diagram",
    ]),
    url: z.string().trim().max(300).optional(),
    recipe: z.string().trim().max(1500).optional(),
    subject: z.string().trim().max(600).optional(),
    topic: z.string().trim().max(600).optional(),
    focus: z.string().trim().max(400).optional(),
    seconds: z.enum(["15", "20", "30", "40", "60"]).optional(),
    closeLine: z.string().trim().max(60).optional(),
    closeTail: z.string().trim().max(40).optional(),
    a: z.string().trim().max(40).optional(),
    b: z.string().trim().max(40).optional(),
    winner: z.enum(["", "a", "b"]).default(""),
    line: z.string().trim().max(60).optional(),
    end: z.string().trim().max(30).optional(),
    voice: z.string().refine((id) => voiceIds.includes(id), { message: "Unknown voice" }).optional(),
    photos: z.array(WizardPhoto).max(15).default([]),
    options: z.object({
      sfxIntensity: z.number().min(0).max(1).default(0.6),
    }),
    brand: z.object({
      name: z.string().max(60).default(""),
      handle: z.string().max(60).default(""),
      endLine: z.string().max(120).default(""),
      cta: z.string().max(60).default(""),
    }),
    consent: z.literal(true, {
      error: "Please confirm you have the rights to what you shared.",
    }),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (["launch", "showreel", "app", "product", "referral", "hype", "flyover"].includes(v.kind))
      need(/^https?:\/\/[^\s/]+\.[^\s]+/i.test(v.url ?? ""), "url", "Add the website link, starting with https://");
    if (v.kind === "recipe") need((v.recipe ?? "").length >= 15, "recipe", "Write the recipe: ingredients with measures.");
    if (v.kind === "journey") need((v.subject ?? "").length >= 10, "subject", "Say what the story is about.");
    if (v.kind === "flyover") need(Boolean(v.closeLine), "closeLine", "Write the closing statement.");
    if (v.kind === "diagram" && v.url)
      need(/^https?:\/\/[^\s/]+\.[^\s]+/i.test(v.url), "url", "The link should start with https://");
    if (["explainer", "editorial", "tierlist", "diagram"].includes(v.kind))
      need((v.topic ?? "").length >= 6, "topic", "Say what the film is about.");
    if (v.kind === "versus") need(Boolean(v.a && v.b), "a", "Name both contenders.");
    if (v.kind === "machine") need(Boolean(v.line), "line", "Write the line that types out.");
  });
export type BriefSubmission = z.infer<typeof BriefSubmission>;

/** "Create my edit" for an AI presenter reel: HeyGen renders the take from script + photo / look. */
export const PresenterSubmission = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(120),
  script: z
    .string()
    .trim()
    .min(20, "The script needs at least a sentence or two.")
    .max(4000, "Keep the script under 4 000 characters."),
  voiceId: z.string().min(1, "Choose a voice"),
  lookId: z.string().min(1).nullable().default(null),
  photoAssetId: z.string().uuid().nullable().default(null),
  photos: z.array(WizardPhoto).max(15).default([]),
  stylePreset: z.string().refine((id) => presetIds.includes(id), {
    message: "Unknown style preset",
  }),
  styleText: z.string().max(300).default(""),
  options: z.object({
    captions: z.boolean().default(true),
    sfxIntensity: z.number().min(0).max(1).default(0.6),
    music: z.boolean().default(false),
    broll: z.boolean().default(false),
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
  presenterConsent: z.literal(true, {
    error: "Please confirm the rights to the photo, that the person is an adult, and the upload to our avatar provider.",
  }),
});
export type PresenterSubmission = z.infer<typeof PresenterSubmission>;

export { estimateSpokenSeconds };

export const MAX_DURATION_SEC = 180;

export function creditCost(durationSec: number): number {
  return creditsForDuration(durationSec);
}
