"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { hero, howItWorks as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/** The nine looks shown on "Pick a look" (the same take, nine styles). */
const LOOKS = [
  "mikku-royal",
  "katana-pop",
  "launch-spotlight",
  "vox-paper",
  "neon-pop",
  "tabloid-headline",
  "comic-pop",
  "festive-bandhani",
  "glass-keynote",
];
const TIMES = ["00:01.20", "00:01.46", "00:01.62", "00:01.80", "00:02.14"];
const WORDS = ["How", "do", "you", "know", "your", "taste", "in", "jewellery", "is", "yours?"];

/**
 * How it works as a scroll story: six steps scroll past on the right while the stage on the left
 * stays put and changes screen with the step crossing the middle of the viewport. Only the active
 * screen's clip plays. On a phone the stage sticks under the nav and the steps scroll beneath it.
 */
export function How() {
  const [at, setAt] = useState(0);
  const steps = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.step));
        }
      },
      // on a phone the stage sticks over the top half, so the step is read lower down the screen
      {
        rootMargin: window.matchMedia("(max-width: 900px)").matches
          ? "-68% 0px -24% 0px"
          : "-45% 0px -45% 0px",
      },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="how" className="v2-cin v2-sec v2-how">
      <div className="v2-in">
        <header className="v2-head" data-rv>
          <span className="v2-label">[ 01 ] {c.kicker}</span>
          <h2 className="v2-h2">
            One take in. <br />A finished reel <em className="v2-serif v2-accent">out.</em>
          </h2>
          <p className="v2-lede">{c.sub}</p>
        </header>

        <div className="v2-how-grid">
          <div className="v2-how-stage-wrap">
            <div className="v2-how-stage" aria-hidden>
              <Screen on={at === 0}>
                <Clip src="/demo/before.mp4" poster="/demo/styles/raw.jpg" on={at === 0} />
                <div className="v2-scr-card v2-scr-bottom">
                  <div className="v2-scr-row">
                    <span>take.mp4</span>
                    <span>1:12</span>
                  </div>
                  <div className="v2-scr-bar">
                    <i />
                  </div>
                  <div className="v2-scr-row v2-scr-dim">
                    <span>Uploading</span>
                    <span>Resumes if the line drops</span>
                  </div>
                </div>
              </Screen>

              <Screen on={at === 1}>
                <div className="v2-scr-transcript">
                  <span className="v2-scr-tag">EN · verified</span>
                  <p>
                    {WORDS.map((w, i) => (
                      <span key={w} style={{ "--i": i } as CSSProperties}>
                        {w}{" "}
                      </span>
                    ))}
                  </p>
                  <ol>
                    {WORDS.slice(0, 5).map((w, i) => (
                      <li key={w}>
                        <span>{TIMES[i]}</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Screen>

              <Screen on={at === 2}>
                <div className="v2-scr-looks">
                  {LOOKS.map((id, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- static demo poster
                    <img
                      key={id}
                      src={`/demo/styles/${id}.jpg`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cn(i === 4 && "is-on")}
                    />
                  ))}
                </div>
              </Screen>

              <Screen on={at === 3}>
                <Clip src={hero.demo.after} poster={hero.demo.afterPoster} on={at === 3} />
                <span className="v2-scr-chip">Photos land on the word</span>
              </Screen>

              <Screen on={at === 4}>
                <Clip
                  src="/demo/styles/mikku-royal.mp4"
                  poster="/demo/styles/mikku-royal.jpg"
                  on={at === 4}
                />
                <span className="v2-scr-chip">Preview · tap a word to change it</span>
              </Screen>

              <Screen on={at === 5}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
                <img src={hero.demo.afterPoster} alt="" loading="lazy" decoding="async" />
                <div className="v2-scr-card v2-scr-bottom">
                  <div className="v2-scr-row">
                    <span>reel_1080x1920.mp4</span>
                    <span className="v2-scr-ok">Ready</span>
                  </div>
                  <div className="v2-scr-dl">Download ↓</div>
                </div>
              </Screen>
            </div>
            <div className="v2-how-count" aria-hidden>
              <span>{String(at + 1).padStart(2, "0")}</span> / 06
            </div>
          </div>

          <ol className="v2-how-steps">
            {c.steps.map((s, i) => (
              <li
                key={s.title}
                ref={(el) => {
                  steps.current[i] = el;
                }}
                data-step={i}
                className={cn("v2-how-step", at === i && "is-on")}
                aria-current={at === i ? "step" : undefined}
              >
                <span className="v2-idx">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Screen({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <div className={cn("v2-scr", on && "is-on")}>{children}</div>;
}

/** A clip that only loads once its screen first shows, and only plays while it shows. */
function Clip({ src, poster, on }: { src: string; poster: string; on: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (on) {
      if (!v.src) v.src = src;
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [on, src]);
  return <video ref={ref} poster={poster} muted loop playsInline preload="none" tabIndex={-1} />;
}
