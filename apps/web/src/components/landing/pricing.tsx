import Link from "next/link";
import { formatPrice, packs, perReel } from "@/config/pricing";
import { pricing as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Pricing: the first reel free, then three one-off packs as lit cards; the recommended pack is the
 * maroon one, lifted, with a gold hairline and a gold button.
 */
export function Pricing() {
  return (
    <section id="pricing" className="lp-sec">
      <div className="lp-in">
        <h2 className="lp-h2">{c.title}</h2>
        <p className="lp-muted" style={{ margin: "14px 0 0", maxWidth: "54ch" }}>
          {c.sub}
        </p>

        <ul className="lp-packs">
          {packs.map((p) => (
            <li key={p.id}>
              <div data-tilt="7" className={cn("lp-pack", p.highlight && "is-rec")}>
                <div className="lp-pack-name">{p.name}</div>
                <div className="lp-pack-price">{p.inr === 0 ? "Free" : formatPrice(p.inr)}</div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  {p.inr === 0 ? c.once : `${formatPrice(perReel(p))} ${c.perReel} · ${c.oneOff}`}
                </div>
                <p style={{ margin: 0, flex: 1 }}>{p.blurb}</p>
                <Link
                  href={p.inr === 0 ? "/dashboard/new" : `/dashboard/credits?pack=${p.id}`}
                  className="lp-btn lp-pack-btn"
                >
                  {p.inr === 0 ? c.startFree : `${c.buy} ${p.name}`}
                </Link>
                <span className="lp-gloss" style={{ borderRadius: 22 }} aria-hidden />
              </div>
            </li>
          ))}
        </ul>
        <p
          className="lp-muted"
          style={{ margin: "28px 0 0", maxWidth: "80ch", fontSize: 14, lineHeight: 1.55 }}
        >
          {c.note}
        </p>
      </div>
    </section>
  );
}
