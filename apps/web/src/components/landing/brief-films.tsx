"use client";

import Link from "next/link";
import { useRef } from "react";
import { BRIEF_KINDS, type BriefKind } from "@/config/briefs";

/**
 * Films from a brief: no footage, just a link, a recipe, two names or a line. Each tile is a real
 * render of that kind (public/demo/briefs/<kind>.mp4, poster .jpg); hovering plays it. Each says
 * what you give and what you get, and opens the wizard on that kind.
 */
export function BriefFilms() {
  return (
    <section id="films" className="section wrap scroll-mt-6">
      <div className="grid12">
        <div className="col-span-12 lg:col-span-4">
          <h2 className="head">Films from a brief</h2>
          <p className="text-muted mt-3 max-w-[34ch]">
            No footage at all. Give us a website, a recipe, two contenders or a single line, and we write,
            score and design the whole film. Every clip here was made that way.
          </p>
        </div>
        <ul className="col-span-12 mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:col-start-5 lg:col-span-8 lg:mt-0 xl:grid-cols-4">
          {BRIEF_KINDS.map((k) => (
            <li key={k.id}>
              <FilmTile kind={k} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FilmTile({ kind }: { kind: BriefKind }) {
  const vid = useRef<HTMLVideoElement>(null);
  const src = `/demo/briefs/${kind.id}.mp4`;
  const play = () => {
    const v = vid.current;
    if (!v) return;
    if (!v.src) v.src = src;
    void v.play().catch(() => undefined);
  };
  const stop = () => {
    const v = vid.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };
  return (
    <Link
      href={`/dashboard/new?source=brief&kind=${kind.id}`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className="tile group flex h-full flex-col"
    >
      <div className="relative aspect-[9/16] w-full overflow-clip bg-[#111]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
        <img
          src={`/demo/briefs/${kind.id}.jpg`}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          ref={vid}
          poster={`/demo/briefs/${kind.id}.jpg`}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2">
        <span className="font-medium leading-snug">{kind.title}</span>
        <span className="text-muted small">
          <span className="text-text">You give:</span> {kind.youGive}
        </span>
      </div>
    </Link>
  );
}
