import "server-only";
import { briefKind, type BriefKindId } from "@/config/briefs";

/**
 * "Write it for me" on the brief step: Claude turns a rough idea (or nothing) into three filled-in
 * briefs for the chosen kind of film. Only the kind's own fields come back; a website link is never
 * invented (the user gives it), so link films get their focus and closing lines written instead.
 */

/** the brief fields each form field fills, with their length caps (lib/wizard-schema.ts) */
const FILLS: Record<string, Record<string, number>> = {
  recipe: { recipe: 1500 },
  subject: { subject: 600 },
  topic: { topic: 600 },
  contenders: { a: 40, b: 40, winner: 1 },
  line: { line: 60, end: 30 },
  focus: { focus: 400 },
  closing: { closeLine: 60, closeTail: 40 },
};

export interface BriefIdea {
  title: string;
  fields: Record<string, string>;
}

export async function briefIdeas(kindId: BriefKindId, idea: string): Promise<BriefIdea[]> {
  const kind = briefKind(kindId);
  if (!kind) return [];
  const caps: Record<string, number> = {};
  const asks: string[] = [];
  for (const f of kind.fields) {
    const fills = FILLS[f.id];
    if (!fills) continue;
    Object.assign(caps, fills);
    const about = "label" in f ? `${f.label}. ${"help" in f ? f.help : ""}` : f.id;
    for (const [key, cap] of Object.entries(fills)) {
      asks.push(
        key === "winner"
          ? `- "winner": "a", "b" or "" (who wins the fight)`
          : `- "${key}": ≤ ${cap} characters — ${about}`,
      );
    }
  }
  if (!asks.length) return [];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5",
      max_tokens: 4000,
      system:
        `You write briefs for short vertical films of one kind: "${kind.title}" — ${kind.blurb} The film: ${kind.youGet}\n` +
        "Write THREE different briefs, each a distinct, specific, scroll-stopping idea (not three versions of one). " +
        "If the user gives a rough idea, all three develop it in different directions; if not, pick ideas that suit this kind of film and a wide audience. " +
        "Facts must be true; never invent a company's claims, prices or numbers. No real private people; public figures and brands only as subjects of fair, friendly fun. " +
        'Return ONE JSON object: {"ideas":[{"title":"≤ 6 words","fields":{…}}]} where fields has exactly these keys:\n' +
        asks.join("\n"),
      messages: [{ role: "user", content: idea.trim() ? `## My rough idea\n\n${idea.slice(0, 600)}` : "I have no idea yet. Surprise me." }],
    }),
  });
  if (!r.ok) throw new Error(`Claude could not write ideas (${r.status})`);
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[] };
  const m = (j.content ?? []).map((b) => b.text ?? "").join("").match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]) as { ideas?: { title?: string; fields?: Record<string, unknown> }[] };
    return (parsed.ideas ?? []).slice(0, 3).map((x) => {
      const fields: Record<string, string> = {};
      for (const [key, cap] of Object.entries(caps)) {
        const v = String(x.fields?.[key] ?? "").trim();
        if (key === "winner") fields.winner = v === "a" || v === "b" ? v : "";
        else if (v) fields[key] = v.slice(0, cap);
      }
      return { title: String(x.title ?? "Idea").slice(0, 60), fields };
    });
  } catch {
    return [];
  }
}
