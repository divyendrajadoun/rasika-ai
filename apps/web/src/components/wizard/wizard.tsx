"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createBriefEdit,
  createDraftProject,
  createEdit,
  createPresenterEdit,
  createScriptEdit,
} from "@/app/dashboard/actions";
import { StepBrand } from "@/components/wizard/step-brand";
import { StepPhotos, type PhotoItem } from "@/components/wizard/step-photos";
import { defaultAiImages, type AiImageSettings } from "@/components/wizard/ai-images";
import {
  StepScript,
  defaultScriptState,
  type ScriptState,
} from "@/components/wizard/step-script";
import {
  StepPresenter,
  defaultPresenterState,
  presenterReady,
  type PresenterState,
} from "@/components/wizard/step-presenter";
import { StepSource, type SourceMode } from "@/components/wizard/step-source";
import { StepBrief, briefReady, defaultBriefState, type BriefState } from "@/components/wizard/step-brief";
import { briefKind } from "@/config/briefs";
import type { HeyGenLook, HeyGenVoice } from "@/lib/heygen";
import { StepStyle, type StyleState } from "@/components/wizard/step-style";
import { StepUpload, type UploadResult } from "@/components/wizard/step-upload";
import { defaultPresetId } from "@/config/presets";
import { estimateSpokenSeconds } from "@/config/voices";
import { creditCost } from "@/lib/wizard-schema";
import { cn } from "@/lib/utils";

type StepId = "source" | "upload" | "script" | "presenter" | "brief" | "photos" | "style" | "brand";
const stepLabel = (s: StepId, mode: SourceMode, kind?: string) =>
  s === "style" && mode === "reference"
    ? "Edit options"
    : s === "photos" && mode === "brief" && kind === "animate"
      ? "Style images"
      : STEP_LABEL[s];
const STEP_LABEL: Record<StepId, string> = {
  source: "Source",
  upload: "Upload reel",
  script: "Your script",
  presenter: "Presenter",
  brief: "Your brief",
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
  presenter: ["source", "presenter", "photos", "style", "brand"],
  // each kind of brief film comes with its own look, so there is no style step
  brief: ["source", "brief", "photos", "brand"],
};

export interface BrandState {
  name: string;
  handle: string;
  endLine: string;
  cta: string;
}

/**
 * A reference is always matched in full: its pace, camera and look (palette, type, captions,
 * texture). The worker still accepts "pace" and "camera" for drafts saved before this changed.
 */
type Fidelity = "pace" | "camera" | "look";
const REFERENCE_FIDELITY: Fidelity = "look";

interface Draft {
  step: number;
  mode: SourceMode;
  upload: UploadResult | null;
  reference: UploadResult | null;
  fidelity: Fidelity;
  script: ScriptState;
  presenter: PresenterState;
  /** script-only / presenter reels: the draft project created before the photos step */
  scriptProjectId: string | null;
  brief: BriefState;
  photos: PhotoItem[];
  style: StyleState;
  ai: AiImageSettings;
  brand: BrandState;
  title: string;
}

const draftKey = (projectId: string) => `rasika:wizard:${projectId}`;

