"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createDraftProject, createEdit, createScriptEdit } from "@/app/dashboard/actions";
import { StepBrand } from "@/components/wizard/step-brand";
import { StepPhotos, type PhotoItem } from "@/components/wizard/step-photos";
import {
  StepScript,
  defaultScriptState,
  type ScriptState,
} from "@/components/wizard/step-script";
import { StepSource, type SourceMode } from "@/components/wizard/step-source";
import { StepStyle, type StyleState } from "@/components/wizard/step-style";
import { StepUpload, type UploadResult } from "@/components/wizard/step-upload";
import { defaultPresetId } from "@/config/presets";
import { estimateSpokenSeconds } from "@/config/voices";
import { creditCost } from "@/lib/wizard-schema";
import { cn } from "@/lib/utils";

type StepId = "source" | "upload" | "script" | "photos" | "style" | "brand";
const STEP_LABEL: Record<StepId, string> = {
  source: "Source",
  upload: "Upload reel",
  script: "Your script",
  photos: "Your photos",
  style: "Style",
  brand: "Brand & ending",
};
/** The path through the wizard depends on where the reel comes from. */
const PATHS: Record<SourceMode, StepId[]> = {
  take: ["source", "upload", "photos", "style", "brand"],
  script: ["source", "script", "photos", "style", "brand"],
  // the reference clip is uploaded on the upload step (second drop zone)
  reference: ["source", "upload", "photos", "style", "brand"],
  presenter: ["source"],
};

export interface BrandState {
  name: string;
  handle: string;
  endLine: string;
  cta: string;
}

type Fidelity = "pace" | "camera" | "look";
const FIDELITY: { id: Fidelity; label: string; blurb: string }[] = [
  { id: "pace", label: "Pace", blurb: "Shot lengths and cut cadence only; your chosen style's look." },
  {
    id: "camera",
    label: "Pace + camera",
    blurb: "Also how shots arrive and move: cuts, punch-ins, entrances.",
  },
  {
    id: "look",
    label: "Pace + camera + look",
    blurb: "Also its palette, type and texture — the style card becomes a starting point.",
  },
];

