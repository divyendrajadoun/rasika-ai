"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { PhotoItem } from "@/components/wizard/step-photos";

export interface AiImageSettings {
  /** after we hear the words, AI draws pictures for the key moments (the worker, imagegen.py) */
  aiImages: boolean;
  aiImageCount: number;
  /** the picture style the prompts are written in, e.g. "photorealistic", "flat illustration" */
  aiImageStyle: string;
}

export const defaultAiImages: AiImageSettings = { aiImages: false, aiImageCount: 4, aiImageStyle: "" };
const AI_MAX = 6;

interface Moment {
  sayWhen: string;
  label: string;
  prompt: string;
  busy?: boolean;
  error?: string;
}

/**
 * AI images on the photos step: draw one now from a description, draft prompts from the script and
 * draw the ones you keep, or let the worker draw the key moments once it has heard the take.
 * Every image is paid for, so nothing is drawn until the user asks (up to 6 per reel).
 */
export function AiImages({
  projectId,
  photos,
  onPhotos,
  value,
  onChange,
  script,
}: {
  projectId: string;
  photos: PhotoItem[];
  onPhotos: (v: PhotoItem[]) => void;
  value: AiImageSettings;
  onChange: (v: AiImageSettings) => void;
  /** the words, when we already have them (script-only and presenter reels) */
  script?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const made = photos.filter((p) => p.filename.startsWith("ai-")).length;
  const room = Math.max(0, AI_MAX - made);
  const set = (patch: Partial<AiImageSettings>) => onChange({ ...value, ...patch });

  /** Start an image, poll it, add it to the photos when it is ready. */
  const draw = async (text: string, sayWhen = "", label = ""): Promise<string | null> => {
    const r = await fetch("/api/images/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, prompt: text }),
    });
    const j = (await r.json().catch(() => ({}))) as { requestId?: string; error?: string };
    if (!r.ok || !j.requestId) return j.error ?? "The image could not be started";
    const qs = new URLSearchParams({ projectId, requestId: j.requestId, prompt: text.slice(0, 1200) });
    for (let i = 0; i < 80; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const s = (await (await fetch(`/api/images/generate?${qs}`)).json().catch(() => ({}))) as {
        state?: string;
        assetId?: string;
        previewUrl?: string;
        reason?: string;
      };
      if (s.state === "done" && s.assetId && s.previewUrl) {
        onPhotos([
          ...photos,
          { assetId: s.assetId, previewUrl: s.previewUrl, filename: `ai-${s.assetId.slice(0, 8)}.jpg`, label, sayWhen, width: 960, height: 1696 },
        ]);
        return null;
      }
      if (s.state === "failed") return `The image failed (${s.reason ?? "unknown"})`;
    }
    return "The image took too long; try again";
  };

  const drawOne = async () => {
    setBusy(true);
    setError(null);
    const err = await draw(prompt.trim());
    if (err) setError(err);
    else setPrompt("");
    setBusy(false);
  };

  const suggest = async () => {
    if (!script) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/images/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script, n: Math.min(room, 4) || 1, style: value.aiImageStyle }),
    });
    const j = (await r.json().catch(() => ({}))) as { moments?: Moment[]; error?: string };
    if (!r.ok) setError(j.error ?? "No suggestions");
    setMoments(j.moments ?? []);
    setBusy(false);
  };

  const drawMoment = async (i: number) => {
    const m = moments[i]!;
    setMoments((ms) => ms.map((x, k) => (k === i ? { ...x, busy: true, error: undefined } : x)));
    const err = await draw(m.prompt, m.sayWhen, m.label);
    setMoments((ms) => (err ? ms.map((x, k) => (k === i ? { ...x, busy: false, error: err } : x)) : ms.filter((_, k) => k !== i)));
  };

  return (
    <section className="bg-surface mt-8 space-y-5 rounded-[8px] p-5" aria-labelledby="ai-images">
      <div className="flex items-start gap-3">
        <Sparkles className="text-accent mt-1 size-5 flex-none" aria-hidden />
        <div>
          <h3 id="ai-images" className="font-semibold">
            No photos? Let AI draw them
          </h3>
          <p className="text-muted text-[14px]">
            Up to {AI_MAX} AI images per reel ({made} made, {room} left). Each picture lands on the word it illustrates.
            No real people&apos;s faces, logos or text in the images.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="label">Picture style</span>
        <input
          className="input"
          maxLength={120}
          placeholder="e.g. photorealistic, natural light · flat pastel illustration · 3D clay"
          value={value.aiImageStyle}
          onChange={(e) => set({ aiImageStyle: e.target.value })}
        />
      </label>

      <label className="bg-raised flex items-center justify-between gap-4 rounded-[8px] p-4">
        <span>
          <span className="block font-semibold">Draw my key moments automatically</span>
          <span className="text-muted text-[13px]">
            After we hear your words, we pick the moments that want a picture and draw them in this style.
          </span>
        </span>
        <span className="flex items-center gap-3">
          <select
            aria-label="How many images"
            className="input w-auto"
            value={value.aiImageCount}
            disabled={!value.aiImages}
            onChange={(e) => set({ aiImageCount: Number(e.target.value) })}
          >
            {Array.from({ length: AI_MAX }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} image{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <input
            type="checkbox"
            className="size-5 accent-[var(--ter)]"
            checked={value.aiImages}
            onChange={(e) => set({ aiImages: e.target.checked })}
          />
        </span>
      </label>

      <div>
        <label htmlFor="ai-prompt" className="label">
          Or describe a picture and draw it now
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="ai-prompt"
            className="input flex-1"
            maxLength={1200}
            placeholder="e.g. a sunlit balcony with potted plants overlooking a city at dusk"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="button" className="button" disabled={busy || room === 0 || prompt.trim().length < 8} onClick={() => void drawOne()}>
            {busy ? "Drawing…" : "Draw it"}
          </button>
        </div>
        <p className="text-muted mt-1 text-[13px]">About 30 seconds. Then set the word it belongs to, like any photo.</p>
      </div>

      {script && (
        <div className="space-y-3">
          <button type="button" className="button-secondary" disabled={busy || room === 0} onClick={() => void suggest()}>
            Suggest pictures from my script
          </button>
          {moments.map((m, i) => (
            <div key={i} className="bg-raised space-y-2 rounded-[8px] p-4">
              <p className="text-[13px]">
                <span className="font-medium">{m.label || "Picture"}</span>
                <span className="text-muted"> · on “{m.sayWhen}”</span>
              </p>
              <textarea
                className="input min-h-16"
                value={m.prompt}
                onChange={(e) => setMoments((ms) => ms.map((x, k) => (k === i ? { ...x, prompt: e.target.value } : x)))}
              />
              <div className="flex items-center gap-3">
                <button type="button" className="button" disabled={m.busy || room === 0} onClick={() => void drawMoment(i)}>
                  {m.busy ? "Drawing…" : "Draw this"}
                </button>
                <button type="button" className="text-muted text-[14px] underline" onClick={() => setMoments((ms) => ms.filter((_, k) => k !== i))}>
                  Skip
                </button>
                {m.error && <span className="text-[13px] text-[var(--ter)]">{m.error}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-[14px] text-[var(--ter)]">{error}</p>}
    </section>
  );
}
