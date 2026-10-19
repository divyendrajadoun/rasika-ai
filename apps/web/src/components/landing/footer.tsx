import { footer as c } from "@/content/landing";

/** Footer — "A single quiet line": what this is · links · year and privacy, after a stretch of empty ground. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="wrap pt-[20svh] pb-6 lg:pt-[30svh] lg:pb-[30px]">
      <div className="small grid gap-2 lg:grid-cols-[1fr_auto_1fr] lg:items-baseline">
        <p className="text-muted">
          {c.what} · {c.madeIn}
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 lg:justify-center">
          {c.links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="link"
                {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-muted lg:text-right">
          © {year} ·{" "}
          <a href={c.privacy.href} className="link text-text">
            {c.privacy.label}
          </a>
        </p>
      </div>
    </footer>
  );
}
