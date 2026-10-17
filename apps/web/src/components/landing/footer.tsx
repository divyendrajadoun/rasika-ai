import { Wordmark } from "@/components/brand/wordmark";
import { brand } from "@/config/brand";
import { footer as c } from "@/content/landing";

export function Footer() {
  return (
    <footer className="jaali border-gold/15 text-iv border-t">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Wordmark />
          <p className="font-accent text-iv/80 mt-3 max-w-xs text-lg italic">{brand.meaning}</p>
          <p className="kicker text-gold/80 mt-6 text-[0.6rem]">{c.madeIn}</p>
        </div>
        {c.columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="kicker text-gold mb-4 text-[0.65rem]">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-iv/80 hover:text-gold text-sm transition"
                    {...(l.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-gold/15 border-t">
        <p className="container-x text-iv/60 py-5 text-xs">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
