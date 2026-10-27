"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  awaiting_shot_review: "probing",
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

/**
 * The live state of a render: the stage in words, the worker's last message, one progress bar in
 * the data hue, and the seven stages as a row of marks (done · current · ahead).
 */
export function ProgressView({
  projectId,
  initial,
}: {
  projectId: string;
  initial: { status: string; progress: number; message: string; updatedAt?: string | null };
}) {
  const s = useJobEvents(projectId, initial);
  // a job that ends while the page is open: reload it, so the reel, edit and exports appear
  const router = useRouter();
  const wasActive = useRef(ACTIVE.has(initial.status));
  useEffect(() => {
    const active = ACTIVE.has(s.status);
    if (wasActive.current && !active) router.refresh();
    wasActive.current = active;
  }, [s.status, router]);
  const idx = stageIndex(s.status);
  const failed = s.status === "failed";
  const staleFor = useStaleSeconds(s.updatedAt ?? null, ACTIVE.has(s.status));
  const stale = staleFor >= STALE_AFTER_SEC;
  return (
    <section className="bg-surface mt-8 rounded-[8px] p-6" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em]">
          {failed ? "Something went wrong" : (STATUS_LABEL[s.status] ?? s.status)}
        </h2>
        {ACTIVE.has(s.status) && <span className="text-xl font-medium tabular-nums">{s.progress}%</span>}
      </div>
      <p className="text-muted mt-1 text-[14px]">{s.message || STAGES[Math.floor(idx)]?.copy}</p>
      {(stale || failed) && (
        <form action={retryEdit} className="bg-raised mt-4 flex flex-wrap items-center gap-3 rounded-[6px] p-3 text-[14px]">
          <input type="hidden" name="id" value={projectId} />
          <span className="text-muted">
            {failed
              ? "This run failed. Retrying starts again from the video check; nothing is charged twice."
              : `No progress report for ${Math.round(staleFor / 60)} min. The worker may have been restarted.`}
          </span>
          <button type="submit" className="button h-9 px-4 text-[14px]">
            Retry this edit
          </button>
        </form>
      )}
      {ACTIVE.has(s.status) && (
        <div className="bg-raised mt-4 h-[4px] overflow-clip rounded-[2px]">
          <div className="bg-accent h-full transition-[width] duration-700" style={{ width: `${Math.max(3, s.progress)}%` }} />
        </div>
      )}
      <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-4">
        {STAGES.map((st, i) => {
          const doneStage = idx > i || s.status === "done";
          const current = idx === i && s.status !== "done";
          return (
            <li
              key={st.key}
              className={cn(
                "flex items-center gap-2",
                doneStage && "text-text",
                current && "text-text font-medium",
                !doneStage && !current && "text-muted",
              )}
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  doneStage ? "bg-text" : current ? "bg-accent" : "bg-raised",
                )}
                aria-hidden
              />
              <span>{st.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted mt-5 text-[13px]">
        You can close this page: your reel keeps rendering, and it will be here when you come back.
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
