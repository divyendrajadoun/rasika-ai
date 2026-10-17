"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  uploaded: "Queued",
  probing: "Checking video",
  transcribing: "Transcribing",
  awaiting_transcript_review: "Review transcript",
  planning: "Designing edit",
  awaiting_plan_review: "Ready to preview",
  rendering_preview: "Rendering preview",
  ready_preview: "Preview ready",
  rendering_final: "Rendering",
  done: "Done",
  failed: "Failed",
  canceled: "Canceled",
};

const ACTIVE = new Set([
  "uploaded",
  "probing",
  "transcribing",
  "planning",
  "rendering_preview",
  "rendering_final",
]);

export function useJobEvents(
  projectId: string,
  initial: { status: string; progress: number; message?: string },
) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    if (!ACTIVE.has(state.status)) return;
    const es = new EventSource(`/api/projects/${projectId}/events`);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as {
          status: string;
          progress: number;
          message: string;
          error: string | null;
        };
        setState({ status: d.status, progress: d.progress, message: d.error ?? d.message });
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, ACTIVE.has(state.status)]);
  return state;
}

export function StatusPill({
  projectId,
  status,
  progress,
}: {
  projectId: string;
  status: string;
  progress: number;
}) {
  const s = useJobEvents(projectId, { status, progress });
  const active = ACTIVE.has(s.status);
  const tone =
    s.status === "done" || s.status === "ready_preview" || s.status === "awaiting_plan_review"
      ? "bg-gold text-ink"
      : s.status === "failed"
        ? "bg-[#ff8a66] text-ink"
        : active
          ? "bg-ter text-white"
          : "bg-ink/70 text-iv";
  return (
    <span
      className={cn(
        "kicker inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.58rem]",
        tone,
      )}
    >
      {active && <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />}
      {STATUS_LABEL[s.status] ?? s.status}
      {active && s.progress > 0 && <span>{s.progress}%</span>}
    </span>
  );
}