export function Wizard({
  initialStyle,
  initialIndustry,
  initialSource,
  initialTitle,
  initialKind,
  resumeProjectId,
  credits,
  maxSeconds,
  planName,
  stockEnabled = false,
  aiImagesEnabled = false,
  presenterEnabled = false,
  voices = [],
  looks = [],
}: {
  initialStyle?: string;
  /** From the landing page's industry picker — seeds the free-text style wish. */
  initialIndustry?: string;
  /** From the landing page's closing step: where the reel comes from, and its title. */
  initialSource?: string;
  initialTitle?: string;
  /** From the landing page's brief films: the kind to start on. */
  initialKind?: string;
  resumeProjectId?: string;
  credits: number;
  maxSeconds: number;
  planName: string;
  /** the worker can fetch stock B-roll */
  stockEnabled?: boolean;
  /** the workspace can draw AI images (Higgsfield keys set) */
  aiImagesEnabled?: boolean;
  /** the worker can render AI presenters (HeyGen) */
  presenterEnabled?: boolean;
  voices?: HeyGenVoice[];
  looks?: HeyGenLook[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    step: 0,
    mode: (["take", "script", "reference", "presenter", "brief"] as SourceMode[]).find((m) => m === initialSource) ?? "take",
    upload: null,
    reference: null,
    fidelity: REFERENCE_FIDELITY,
    script: defaultScriptState,
    presenter: defaultPresenterState,
    scriptProjectId: null,
    brief: briefKind(initialKind ?? "")
      ? { ...defaultBriefState, kind: initialKind as BriefState["kind"], ...briefKind(initialKind ?? "")!.example }
      : defaultBriefState,
    photos: [],
    style: {
      preset: initialStyle && /^[a-z-]+$/.test(initialStyle) ? initialStyle : defaultPresetId,
      text: industryHint(initialIndustry),
      captions: true,
      sfxIntensity: 0.6,
      music: false,
      language: "auto",
      broll: false,
      cleanCut: false,
      hookFirst: false,
    },
    ai: defaultAiImages,
    brand: { name: "", handle: "", endLine: "", cta: "" },
    title: (initialTitle ?? "").slice(0, 80),
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
  const projectId =
    draft.mode === "script" || draft.mode === "presenter" || draft.mode === "brief"
      ? draft.scriptProjectId
      : (draft.upload?.projectId ?? null);
  const scriptSeconds = estimateSpokenSeconds(
    draft.mode === "presenter" ? draft.presenter.text : draft.script.text,
  );
  const duration =
    draft.mode === "brief"
      ? Math.min(briefKind(draft.brief.kind)?.maxSeconds ?? 30, maxSeconds)
      : draft.mode === "script" || draft.mode === "presenter"
        ? scriptSeconds || null
        : (draft.upload?.durationSec ?? null);
  const cost = duration ? creditCost(Math.max(1, duration)) : 1;
  const tooLong = duration !== null && duration > maxSeconds;
  const canNext = useMemo(() => {
    if (stepId === "source") return draft.mode !== "presenter" || presenterEnabled;
    if (stepId === "presenter") return presenterReady(draft.presenter) && !tooLong;
    if (stepId === "upload")
      return (
        Boolean(draft.upload?.complete) &&
        !tooLong &&
        (draft.mode !== "reference" || Boolean(draft.reference?.complete))
      );
    if (stepId === "script") return draft.script.text.trim().length >= 20 && !tooLong;
    if (stepId === "brief") return briefReady(draft.brief);
    return true;
  }, [stepId, draft.mode, draft.upload, draft.reference, draft.script.text, draft.presenter, draft.brief, tooLong, presenterEnabled]);

  const ensureDraftProject = async (): Promise<string | null> => {
    if (draft.scriptProjectId) return draft.scriptProjectId;
    const firstLine =
      (draft.mode === "presenter" ? draft.presenter.text : draft.script.text).trim().split(/\n/)[0]?.slice(0, 80) ?? "";
    const res = await createDraftProject(draft.title || firstLine || "Presenter reel");
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setDraft((d) => ({ ...d, scriptProjectId: res.projectId, title: d.title || firstLine }));
    return res.projectId;
  };

  const next = () => {
    setError(null);
    if (stepId === "brief" && !draft.scriptProjectId) {
      // the photos step uploads against a project: create the draft now
      startTransition(async () => {
        const res = await createDraftProject(draft.title || briefKind(draft.brief.kind)?.title || "Brief film");
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setDraft((d) => ({ ...d, scriptProjectId: res.projectId, step: d.step + 1 }));
      });
      return;
    }
    if (stepId === "presenter" && !draft.scriptProjectId) {
      startTransition(async () => {
        const pid = await ensureDraftProject();
        if (pid) setDraft((d) => ({ ...d, step: d.step + 1 }));
      });
      return;
    }
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

  const submitBrief = () => {
    if (!draft.scriptProjectId) return;
    setError(null);
    const b = draft.brief;
    const payload = {
      projectId: draft.scriptProjectId,
      title: draft.title,
      kind: b.kind,
      url: b.url || undefined,
      recipe: b.recipe || undefined,
      subject: b.subject || undefined,
      topic: b.topic || undefined,
      narrate: b.kind === "animate" ? b.narrate : undefined,
      focus: b.focus || undefined,
      seconds: (b.seconds || undefined) as "8" | "10" | "15" | "20" | "30" | "40" | "60" | undefined,
      closeLine: b.closeLine || undefined,
      closeTail: b.closeTail || undefined,
      a: b.a || undefined,
      b: b.b || undefined,
      winner: b.winner,
      line: b.line || undefined,
      end: b.end || undefined,
      photos: draft.photos.map((p) => ({ assetId: p.assetId, label: p.label, sayWhen: p.sayWhen, crop: p.crop })),
      options: { sfxIntensity: draft.style.sfxIntensity },
      brand: draft.brand,
      consent,
    };
    startTransition(async () => {
      const res = await createBriefEdit(payload);
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

  const submitPresenter = () => {
    if (!draft.scriptProjectId) return;
    setError(null);
    const payload = {
      projectId: draft.scriptProjectId,
      title: draft.title || draft.presenter.text.trim().split(/\n/)[0]?.slice(0, 80) || "Presenter reel",
      script: draft.presenter.text,
      voiceId: draft.presenter.voiceId ?? "",
      lookId: draft.presenter.kind === "look" ? draft.presenter.lookId : null,
      photoAssetId: draft.presenter.kind === "photo" ? draft.presenter.photoAssetId : null,
      photos: draft.photos.map((p) => ({ assetId: p.assetId, label: p.label, sayWhen: p.sayWhen, crop: p.crop })),
      stylePreset: draft.style.preset,
      styleText: draft.style.text,
      options: {
        captions: draft.style.captions,
        sfxIntensity: draft.style.sfxIntensity,
        music: draft.style.music,
        broll: draft.style.broll && stockEnabled,
        ...(aiImagesEnabled ? { aiImages: (draft.ai ?? defaultAiImages).aiImages, aiImageCount: (draft.ai ?? defaultAiImages).aiImageCount, aiImageStyle: (draft.ai ?? defaultAiImages).aiImageStyle } : {}),
        language: draft.style.language,
      },
      brand: draft.brand,
      consent,
      presenterConsent: draft.presenter.rights && draft.presenter.adult && draft.presenter.upload,
    };
    startTransition(async () => {
      const res = await createPresenterEdit(payload);
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

  const submit = () => {
    if (draft.mode === "brief") return submitBrief();
    if (draft.mode === "presenter") return submitPresenter();
    if (draft.mode === "script") return submitScript();
    if (!draft.upload) return;
    setError(null);
    const payload = {
      projectId: draft.upload.projectId,
      title: draft.title || draft.upload.filename.replace(/\.[^.]+$/, ""),
      sourceAssetId: draft.upload.assetId,
      referenceAssetId:
        draft.mode === "reference" && draft.reference?.complete ? draft.reference.assetId : undefined,
      fidelity: REFERENCE_FIDELITY,
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
        broll: draft.style.broll && stockEnabled,
        ...(aiImagesEnabled ? { aiImages: (draft.ai ?? defaultAiImages).aiImages, aiImageCount: (draft.ai ?? defaultAiImages).aiImageCount, aiImageStyle: (draft.ai ?? defaultAiImages).aiImageStyle } : {}),
        cleanCut: Boolean(draft.style.cleanCut || draft.style.hookFirst),
        hookFirst: Boolean(draft.style.hookFirst),
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
        broll: draft.style.broll && stockEnabled,
        ...(aiImagesEnabled ? { aiImages: (draft.ai ?? defaultAiImages).aiImages, aiImageCount: (draft.ai ?? defaultAiImages).aiImageCount, aiImageStyle: (draft.ai ?? defaultAiImages).aiImageStyle } : {}),
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
      <p className="text-muted text-[14px]">
        New edit · step {draft.step + 1} of {steps.length}
      </p>
      <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em]">{stepLabel(stepId, draft.mode, draft.brief.kind)}</h1>

      <ol className="mt-5 flex flex-wrap gap-1.5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > draft.step && !canNext}
              onClick={() => i <= draft.step && setDraft((d) => ({ ...d, step: i }))}
              className={cn(
                "inline-flex h-9 items-center rounded-[6px] px-3 text-[14px] transition-colors",
                i === draft.step
                  ? "bg-text text-bg font-medium"
                  : i < draft.step
                    ? "bg-surface text-text hover:bg-raised"
                    : "bg-surface text-muted",
              )}
              aria-current={i === draft.step ? "step" : undefined}
            >
              {stepLabel(s, draft.mode, draft.brief.kind)}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {stepId === "source" && (
          <StepSource
            value={draft.mode}
            presenterEnabled={presenterEnabled}
            onChange={(mode) => setDraft((d) => ({ ...d, mode, step: 0 }))}
          />
        )}
        {stepId === "presenter" && (
          <StepPresenter
            value={draft.presenter}
            projectId={draft.scriptProjectId}
            voices={voices}
            looks={looks}
            onChange={(presenter) => setDraft((d) => ({ ...d, presenter }))}
            onNeedProject={ensureDraftProject}
          />
        )}
        {stepId === "brief" && (
          <StepBrief value={draft.brief} onChange={(brief) => setDraft((d) => ({ ...d, brief }))} />
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
                  <p className="label mb-1">The reference</p>
                  <p className="text-muted-foreground text-sm">
                    {draft.upload?.complete
                      ? "Now the reel whose style you want. We measure its cuts, camera moves, colours, type and captions, write a style from them, and edit your take to match it. No preset to pick."
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
              </div>
            )}
          </div>
        )}
        {stepId === "photos" && projectId && (
          <StepPhotos
            projectId={projectId}
            purpose={draft.mode === "brief" && draft.brief.kind === "animate" ? "style" : "photos"}
            ai={draft.ai ?? defaultAiImages}
            onAi={(ai) => setDraft((d) => ({ ...d, ai }))}
            aiEnabled={aiImagesEnabled && draft.mode !== "brief"}
            script={draft.mode === "script" ? draft.script.text : draft.mode === "presenter" ? draft.presenter.text : undefined}
            value={draft.photos}
            onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
          />
        )}
        {stepId === "style" && (
          <StepStyle
            value={draft.style}
            stockEnabled={stockEnabled}
            fromReference={draft.mode === "reference"}
            recorded={draft.mode === "take" || draft.mode === "reference"}
            onChange={(style) => setDraft((d) => ({ ...d, style }))}
          />
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
          className="mt-6 rounded-[6px] bg-surface px-3 py-2 text-sm text-[#ff8a66]"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="sticky bottom-4 z-20 mt-8">
      <div
        data-glass="panel"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-4 py-3"
      >
        <button
          type="button"
          className="button button-ghost"
          disabled={draft.step === 0}
          onClick={() => setDraft((d) => ({ ...d, step: Math.max(0, d.step - 1) }))}
        >
          Back
        </button>
        {draft.step < steps.length - 1 ? (
          <button type="button" className="button" disabled={!canNext || pending} onClick={next}>
            {pending
              ? "One moment…"
              : stepId === "photos" && draft.photos.length === 0
                ? "Skip photos"
                : "Continue"}
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
              className="button"
              disabled={pending || !consent || credits < cost}
              onClick={submit}
            >
              {pending ? "Creating…" : "Create my edit"}
            </button>
          </div>
        )}
      </div>
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
