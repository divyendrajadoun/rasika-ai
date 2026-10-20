import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { BRIEF_GROUPS, BRIEF_KINDS } from "@/config/briefs";
import { PRESET_HOW_TO, demoSrc, presetCards } from "@/config/presets";

/** The ways to start, every film kind and the looks that need something from you, one click each. */
const STARTS = [
  {
    href: "/dashboard/new?source=take",
    title: "My video",
    give: "A talking clip you recorded.",
    get: "Poster type, word-timed captions, your photos on the word, sound. Clean cut and Hook first on the style step.",
  },
  {
    href: "/dashboard/new?source=reference",
    title: "Match a reference",
    give: "Your clip and a reel whose style you like.",
    get: "Your clip edited in that reel's look: its type, colours, pace and framing.",
  },
  {
    href: "/dashboard/new?source=script",
    title: "Script only",
    give: "A script you type.",
    get: "A narrated reel with no camera at all.",
  },
  {
    href: "/dashboard/new?source=presenter",
    title: "AI presenter",
    give: "A script and a photo or a stock look.",
    get: "An avatar speaks your script, then the reel is edited around it.",
  },
];

/** A demo poster exists for this film kind (public/demo/briefs/<kind>.jpg). */
function poster(kind: string): string | null {
  const file = path.join(process.cwd(), "public", "demo", "briefs", `${kind}.jpg`);
  return existsSync(file) ? `/demo/briefs/${kind}.jpg` : null;
}

export function TryGallery() {
  const looks = presetCards.filter((c) => PRESET_HOW_TO[c.tokens.id]);
  return (
    <section aria-labelledby="try-heading" className="mt-14 space-y-10">
      <div>
        <h2 id="try-heading" className="text-xl font-semibold leading-tight tracking-[-0.02em]">
          Try something new
        </h2>
        <p className="text-muted mt-1 text-[14px]">Every way to make a reel. Each card says what you give and what you get.</p>
      </div>

      <div>
        <h3 className="font-semibold">Start from footage or a script</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STARTS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="bg-surface hover:bg-raised flex h-full flex-col gap-2 rounded-[8px] p-5 transition-colors">
                <span className="font-semibold">{s.title}</span>
                <span className="text-muted text-[13px]">
                  <span className="text-text font-medium">You give:</span> {s.give}
                </span>
                <span className="text-muted text-[13px]">
                  <span className="text-text font-medium">You get:</span> {s.get}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {BRIEF_GROUPS.map((g) => (
        <div key={g.id}>
          <h3 className="font-semibold">Films {g.title.charAt(0).toLowerCase() + g.title.slice(1)}</h3>
          <p className="text-muted text-[13px]">{g.blurb}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BRIEF_KINDS.filter((k) => k.group === g.id).map((k) => {
              const img = poster(k.id);
              return (
                <li key={k.id}>
                  <Link
                    href={`/dashboard/new?source=brief&kind=${k.id}`}
                    className="bg-surface hover:bg-raised flex h-full flex-col overflow-hidden rounded-[8px] transition-colors"
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element -- static demo poster
                      <img src={img} alt="" loading="lazy" className="aspect-[9/10] w-full object-cover object-top" />
                    )}
                    <span className="flex flex-1 flex-col gap-2 p-5">
                      <span className="font-semibold">{k.title}</span>
                      <span className="text-[13px]">{k.blurb}</span>
                      <span className="text-muted text-[13px]">
                        <span className="text-text font-medium">You give:</span> {k.youGive}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div>
        <h3 className="font-semibold">Looks that need something from you</h3>
        <p className="text-muted text-[13px]">
          Any of the {presetCards.length} styles works on a talking clip; these work best when you give them a little more.
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {looks.map((c) => (
            <li key={c.tokens.id}>
              <Link
                href={`/dashboard/new?source=take&style=${c.tokens.id}`}
                className="bg-surface hover:bg-raised flex h-full flex-col overflow-hidden rounded-[8px] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
                <img src={demoSrc(c.tokens.id, "jpg")} alt="" loading="lazy" className="aspect-[9/10] w-full object-cover object-top" />
                <span className="flex flex-1 flex-col gap-2 p-5">
                  <span className="font-semibold">{c.tokens.name}</span>
                  <span className="text-muted text-[13px]">{PRESET_HOW_TO[c.tokens.id]!.steps[0]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
