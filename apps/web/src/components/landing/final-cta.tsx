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
 * Closing: the line on the left; on the right a finished reel, tilted, with the wizard's own first
 * step lying over its lower edge as a pane of glass: name the reel, choose where it comes from, go.
 * The button carries both into the real wizard (sign-in first if needed).
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
    <section id="start" className="lp-sec lp-start">
      <div className="lp-start-bg" aria-hidden />
      <div className="lp-in lp-start-grid">
        <div>
          <h2>
            <span>{c.lines[0]}</span>
            <span style={{ color: "#e6b450" }}>{c.lines[1]}</span>
          </h2>
          <p style={{ margin: "20px 0 0", maxWidth: "38ch", fontSize: 18, color: "#d3c6bc" }}>
            {c.after}
          </p>
        </div>

        <div style={{ position: "relative", perspective: 1400 }}>
          <div className="lp-start-poster" data-tilt="5">
            <div>
              <DemoVideo
                className="h-full w-full"
                src={hero.demo.after}
                poster={hero.demo.afterPoster}
                alt={hero.demo.alt}
              />
            </div>
          </div>
          <form onSubmit={go} className="lp-start-form" aria-labelledby="start-title">
            <div id="start-title" style={{ fontWeight: 600, fontSize: 17 }}>
              {c.dialogTitle}
            </div>
            <label htmlFor="reel-title" className="sr-only">
              Reel title
            </label>
            <input
              id="reel-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              autoComplete="off"
            />
            <div style={{ fontSize: 13, color: "#d3c6bc" }}>Where the reel comes from</div>
            <div
              className="lp-seg"
              role="group"
              aria-label="Source"
              style={{ "--n": sources.length } as CSSProperties}
            >
              {sources.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={source === id}
                  onClick={() => setSource(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="submit" className="lp-start-go">
              {c.cta.label}
            </button>
            <div style={{ fontSize: 13, color: "#d3c6bc", textAlign: "center" }}>{c.sub}</div>
          </form>
        </div>
      </div>
    </section>
  );
}
