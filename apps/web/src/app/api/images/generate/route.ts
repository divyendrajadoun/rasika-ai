import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { AI_MAX, aiImagesEnabled, imageStatus, storeImage, submitImage } from "@/lib/ai-images";
import { requireApiUser } from "@/lib/auth";
import { presignGet, storageKey } from "@/lib/storage/s3";

async function ownProject(userId: string, projectId: string) {
  const [p] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
  return Boolean(p);
}

async function images(projectId: string) {
  return db
    .select({ id: schema.assets.id, meta: schema.assets.meta })
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, projectId), eq(schema.assets.kind, "image")));
}

const Post = z.object({ projectId: z.string().uuid(), prompt: z.string().trim().min(8).max(1200) });

/** Start one AI image (Higgsfield) for this project: returns the request to poll. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  if (!aiImagesEnabled()) return Response.json({ error: "AI images are not set up on this workspace" }, { status: 503 });
  const parsed = Post.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the picture in a sentence or two" }, { status: 400 });
  const { projectId, prompt } = parsed.data;
  if (!(await ownProject(user.id, projectId))) return Response.json({ error: "Project not found" }, { status: 404 });
  const imgs = await images(projectId);
  const ai = imgs.filter((i) => (i.meta as { source?: string } | null)?.source === "ai").length;
  if (ai >= AI_MAX) return Response.json({ error: `Up to ${AI_MAX} AI images per reel` }, { status: 409 });
  if (imgs.length >= 15) return Response.json({ error: "Up to 15 photos per reel" }, { status: 409 });
  try {
    return Response.json({ requestId: await submitImage(prompt) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}

const Get = z.object({ projectId: z.string().uuid(), requestId: z.string().uuid(), prompt: z.string().max(1200).default("") });

/** Poll a request; when it is done, keep the image as one of the project's photos. */
export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Get.safeParse(q);
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { projectId, requestId, prompt } = parsed.data;
  if (!(await ownProject(user.id, projectId))) return Response.json({ error: "Project not found" }, { status: 404 });
  // polled again after it finished: hand back the image already kept
  const kept = (await images(projectId)).find((i) => (i.meta as { requestId?: string } | null)?.requestId === requestId);
  if (kept) {
    const [a] = await db.select().from(schema.assets).where(eq(schema.assets.id, kept.id));
    return Response.json({ state: "done", assetId: kept.id, previewUrl: await presignGet(a!.storageKey) });
  }
  const st = await imageStatus(requestId);
  if (st.state !== "done") return Response.json(st);
  const id = crypto.randomUUID();
  const key = storageKey.image(user.id, projectId, id, "jpg");
  try {
    const size = await storeImage(st.url, key);
    await db.insert(schema.assets).values({
      id,
      projectId,
      userId: user.id,
      kind: "image",
      storageKey: key,
      filename: `ai-${id.slice(0, 8)}.jpg`,
      mime: "image/jpeg",
      sizeBytes: size,
      meta: { source: "ai", prompt, requestId, width: 960, height: 1696 },
    });
  } catch (e) {
    return Response.json({ state: "failed", reason: (e as Error).message });
  }
  return Response.json({ state: "done", assetId: id, previewUrl: await presignGet(key) });
}
