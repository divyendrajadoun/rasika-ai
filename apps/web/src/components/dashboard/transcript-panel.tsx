import type { schema } from "@/db";

type TranscriptRow = typeof schema.transcripts.$inferSelect;

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

/** Read-only transcript with word timestamps (the editable review step is Phase 5). */
export function TranscriptPanel({ transcript }: { transcript: TranscriptRow }) {
  const words = transcript.words;
  const lang =
    transcript.language === "hi"
      ? "Hindi"
      : transcript.language === "en"
        ? "English"
        : transcript.language;
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em]">Transcript</h2>
        <p className="text-muted-foreground text-[13px]">
          {words.length} words · {lang} · v{transcript.version}
        </p>
      </div>
      <details className="bg-surface mt-4 rounded-[8px] p-4" open>
        <summary className="cursor-pointer text-sm">Every word, timed</summary>
        <p className="mt-3 leading-8">
          {words.map((w, i) => (
            <span key={i} title={fmt(w.t)} className="hover:text-accent mr-[0.3em] inline-block">
              {w.w}
            </span>
          ))}
        </p>
      </details>
    </section>
  );
}
