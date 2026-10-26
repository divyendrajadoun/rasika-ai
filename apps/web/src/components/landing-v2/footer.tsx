import { brand } from "@/config/brand";
import { footer as c } from "@/content/landing";

/** Footer: one quiet row of links, then the name as a ghost wordmark cut off by the page's end. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="v2-cin v2-footer">
      <div className="v2-in v2-footer-row">
        <span>
          {c.what} · {c.madeIn}
        </span>
        <ul>
          {c.links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                {...(l.href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <span>
          © {year} · <a href={c.privacy.href}>{c.privacy.label}</a>
        </span>
      </div>
      <div className="v2-footer-mark" aria-hidden>
        {brand.name}
      </div>
    </footer>
  );
}
