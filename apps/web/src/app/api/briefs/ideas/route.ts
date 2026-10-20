import { z } from "zod";
import { BRIEF_KINDS, type BriefKindId } from "@/config/briefs";
import { requireApiUser } from "@/lib/auth";
import { briefIdeas } from "@/lib/brief-ideas";

const Body = z.object({
  kind: z.string().refine((k) => BRIEF_KINDS.some((x) => x.id === k)),
  idea: z.string().max(600).default(""),
});

/** Three filled-in briefs for a kind of film, from the user's rough idea or from nothing. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Claude is not set up on this workspace" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown kind of film" }, { status: 400 });
  try {
    const ideas = await briefIdeas(parsed.data.kind as BriefKindId, parsed.data.idea);
    if (!ideas.length) return Response.json({ error: "No ideas came back; try again" }, { status: 502 });
    return Response.json({ ideas });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No ideas" }, { status: 502 });
  }
}
