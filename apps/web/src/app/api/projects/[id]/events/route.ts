import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TERMINAL = new Set([
  "done",
  "failed",
  "canceled",
  "awaiting_transcript_review",
  "awaiting_shot_review",
  "awaiting_plan_review",
  "ready_preview",
]);

/** Server-Sent Events: the latest job status for a project, polled from Postgres every second. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)));
  if (!project) return new Response("Not found", { status: 404 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let last = "";
      let closed = false;
      req.signal.addEventListener("abort", () => (closed = true));
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // ~20 s per stream; the client reconnects (serverless functions are cut off after seconds)
      for (let i = 0; i < 20 && !closed; i++) {
        const [job] = await db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.projectId, id))
          .orderBy(desc(schema.jobs.createdAt))
          .limit(1);
        const [p] = await db
          .select({ status: schema.projects.status })
          .from(schema.projects)
          .where(eq(schema.projects.id, id));
        const payload = {
          status: job?.status ?? p?.status ?? "draft",
          progress: job?.progress ?? 0,
          message: job?.message ?? "",
          error: job?.error ?? null,
          type: job?.type ?? null,
          updatedAt: job?.updatedAt ?? null,
        };
        const key = JSON.stringify(payload);
        if (key !== last) {
          send(payload);
          last = key;
        }
        if (TERMINAL.has(payload.status)) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
