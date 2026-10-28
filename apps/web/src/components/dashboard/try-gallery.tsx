import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { BRIEF_GROUPS, BRIEF_KINDS } from "@/config/briefs";
import { PRESET_HOW_TO, demoSrc, presetCards } from "@/config/presets";

/**
 * Every way to make a reel, sorted by what the person wants to make: films that need no filming
 * first (each section says what you give), then the ones with a person on screen, then the looks
 * for a talking clip.
 */

/** No footage and no brief: the person's own script, voiced and drawn. */
const SCRIPT = {
  href: "/dashboard/new?source=script",
  title: "Voice my script",
  blurb: "Paste a script you wrote. A voice reads it and the whole film is drawn around it.",
  give: "Your script",
};

/** Reels with a person on screen: a video the person filmed, or an AI presenter. */
const PERSON = [
  {
    href: "/dashboard/new?source=take",
    title: "Edit my video",
    blurb: "One talking clip. Captions on every word, big type, your photos on the word, sound.",
    give: "A clip of you talking",
  },
  {
    href: "/dashboard/new?source=messy",
    title: "Clean up one messy video",
    blurb: "Already joined in VN or CapCut? We cut the ums, bad takes and pauses, then style it.",
    give: "One joined video",
  },
  {
    href: "/dashboard/new?source=clips",
    title: "Join many clips",
    blurb: "Every clip you shot: we keep the best take of each line and put them in order.",
    give: "All your clips",
  },
  {
    href: "/dashboard/new?source=reference",
    title: "Copy a reel's style",
    blurb: "Your clip, edited with the pace, type and colours of a reel you like.",
    give: "Your clip and a reel you like",
  },
  {
    href: "/dashboard/new?source=presenter",
    title: "AI presenter",
    blurb: "No camera: an AI person speaks your script, then it's edited like a video of you.",
    give: "A script and a photo or a stock look",
  },
];

/** A demo poster exists for this film kind (public/demo/briefs/<kind>.jpg). */
function poster(kind: string): string | null {
  const file = path.join(process.cwd(), "public", "demo", "briefs", `${kind}.jpg`);
  return existsSync(file) ? `/demo/briefs/${kind}.jpg` : null;
}

function Card({
  href,
  title,
  blurb,
  img,
}: {
  href: string;
  title: string;
  blurb: string;
  img?: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="bg-surface hover:bg-raised flex h-full flex-col overflow-hidden rounded-[8px] transition-colors"
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element -- static demo poster
          <img
            src={img}
            alt=""
            loading="lazy"
            className="aspect-[9/10] w-full object-cover object-top"
          />
        )}
        <span className="flex flex-1 flex-col gap-1.5 p-4">
          <span className="font-semibold leading-tight">{title}</span>
          <span className="text-muted text-[13px]">{blurb}</span>
        </span>
      </Link>
    </li>
  );
}

function Section({
  id,
  title,
  give,
  blurb,
  children,
}: {
  id: string;
  title: string;
  give?: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`${id}-h`} className="text-lg font-semibold tracking-[-0.02em]">
          {title}
        </h3>
        {give && (
          <span className="bg-surface rounded-full px-2.5 py-0.5 text-[12px] font-medium">
            You give: {give.toLowerCase()}
          </span>
        )}
      </div>
      <p className="text-muted mt-1 text-[14px]">{blurb}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</ul>
    </section>
  );
}

export function TryGallery() {
  const looks = presetCards.filter((c) => PRESET_HOW_TO[c.tokens.id]);
  const jumps = [
    ...BRIEF_GROUPS.map((g) => ({ id: `try-${g.id}`, title: g.title })),
    { id: "try-script", title: "Voice my script" },
    { id: "try-person", title: "A person on screen" },
    { id: "try-looks", title: "Looks for your video" },
  ];
  return (
    <section aria-labelledby="try-heading" className="mt-14 space-y-10">
      <div>
        <h2 id="try-heading" className="text-xl font-semibold leading-tight tracking-[-0.02em]">
          What do you want to make?
        </h2>
        <p className="text-muted mt-1 text-[14px]">
          Pick what you want, give what it asks for, and we make the rest. Tap a card to start.
        </p>
        <nav aria-label="Jump to" className="mt-4 flex flex-wrap gap-2">
          {jumps.map((j) => (
            <a
              key={j.id}
              href={`#${j.id}`}
              className="bg-surface hover:bg-raised inline-flex h-9 items-center rounded-full px-3.5 text-[13px] transition-colors"
            >
              {j.title}
            </a>
          ))}
        </nav>
      </div>

      <div className="space-y-10">
        <p className="text-muted border-line border-b pb-2 text-[12px] font-medium uppercase tracking-[0.08em]">
          No filming needed
        </p>
        {BRIEF_GROUPS.map((g) => (
          <Section key={g.id} id={`try-${g.id}`} title={g.title} give={g.give} blurb={g.blurb}>
            {BRIEF_KINDS.filter((k) => k.group === g.id).map((k) => (
              <Card
                key={k.id}
                href={`/dashboard/new?source=brief&kind=${k.id}`}
                title={k.title}
                blurb={k.blurb}
                img={poster(k.id)}
              />
            ))}
          </Section>
        ))}
        <Section
          id="try-script"
          title="Voice my script"
          give={SCRIPT.give}
          blurb="Already wrote what you want to say? Paste it and pick a style."
        >
          <Card href={SCRIPT.href} title={SCRIPT.title} blurb={SCRIPT.blurb} />
        </Section>
      </div>

      <div className="space-y-10">
        <p className="text-muted border-line border-b pb-2 text-[12px] font-medium uppercase tracking-[0.08em]">
          With a person on screen
        </p>
        <Section
          id="try-person"
          title="A person on screen"
          blurb="You filmed yourself, or an AI presenter speaks for you. Each card says what to upload."
        >
          {PERSON.map((p) => (
            <Card
              key={p.href}
              href={p.href}
              title={p.title}
              blurb={`${p.blurb} You give: ${p.give.toLowerCase()}.`}
            />
          ))}
        </Section>
        <Section
          id="try-looks"
          title="Looks for your video"
          give="A clip of you talking"
          blurb={`Any of the ${presetCards.length} looks works on a talking clip; these work best when you give them a little more.`}
        >
          {looks.map((c) => (
            <Card
              key={c.tokens.id}
              href={`/dashboard/new?source=take&style=${c.tokens.id}`}
              title={c.tokens.name}
              blurb={PRESET_HOW_TO[c.tokens.id]!.steps[0]!}
              img={demoSrc(c.tokens.id, "jpg")}
            />
          ))}
        </Section>
      </div>
    </section>
  );
}
