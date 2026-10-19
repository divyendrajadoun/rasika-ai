/**
 * Narration voices for script-only reels — Deepgram Aura-2 on the same key the transcriber uses.
 * Mirrors `VOICES` in apps/worker/rasika_worker/tts.py (the worker rejects ids it does not know).
 * English only: Aura has no Hindi model yet, so the script mode is English until a second TTS
 * provider is approved (see docs/costs.md).
 */
export interface Voice {
  id: string;
  name: string;
  accent: string;
  tone: string;
}

export const VOICES: readonly Voice[] = [
  { id: "aura-2-thalia-en", name: "Thalia", accent: "American", tone: "clear, confident, energetic" },
  { id: "aura-2-asteria-en", name: "Asteria", accent: "American", tone: "clear, knowledgeable" },
  { id: "aura-2-luna-en", name: "Luna", accent: "American", tone: "young, friendly, natural" },
  { id: "aura-2-athena-en", name: "Athena", accent: "American", tone: "mature, calm, professional" },
  { id: "aura-2-orion-en", name: "Orion", accent: "American", tone: "approachable, calm" },
  { id: "aura-2-zeus-en", name: "Zeus", accent: "American", tone: "deep, trustworthy" },
  { id: "aura-2-apollo-en", name: "Apollo", accent: "American", tone: "confident, casual" },
  { id: "aura-2-pandora-en", name: "Pandora", accent: "British", tone: "smooth, calm, melodic" },
  { id: "aura-2-draco-en", name: "Draco", accent: "British", tone: "warm, approachable" },
  { id: "aura-2-theia-en", name: "Theia", accent: "Australian", tone: "expressive, sincere" },
  { id: "aura-2-hyperion-en", name: "Hyperion", accent: "Australian", tone: "caring, warm" },
  { id: "aura-2-amalthea-en", name: "Amalthea", accent: "Filipino", tone: "young, engaging, cheerful" },
];

export const DEFAULT_VOICE = "aura-2-thalia-en";
export const voiceIds = VOICES.map((v) => v.id);

/** Spoken length estimate (≈150 wpm + paragraph pauses + end-card tail); the worker measures the real one. */
export function estimateSpokenSeconds(script: string): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const paragraphs = script.split(/\n\s*\n/).filter((p) => p.trim()).length;
  if (!words) return 0;
  return (words / 150) * 60 + Math.max(0, paragraphs - 1) * 0.45 + 0.6;
}
