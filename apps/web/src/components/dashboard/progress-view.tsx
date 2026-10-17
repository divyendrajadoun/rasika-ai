"use client";

import { Check, Loader2 } from "lucide-react";
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
const ACTIVE = new Set([
  "uploaded",
  "probing",
  "transcribing",
  "planning",
  "rendering_preview",
  "rendering_final",
]);

export function ProgressView({
  projectId,
  initial,
}: {
  projectId: string;
  initial: { status: string; progress: number; message: string };
}) {
  const s = useJobEvents(projectId, initial);
  const idx = ORDER.indexOf(s.status);
  const failed = s.status === "failed";
  return (
    <section className="bg-card mt-8 rounded-2xl border p-6" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <h2 className="poster text-3xl">
          {failed ? "Something went wrong" : (STATUS_LABEL[s.status] ?? s.status)}
        </h2>
        {ACTIVE.has(s.status) && <span className="poster text-ter text-3xl">{s.progress}%</span>}
      </div>
      <p className="font-accent text-muted-foreground mt-1 text-xl italic">
        {s.message || STAGES[idx]?.copy}
      </p>
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
