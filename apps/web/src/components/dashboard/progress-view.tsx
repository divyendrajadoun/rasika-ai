"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { retryEdit } from "@/app/dashboard/actions";
import { STATUS_LABEL, useJobEvents } from "@/components/dashboard/status-pill";
import { cn } from "@/lib/utils";

const STAGES: Array<{ key: string; label: string; copy: string }> = [
  { key: "uploaded", label: "Uploaded", copy: "Your reel is in the queue." },
  { key: "probing", label: "Checking video", copy: "Looking at your video…" },
  { key: "transcribing", label: "Transcribing", copy: "Timing every word…" },
  { key: "planning", label: "Designing", copy: "Designing your edit…" },
  { key: "rendering_preview", label: "Preview", copy: "Making a quick preview…" },
  { key: "rendering_final", label: "Final render", copy: "Rendering in full quality…" },
  { key: "done", label: "Done", copy: "Your reel is ready." },
];
const ORDER = STAGES.map((s) => s.key);
/** Waiting states sit just after the stage that produced them. */
const AFTER: Record<string, string> = {
  awaiting_transcript_review: "transcribing",
  awaiting_plan_review: "planning",
  ready_preview: "rendering_preview",
};
const stageIndex = (status: string) =>
  status in AFTER ? ORDER.indexOf(AFTER[status]!) + 0.5 : ORDER.indexOf(status);
const ACTIVE = new Set([
  "uploaded",
  "probing",
  "transcribing",
  "planning",
  "rendering_preview",
  "rendering_final",
]);

/** No progress report for this long while a stage is active → offer a retry. */
const STALE_AFTER_SEC = 120;

export function ProgressView({
  projectId,
  initial,
}: {
  projectId: string;
  initial: { status: string; progress: number; message: string; updatedAt?: string | null };
}) {
  const s = useJobEvents(projectId, initial);
  const idx = stageIndex(s.status);
  const failed = s.status === "failed";
  const staleFor = useStaleSeconds(s.updatedAt ?? null, ACTIVE.has(s.status));
  const stale = staleFor >= STALE_AFTER_SEC;
  return (
    <section className="bg-card mt-8 rounded-2xl border p-6" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <h2 className="poster text-3xl">
          {failed ? "Something went wrong" : (STATUS_LABEL[s.status] ?? s.status)}
        </h2>
        {ACTIVE.has(s.status) && <span className="poster text-ter text-3xl">{s.progress}%</span>}
      </div>
      <p className="font-accent text-muted-foreground mt-1 text-xl italic">
        {s.message || STAGES[Math.floor(idx)]?.copy}
      </p>
      {(stale || failed) && (
        <form
          action={retryEdit}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm"
        >
          <input type="hidden" name="id" value={projectId} />
          <span className="text-muted-foreground">
            {failed
              ? "This run failed. Retrying starts again from the video check; nothing is charged twice."
              : `No progress report for ${Math.round(staleFor / 60)} min. The worker may have been restarted.`}
          </span>
          <button type="submit" className="btn-outline-gold h-9 px-4 text-xs">
            Retry this edit
          </button>
        </form>
      )}
      {ACTIVE.has(s.status) && (
        <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
          <div
            className="bg-ter h-full transition-[width] duration-700"
            style={{ width: `${Math.max(3, s.progress)}%` }}
          />
        </div>
      )}
      <ol className="mt-6 grid gap-2 sm:grid-cols-2">
        {STAGES.map((st, i) => {
          const doneStage = idx > i || s.status === "done";
          const current = idx === i && s.status !== "done";
          return (
            <li
              key={st.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                doneStage && "border-gold/40 text-foreground",
                current && "border-ter",
                !doneStage && !current && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  doneStage ? "bg-gold text-ink" : current ? "bg-ter text-white" : "bg-muted",
                )}
              >
                {doneStage ? (
                  <Check className="size-3.5" aria-hidden />
                ) : current ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <span className="text-[10px]">{i + 1}</span>
                )}
              </span>
              <span>{st.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground mt-5 text-xs">
        You can close this page. We&apos;ll email you when the reel is ready (email arrives in Phase
        8; the dashboard updates live meanwhile).
      </p>
    </section>
  );
}

function useStaleSeconds(updatedAt: string | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active || !updatedAt) return 0;
  return Math.max(0, (now - new Date(updatedAt).getTime()) / 1000);
}
