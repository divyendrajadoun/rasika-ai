import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "@/components/brand/section";
import { faq as c } from "@/content/landing";

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
    <Section id="faq" eyebrow={c.eyebrow} title={c.title}>
      <div className="bg-card mx-auto max-w-3xl rounded-2xl border px-5 sm:px-8">
        <Accordion>
          {c.items.map((it) => (
            <AccordionItem key={it.q} value={it.q}>
              <AccordionTrigger className="py-5 text-left text-lg font-semibold hover:no-underline sm:text-xl">
                {it.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 text-base leading-relaxed">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Section>
  );
}
