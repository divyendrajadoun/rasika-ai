import Link from "next/link";
import type { CSSProperties } from "react";
import { DemoFrame } from "@/components/motion/demo-frame";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { presetCards, type PresetCard } from "@/config/presets";
import { styles as c } from "@/content/landing";
import "@/styles/demos.css";

const v = (o: Record<string, number | string>) => o as CSSProperties;

/** A palette-driven looping mini preview of a preset: stage, poster lines, one caption. Pure CSS. */
function PresetPreview({ card }: { card: PresetCard }) {
  const p = card.tokens.palette;
  const dur = `${(2.4 + (1 - card.tokens.pace) * 2).toFixed(2)}s`; // faster pace → shorter loop
  const shape =
    card.tokens.endCardShape === "arch"
      ? "arch"
      : card.tokens.endCardShape === "rounded"
        ? "rounded-xl"
        : "";
  const lines = [
    { t: card.preview.kicker, cls: "kicker text-[6px]", color: p.gold },
    {
      t: card.preview.big,
      cls:
        card.tokens.fonts.poster === "Inter"
          ? "font-sans text-[15px] font-black uppercase"
          : "poster text-[19px]",
      color: p.iv,
    },
    { t: card.preview.italic, cls: "font-accent text-[12px] italic", color: p.gold },
  ];
  return (
    <div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-xl"
      style={{ background: p.stage }}
    >
      {card.tokens.pattern === "jaali" && <div className="jaali absolute inset-0 opacity-80" />}
      <div
        className={"absolute inset-x-[14%] bottom-[8%] top-[36%] overflow-hidden " + shape}
        style={{
          background: "linear-gradient(180deg,#efe0c6,#d8c3a3)",
          boxShadow: `0 0 0 2px ${p.gold}`,
        }}
      >
        <div className="d-head" />
      </div>
      <div className="absolute inset-x-2 top-[6%] text-center">
        {lines.map((l, i) => (
          <div key={l.t} className="d-mask">
            <span
              className={"d-rise " + l.cls}
              style={v({ "--i": i, "--dur": dur, color: l.color })}
            >
              {l.t}
            </span>
          </div>
        ))}
      </div>
      <p
        className="d-cap-once caption-gold absolute inset-x-0 bottom-[18%] text-center"
        style={{
          color: p.gold,
          fontSize: `${card.tokens.captionSize / 6}px`,
          animationDuration: dur,
        }}
      >
        {card.preview.caption}
      </p>
    </div>
  );
}

export function StyleGallery() {
  return (
    <Section id="styles" eyebrow={c.eyebrow} title={c.title} sub={c.sub}>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {presetCards.map((card, i) => (
          <li key={card.tokens.id}>
            <Reveal kind="card" delay={i * 0.08} className="h-full">
              <Link
                href={`/dashboard/new?style=${card.tokens.id}`}
                className="bg-card hover:border-gold/60 focus-visible:border-gold group flex h-full flex-col rounded-2xl border p-4 shadow-[0_20px_50px_rgba(30,0,5,.12)] transition hover:-translate-y-1"
                aria-label={`${c.ctaLabel}: ${card.tokens.name}`}
              >
                <DemoFrame className="mx-auto w-[64%]">
                  <PresetPreview card={card} />
                </DemoFrame>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <h3 className="poster text-2xl">{card.tokens.name}</h3>
                  {card.badge && (
                    <span className="kicker bg-gold text-ink rounded-full px-2 py-1 text-[0.55rem]">
                      {card.badge}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {card.tokens.tagline}
                </p>
                <div className="mt-4 flex items-center gap-2" aria-hidden>
                  {Object.values(card.tokens.palette)
                    .slice(0, 6)
                    .map((hex) => (
                      <span
                        key={hex}
                        className="size-4 rounded-full ring-1 ring-black/10"
                        style={{ background: hex }}
                      />
                    ))}
                </div>
                <span className="font-accent text-goldd dark:text-gold mt-4 text-lg italic group-hover:underline">
                  {c.ctaLabel} →
                </span>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
