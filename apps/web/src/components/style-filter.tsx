"use client";

import { useMemo, useState } from "react";
import { FAMILY_LABEL, type PresetCard } from "@/config/presets";
import { cn } from "@/lib/utils";

type Family = PresetCard["tokens"]["motion"]["family"];
export type FamilyPick = "all" | Family;

/** Family chips + free-text search over the style cards (wizard and landing share it). */
export function useStyleFilter(cards: readonly PresetCard[]) {
  const [family, setFamily] = useState<FamilyPick>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => {
    const m = new Map<Family, number>();
    for (const c of cards) m.set(c.tokens.motion.family, (m.get(c.tokens.motion.family) ?? 0) + 1);
    return m;
  }, [cards]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (family !== "all" && c.tokens.motion.family !== family) return false;
      if (!q) return true;
      const hay = `${c.tokens.name} ${c.tokens.tagline} ${FAMILY_LABEL[c.tokens.motion.family]}`;
      return hay.toLowerCase().includes(q);
    });
  }, [cards, family, query]);
  return { family, setFamily, query, setQuery, counts, filtered };
}

/** Flat filled chips: the chosen one in ink, the rest one tone off the ground. */
export function FamilyChips({
  counts,
  total,
  value,
  onChange,
}: {
  counts: Map<Family, number>;
  total: number;
  value: FamilyPick;
  onChange: (f: FamilyPick) => void;
  /** kept for callers; the chips take their colours from the theme now */
  tone?: "light" | "dark";
}) {
  const families = (Object.keys(FAMILY_LABEL) as Family[]).filter((f) => counts.has(f));
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 px-3 text-[14px] transition-colors duration-150",
      on ? "bg-text text-bg" : "bg-surface text-text hover:bg-raised",
    );
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter styles by motion family">
      <button type="button" role="tab" aria-selected={value === "all"} className={chip(value === "all")} onClick={() => onChange("all")}>
        All <span className="opacity-60">{total}</span>
      </button>
      {families.map((f) => (
        <button key={f} type="button" role="tab" aria-selected={value === f} className={chip(value === f)} onClick={() => onChange(f)}>
          {FAMILY_LABEL[f]} <span className="opacity-60">{counts.get(f)}</span>
        </button>
      ))}
    </div>
  );
}
