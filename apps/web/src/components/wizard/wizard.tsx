"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createEdit } from "@/app/dashboard/actions";
import { StepBrand } from "@/components/wizard/step-brand";
import { StepPhotos, type PhotoItem } from "@/components/wizard/step-photos";
import { StepStyle, type StyleState } from "@/components/wizard/step-style";
import { StepUpload, type UploadResult } from "@/components/wizard/step-upload";
import { defaultPresetId } from "@/config/presets";
import { creditCost } from "@/lib/wizard-schema";
import { cn } from "@/lib/utils";

const STEPS = ["Upload reel", "Your photos", "Style", "Brand & ending"] as const;

export interface BrandState {
  name: string;
  handle: string;
  endLine: string;
  cta: string;
}

interface Draft {
  step: number;
  upload: UploadResult | null;
  photos: PhotoItem[];
  style: StyleState;
  brand: BrandState;
  title: string;
}

const draftKey = (projectId: string) => `rasika:wizard:${projectId}`;

export function Wizard({
  initialStyle,
  initialIndustry,
  resumeProjectId,
  credits,
  maxSeconds,
  planName,
}: {
  initialStyle?: string;
  /** From the landing page's industry picker — seeds the free-text style wish. */
  initialIndustry?: string;
  resumeProjectId?: string;
  credits: number;
  maxSeconds: number;
  planName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    step: 0,
    upload: null,
    photos: [],
    style: {
      preset: initialStyle && /^[a-z-]+$/.test(initialStyle) ? initialStyle : defaultPresetId,
      text: industryHint(initialIndustry),
      captions: true,
      sfxIntensity: 0.6,
      music: false,
      language: "auto",
    },
    brand: { name: "", handle: "", endLine: "", cta: "" },
    title: "",
  });

  // restore a draft for the project being resumed (upload state itself resumes via localStorage too)
  useEffect(() => {
    if (!resumeProjectId) return;
    try {
      const raw = localStorage.getItem(draftKey(resumeProjectId));
      if (raw) setDraft((d) => ({ ...d, ...(JSON.parse(raw) as Partial<Draft>) }));
    } catch {
      /* ignore */
    }
  }, [resumeProjectId]);
  useEffect(() => {
    const pid = draft.upload?.projectId;
    if (!pid) return;
    try {
      localStorage.setItem(draftKey(pid), JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const duration = draft.upload?.durationSec ?? null;
  const cost = duration ? creditCost(duration) : 1;
  const tooLong = duration !== null && duration > maxSeconds;
  const canNext = useMemo(() => {
    if (draft.step === 0) return Boolean(draft.upload?.complete) && !tooLong;
    return true;
  }, [draft.step, draft.upload, tooLong]);

  const submit = () => {
    if (!draft.upload) return;
    setError(null);
    const payload = {
      projectId: draft.upload.projectId,
      title: draft.title || draft.upload.filename.replace(/\.[^.]+$/, ""),
      sourceAssetId: draft.upload.assetId,
      durationSec: draft.upload.durationSec ?? 0,
      photos: draft.photos.map((p) => ({
        assetId: p.assetId,
        label: p.label,
        sayWhen: p.sayWhen,
        crop: p.crop,
      })),
      stylePreset: draft.style.preset,
      styleText: draft.style.text,
      options: {
        captions: draft.style.captions,
        sfxIntensity: draft.style.sfxIntensity,
        music: draft.style.music,
        language: draft.style.language,
      },
      brand: draft.brand,
      consent,
    };
    startTransition(async () => {
      const res = await createEdit(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.removeItem(draftKey(res.projectId));
      } catch {
        /* ignore */
      }
      router.push(`/dashboard/p/${res.projectId}`);
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="kicker text-goldd dark:text-gold mb-2">New edit</p>
      <h1 className="poster text-5xl">{STEPS[draft.step]}</h1>

      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > draft.step && !canNext}
              onClick={() => i <= draft.step && setDraft((d) => ({ ...d, step: i }))}
              className={cn(
                "w-full rounded-xl border px-2 py-2 text-left transition",
                i === draft.step
                  ? "border-ter"
                  : i < draft.step
                    ? "border-gold/50"
                    : "text-muted-foreground",
              )}
              aria-current={i === draft.step ? "step" : undefined}
            >
              <span className="poster text-gold block text-2xl leading-none">0{i + 1}</span>
              <span className="mt-1 block truncate text-[0.7rem] font-semibold uppercase tracking-wide">
                {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {draft.step === 0 && (
          <StepUpload
            value={draft.upload}
            maxSeconds={maxSeconds}
            planName={planName}
            onChange={(u) =>
              setDraft((d) => ({
                ...d,
                upload: u,
                title: d.title || (u?.filename.replace(/\.[^.]+$/, "") ?? ""),
              }))
            }
          />
        )}
        {draft.step === 1 && draft.upload && (
          <StepPhotos
            projectId={draft.upload.projectId}
            value={draft.photos}
            onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
          />
        )}
        {draft.step === 2 && (
          <StepStyle value={draft.style} onChange={(style) => setDraft((d) => ({ ...d, style }))} />
        )}
        {draft.step === 3 && (
          <StepBrand
            value={draft.brand}
            title={draft.title}
            onTitle={(title) => setDraft((d) => ({ ...d, title }))}
            onChange={(brand) => setDraft((d) => ({ ...d, brand }))}
            consent={consent}
            onConsent={setConsent}
          />
        )}
      </div>

      {error && (
        <p
          className="mt-6 rounded-lg bg-[#ff8a66]/15 px-3 py-2 text-sm text-[#ff8a66]"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <button
          type="button"
          className="btn-outline-gold"
          disabled={draft.step === 0}
          onClick={() => setDraft((d) => ({ ...d, step: Math.max(0, d.step - 1) }))}
        >
          ← Back
        </button>
        {draft.step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn-ter"
            disabled={!canNext}
            onClick={() => setDraft((d) => ({ ...d, step: d.step + 1 }))}
          >
            {draft.step === 1 && draft.photos.length === 0 ? "Skip photos →" : "Continue →"}
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">
              Cost:{" "}
              <strong className="text-foreground">
                {cost} credit{cost === 1 ? "" : "s"}
              </strong>{" "}
              · you have {credits}
            </span>
            <button
              type="button"
              className="btn-ter"
              disabled={pending || !consent || credits < cost}
              onClick={submit}
            >
              {pending ? "Creating…" : "Create my edit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const INDUSTRY_HINTS: Record<string, string> = {
  "real-estate":
    "Real estate listing: show the price as a counter, land each photo on the room I name.",
  doctors:
    "Doctor explainer: calm, clinical, chapters for each reason, no stamps or flashy effects.",
  coaches:
    "Coach / educator: chapter cards for each step, counters for numbers, clear poster lines.",
  founders:
    "Founder story: bold poster lines, a counter for the big number, product photos on the word.",
  food: "Restaurant / chef: warm and appetising, photos of the dish on the word, time as a counter.",
  fitness: "Fitness: punchy, chapter per swap or exercise, counters for reps and days.",
  "law-finance": "Lawyer / finance explainer: serious, numbered clauses as chapters, no stamps.",
  agencies: "Agency client reel: clean and brandable, end card with the client handle.",
};

function industryHint(id?: string): string {
  return (id && INDUSTRY_HINTS[id]) || "";
}
