import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireApiUser } from "@/lib/auth";
import {
  abortMultipart,
  completeMultipart,
  deleteObject,
  headObject,
  listUploadedParts,
  presignParts,
} from "@/lib/storage/s3";
import { planParts, remainingParts } from "@/lib/upload/plan";

type Ctx = { params: Promise<{ assetId: string }> };

async function ownedAsset(userId: string, assetId: string) {
  const [a] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.id, assetId), eq(schema.assets.userId, userId)));
  return a ?? null;
}

/** GET ?uploadId=… → which parts S3 already holds (for resume). */
export async function GET(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { assetId } = await params;
  const uploadId = new URL(req.url).searchParams.get("uploadId") ?? "";
  const asset = await ownedAsset(user.id, assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });
  if (await headObject(asset.storageKey))
    return Response.json({ complete: true, uploaded: [], remaining: [] });
  try {
    const uploaded = await listUploadedParts(asset.storageKey, uploadId);
    const plan = planParts(asset.sizeBytes);
    return Response.json({ complete: false, uploaded, remaining: remainingParts(plan, uploaded) });
  } catch {
    return Response.json({ error: "Upload session expired; start again" }, { status: 410 });
  }
}

const Action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    uploadId: z.string(),
    partNumbers: z.array(z.number().int().positive()).max(50),
  }),
  z.object({
    action: z.literal("complete"),
    uploadId: z.string(),
    meta: z
      .object({
        durationSec: z.number().positive().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .optional(),
  }),
  z.object({ action: z.literal("abort"), uploadId: z.string() }),
]);

/** POST {action: sign | complete | abort} */
export async function POST(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { assetId } = await params;
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const asset = await ownedAsset(user.id, assetId);
  if (!asset) return Response.json({ error: "Not found" }, { status: 404 });
  const body = parsed.data;

  if (body.action === "sign") {
    return Response.json({
      urls: await presignParts(asset.storageKey, body.uploadId, body.partNumbers),
    });
  }
  if (body.action === "abort") {
    await abortMultipart(asset.storageKey, body.uploadId);
    await db.delete(schema.assets).where(eq(schema.assets.id, asset.id));
    return Response.json({ ok: true });
  }
  // complete: trust S3's own part list (ETags); every planned part must be there, and the
  // finished object must be exactly the file's size (Supabase lists parts without sizes)
  const uploaded = await listUploadedParts(asset.storageKey, body.uploadId);
  const missing = remainingParts(planParts(asset.sizeBytes), uploaded);
  if (missing.length > 0) {
    return Response.json(
      { error: "Upload incomplete", missingParts: missing.map((p) => p.partNumber) },
      { status: 409 },
    );
  }
  await completeMultipart(asset.storageKey, body.uploadId, uploaded);
  const head = await headObject(asset.storageKey);
  if (!head || head.size !== asset.sizeBytes) {
    await deleteObject(asset.storageKey);
    return Response.json(
      { error: "Upload incomplete", uploadedBytes: head?.size ?? 0, expectedBytes: asset.sizeBytes },
      { status: 409 },
    );
  }
  const meta = { ...asset.meta, ...(body.meta ?? {}) };
  await db.update(schema.assets).set({ meta }).where(eq(schema.assets.id, asset.id));
  if (body.meta?.durationSec && asset.kind === "source_video") {
    await db
      .update(schema.projects)
      .set({ durationSec: body.meta.durationSec, updatedAt: schema.now })
      .where(eq(schema.projects.id, asset.projectId));
  }
  return Response.json({ ok: true, assetId: asset.id, projectId: asset.projectId });
}
