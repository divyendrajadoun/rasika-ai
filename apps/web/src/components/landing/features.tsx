import type { CSSProperties } from "react";
import { DemoFrame } from "@/components/motion/demo-frame";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { features as c } from "@/content/landing";
import "@/styles/demos.css";

const v = (o: Record<string, number | string>) => o as CSSProperties;

/** Tiny looping demos — one per feature — in a 9:16 mini stage. Pure CSS, see styles/demos.css. */
function Demo({ id }: { id: string }) {
  switch (id) {
    case "poster":
      return (
        <div className="d-stage">
          <div className="absolute inset-x-2 top-3 text-center">
            <div className="d-mask">
              <span className="d-rise poster text-mar text-[10px]" style={v({ "--i": 0 })}>
                HOW DO YOU KNOW
              </span>
            </div>
            <div className="d-mask">
              <span className="d-rise poster text-ter text-[20px]" style={v({ "--i": 1 })}>
                YOUR TASTE
              </span>
            </div>
            <div className="d-mask">
              <span
                className="d-rise font-accent text-goldd text-[11px] italic"
                style={v({ "--i": 2 })}
              >
                in 30 days?
              </span>
            </div>
          </div>
          <div className="d-head" />
        </div>
      );
    case "captions":
      return (
        <div className="d-stage">
          <div className="d-head" />
          <div className="absolute inset-x-0 bottom-[22%] text-center">
            {["your", "taste", "isn't", "yours"].map((w, i) => (
              <span
                key={w}
                className={
                  "d-cap " +
                  (w === "taste"
                    ? "caption-gold text-[20px]"
                    : w === "yours"
                      ? "caption-red text-[16px]"
                      : "caption text-[14px]")
                }
                style={v({ "--i": i })}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      );
    case "image-on-word":
      return (
        <div className="d-stage">
          <div className="d-head" />
          <div className="d-polaroid polaroid absolute right-[6%] top-[8%] w-[46%]">
            <div className="aspect-[4/5] w-full bg-[linear-gradient(135deg,#c8452f,#e6b450)]" />
            <p className="poster text-mar absolute inset-x-0 bottom-[3%] text-center text-[8px]">
              BALCONY
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-[22%] text-center">
            <span className="d-cap-once caption-red text-[16px]">balcony</span>
          </div>
        </div>
      );
    case "punch-in":
      return (
        <div className="d-stage">
          <div className="d-zoom">
            <div className="d-head" />
          </div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 90 160">
            <ellipse
              className="d-ring"
              cx="45"
              cy="86"
              rx="26"
              ry="11"
              fill="none"
              stroke="#e6b450"
              strokeWidth="2"
            />
          </svg>
          <p className="poster text-iv absolute inset-x-0 top-[12%] text-center text-[11px] drop-shadow">
            THE SAME CHOKER
          </p>
        </div>
      );
    case "pip":
      return (
        <div className="d-stage dark">
          <div className="d-plate bg-[linear-gradient(160deg,#7d3f22,#c98d5c)]" />
          <div className="absolute inset-x-0 top-[9%] text-center">
            <p className="kicker text-gold text-[6px]">LOOK HERE</p>
            <p className="poster text-iv text-[13px]">AMRAPALI MUSEUM</p>
          </div>
          <div className="d-pip ring-gold absolute bottom-[8%] right-[6%] w-[34%] overflow-hidden rounded-[6px] ring-2">
            <div className="relative aspect-[9/16] bg-[linear-gradient(180deg,#efe0c6,#d8c3a3)]">
              <div className="d-head" />
            </div>
          </div>
        </div>
      );
    case "reveal":
      return (
        <div className="d-stage dark">
          <div className="border-gold bg-iv/10 absolute inset-x-[8%] top-[16%] rounded-lg border-2 border-dashed py-3 text-center">
            <p className="kicker text-gold text-[6px]">THE WORD</p>
            <p className="d-blur poster text-iv text-[22px]">RASIKA</p>
            <p className="font-devanagari text-gold text-[11px]">रसिक</p>
          </div>
          <div className="d-head" />
        </div>
      );
    case "sfx":
      return (
        <div className="d-stage dark">
          <div className="absolute inset-x-[12%] top-1/2 flex h-[40%] -translate-y-1/2 items-end justify-between gap-[3px]">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="d-bar bg-gold rounded-sm"
                style={v({ "--i": i, "--h": (30 + ((i * 37) % 60)) / 100 })}
              />
            ))}
          </div>
          <p className="kicker text-iv/80 absolute inset-x-0 bottom-[14%] text-center text-[6px]">
            whoosh · pop · tick · riser · impact · sub
          </p>
        </div>
      );
    default:
      return (
        <div className="d-stage dark">
          <div className="absolute inset-x-0 top-[18%] text-center">
            <div className="d-mask">
              <span
                className="d-rise font-devanagari text-gold text-[30px] leading-tight"
                style={v({ "--dur": "3s" })}
              >
                रस
              </span>
            </div>
            <p className="poster text-iv text-[12px]">RAS</p>
          </div>
          <div className="d-head" />
        </div>
      );
  }
}

export function Features() {
  return (
    <Section id="features" eyebrow={c.eyebrow} title={c.title}>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {c.items.map((f, i) => (
          <li key={f.id}>
            <Reveal delay={(i % 4) * 0.08} className="h-full">
              <article className="bg-card flex h-full flex-col rounded-2xl border p-4 shadow-[0_20px_50px_rgba(30,0,5,.12)]">
                <DemoFrame className="mx-auto w-[58%]">
                  <Demo id={f.id} />
                </DemoFrame>
                <h3 className="poster mt-5 text-2xl">{f.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.body}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
