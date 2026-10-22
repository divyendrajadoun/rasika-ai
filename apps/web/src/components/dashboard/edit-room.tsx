"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { safeAction } from "@/lib/safe-action";
import { useRouter } from "next/navigation";
import { recutEdit } from "@/app/dashboard/actions";
import type { EditorData } from "@/lib/projects";
import { cn } from "@/lib/utils";

const WHY_LABEL = { filler: "filler", repeat: "repeat", retake: "earlier take" } as const;
const WHY_TONE = {
  filler: "decoration-[#d9a441]",
  repeat: "decoration-[#d9a441]",
  retake: "decoration-[#ff8a66]",
} as const;

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/**
 * The editor: the original take as text. Click a word to cut it (shift-click cuts or restores a
 * run); the worker's suggestions (fillers, repeats, earlier takes of a line) are marked, one button
 * cuts them all. "Preview" plays the original skipping the cut words; "Render this edit" cuts the
 * take for real and the reel is designed again on the cut.
 */
export function EditRoom({
  projectId,
  data,
  busy,
  studioSound: initialStudio,
}: {
  projectId: string;
  data: EditorData;
  /** a render is running: editing is open, rendering waits */
  busy: boolean;
  studioSound: boolean;
}) {
  const { words, suggested } = data;
  const [removed, setRemoved] = useState<Set<number>>(() => new Set(data.removed));
  const [anchor, setAnchor] = useState<number | null>(null);
  const [studio, setStudio] = useState(initialStudio);
  const [skip, setSkip] = useState(true);
  const [current, setCurrent] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);

  const why = useMemo(() => {
    const m = new Map<number, keyof typeof WHY_LABEL>();
    for (const s of suggested) for (let i = s.i0; i <= s.i1; i++) m.set(i, s.why);
    return m;
  }, [suggested]);
  const suggestedCount = why.size;
  const suggestionsOn = suggestedCount > 0 && [...why.keys()].every((i) => removed.has(i));

  // the cut words as time ranges of the original (for the skip-preview and the estimate)
  const cutRanges = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < words.length; i++) {
      if (!removed.has(i)) continue;
      const a = i > 0 && !removed.has(i - 1) ? (words[i - 1]!.end ?? words[i]!.t) : words[i]!.t;
      const b = words[i]!.end ?? words[i]!.t + 0.3;
      const last = out[out.length - 1];
      if (last && removed.has(i - 1)) last[1] = b;
      else out.push([a, b]);
    }
    return out;
  }, [removed, words]);
  const cutSec = cutRanges.reduce((s, [a, b]) => s + (b - a), 0);
  const total = words.length ? (words[words.length - 1]!.end ?? words[words.length - 1]!.t) : 0;
  const dirty =
    removed.size !== data.removed.length ||
    data.removed.some((i) => !removed.has(i)) ||
    studio !== initialStudio;

  const toggle = useCallback(
    (i: number, range: boolean) => {
      setRemoved((prev) => {
        const next = new Set(prev);
        if (range && anchor !== null) {
          const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
          const cutIt = prev.has(anchor); // the run follows what the first click did
          for (let k = a; k <= b; k++) {
            if (cutIt) next.add(k);
            else next.delete(k);
          }
        } else if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
      setAnchor(i);
    },
    [anchor],
  );

  const seek = (i: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, words[i]!.t - 0.05);
  };

  // follow the playhead; in preview mode jump over the cut words (a frame-accurate cut is rendered)
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
      if (skip && !v.paused) {
        const hit = cutRanges.find(([a, b]) => t >= a && t < b - 0.02);
        if (hit) v.currentTime = hit[1];
      }
      let lo = 0;
      let hi = words.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (words[mid]!.t <= t) {
          found = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      setCurrent(found);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cutRanges, skip, words]);

  const render = () => {
    setError(null);
    start(async () => {
      const r = await safeAction(() =>
        recutEdit({
          projectId,
          transcriptVersion: data.version,
          removed: [...removed].sort((a, b) => a - b),
          studioSound: studio,
        }),
      );
      if (!r.ok) setError(r.error);
      else {
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  return (
    <section className="mt-10" aria-labelledby="edit-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="edit-h" className="text-xl font-semibold leading-tight tracking-[-0.02em]">
          Edit
        </h2>
        <p className="text-muted text-[13px] tabular-nums">
          {fmt(total)} take · cutting {removed.size} word{removed.size === 1 ? "" : "s"} (about{" "}
          {cutSec.toFixed(1)} s) · about {fmt(Math.max(0, total - cutSec))} left
        </p>
      </div>
      <p className="text-muted mt-1 text-[14px]">
        Click a word to cut it, click again to keep it. Shift-click cuts or restores everything in
        between. Every edit starts from your original take, so nothing is lost.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="space-y-2">
          <video
            ref={video}
            src={data.originalUrl}
            crossOrigin="anonymous"
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] w-full rounded-[8px] bg-[#111]"
          />
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
            Preview: skip cut words
          </label>
        </div>

        <div className="bg-surface rounded-[8px] p-4">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {suggestedCount > 0 ? (
              <button
                type="button"
                className="button button-ghost h-8 px-3 text-[13px]"
                onClick={() =>
                  setRemoved((prev) => {
                    const next = new Set(prev);
                    for (const i of why.keys()) {
                      if (suggestionsOn) next.delete(i);
                      else next.add(i);
                    }
                    return next;
                  })
                }
              >
                {suggestionsOn
                  ? "Keep the suggested words"
                  : `Cut ${suggestedCount} suggested words`}
              </button>
            ) : (
              <span className="text-muted">No fillers, repeats or retakes found.</span>
            )}
            <button
              type="button"
              className="button button-ghost h-8 px-3 text-[13px]"
              disabled={removed.size === 0}
              onClick={() => setRemoved(new Set())}
            >
              Keep every word
            </button>
            <span className="text-muted ml-auto flex flex-wrap gap-3">
              <span className="underline decoration-[#d9a441] decoration-dotted decoration-2 underline-offset-4">
                filler / repeat
              </span>
              <span className="underline decoration-[#ff8a66] decoration-dotted decoration-2 underline-offset-4">
                earlier take
              </span>
            </span>
          </div>

          <p className="mt-4 max-h-[420px] overflow-y-auto pr-2 leading-8" lang={data.language}>
            {words.map((w, i) => {
              const cut = removed.has(i);
              const reason = why.get(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    toggle(i, e.shiftKey);
                    seek(i);
                  }}
                  title={`${fmt(w.t)}${reason ? ` · ${WHY_LABEL[reason]}` : ""}${cut ? " · cut" : ""}`}
                  aria-pressed={cut}
                  className={cn(
                    "mr-[0.3em] inline rounded-[3px] px-[1px] text-left transition-colors",
                    cut ? "text-muted line-through opacity-60" : "hover:bg-raised",
                    reason &&
                      !cut &&
                      cn(
                        "underline decoration-dotted decoration-2 underline-offset-4",
                        WHY_TONE[reason],
                      ),
                    i === current && "bg-accent/25",
                  )}
                >
                  {w.w}
                </button>
              );
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="button"
          disabled={!dirty || pending || busy}
          onClick={render}
        >
          {pending ? "Starting…" : "Render this edit"}
        </button>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={studio} onChange={(e) => setStudio(e.target.checked)} />
          Studio sound
          <span className="text-muted text-[13px]">(cleans hum, hiss and room noise)</span>
        </label>
        {busy && (
          <span className="text-muted text-[13px]">
            A render is running; you can render this edit when it ends.
          </span>
        )}
        {error && <span className="text-[13px] text-[#ff8a66]">{error}</span>}
      </div>
      <p className="text-muted mt-2 text-[13px]">
        Rendering the edit designs the reel again on the cut take (a couple of minutes). Re-edits of
        this reel are not charged again. Every reel is levelled to −14 LUFS, the loudness Reels,
        Shorts, TikTok and YouTube play at.
      </p>
    </section>
  );
}