interface Draft {
  step: number;
  mode: SourceMode;
  upload: UploadResult | null;
  reference: UploadResult | null;
  fidelity: Fidelity;
  script: ScriptState;
  /** script-only reels: the draft project created when leaving the script step */
  scriptProjectId: string | null;
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
    mode: "take",
    upload: null,
    reference: null,
    fidelity: "camera",
    script: defaultScriptState,
    scriptProjectId: null,
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
    const pid = draft.upload?.projectId ?? draft.scriptProjectId;
    if (!pid) return;
    try {
      localStorage.setItem(draftKey(pid), JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const steps = PATHS[draft.mode];
  const stepId: StepId = steps[Math.min(draft.step, steps.length - 1)] ?? "source";
  const projectId = draft.mode === "script" ? draft.scriptProjectId : (draft.upload?.projectId ?? null);
  const scriptSeconds = estimateSpokenSeconds(draft.script.text);
  const duration =
    draft.mode === "script" ? (scriptSeconds || null) : (draft.upload?.durationSec ?? null);
  const cost = duration ? creditCost(Math.max(1, duration)) : 1;
  const tooLong = duration !== null && duration > maxSeconds;
  const canNext = useMemo(() => {
    if (stepId === "source") return draft.mode !== "presenter";
    if (stepId === "upload")
      return (
        Boolean(draft.upload?.complete) &&
        !tooLong &&
        (draft.mode !== "reference" || Boolean(draft.reference?.complete))
      );
    if (stepId === "script") return draft.script.text.trim().length >= 20 && !tooLong;
    return true;
  }, [stepId, draft.mode, draft.upload, draft.reference, draft.script.text, tooLong]);

  const next = () => {
    setError(null);
    if (stepId === "script" && !draft.scriptProjectId) {
      // the photos step uploads against a project: create the draft now
      startTransition(async () => {
        const firstLine = draft.script.text.trim().split(/\n/)[0]?.slice(0, 80) ?? "";
        const res = await createDraftProject(draft.title || firstLine || "Script reel");
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setDraft((d) => ({
          ...d,
          scriptProjectId: res.projectId,
          title: d.title || firstLine,
          step: d.step + 1,
        }));
      });
      return;
    }
    setDraft((d) => ({ ...d, step: d.step + 1 }));
  };

  const submit = () => {
    if (draft.mode === "script") return submitScript();
    if (!draft.upload) return;
    setError(null);
    const payload = {
      projectId: draft.upload.projectId,
      title: draft.title || draft.upload.filename.replace(/\.[^.]+$/, ""),
      sourceAssetId: draft.upload.assetId,
      referenceAssetId:
        draft.mode === "reference" && draft.reference?.complete ? draft.reference.assetId : undefined,
      fidelity: draft.fidelity,
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

  const submitScript = () => {
    if (!draft.scriptProjectId) return;
    setError(null);
    const payload = {
      projectId: draft.scriptProjectId,
      title: draft.title || draft.script.text.trim().split(/\n/)[0]?.slice(0, 80) || "Script reel",
      script: draft.script.text,
      voice: draft.script.voice,
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
      },
      brand: draft.brand,
      consent,
    };
    startTransition(async () => {
      const res = await createScriptEdit(payload);
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
      <h1 className="poster text-5xl">{STEP_LABEL[stepId]}</h1>

      <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Steps">
        {steps.map((s, i) => (
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
                {STEP_LABEL[s]}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {stepId === "source" && (
          <StepSource
            value={draft.mode}
            onChange={(mode) => setDraft((d) => ({ ...d, mode, step: 0 }))}
          />
        )}
        {stepId === "script" && (
          <StepScript
            value={draft.script}
            maxSeconds={maxSeconds}
            planName={planName}
            onChange={(script) => setDraft((d) => ({ ...d, script }))}
          />
        )}
        {stepId === "upload" && (
          <div className="space-y-8">
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
            {draft.mode === "reference" && (
              <div className="space-y-4">
                <div>
                  <p className="kicker text-goldd dark:text-gold mb-1">The reference</p>
                  <p className="text-muted-foreground text-sm">
                    {draft.upload?.complete
                      ? "Now the reel whose rhythm and look you want. We measure its cuts, camera and palette, write a style from them, and cut your take that way."
                      : "Upload your own take first; the reference attaches to it."}
                  </p>
                </div>
                {draft.upload?.complete && (
                  <StepUpload
                    kind="reference_video"
                    projectId={draft.upload.projectId}
                    value={draft.reference}
                    maxSeconds={180}
                    planName={planName}
                    onChange={(r) => setDraft((d) => ({ ...d, reference: r }))}
                  />
                )}
                <div>
                  <p className="kicker text-goldd dark:text-gold mb-2">How closely</p>
                  <ul className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Fidelity">
                    {FIDELITY.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={draft.fidelity === f.id}
                          onClick={() => setDraft((d) => ({ ...d, fidelity: f.id }))}
                          className={cn(
                            "bg-card h-full w-full rounded-xl border px-3 py-2 text-left transition",
                            draft.fidelity === f.id && "border-ter ring-ter/40 ring-2",
                          )}
                        >
                          <span className="block font-semibold">{f.label}</span>
                          <span className="text-muted-foreground block text-xs">{f.blurb}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        {stepId === "photos" && projectId && (
          <StepPhotos
            projectId={projectId}
            value={draft.photos}
            onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
          />
        )}
        {stepId === "style" && (
          <StepStyle value={draft.style} onChange={(style) => setDraft((d) => ({ ...d, style }))} />
        )}
        {stepId === "brand" && (
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
        {draft.step < steps.length - 1 ? (
          <button type="button" className="btn-ter" disabled={!canNext || pending} onClick={next}>
            {pending
              ? "One moment…"
              : stepId === "photos" && draft.photos.length === 0
                ? "Skip photos →"
                : "Continue →"}
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
