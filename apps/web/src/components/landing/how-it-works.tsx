import { DemoVideo } from "@/components/brand/demo-video";
import { ReelFragment } from "@/components/brand/reel-fragment";
import { Reveal } from "@/components/motion/reveal";
import { demoSrc, presetCards } from "@/config/presets";
import { hero, howItWorks as c } from "@/content/landing";

const TAKE = {
  file: "listing-walkthrough.mov",
  meta: "42 s · 118 MB · 1080 × 1920",
  words: [
    ["Three", "0.42"],
    ["bedrooms,", "0.71"],
    ["east-facing", "1.30"],
    ["balcony,", "1.92"],
    ["one", "2.48"],
    ["crore", "2.66"],
    ["eighteen.", "2.95"],
  ],
  photos: [
    ["balcony-evening.jpg", "balcony"],
    ["kitchen-island.jpg", "kitchen"],
    ["floor-plan.png", "eighteen"],
  ],
  line: "Three bedrooms, east-facing balcony",
};

/**
 * How it works — "Call and response column". Three exchanges in one narrow column: what you give,
 * then what comes back, each as a true-size fragment of the product. The third response is the
 * finished reel and breaks out of the column.
 */
export function HowItWorks() {
  const preset = presetCards.find((p) => p.tokens.id === "mikku-royal") ?? presetCards[0]!;
  const [s1, s2, s3] = c.steps;
  return (
    <section id="how-it-works" className="section wrap scroll-mt-6">
      <div className="grid12">
        <div className="col-span-12 lg:col-start-4 lg:col-span-6">
          <h2 className="lead font-semibold leading-none tracking-[-0.03em]">{c.title}</h2>
          <p className="text-muted mt-2">{c.sub}</p>
        </div>

        {/* 1 · the take → timed words */}
        <Reveal as="div" className="col-span-12 mt-10 lg:col-start-4 lg:col-span-6">
          <p className="lead font-medium">{s1!.lead}</p>
          <p className="mt-2 max-w-[52ch]">{s1!.body}</p>
          <div data-ui className="panel mt-4 rounded-[8px] p-5">
            <div className="flex items-baseline justify-between gap-4 text-[14px]">
              <span className="font-medium">{TAKE.file}</span>
              <span className="text-muted">{TAKE.meta}</span>
            </div>
            <div className="mt-3 h-[4px] w-full rounded-[2px]" style={{ background: "var(--raised)" }}>
              <div className="h-full w-full rounded-[2px]" style={{ background: "var(--accent)" }} />
            </div>
            <p className="text-muted mt-2 text-[13px]">Uploaded · resumable if your network drops</p>
          </div>
          <div data-ui className="panel-raised mt-3 rounded-[8px] p-5 lg:ml-14">
            <p className="text-[13px] font-medium">Words, timed</p>
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-3 text-[14px]">
              {TAKE.words.map(([w, t], i) => (
                <li key={w} className="flex flex-col">
                  <span className={i === 3 ? "font-semibold underline decoration-[3px] underline-offset-4" : undefined} style={i === 3 ? { textDecorationColor: "var(--accent)" } : undefined}>
                    {w}
                  </span>
                  <span className="text-muted text-[12px] tabular-nums">{t} s</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* 2 · photos and a style → the plan */}
        <Reveal as="div" className="col-span-12 mt-16 lg:col-start-4 lg:col-span-6">
          <p className="lead font-medium">{s2!.lead}</p>
          <p className="mt-2 max-w-[52ch]">{s2!.body}</p>
          <div data-ui className="panel mt-4 grid grid-cols-[96px_1fr] gap-4 rounded-[8px] p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- the style's real demo poster */}
            <img
              src={demoSrc(preset.tokens.id, "jpg")}
              alt={`${preset.tokens.name} style`}
              loading="lazy"
              decoding="async"
              className="aspect-[9/16] w-full rounded-[6px] object-cover"
            />
            <div className="text-[14px]">
              <p className="font-medium">{preset.tokens.name}</p>
              <p className="text-muted">{preset.tokens.tagline}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {TAKE.photos.map(([f, w]) => (
                  <li key={f} className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span>{f}</span>
                    <span className="text-muted">
                      show when I say <span className="text-text font-medium">“{w}”</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ReelFragment
            tokens={preset.tokens}
            line={TAKE.line}
            lit={3}
            className="mt-3 w-full max-w-[360px] rounded-[8px] lg:ml-14"
          />
        </Reveal>

        {/* 3 · render → the finished reel (breaks out of the column) */}
        <Reveal as="div" className="col-span-12 mt-16 lg:col-start-4 lg:col-span-9">
          <div className="lg:max-w-[560px]">
            <p className="lead font-medium">{s3!.lead}</p>
            <p className="mt-2 max-w-[52ch]">{s3!.body}</p>
            <div data-ui className="panel mt-4 rounded-[8px] p-5 text-[14px]">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">Rendering final · 1080 × 1920</span>
                <span className="tabular-nums">73%</span>
              </div>
              <div className="mt-3 h-[4px] w-full rounded-[2px]" style={{ background: "var(--raised)" }}>
                <div className="h-full w-[73%] rounded-[2px]" style={{ background: "var(--accent)" }} />
              </div>
              <p className="text-muted mt-2 text-[13px]">Frames 1,240 of 1,700 · 2 min 31 s</p>
            </div>
          </div>
          <div data-ui className="panel-raised mt-3 grid gap-6 rounded-[8px] p-5 sm:grid-cols-[minmax(0,300px)_1fr] lg:ml-14">
            <DemoVideo
              className="aspect-[9/16] w-full max-w-[300px] overflow-clip rounded-[6px]"
              src={hero.demo.after}
              poster={hero.demo.afterPoster}
              alt={hero.demo.alt}
            />
            <div className="flex flex-col text-[14px]">
              <p className="font-medium">The finished reel</p>
              <p className="text-muted">A jewellery founder&apos;s 90-second take, rendered in Mikku Royal.</p>
              <ul className="mt-5 flex flex-col gap-3">
                <li className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    final_1080.mp4 <span className="text-muted">· 1080 × 1920 · H.264</span>
                  </span>
                  <a href={hero.demo.after} download className="button h-10 px-4 text-[14px]">
                    Download
                  </a>
                </li>
                <li className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Change a title, retime a photo <span className="text-muted">· click the word</span>
                  </span>
                  <a href="/dashboard" className="link font-medium">
                    Open the editor
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
