"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { BriefKindId } from "@/config/briefs";

interface Idea {
  title: string;
  fields: Record<string, string>;
}

/**
 * No idea yet? Claude writes three briefs for this kind of film, from a rough idea or from nothing;
 * picking one fills the form below, where it can still be edited.
 */
export function BriefIdeas({
  kind,
  needsLink,
  onPick,
}: {
  kind: BriefKindId;
  /** link films: the user still gives the page; Claude writes the rest */
  needsLink: boolean;
  onPick: (fields: Record<string, string>) => void;
}) {
  const [idea, setIdea] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    setPicked(null);
    const r = await fetch("/api/briefs/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, idea }),
    });
    const j = (await r.json().catch(() => ({}))) as { ideas?: Idea[]; error?: string };
    if (!r.ok) setError(j.error ?? "No ideas came back; try again");
    setIdeas(j.ideas ?? []);
    setBusy(false);
  };

  return (
    <div className="bg-raised space-y-3 rounded-[8px] p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="text-accent mt-0.5 size-5 flex-none" aria-hidden />
        <div>
          <p className="font-semibold">No idea yet? Let Claude write the brief</p>
          <p className="text-muted text-[13px]">
            Type a rough idea, or leave it empty, and get three briefs to choose from. Picking one fills the form below;
            you can still change every word.{needsLink ? " You still give the link to your page." : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          maxLength={600}
          placeholder="Rough idea (optional): e.g. something for my bakery's Diwali week"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <button type="button" className="button" disabled={busy} onClick={() => void write()}>
          {busy ? "Writing…" : ideas.length ? "Three more" : "Write ideas for me"}
        </button>
      </div>
      {error && <p className="text-[13px] text-[var(--ter)]">{error}</p>}
      {ideas.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {ideas.map((it, i) => {
            const preview = Object.entries(it.fields)
              .filter(([k]) => k !== "winner")
              .map(([, v]) => v)
              .join(" · ");
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={picked === i}
                  onClick={() => {
                    setPicked(i);
                    onPick(it.fields);
                  }}
                  className={`bg-surface hover:bg-bg h-full w-full rounded-[8px] p-3 text-left transition-colors ${picked === i ? "ring-text ring-2" : ""}`}
                >
                  <span className="block font-semibold leading-tight">{it.title}</span>
                  <span className="text-muted mt-1 line-clamp-4 block text-[13px]">{preview}</span>
                  <span className="mt-2 block text-[13px] font-medium">{picked === i ? "Filled in below ✓" : "Use this"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
