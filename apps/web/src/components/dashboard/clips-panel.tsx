"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ActionResult, reassembleClips } from "@/app/dashboard/actions";
import type { ClipDecision } from "@/db/schema";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";

const BY: Record<string, string> = {
  script: "in the order of your script",
  model: "in the order of what you say",
  recorded: "in the order you recorded them",
  picked: "in your order",
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * Many clips: how Rasika joined them (kept clips in order, the rest left out with the reason).
 * Move a clip, put one back or leave one out, then "Join again": the clips are joined in this
 * order and the reel is designed again on the new take.
 */
export function ClipsPanel({
  projectId,
  arrangement,
  arrangedBy,
  urls,
  busy,
  review,
}: {
  projectId: string;
  arrangement: ClipDecision[];
  arrangedBy?: string;
  /** clip id → a playable URL of the clip */
  urls: Record<string, string>;
  busy: boolean;
  /** one messy video, before the reel is made: the shots are checked here, the style is picked
   *  (`extra`, under the list) and `onFinish` makes the reel from the kept shots */
  review?: {
    extra: ReactNode;
    maxSeconds: number;
    onFinish: (order: string[]) => Promise<ActionResult>;
  };
}) {
  const initial = useMemo(
    () => arrangement.filter((d) => urls[d.id]).map((d) => ({ ...d })),
    [arrangement, urls],
  );
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const keptIds = rows.filter((r) => r.keep).map((r) => r.id);
  const dirty =
    keptIds.join() !==
    initial
      .filter((r) => r.keep)
      .map((r) => r.id)
      .join();
  const keptSec = rows.filter((r) => r.keep).reduce((s, r) => s + (r.end - r.start), 0);

  const move = (i: number, by: number) =>
    setRows((list) => {
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const toggle = (i: number) =>
    setRows((list) => {
      const next = list.map((r, k) => (k === i ? { ...r, keep: !r.keep } : r));
      // kept clips stay together at the top, in their order
      return [...next.filter((r) => r.keep), ...next.filter((r) => !r.keep)];
    });

  const join = () => {
    setError(null);
    start(async () => {
      const res = await safeAction(() =>
        review ? review.onFinish(keptIds) : reassembleClips({ projectId, order: keptIds }),
      );
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  if (!rows.length) return null;
  return (
    <section className="mt-10" aria-labelledby="clips-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="clips-heading" className="text-xl font-semibold leading-tight tracking-[-0.02em]">
          {review ? "Your shots" : "Your clips"}
        </h2>
        <p className="text-muted-foreground text-[13px]">
          {keptIds.length} of {rows.length} joined {BY[arrangedBy ?? ""] ?? ""} · {fmt(keptSec)}
        </p>
      </div>
      <p className="text-muted mt-1 text-[14px]">
        {review
          ? "We found where your video was joined and checked every shot. The ones we left out show why. Move a shot, put one back or leave one out, then pick a style and make your reel. The ums, repeats and long pauses inside the shots come out too."
          : "Move a clip, leave one out or put one back, then join them again. The dead air at the start and end of each clip is already trimmed."}
      </p>
      <ol className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              "bg-surface flex items-start gap-3 rounded-[8px] p-2 pr-3",
              !r.keep && "opacity-60",
            )}
          >
            <span className="text-muted w-6 shrink-0 pt-1 text-center text-[13px] tabular-nums">
              {r.keep ? keptIds.indexOf(r.id) + 1 : "–"}
            </span>
            <video
              src={`${urls[r.id]}#t=${r.start.toFixed(2)}`}
              crossOrigin="anonymous"
              preload="metadata"
              muted
              playsInline
              controls
              className="aspect-[9/16] w-16 shrink-0 rounded-[4px] bg-[#111] object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">
                {r.name} · {fmt(r.end - r.start)}
                {!r.keep && r.why && (
                  <span className="bg-raised text-foreground/70 ml-2 rounded-full px-2 py-0.5 text-[11px] font-normal">
                    {r.why}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-1 line-clamp-3 text-[13px]">
                {r.text ? `“${r.text}”` : "No speech in this clip"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="button button-ghost h-8 px-2"
                disabled={!r.keep || i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${r.name} earlier`}
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="button button-ghost h-8 px-2"
                disabled={!r.keep || !rows[i + 1]?.keep}
                onClick={() => move(i, 1)}
                aria-label={`Move ${r.name} later`}
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="button button-ghost h-8 px-2"
                onClick={() => toggle(i)}
                aria-label={r.keep ? `Leave ${r.name} out` : `Put ${r.name} back`}
                title={r.keep ? "Leave out" : "Put back"}
              >
                {r.keep ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <p className="bg-surface mt-3 rounded-[6px] px-3 py-2 text-sm text-[#ff8a66]" role="alert">
          {error}
        </p>
      )}
      {review && <div className="mt-10">{review.extra}</div>}
      {review && keptSec > review.maxSeconds + 0.5 && (
        <p className="mt-3 text-sm text-[#ff8a66]">
          The shots you kept add up to {fmt(keptSec)}; your plan allows {fmt(review.maxSeconds)}.
          Leave a few out.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button"
          disabled={
            (!review && !dirty) ||
            (review && keptSec > review.maxSeconds + 0.5) ||
            busy ||
            pending ||
            keptIds.length === 0
          }
          onClick={join}
        >
          {review
            ? pending
              ? "Starting…"
              : "Make my reel"
            : pending
              ? "Joining…"
              : "Join again in this order"}
        </button>
        {dirty && (
          <button type="button" className="button button-ghost" onClick={() => setRows(initial)}>
            Undo changes
          </button>
        )}
        {busy && (
          <span className="text-muted-foreground text-[13px]">
            Wait for the current render to finish.
          </span>
        )}
      </div>
    </section>
  );
}
