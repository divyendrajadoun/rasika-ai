"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { beforeAfter, features as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * What the edit does, on the ivory sheet: the real before/after plate stays beside eight numbered
 * notes. Drag the plate's handle (or the range under it); hovering or focusing a note slides the
 * handle across so the finished edit shows whole. Both clips play in sync.
 */
export function Edit() {
  const [pos, setPos] = useState(50);
  const [active, setActive] = useState<number | null>(null);
  const [eased, setEased] = useState(false);
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      const a = afterRef.current;
      const b = beforeRef.current;
      if (a && b && Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setEased(false);
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  // the handle sits at `shown`% from the left; the edit fills everything right of it
  const shown = active !== null ? 0 : pos;
  const hold = (i: number | null) => {
    setEased(true);
    setActive(i);
  };

  return (
    <section id="features" className="v2-sheet v2-sec v2-overlap v2-edit">
      <div className="v2-in">
        <header className="v2-head v2-head-split" data-rv>
          <div>
            <span className="v2-label">[ 02 ] {c.title}</span>
            <h2 className="v2-h2">
              Everything a motion designer <br />
              would do <em className="v2-serif v2-accent">by hand.</em>
            </h2>
          </div>
          <p className="v2-lede">{beforeAfter.sub}</p>
        </header>

        <div className="v2-edit-grid">
          <figure className="v2-edit-plate" data-rv>
            <div
              data-ui
              id="ba-frame"
              ref={frameRef}
              className={cn("v2-cmp", eased && "is-anim")}
              onPointerDown={(e) => {
                dragging.current = true;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setFromClientX(e.clientX);
              }}
              onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
              onDragStart={(e) => e.preventDefault()}
            >
              <DemoVideo
                ref={beforeRef}
                className="absolute inset-0"
                src={beforeAfter.before.src}
                poster="/demo/styles/raw.jpg"
                alt={beforeAfter.before.label}
              />
              <div className="v2-cmp-top" style={{ clipPath: `inset(0 0 0 ${shown}%)` }}>
                <DemoVideo
                  ref={afterRef}
                  className="absolute inset-0"
                  src={beforeAfter.after.src}
                  poster="/demo/after-poster.webp"
                  alt={beforeAfter.after.label}
                />
              </div>
              <div className="v2-cmp-line" style={{ left: `${shown}%` }} aria-hidden>
                <span className="v2-cmp-knob">
                  <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
                    <path
                      d="M5 1 1 5l4 4M13 1l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </span>
              </div>
              <span className="v2-cmp-tag" style={{ left: 12 }}>
                {beforeAfter.before.label}
              </span>
              <span className="v2-cmp-tag is-gold" style={{ right: 12 }}>
                {beforeAfter.after.label}
              </span>
            </div>
            <label className="v2-range">
              <span className="sr-only">Comparison position</span>
              <input
                id="ba-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(100 - pos)}
                onChange={(e) => {
                  setEased(false);
                  setPos(100 - Number(e.target.value));
                }}
                aria-valuetext={`${Math.round(100 - shown)} percent edited`}
              />
            </label>
            <figcaption className="v2-note-small">{beforeAfter.note}</figcaption>
          </figure>

          <ol className={cn("v2-notes", active !== null && "has-active")}>
            {c.items.map((f, i) => (
              <li
                key={f.id}
                tabIndex={0}
                data-rv
                style={{ "--rv-d": `${(i % 2) * 80}ms` } as React.CSSProperties}
                className={cn("v2-note", active === i && "is-on")}
                onMouseEnter={() => hold(i)}
                onMouseLeave={() => hold(null)}
                onFocus={() => hold(i)}
                onBlur={() => hold(null)}
              >
                <span className="v2-idx">{String(i + 1).padStart(2, "0")}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
