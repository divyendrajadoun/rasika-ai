"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { finalCta as c, hero } from "@/content/landing";

type Source = "take" | "script" | "reference" | "presenter";
const SOURCES: Array<[Source, string]> = [
  ["take", "My take"],
  ["script", "Script only"],
  ["reference", "Match a reference"],
  ["presenter", "AI presenter"],
];

/**
 * Closing — "First step, already open". A full-bleed field; on the right, a finished reel plays,
 * and over its lower edge lies the wizard's own first step as a pane of frosted liquid glass: name
 * the reel, choose where it comes from, go. The button carries both into the real wizard (sign-in
 * first if needed). On the left, the closing line.
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
      <div className="wrap grid12 min-h-[90svh] items-end pb-10 pt-12 lg:items-center lg:py-16">
        <div className="col-span-12 order-1 md:col-span-6 md:self-end lg:col-span-5 lg:pb-10">
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

        {/* the reel behind the glass, then the first step lying across its lower edge */}
        <div className="relative col-span-12 order-2 mt-10 md:col-span-6 md:mt-0 lg:col-start-6 lg:col-span-7">
          <DemoVideo
            className="ml-auto aspect-[9/16] w-[78%] max-w-[400px] overflow-clip rounded-[18px] md:w-[70%]"
            src={hero.demo.after}
            poster={hero.demo.afterPoster}
            alt={hero.demo.alt}
          />
          <form
            data-ui
            data-glass="panel"
            data-glass-snapshot="#start"
            data-glass-tint="rgba(30, 8, 12, 0.55)"
            data-glass-shadow="false"
            onSubmit={go}
            className="dialog relative -mt-[38%] w-full max-w-[440px] p-6 md:absolute md:bottom-[8%] md:left-0 md:mt-0"
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
      </div>
    </section>
  );
}
