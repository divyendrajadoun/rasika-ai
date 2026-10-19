import { z } from "zod";
import { AI_MAX, aiImagesEnabled, suggestPrompts } from "@/lib/ai-images";
import { requireApiUser } from "@/lib/auth";

const Body = z.object({
  script: z.string().trim().min(20).max(6000),
  n: z.number().int().min(1).max(AI_MAX).default(4),
  style: z.string().max(200).default(""),
});

/** Image prompts written from the user's script, for them to edit before anything is drawn. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  if (!aiImagesEnabled()) return Response.json({ error: "AI images are not set up on this workspace" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "The script is too short" }, { status: 400 });
  const moments = await suggestPrompts(parsed.data.script, parsed.data.n, parsed.data.style);
  return Response.json({ moments });
}
