import { faq as c } from "@/content/landing";

/**
 * FAQ: the title stays on the left while seven filled tiles scroll past; the open one fills with the
 * accent. Built as <details> sharing a name so one opens at a time.
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
    <section id="faq" className="lp-sec" style={{ paddingTop: "clamp(48px, 6vw, 100px)" }}>
      <div className="lp-in lp-faq-grid">
        <h2 className="lp-h2">{c.title}</h2>
        <div className="flex flex-col gap-2">
          {c.items.map((it, i) => (
            <details key={it.q} name="faq" className="lp-faq" open={i === 0 ? true : undefined}>
              <summary>{it.q}</summary>
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
