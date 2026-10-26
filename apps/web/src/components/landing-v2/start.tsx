"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
 * Closing, back in the cinema: the line on the left; on the right a finished reel with the wizard's
 * first step on glass over its lower half. Name the reel, choose where it comes from, go: the
 * button carries both into the real wizard (sign-in first if needed).
 */
export function Start({ presenterEnabled = false }: { presenterEnabled?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(c.dialogExample);
  const [source, setSource] = useState<Source>("take");
  const sources = SOURCES.filter(([id]) => id !== "presenter" || presenterEnabled);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ source, title: title.trim() });
    router.push(`${c.cta.href}?${q.toString()}`);
  };
  // the last two words of the closing line are the accent ("post it.")
  const tail = c.lines[1].split(" ");

  return (
    <section id="start" className="v2-cin v2-sec v2-overlap v2-start">
      <div className="v2-in v2-start-grid">
        <div data-rv>
          <span className="v2-label">[ 06 ] Your turn</span>
          <h2 className="v2-h2 v2-h2-big">
            {c.lines[0]} <br />
            {tail.slice(0, -2).join(" ")}{" "}
            <em className="v2-serif v2-accent">{tail.slice(-2).join(" ")}</em>
          </h2>
          <p className="v2-lede">{c.after}</p>
        </div>

        <div
          className="v2-start-stage"
          data-rv
          style={{ "--rv-d": "120ms" } as React.CSSProperties}
        >
          <div className="v2-start-reel">
            <DemoVideo
              className="absolute inset-0"
              src={hero.demo.after}
              poster={hero.demo.afterPoster}
              alt={hero.demo.alt}
            />
          </div>
          <form onSubmit={go} className="v2-form v2-glass" aria-labelledby="v2-start-title">
            <div id="v2-start-title" className="v2-form-title">
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
            <div className="v2-form-sub">Where the reel comes from</div>
            <div className="v2-chips" role="group" aria-label="Source">
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
            <button type="submit" className="v2-btn v2-btn-gold v2-form-go">
              {c.cta.label}
              <span aria-hidden>→</span>
            </button>
            <div className="v2-form-sub v2-form-center">{c.sub}</div>
          </form>
        </div>
      </div>
    </section>
  );
}
