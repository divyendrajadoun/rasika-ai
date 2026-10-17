import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { whoFor as c } from "@/content/landing";

export function WhoFor() {
  return (
    <Section id="who" eyebrow={c.eyebrow} title={c.title} tone="maroon">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {c.items.map((it, i) => (
          <li key={it.title}>
            <Reveal delay={i * 0.07} className="h-full">
              <div className="border-gold/25 bg-mar/50 flex h-full flex-col rounded-2xl border p-5">
                <h3 className="poster text-gold text-2xl">{it.title}</h3>
                <p className="font-accent text-iv/85 mt-2 text-lg italic">{it.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
