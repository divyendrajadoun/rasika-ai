import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { howItWorks as c } from "@/content/landing";

/** Three chapter cards styled like the edit's 01 / 02 / 03 beats. */
export function HowItWorks() {
  return (
    <Section id="how-it-works" eyebrow={c.eyebrow} title={c.title} tone="maroon">
      <ol className="grid gap-5 md:grid-cols-3">
        {c.steps.map((s, i) => (
          <li key={s.n}>
            <Reveal kind="card" delay={i * 0.12} className="h-full">
              <article className="border-gold/25 bg-mar/60 relative flex h-full flex-col rounded-2xl border p-7 shadow-[0_30px_70px_rgba(0,0,0,.35)] backdrop-blur-sm">
                <span className="poster text-gold text-7xl leading-none" aria-hidden>
                  {s.n}
                </span>
                <h3 className="poster text-iv mt-4 text-3xl">
                  <span className="sr-only">Step {s.n}: </span>
                  {s.line}
                </h3>
                <p className="font-accent text-gold mt-1 text-2xl italic">{s.italic}</p>
                <div className="gold-rule my-5 opacity-60" aria-hidden />
                <p className="text-iv/80 text-base leading-relaxed">{s.body}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
