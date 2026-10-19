import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireApiUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { presignPut, storageKey } from "@/lib/storage/s3";
import { ACCEPTED_IMAGE, extensionFor } from "@/lib/upload/plan";

const Body = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["image", "thumbnail", "presenter_image"]),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().max(100),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

/** Single-PUT presigned upload for photos (≤ 15 per project) and the client-side thumbnail. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const b = parsed.data;
  if (b.size > env.maxImageBytes)
    return Response.json({ error: "Image too large" }, { status: 413 });
  if ((b.kind === "image" || b.kind === "presenter_image") && !ACCEPTED_IMAGE.includes(b.mime)) {
    return Response.json({ error: "Use JPG, PNG, WebP or HEIC" }, { status: 415 });
  }
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, b.projectId), eq(schema.projects.userId, user.id)));
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  if (b.kind === "image") {
    const existing = await db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(and(eq(schema.assets.projectId, b.projectId), eq(schema.assets.kind, "image")));
    if (existing.length >= 15)
      return Response.json({ error: "Up to 15 photos per reel" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const key =
    b.kind === "thumbnail"
      ? storageKey.thumbnail(user.id, b.projectId)
      : storageKey.image(user.id, b.projectId, id, extensionFor(b.filename, b.mime));
  await db.insert(schema.assets).values({
    id,
    projectId: b.projectId,
    userId: user.id,
    kind: b.kind,
    storageKey: key,
    filename: b.filename,
    mime: b.mime,
    sizeBytes: b.size,
    meta: { width: b.width, height: b.height },
  });
  if (b.kind === "thumbnail") {
    await db
      .update(schema.projects)
      .set({ thumbnailAssetId: id })
      .where(eq(schema.projects.id, b.projectId));
  }
  return Response.json({ assetId: id, url: await presignPut(key, b.mime) });
}

const Del = z.object({ assetId: z.string().uuid() });
export async function DELETE(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const parsed = Del.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  await db
    .delete(schema.assets)
    .where(
      and(
        eq(schema.assets.id, parsed.data.assetId),
        eq(schema.assets.userId, user.id),
        eq(schema.assets.kind, "image"),
      ),
    );
  return Response.json({ ok: true });
}
