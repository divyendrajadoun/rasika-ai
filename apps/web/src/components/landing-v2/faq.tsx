import { faq as c } from "@/content/landing";

/**
 * Questions on the same sheet as pricing: the heading stays on the left while the rows pass; one
 * row open at a time (<details> sharing a name), the plus turns into a cross.
 */
export function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
  return (
    <section id="faq" className="v2-sheet v2-sec v2-faq">
      <div className="v2-in v2-faq-grid">
        <header className="v2-faq-head" data-rv>
          <span className="v2-label">[ 05 ] FAQ</span>
          <h2 className="v2-h2">
            Questions, <br />
            <em className="v2-serif v2-accent">answered.</em>
          </h2>
        </header>
        <div className="v2-faq-list" data-rv>
          {c.items.map((it, i) => (
            <details key={it.q} name="faq" className="v2-qa" open={i === 0 ? true : undefined}>
              <summary>
                {it.q}
                <span className="v2-qa-x" aria-hidden />
              </summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
