"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { beforeAfter, features as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Features: the real before/after between two columns of notes. The plate is the raw phone clip
 * under the Rasika edit, split by a handle you drag, both playing in sync. Hovering or focusing a
 * note slides the handle across so the finished edit shows whole. On a phone the plate comes first.
 */
export function Features() {
  const [pos, setPos] = useState(50);
  const [active, setActive] = useState<number | null>(null);
  const [eased, setEased] = useState(false);
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const a = afterRef.current;
    const b = beforeRef.current;
    if (!a || !b) return;
    const id = window.setInterval(() => {
      if (Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
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

  const notes = (from: number, items: typeof c.items, side: "l" | "r") => (
    <ul
      className={cn(
        "lp-notes",
        side === "l" ? "lp-notes-l" : "lp-notes-r",
        active !== null && "has-active",
      )}
    >
      {items.map((f, k) => {
        const i = from + k;
        return (
          <li
            key={f.id}
            tabIndex={0}
            className={cn("lp-note", active === i && "is-on")}
            onMouseEnter={() => hold(i)}
            onMouseLeave={() => hold(null)}
            onFocus={() => hold(i)}
            onBlur={() => hold(null)}
          >
            <div className="lp-note-num">{String(i + 1).padStart(2, "0")}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section id="features" className="lp-sec">
      <div className="lp-in">
        <div className="lp-feat-head">
          <div>
            <h2 className="lp-h2">{c.title}</h2>
            <p
              className="lp-muted"
              style={{ margin: "12px 0 0", fontSize: "clamp(1.15rem, 1rem + 0.5vw, 1.5rem)" }}
            >
              {c.sub}
            </p>
          </div>
          <p className="lp-muted" style={{ margin: 0, maxWidth: "44ch" }}>
            {beforeAfter.sub}
          </p>
        </div>

        <div className="lp-feat-grid">
          {notes(0, c.items.slice(0, 4), "l")}

          <figure className="lp-feat-plate" style={{ margin: "0 auto" }}>
            <div className="lp-tilt-plate" data-tilt="6">
              <div
                data-ui
                id="ba-frame"
                ref={frameRef}
                className={cn("lp-cmp", eased && "is-anim")}
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
                <div className="lp-cmp-top" style={{ clipPath: `inset(0 0 0 ${shown}%)` }}>
                  <DemoVideo
                    ref={afterRef}
                    className="absolute inset-0"
                    src={beforeAfter.after.src}
                    poster="/demo/after-poster.webp"
                    alt={beforeAfter.after.label}
                  />
                </div>
                <div className="lp-cmp-line" style={{ left: `${shown}%` }} aria-hidden>
                  <div className="lp-cmp-knob">⟷</div>
                </div>
                <span className="lp-cmp-tag" style={{ left: 14 }}>
                  {beforeAfter.before.label}
                </span>
                <span className="lp-cmp-tag is-gold" style={{ right: 14 }}>
                  {beforeAfter.after.label}
                </span>
              </div>
              <div className="lp-cmp-shadow" aria-hidden />
            </div>
            <label className="lp-range" style={{ marginTop: 22 }}>
              <span>Comparison position</span>
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
            <figcaption
              className="lp-muted"
              style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.5, textAlign: "center" }}
            >
              {beforeAfter.note}
            </figcaption>
          </figure>

          {notes(4, c.items.slice(4), "r")}
        </div>
      </div>
    </section>
  );
}
