"use client";

import { useRef, useState } from "react";
import type { HeyGenLook, HeyGenVoice } from "@/lib/heygen";
import { uploadSmall } from "@/lib/upload/multipart-client";
import { ACCEPTED_IMAGE } from "@/lib/upload/plan";
import { cn } from "@/lib/utils";

export interface PresenterState {
  text: string;
  /** "photo" animates the uploaded portrait; "look" uses a HeyGen stock look */
  kind: "photo" | "look";
  photoAssetId: string | null;
  photoPreview: string | null;
  lookId: string | null;
  voiceId: string | null;
  rights: boolean;
  adult: boolean;
  upload: boolean;
}

export const defaultPresenterState: PresenterState = {
  text: "",
  kind: "photo",
  photoAssetId: null,
  photoPreview: null,
  lookId: null,
  voiceId: null,
  rights: false,
  adult: false,
  upload: false,
};

export const PRESENTER_MAX_CHARS = 4000;

/** Script + presenter + voice for a HeyGen-rendered talking head (paid: the owner's HeyGen wallet). */
export function StepPresenter({
  value,
  projectId,
  voices,
  looks,
  onChange,
  onNeedProject,
}: {
  value: PresenterState;
  /** the draft project the photo uploads against (created on first upload) */
  projectId: string | null;
  voices: HeyGenVoice[];
  looks: HeyGenLook[];
  onChange: (v: PresenterState) => void;
  /** creates the draft project and returns its id */
  onNeedProject: () => Promise<string | null>;
}) {
  const set = (patch: Partial<PresenterState>) => onChange({ ...value, ...patch });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const words = value.text.trim().split(/\s+/).filter(Boolean).length;
  const est = words ? (words / 150) * 60 + 1 : 0;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_IMAGE.includes(file.type)) {
      setError("Use a JPG or PNG portrait.");
      return;
    }
    setBusy(true);
    try {
      const pid = projectId ?? (await onNeedProject());
      if (!pid) throw new Error("Could not start the project");
      const assetId = await uploadSmall(pid, "presenter_image", file, file.name);
      set({ photoAssetId: assetId, photoPreview: URL.createObjectURL(file), kind: "photo" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const privateVoices = voices.filter((v) => v.private);
  const publicVoices = voices.filter((v) => !v.private);

  return (
    <div className="space-y-6">
      <p className="text-muted">
        A script and one face become a presenter video, rendered by HeyGen, then edited like any
        take. This spends HeyGen credits from your wallet.
      </p>

      <label className="block">
        <span className="label flex items-baseline justify-between">
          <span>Script</span>
          <span className="text-muted-foreground font-normal normal-case tracking-normal">
            {words} words · about {Math.round(est)} s spoken
          </span>
        </span>
        <textarea
          className="input min-h-48 text-sm leading-relaxed"
          maxLength={PRESENTER_MAX_CHARS}
          placeholder={"Hi, I'm the founder of…\n\nHere is the one thing nobody tells you before you buy."}
          value={value.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      </label>

      <div>
        <p className="label">Presenter</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => set({ kind: "photo" })}
            className={cn(
              "bg-surface rounded-[8px] p-4 text-left transition",
              value.kind === "photo" && "ring-2 ring-text",
            )}
          >
            <span className="block font-semibold">Your photo</span>
            <span className="text-muted-foreground block text-[13px]">
              One clear, front-facing portrait of an adult you have the rights to. HeyGen animates
              the face and lip-syncs the script.
            </span>
            {value.kind === "photo" && (
              <span className="mt-3 flex items-center gap-3">
                {value.photoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview blob
                  <img src={value.photoPreview} alt="" className="size-16 rounded-[6px] object-cover" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => void pickPhoto(e.target.files?.[0])}
                />
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileRef.current?.click();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                  className="button button-ghost text-[13px]"
                >
                  {busy ? "Uploading…" : value.photoAssetId ? "Change photo" : "Choose photo"}
                </span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => set({ kind: "look" })}
            className={cn(
              "bg-surface rounded-[8px] p-4 text-left transition",
              value.kind === "look" && "ring-2 ring-text",
            )}
          >
            <span className="block font-semibold">A stock presenter</span>
            <span className="text-muted-foreground block text-[13px]">
              One of HeyGen&apos;s licensed photo avatars. No upload, no rights to clear.
            </span>
          </button>
        </div>
        {value.kind === "look" && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup">
            {looks.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={value.lookId === l.id}
                  onClick={() => set({ lookId: l.id })}
                  className={cn(
                    "bg-surface w-full overflow-hidden rounded-[8px] border text-left transition",
                    value.lookId === l.id && "ring-2 ring-text",
                  )}
                >
                  <span className="relative block aspect-[3/4] bg-black/10">
                    {l.preview && (
                      // eslint-disable-next-line @next/next/no-img-element -- HeyGen preview
                      <img src={l.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="block truncate px-2 py-1 text-[12px]">{l.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-sm text-[#ff8a66]">{error}</p>}
      </div>

      <div>
        <p className="label">Voice</p>
        <select
          className="input"
          value={value.voiceId ?? ""}
          onChange={(e) => set({ voiceId: e.target.value || null })}
        >
          <option value="">Choose a voice…</option>
          {privateVoices.length > 0 && (
            <optgroup label="Your voices">
              {privateVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.language}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="HeyGen voices">
            {publicVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.language} · {v.gender}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="bg-surface space-y-2 rounded-[8px] p-4 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--ter)]" checked={value.rights} onChange={(e) => set({ rights: e.target.checked })} />
          <span>I own the rights to this photo and script, or have the person&apos;s permission.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--ter)]" checked={value.adult} onChange={(e) => set({ adult: e.target.checked })} />
          <span>The person shown is an adult.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--ter)]" checked={value.upload} onChange={(e) => set({ upload: e.target.checked })} />
          <span>The photo and script may be sent to HeyGen to render the video.</span>
        </label>
      </div>
    </div>
  );
}

export function presenterReady(v: PresenterState): boolean {
  return (
    v.text.trim().length >= 20 &&
    Boolean(v.voiceId) &&
    (v.kind === "photo" ? Boolean(v.photoAssetId) : Boolean(v.lookId)) &&
    v.rights &&
    v.adult &&
    v.upload
  );
}
