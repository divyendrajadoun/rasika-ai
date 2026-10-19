"use client";

import { BRIEF_KINDS, briefKind, type BriefKindId } from "@/config/briefs";
import { allPresetCards } from "@/config/presets";
import { cn } from "@/lib/utils";

export interface BriefState {
  kind: BriefKindId;
  url: string;
  recipe: string;
  subject: string;
  a: string;
  b: string;
  winner: "" | "a" | "b";
  line: string;
  end: string;
}

export const defaultBriefState: BriefState = {
  kind: "launch",
  url: "",
  recipe: "",
  subject: "",
  a: "",
  b: "",
  winner: "",
  line: "",
  end: "",
};

/** The same rules the server applies (lib/wizard-schema.ts BriefSubmission). */
export function briefReady(b: BriefState): boolean {
  switch (b.kind) {
    case "launch":
    case "showreel":
    case "app":
      return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(b.url.trim());
    case "recipe":
      return b.recipe.trim().length >= 15;
    case "journey":
      return b.subject.trim().length >= 10;
    case "versus":
      return Boolean(b.a.trim() && b.b.trim());
    case "machine":
      return Boolean(b.line.trim());
  }
}

/**
 * Films made from a brief: pick the kind, then give exactly what that kind needs. Each card says
 * what you give and what you get, so the choice is the explanation.
 */
export function StepBrief({ value, onChange }: { value: BriefState; onChange: (v: BriefState) => void }) {
  const set = (patch: Partial<BriefState>) => onChange({ ...value, ...patch });
  const kind = briefKind(value.kind)!;
  const look = allPresetCards.find((c) => c.tokens.id === kind.preset)?.tokens;
  const pick = (id: BriefKindId) => {
    // a new kind starts from its example, unless the user already typed something for it
    const k = briefKind(id)!;
    const ex = k.example;
    onChange({
      ...value,
      kind: id,
      url: value.url || ex.url || "",
      recipe: value.recipe || ex.recipe || "",
      subject: value.subject || ex.subject || "",
      a: value.a || ex.a || "",
      b: value.b || ex.b || "",
      line: value.line || ex.line || "",
      end: value.end || ex.end || "",
    });
  };
  return (
    <div className="space-y-8">
      <p className="text-muted">
        No footage needed. Pick the kind of film; we write it, score it and design it, using only what you give us.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Kind of film">
        {BRIEF_KINDS.map((k) => {
          const on = k.id === value.kind;
          return (
            <li key={k.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(k.id)}
                className={cn(
                  "bg-surface flex h-full w-full flex-col gap-2 rounded-[8px] p-5 text-left transition-colors hover:bg-raised",
                  on && "ring-2 ring-text",
                )}
              >
                <span className="text-lg font-semibold leading-tight tracking-[-0.02em]">{k.title}</span>
                <span className="text-[14px]">{k.blurb}</span>
                <span className="text-muted text-[13px]">
                  <span className="text-text font-medium">You give:</span> {k.youGive}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="bg-surface space-y-5 rounded-[8px] p-5">
        <div>
          <p className="font-medium">{kind.title}</p>
          <p className="text-muted mt-1 text-[14px]">
            <span className="text-text font-medium">You get:</span> {kind.youGet}
          </p>
          {look && (
            <p className="text-muted mt-1 text-[14px]">
              <span className="text-text font-medium">The look:</span> {look.name}. {look.tagline}
            </p>
          )}
        </div>

        {kind.fields.map((f) => {
          if (f.id === "url")
            return (
              <div key="url">
                <label htmlFor="brief-url" className="label">
                  {f.label}
                </label>
                <input
                  id="brief-url"
                  type="url"
                  inputMode="url"
                  className="input"
                  placeholder={f.placeholder}
                  value={value.url}
                  onChange={(e) => set({ url: e.target.value })}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "recipe" || f.id === "subject")
            return (
              <div key={f.id}>
                <label htmlFor={`brief-${f.id}`} className="label">
                  {f.label}
                </label>
                <textarea
                  id={`brief-${f.id}`}
                  className="input min-h-28"
                  maxLength={f.id === "recipe" ? 1500 : 600}
                  placeholder={f.placeholder}
                  value={value[f.id]}
                  onChange={(e) => set({ [f.id]: e.target.value } as Partial<BriefState>)}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "contenders")
            return (
              <div key="contenders" className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="brief-a" className="label">
                    Red corner
                  </label>
                  <input id="brief-a" className="input" maxLength={40} value={value.a} onChange={(e) => set({ a: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="brief-b" className="label">
                    Blue corner
                  </label>
                  <input id="brief-b" className="input" maxLength={40} value={value.b} onChange={(e) => set({ b: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="brief-winner" className="label">
                    Who wins?
                  </label>
                  <select
                    id="brief-winner"
                    className="input"
                    value={value.winner}
                    onChange={(e) => set({ winner: e.target.value as BriefState["winner"] })}
                  >
                    <option value="">Let the story decide</option>
                    <option value="a">{value.a || "Red corner"}</option>
                    <option value="b">{value.b || "Blue corner"}</option>
                  </select>
                  <p className="text-muted mt-1 text-[13px]">
                    People, brands or ideas all work. It roasts what they do, never their looks or identity.
                  </p>
                </div>
              </div>
            );
          return (
            <div key="line" className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="brief-line" className="label">
                  The line that types out
                </label>
                <input id="brief-line" className="input" maxLength={60} value={value.line} onChange={(e) => set({ line: e.target.value })} />
              </div>
              <div>
                <label htmlFor="brief-end" className="label">
                  Closing words
                </label>
                <input id="brief-end" className="input" maxLength={30} value={value.end} onChange={(e) => set({ end: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
