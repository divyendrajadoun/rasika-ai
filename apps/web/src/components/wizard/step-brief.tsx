"use client";

import { BRIEF_GROUPS, BRIEF_KINDS, briefKind, type BriefKindId } from "@/config/briefs";
import { allPresetCards } from "@/config/presets";
import { cn } from "@/lib/utils";

export interface BriefState {
  kind: BriefKindId;
  url: string;
  recipe: string;
  subject: string;
  topic: string;
  a: string;
  b: string;
  winner: "" | "a" | "b";
  line: string;
  end: string;
  focus: string;
  seconds: string;
  closeLine: string;
  closeTail: string;
}

export const defaultBriefState: BriefState = {
  kind: "launch",
  url: "",
  recipe: "",
  subject: "",
  topic: "",
  a: "",
  b: "",
  winner: "",
  line: "",
  end: "",
  focus: "",
  seconds: "",
  closeLine: "",
  closeTail: "",
};

const BRIEF_EXAMPLE_TOPICS = Object.fromEntries(
  BRIEF_KINDS.filter((k) => k.example.topic).map((k) => [k.id, k.example.topic!]),
);

/** The same rules the server applies (lib/wizard-schema.ts BriefSubmission). */
export function briefReady(b: BriefState): boolean {
  switch (b.kind) {
    case "launch":
    case "showreel":
    case "app":
    case "product":
    case "referral":
    case "hype":
      return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(b.url.trim());
    case "flyover":
      return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(b.url.trim()) && Boolean(b.closeLine.trim());
    case "diagram":
      return b.topic.trim().length >= 6;
    case "recipe":
      return b.recipe.trim().length >= 15;
    case "journey":
      return b.subject.trim().length >= 10;
    case "explainer":
    case "editorial":
    case "tierlist":
      return b.topic.trim().length >= 6;
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
      // each topic kind starts from its own example unless the user typed one for another topic kind
      topic: value.topic && !Object.values(BRIEF_EXAMPLE_TOPICS).includes(value.topic) ? value.topic : ex.topic || "",
      a: value.a || ex.a || "",
      b: value.b || ex.b || "",
      line: value.line || ex.line || "",
      end: value.end || ex.end || "",
      focus: value.focus,
      seconds: ex.seconds || "",
      closeLine: value.closeLine || ex.closeLine || "",
      closeTail: value.closeTail || ex.closeTail || "",
    });
  };
  return (
    <div className="space-y-8">
      <p className="text-muted">
        No footage needed. Pick the kind of film; we write it, score it and design it, using only what you give us.
      </p>
      {BRIEF_GROUPS.map((g) => (
      <section key={g.id} aria-label={g.title}>
      <h3 className="text-lg font-semibold tracking-[-0.02em]">{g.title}</h3>
      <p className="text-muted mb-3 text-[14px]">{g.blurb}</p>
      <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={g.title}>
        {BRIEF_KINDS.filter((k) => k.group === g.id).map((k) => {
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
      </section>
      ))}

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
          if (f.id === "recipe" || f.id === "subject" || f.id === "topic")
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
          if (f.id === "focus")
            return (
              <div key="focus">
                <label htmlFor="brief-focus" className="label">
                  {f.label}
                </label>
                <textarea
                  id="brief-focus"
                  className="input min-h-20"
                  maxLength={400}
                  placeholder={f.placeholder}
                  value={value.focus}
                  onChange={(e) => set({ focus: e.target.value })}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "seconds")
            return (
              <div key="seconds">
                <label htmlFor="brief-seconds" className="label">
                  Length
                </label>
                <select
                  id="brief-seconds"
                  className="input"
                  value={value.seconds}
                  onChange={(e) => set({ seconds: e.target.value })}
                >
                  <option value="">The usual ({kind.maxSeconds <= 16 ? 15 : Math.round((kind.maxSeconds - 2) / 10) * 10} s)</option>
                  {f.options.map((o) => (
                    <option key={o} value={String(o)}>
                      {o} seconds
                    </option>
                  ))}
                </select>
              </div>
            );
          if (f.id === "closing")
            return (
              <div key="closing" className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="brief-close" className="label">
                    Closing statement
                  </label>
                  <input id="brief-close" className="input" maxLength={60} value={value.closeLine} onChange={(e) => set({ closeLine: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="brief-tail" className="label">
                    Italic tail (short)
                  </label>
                  <input id="brief-tail" className="input" maxLength={40} value={value.closeTail} onChange={(e) => set({ closeTail: e.target.value })} />
                </div>
                <p className="text-muted text-[13px] sm:col-span-2">
                  The two lines appear word by word on the end card, the tail in an italic serif. Your logo is taken from the page; your brand name comes from the Brand step.
                </p>
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
