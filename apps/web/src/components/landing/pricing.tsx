"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { creditPacks, formatPrice, plans, type Currency } from "@/config/pricing";
import { pricing as c } from "@/content/landing";
import { cn } from "@/lib/utils";

export function Pricing() {
  const [cur, setCur] = useState<Currency>("INR");
  return (
    <Section id="pricing" eyebrow={c.eyebrow} title={c.title} sub={c.sub}>
      <div className="mb-10 flex justify-center">
        <div
          role="group"
          aria-label="Currency"
          className="bg-card inline-flex rounded-full border p-1 text-sm font-semibold"
        >
          {(["INR", "USD"] as Currency[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setCur(k)}
              aria-pressed={cur === k}
              className={cn(
                "rounded-full px-5 py-2 transition",
                cur === k ? "bg-ter text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "INR" ? "₹ INR" : "$ USD"}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => (
          <li key={p.id}>
            <Reveal kind="card" delay={i * 0.08} className="h-full">
              <article
                className={cn(
                  "bg-card relative flex h-full flex-col rounded-2xl border p-6 shadow-[0_20px_50px_rgba(30,0,5,.12)]",
                  p.highlight && "border-gold ring-gold/50 ring-2",
                )}
              >
                {p.highlight && (
                  <span className="kicker bg-gold text-ink absolute -top-3 left-6 rounded-full px-3 py-1 text-[0.6rem]">
                    Most popular
                  </span>
                )}
                <h3 className="poster text-3xl">{p.name}</h3>
                <p className="font-accent text-muted-foreground mt-1 text-lg italic">{p.blurb}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="poster text-ter text-5xl">{formatPrice(p.price[cur], cur)}</span>
                  {p.price[cur] !== null && (
                    <span className="text-muted-foreground text-sm">{c.perMonth}</span>
                  )}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        className="text-goldd dark:text-gold mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={cn(
                    "mt-7 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition",
                    p.highlight
                      ? "bg-ter text-white hover:bg-[#d8553d]"
                      : "border-goldd/50 text-foreground hover:bg-gold/10 dark:border-gold/40 border",
                  )}
                >
                  {p.cta}
                </Link>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>

      <div className="mt-16 text-center">
        <h3 className="poster text-3xl">{c.creditsTitle}</h3>
        <p className="font-accent text-muted-foreground mt-1 text-lg italic">{c.creditsSub}</p>
        <ul className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
          {creditPacks.map((cp) => (
            <li key={cp.id} className="bg-card rounded-2xl border p-5">
              <p className="poster text-ter text-4xl">{cp.credits}</p>
              <p className="kicker text-muted-foreground mt-1 text-[0.6rem]">credits</p>
              <p className="mt-3 text-xl font-bold">{formatPrice(cp.price[cur], cur)}</p>
              {cur === "INR" && <p className="text-muted-foreground text-xs">{cp.note}</p>}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
