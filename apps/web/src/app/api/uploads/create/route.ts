import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireApiUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createMultipart, storageKey } from "@/lib/storage/s3";
import { extensionFor, planParts } from "@/lib/upload/plan";

const Body = z.object({
  projectId: z.string().uuid().optional(),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().max(100),
});

/** Starts a resumable multipart upload for the source video (creates a draft project if needed). */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { filename, size, mime } = parsed.data;
  if (size > env.maxUploadBytes) {
    return Response.json(
      { error: `File is larger than ${env.maxUploadBytes / 1024 / 1024} MB` },
      { status: 413 },
    );
  }
  if (mime && !mime.startsWith("video/"))
    return Response.json({ error: "Please upload a video file" }, { status: 415 });

  let projectId = parsed.data.projectId;
  if (projectId) {
    const [p] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.id)));
    if (!p) return Response.json({ error: "Project not found" }, { status: 404 });
  } else {
    const [p] = await db
      .insert(schema.projects)
      .values({
        userId: user.id,
        title: filename.replace(/\.[^.]+$/, "").slice(0, 120) || "Untitled reel",
      })
      .returning({ id: schema.projects.id });
    projectId = p!.id;
  }

  const ext = extensionFor(filename, mime);
  const key = storageKey.source(user.id, projectId, ext);
  const uploadId = await createMultipart(key, mime || "application/octet-stream");
  const [asset] = await db
    .insert(schema.assets)
    .values({
      projectId,
      userId: user.id,
      kind: "source_video",
      storageKey: key,
      filename,
      mime: mime || "application/octet-stream",
      sizeBytes: size,
      meta: {},
    })
    .returning({ id: schema.assets.id });

  return Response.json({ projectId, assetId: asset!.id, key, uploadId, parts: planParts(size) });
}
