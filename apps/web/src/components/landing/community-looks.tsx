import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { communityLooks as c } from "@/content/landing";
import looks from "@/content/looks.json";

interface Look {
  owner: string;
  repo: string;
  title: string;
  description: string;
  url: string;
  license: string | null;
  video: string | null;
  poster: string;
}

/**
 * Looks from the open video-skills community (the awesome-claude-video-skills list): preview clips
 * of styles other code-video tools make. Shown with full credit and a link to each repo — these
 * are references for what Rasika adds next, not Rasika renders.
 */
export function CommunityLooks() {
  const items = looks as Look[];
  return (
    <Section id="looks" eyebrow={c.eyebrow} title={c.title} sub={c.sub}>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((l, i) => (
          <li key={`${l.owner}/${l.repo}`}>
            <Reveal delay={i * 0.04} className="h-full">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card hover:border-gold/50 group flex h-full flex-col overflow-hidden rounded-2xl border transition"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  {l.video ? (
                    <video
                      src={l.video}
                      poster={l.poster}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="none"
                      className="absolute inset-0 h-full w-full object-cover"
                      aria-hidden
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- third-party preview
                    <img
                      src={l.poster}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="poster text-lg leading-tight">{l.title}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">{l.description}</p>
                  <p className="kicker text-goldd dark:text-gold mt-auto pt-3 text-[0.55rem]">
                    {l.owner}/{l.repo}
                    {l.license ? ` · ${l.license}` : ""}
                  </p>
                </div>
              </a>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mx-auto mt-8 max-w-3xl text-center text-xs">{c.credit}</p>
    </Section>
  );
}
