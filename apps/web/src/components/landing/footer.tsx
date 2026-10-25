import { footer as c } from "@/content/landing";

/** Footer: one quiet line after a stretch of empty ground: what this is · links · year and privacy. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="lp-footer">
      <div className="lp-in">
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
        <span className="lp-footer-end" style={{ textAlign: "right" }}>
          © {year} · <a href={c.privacy.href}>{c.privacy.label}</a>
        </span>
      </div>
    </footer>
  );
}
