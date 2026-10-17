import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { finalCta as c } from "@/content/landing";

export function FinalCta() {
  return (
    <section className="jaali grain text-iv relative">
      <div className="gold-rule" aria-hidden />
      <div className="container-x relative z-[2] py-24 text-center sm:py-32">
        <Reveal>
          <h2 className="poster text-balance text-5xl sm:text-7xl">{c.title}</h2>
          <p className="font-accent text-iv/85 mt-5 text-2xl italic">{c.sub}</p>
          <Link
            href={c.cta.href}
            className="h-13 bg-ter mt-10 inline-flex items-center justify-center rounded-full px-9 text-base font-semibold text-white shadow-[0_14px_40px_rgba(200,69,47,.4)] transition hover:bg-[#d8553d]"
          >
            {c.cta.label}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
