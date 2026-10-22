import Link from "next/link";
import { formatPrice, packs, perReel } from "@/config/pricing";
import { pricing as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Pricing: the first reel free, then three one-off packs, the type far larger than a table usually
 * gets; the recommended pack is the one column on the accent tone.
 */
export function Pricing() {
  return (
    <section id="pricing" className="section wrap scroll-mt-6">
      <div>
        <h2 className="head">{c.title}</h2>
        <p className="text-muted mt-3 max-w-[48ch]">{c.sub}</p>
      </div>

      <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {packs.map((p) => (
          <li
            key={p.id}
            className={cn("flex flex-col p-6", p.highlight ? "is-rec-block" : "panel")}
          >
            <p className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-none tracking-[-0.03em]">
              {p.name}
            </p>
            <p className="mt-3 text-[clamp(1.75rem,3vw,2.5rem)] font-normal tabular-nums leading-none tracking-[-0.02em]">
              {p.inr === 0 ? "Free" : formatPrice(p.inr)}
            </p>
            <p className="mt-2 opacity-80">
              {p.inr === 0 ? c.once : `${formatPrice(perReel(p))} ${c.perReel} · ${c.oneOff}`}
            </p>
            <p className="mt-4 opacity-80">{p.blurb}</p>
            <Link
              href={p.inr === 0 ? "/dashboard/new" : `/dashboard/credits?pack=${p.id}`}
              className={cn("button mt-auto w-full", p.highlight ? "button-field" : undefined)}
              style={{ marginTop: "2rem" }}
            >
              {p.inr === 0 ? c.startFree : `${c.buy} ${p.name}`}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-muted mt-6 max-w-[70ch] text-[14px]">{c.note}</p>
    </section>
  );
}
