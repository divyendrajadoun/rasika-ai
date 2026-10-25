"use client";

import type { CSSProperties, ReactNode } from "react";
import { howItWorks as c } from "@/content/landing";
import { cn } from "@/lib/utils";
import { useAdvance } from "./use-advance";

const WORDS = "This balcony faces east, so you get morning sun all year.".split(" ");
const KEY = new Set([1, 3, 7, 8]);
const THUMBS = [
  "mikku-royal",
  "katana-pop",
  "vox-paper",
  "neon-pop",
  "launch-spotlight",
  "comic-pop",
];

/**
 * How it works: six phone screens in a 3D coverflow, one per step, each playing its own small
 * animation when it comes to the front, in step with the list beside it. The list carries the
 * meaning (the phones are decoration); a pick by hand holds the auto-advance for 7 s.
 */
export function HowItWorks() {
  const { index, pick } = useAdvance(c.steps.length, 3600, 7000);

  const phones: ReactNode[] = [
    <Upload key="upload" />,
    <Transcript key="transcript" />,
    <PickLook key="look" />,
    <PhotoOnWord key="photo" />,
    <Preview key="preview" />,
    <Ready key="ready" />,
  ];

  return (
    <section id="how" className="lp-how" aria-labelledby="how-title">
      <div className="lp-how-bg" aria-hidden />
      <div className="lp-in lp-how-grid">
        <div className="lp-how-list">
          <div>
            <div className="lp-how-kicker">{c.kicker}</div>
            <h2 id="how-title">{c.title}</h2>
            <p style={{ margin: "14px 0 0", maxWidth: "44ch", color: "rgba(246,236,216,0.72)" }}>
              {c.sub}
            </p>
          </div>
          <ol className="lp-how-steps">
            {c.steps.map((s, i) => {
              const on = i === index;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    className="lp-how-step"
                    aria-current={on ? "step" : undefined}
                    onClick={() => pick(i)}
                  >
                    <span style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                      <span className="lp-how-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lp-how-t">{s.title}</span>
                    </span>
                    {on && (
                      <>
                        <span className="lp-how-b">{s.body}</span>
                        <span key={`bar-${index}`} className="lp-how-bar is-run" aria-hidden>
                          <span />
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="lp-how-stage-wrap">
          <div className="lp-how-stage" data-tilt="4" aria-hidden>
            <div
              className="lp-floor"
              style={{ bottom: 0, width: "70%", height: 80, opacity: 0.8 }}
            />
            <div className="lp-how-group">
              {phones.map((screen, i) => {
                const off = i - index;
                const ab = Math.abs(off);
                const style: CSSProperties = {
                  transform: `translateX(calc(${off} * var(--hw) * 0.66)) translateZ(${-ab * 190}px) rotateY(${off * -38}deg)`,
                  opacity: ab > 2 ? 0 : 1,
                  zIndex: 10 - ab,
                };
                return (
                  <div
                    key={i}
                    className={cn("lp-phone lp-hp", off === 0 && "is-on")}
                    style={style}
                    onClick={() => pick(i)}
                  >
                    <div className="lp-phone-screen">
                      {screen}
                      <span className="lp-notch" />
                      <span className="lp-hp-veil" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element -- static demo posters inside decorative phones */
function Upload() {
  return (
    <div className="lp-hp-pad">
      <div className="lp-hp-small">New edit · step 1 of 3</div>
      <div className="lp-hp-title">Your video</div>
      <div className="lp-hp-drop">
        <img src="/demo/styles/raw.jpg" alt="" loading="lazy" className="lp-hp-thumb" />
        <div style={{ fontWeight: 600, fontSize: 12 }}>balcony-walkthrough.mov</div>
        <div className="lp-hp-small">86.4 MB · 48 s · 1080×1920</div>
      </div>
      <div className="lp-hp-prog">
        <div />
      </div>
      <div className="lp-hp-row">
        <span>Uploading</span>
        <span className="lp-gold">9.8 MB/s</span>
      </div>
    </div>
  );
}

function Transcript() {
  return (
    <>
      <img
        src="/demo/styles/raw.jpg"
        alt=""
        loading="lazy"
        className="lp-hp-fill"
        style={{ filter: "brightness(0.6)" }}
      />
      <div className="lp-anton lp-hp-east">EAST</div>
      <div className="lp-hp-glass">
        <div className="lp-hp-tag">
          <span>TRANSCRIPT · EN</span>
          <span>VERIFIED</span>
        </div>
        <div className="lp-hp-words">
          {WORDS.map((w, i) => (
            <span
              key={i}
              className={KEY.has(i) ? "is-key" : undefined}
              style={{ "--d": `${250 + i * 180}ms` } as CSSProperties}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function PickLook() {
  return (
    <div className="lp-hp-pad" style={{ gap: 8, padding: "36px 12px 14px" }}>
      <div className="lp-hp-small">Step 2 of 3</div>
      <div className="lp-hp-title">Pick a look</div>
      <div className="lp-hp-grid">
        {THUMBS.map((id, i) => (
          <img
            key={id}
            src={`/demo/styles/${id}.jpg`}
            alt=""
            loading="lazy"
            className={i === 1 ? "is-pick" : undefined}
          />
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column" }}>
          <b style={{ fontWeight: 600 }}>Katana pop</b>
          <span style={{ fontSize: 10, color: "rgba(246,236,216,0.6)" }}>
            Kinetic type · Pop &amp; whoosh
          </span>
        </span>
        <span className="lp-hp-go">Continue</span>
      </div>
    </div>
  );
}

function PhotoOnWord() {
  return (
    <>
      <img
        src="/demo/styles/raw.jpg"
        alt=""
        loading="lazy"
        className="lp-hp-fill"
        style={{ filter: "brightness(0.8)" }}
      />
      <div className="lp-hp-chip">
        Show when I say: <b className="lp-gold">balcony</b>
      </div>
      <div
        className="lp-hp-photo"
        style={{
          background: "linear-gradient(160deg,#e6b450,#9a6a14 55%,#3a0a11)",
          display: "flex",
          alignItems: "flex-end",
          padding: 8,
          fontSize: 10,
          color: "#f6ecd8",
        }}
      >
        balcony.jpg
      </div>
      <div className="lp-hp-say">
        <div style={{ fontSize: 13, fontWeight: 500, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
          the east-facing
        </div>
        <div className="lp-anton" style={{ fontSize: "calc(var(--hw) * 0.17)" }}>
          BALCONY
        </div>
      </div>
    </>
  );
}

function Preview() {
  return (
    <>
      <img
        src="/demo/after-poster.webp"
        alt=""
        loading="lazy"
        className="lp-hp-fill"
        style={{ filter: "blur(2px) brightness(0.55)" }}
      />
      <div
        className="lp-hp-glass"
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "rgba(20,5,8,0.82)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>Rendering preview</div>
        {["Transcribed", "Edit designed · 14 beats", "Sound placed · 22 cues"].map((t) => (
          <div key={t} className="lp-hp-row">
            <span>{t}</span>
            <span className="lp-gold">✓</span>
          </div>
        ))}
        <div className="lp-hp-prog">
          <div />
        </div>
        <div style={{ fontSize: 10, color: "rgba(246,236,216,0.6)" }}>
          Tap any word to change it before the final render.
        </div>
      </div>
    </>
  );
}

function Ready() {
  return (
    <>
      <img src="/demo/after-poster.webp" alt="" loading="lazy" className="lp-hp-fill" />
      <div className="lp-hp-play">▶</div>
      <div className="lp-hp-sheet">
        <div style={{ fontWeight: 600, fontSize: 15 }}>Your reel is ready</div>
        <div style={{ fontSize: 11, color: "rgba(246,236,216,0.65)" }}>
          48 s · 1080 × 1920 · MP4
        </div>
        <div className="lp-hp-dl">Download</div>
        <div className="lp-hp-share">Share to Instagram</div>
      </div>
    </>
  );
}
/* eslint-enable @next/next/no-img-element */
