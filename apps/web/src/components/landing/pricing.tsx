"use client";

import Link from "next/link";
import { useState } from "react";
import { creditPacks, formatPrice, plans, type Currency, type Plan } from "@/config/pricing";
import { pricing as c } from "@/content/landing";
import { cn } from "@/lib/utils";

const length = (p: Plan) => (p.maxSeconds >= 60 ? `${Math.round(p.maxSeconds / 60)} min` : `${p.maxSeconds} s`);
const reels = (p: Plan) => (p.reelsPerMonth === null ? "Volume credits" : `${p.reelsPerMonth}`);
const endCard = (p: Plan) => (p.watermark ? "Small Rasika mark" : "Clean");
const extras = (p: Plan) =>
  p.features.filter((f) => !/reel|export|up to|watermark|mark on/i.test(f)).join(" · ") || "—";

/**
 * Pricing — "Plans as a large table". Four plans compared in words, the type far larger than a
 * table usually gets; the recommended plan is the one column on the accent tone.
 */
export function Pricing() {
  const [cur, setCur] = useState<Currency>("INR");
  const rows: Array<[string, (p: Plan) => string]> = [
    [c.rows.reels, reels],
    [c.rows.length, length],
    [c.rows.export, (p) => p.resolution],
    [c.rows.watermark, endCard],
    [c.rows.extras, extras],
  ];
  return (
    <section id="pricing" className="section wrap scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="head">{c.title}</h2>
          <p className="text-muted mt-3 max-w-[40ch]">{c.sub}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div role="group" aria-label="Currency" className="seg" data-ui>
            {(["INR", "USD"] as Currency[]).map((k) => (
              <button key={k} type="button" onClick={() => setCur(k)} aria-pressed={cur === k}>
                {k === "INR" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
          <p className="text-muted small">{c.currencyNote}</p>
        </div>
      </div>

      {/* desktop: the table */}
      <table className="plans mt-12 hidden w-full lg:table">
        <thead>
          <tr>
            <th scope="col" className="w-1/3 align-top">
              <span className="sr-only">Compared</span>
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className={cn("align-top", p.highlight && "is-rec")}>
                <span className="block text-[clamp(1.5rem,3vw,2.75rem)] font-semibold leading-none tracking-[-0.03em]">{p.name}</span>
                <span className="mt-2 block text-[clamp(1.5rem,3vw,2.75rem)] font-normal leading-none tracking-[-0.02em] tabular-nums">
                  {formatPrice(p.price[cur], cur)}
                </span>
                <span className="mt-2 block text-[1rem] font-normal opacity-80">
                  {p.price[cur] === null ? "custom" : p.price[cur] === 0 ? "forever" : c.perMonth}
                </span>
                <span className="mt-3 block text-[1rem] font-normal opacity-80">{p.blurb}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {plans.map((p) => (
                <td key={p.id} className={cn(p.highlight && "is-rec")}>
                  {f(p)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">
              <span className="sr-only">Choose</span>
            </th>
            {plans.map((p) => (
              <td key={p.id} className={cn(p.highlight && "is-rec")}>
                <Link href={p.href} className={cn("button w-full", p.highlight ? "button-field" : undefined)}>
                  {p.cta}
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* phone and tablet: the plans as blocks */}
      <ul className="mt-10 grid gap-10 md:grid-cols-2 lg:hidden">
        {plans.map((p) => (
          <li key={p.id} className={cn("flex flex-col p-6", p.highlight ? "is-rec-block" : "panel")}>
            <p className="text-[clamp(2.25rem,9vw,3rem)] font-semibold leading-none tracking-[-0.03em]">{p.name}</p>
            <p className="mt-2 text-[clamp(2.25rem,9vw,3rem)] font-normal leading-none tracking-[-0.02em] tabular-nums">
              {formatPrice(p.price[cur], cur)}
              <span className="ml-2 text-[1rem] opacity-80">
                {p.price[cur] === null ? "custom" : p.price[cur] === 0 ? "forever" : c.perMonth}
              </span>
            </p>
            <p className="mt-3 opacity-80">{p.blurb}</p>
            <dl className="mt-6 grid gap-3">
              {rows.map(([label, f]) => (
                <div key={label}>
                  <dt className="opacity-70">{label}</dt>
                  <dd>{f(p)}</dd>
                </div>
              ))}
            </dl>
            <Link href={p.href} className={cn("button mt-8 w-full", p.highlight ? "button-field" : undefined)}>
              {p.cta}
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid12 mt-20">
        <div className="col-span-12 lg:col-span-4">
          <h3 className="lead font-semibold leading-tight tracking-[-0.02em]">{c.creditsTitle}</h3>
          <p className="text-muted mt-2 max-w-[32ch]">{c.creditsSub}</p>
        </div>
        <ul className="col-span-12 mt-6 lg:col-start-5 lg:col-span-8 lg:mt-0">
          {creditPacks.map((cp, i) => (
            <li key={cp.id} className={cn("flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4", i % 2 === 0 && "panel")}>
              <span className="font-medium">{cp.credits} credits</span>
              <span className="tabular-nums">{formatPrice(cp.price[cur], cur)}</span>
              <span className="text-muted">{cur === "INR" ? cp.note : " "}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
