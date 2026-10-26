import Link from "next/link";
import type { CSSProperties } from "react";
import { formatPrice, packs, perReel } from "@/config/pricing";
import { pricing as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Pricing on the ivory sheet: the free first reel and three one-off packs. The recommended pack is
 * the inverse card (cinema colours, a gold chip). Under 900px the cards become a snap rail.
 */
export function Pricing() {
  return (
    <section id="pricing" className="v2-sheet v2-sec v2-overlap v2-pricing">
      <div className="v2-in">
        <header className="v2-head v2-head-split" data-rv>
          <div>
            <span className="v2-label">[ 04 ] {c.title}</span>
            <h2 className="v2-h2">
              Pay per reel. <br />
              Never a <em className="v2-serif v2-accent">subscription.</em>
            </h2>
          </div>
          <p className="v2-lede">{c.sub}</p>
        </header>

        <ul className="v2-packs">
          {packs.map((p, i) => (
            <li
              key={p.id}
              data-rv
              style={{ "--rv-d": `${i * 90}ms` } as CSSProperties}
              className={cn("v2-pack", p.highlight && "is-rec")}
            >
              <div className="v2-pack-top">
                <span className="v2-pack-name">{p.name}</span>
                {p.highlight && <span className="v2-pack-chip">Recommended</span>}
              </div>
              <div className="v2-pack-price v2-serif">
                {p.inr === 0 ? "Free" : formatPrice(p.inr)}
              </div>
              <div className="v2-pack-per">
                {p.inr === 0 ? c.once : `${formatPrice(perReel(p))} ${c.perReel} · ${c.oneOff}`}
              </div>
              <p className="v2-pack-blurb">{p.blurb}</p>
              <Link
                href={p.inr === 0 ? "/dashboard/new" : `/dashboard/credits?pack=${p.id}`}
                className={cn("v2-btn", p.highlight ? "v2-btn-gold" : "v2-btn-line")}
              >
                {p.inr === 0 ? c.startFree : `${c.buy} ${p.name}`}
              </Link>
            </li>
          ))}
        </ul>
        <p className="v2-note-small v2-pricing-note">{c.note}</p>
      </div>
    </section>
  );
}
