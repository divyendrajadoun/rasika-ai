"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { finalCta as c } from "@/content/landing";

type Source = "take" | "script" | "reference" | "presenter";
const SOURCES: Array<[Source, string]> = [
  ["take", "My take"],
  ["script", "Script only"],
  ["reference", "Match a reference"],
  ["presenter", "AI presenter"],
];

/**
 * Closing — "First step, already open". A full-bleed field; on the right, the wizard's own first
 * step at true size: name the reel, choose where it comes from, go. The button carries both into
 * the real wizard (sign-in first if needed). On the left, the closing line.
 */
export function FinalCta({ presenterEnabled = false }: { presenterEnabled?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(c.dialogExample);
  const [source, setSource] = useState<Source>("take");
  const sources = SOURCES.filter(([id]) => id !== "presenter" || presenterEnabled);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ source, title: title.trim() });
    router.push(`${c.cta.href}?${q.toString()}`);
  };
  return (
    <section id="start" className="field relative min-h-[90svh] overflow-clip">
      <div className="wrap grid12 min-h-[90svh] items-end pb-10 pt-12 lg:items-center lg:py-0">
        <div className="col-span-12 order-1 md:col-span-6 md:self-end lg:pb-10">
          <h2
            className="lines font-semibold"
            style={{ fontSize: "var(--step-closing)", lineHeight: 0.92, letterSpacing: "-0.04em" }}
          >
            {c.lines.map((l, i) => (
              <span key={l} className="line">
                <span data-line style={{ "--i": i } as CSSProperties}>
                  {l}
                </span>
              </span>
            ))}
          </h2>
          <p className="mt-6 max-w-[40ch] opacity-90">{c.after}</p>
        </div>

        <form
          data-ui
          onSubmit={go}
          className="dialog col-span-12 order-2 mt-10 w-full max-w-[440px] self-center p-6 md:col-span-6 md:mt-0 md:justify-self-end lg:col-start-7 lg:col-span-5"
          aria-labelledby="start-title"
        >
          <p id="start-title" className="font-medium">
            {c.dialogTitle}
          </p>
          <label htmlFor="reel-title" className="sr-only">
            Reel title
          </label>
          <input
            id="reel-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="field-input mt-3"
            autoComplete="off"
          />
          <p className="small mt-5 font-medium">Where the reel comes from</p>
          <div className="seg seg-4 mt-2" role="group" aria-label="Source">
            {sources.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={source === id} onClick={() => setSource(id)}>
                {label}
              </button>
            ))}
          </div>
          <button type="submit" className="button button-accent mt-6 h-[52px] w-full">
            {c.cta.label}
          </button>
          <p className="text-muted small mt-3">{c.sub}</p>
        </form>
      </div>
    </section>
  );
}
