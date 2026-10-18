import Link from "next/link";
import { ArchFrame } from "@/components/brand/arch-frame";
import { DemoVideo } from "@/components/brand/demo-video";
import { PhoneMockup } from "@/components/brand/phone-mockup";
import { RisingWords } from "@/components/motion/rising-words";
import { hero } from "@/content/landing";

export function Hero() {
  return (
    <section className="jaali text-iv relative overflow-hidden">
      <div className="container-x relative z-[2] grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-28">
        <div className="max-w-2xl">
          <h1 className="poster text-[2.9rem] leading-[0.96] sm:text-7xl lg:text-[5.4rem]">
            <RisingWords text={hero.headline} goldWord={hero.goldWord} />
          </h1>
          <p
            className="font-accent text-iv/90 fade-up mt-6 max-w-xl text-2xl italic leading-snug sm:text-3xl"
            style={{ animationDelay: "0.5s" }}
          >
            {hero.sub}
          </p>

          <div
            className="fade-up mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.65s" }}
          >
            <Link
              href={hero.primary.href}
              className="h-13 bg-ter inline-flex items-center justify-center rounded-full px-7 text-base font-semibold text-white shadow-[0_14px_40px_rgba(200,69,47,.4)] transition hover:bg-[#d8553d]"
            >
              {hero.primary.label}
            </Link>
            <a
              href={hero.secondary.href}
              className="h-13 border-gold/50 text-gold hover:bg-gold/10 inline-flex items-center justify-center rounded-full border px-7 text-base font-semibold transition"
            >
              {hero.secondary.label}
            </a>
          </div>

          <p
            className="kicker text-gold/80 fade-up mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.68rem]"
            style={{ animationDelay: "0.8s" }}
          >
            {hero.trust.map((t, i) => (
              <span key={t} className="inline-flex items-center gap-3">
                {i > 0 && <span aria-hidden>·</span>}
                {t}
              </span>
            ))}
          </p>
        </div>

        <div
          className="card-in relative mx-auto w-full max-w-[300px] sm:max-w-[340px]"
          style={{ animationDelay: "0.3s" }}
        >
          <div aria-hidden className="bg-gold/25 absolute -inset-10 -z-[1] rounded-full blur-3xl" />
          <PhoneMockup>
            <div className="jaali absolute inset-0" aria-hidden />
            <div className="absolute inset-x-[9%] bottom-[8%] top-[8%]">
              <ArchFrame className="h-full">
                <DemoVideo
                  className="h-full"
                  src={hero.demo.after}
                  poster={hero.demo.afterPoster}
                  alt={hero.demo.alt}
                  start="load"
                  priority
                />
              </ArchFrame>
            </div>
            <div className="absolute inset-x-0 bottom-[3.5%] text-center">
              <p className="kicker text-gold text-[0.55rem]">Real take · rendered by Rasika</p>
            </div>
          </PhoneMockup>
        </div>
      </div>
      <div className="gold-rule relative z-[2]" aria-hidden />
    </section>
  );
}
