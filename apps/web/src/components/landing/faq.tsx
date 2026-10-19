import { faq as c } from "@/content/landing";

/**
 * FAQ — "Accordion of filled tiles". The heading stays while the tiles scroll past; each question is a
 * filled tile, the open one on the accent tone. Built as <details> sharing a name so one opens at a time.
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
    <section id="faq" className="section wrap scroll-mt-6">
      <div className="grid12">
        <div className="col-span-12 lg:col-span-4">
          <h2 className="head lg:sticky lg:top-24">{c.title}</h2>
        </div>
        <div className="col-span-12 mt-8 flex flex-col gap-2 lg:col-start-5 lg:col-span-8 lg:mt-0">
          {c.items.map((it, i) => (
            <details key={it.q} name="faq" className="faq-tile" open={i === 0 ? true : undefined}>
              <summary>
                <span>{it.q}</span>
                <span className="plus" aria-hidden />
              </summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
