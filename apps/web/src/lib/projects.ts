import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { presignGet } from "@/lib/storage/s3";

export type ProjectRow = typeof schema.projects.$inferSelect;
export type AssetRow = typeof schema.assets.$inferSelect;
export type JobRow = typeof schema.jobs.$inferSelect;

export const ACTIVE_STATUSES = new Set([
  "uploaded",
  "probing",
  "transcribing",
  "planning",
  "rendering_preview",
  "rendering_final",
]);

export async function listProjects(userId: string) {
  const rows = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, userId), isNull(schema.projects.deletedAt)))
    .orderBy(desc(schema.projects.createdAt));
  const thumbIds = rows.map((r) => r.thumbnailAssetId).filter((x): x is string => Boolean(x));
  const thumbs = thumbIds.length
    ? await db.select().from(schema.assets).where(inArray(schema.assets.id, thumbIds))
    : [];
  const thumbByProject = new Map<string, string>();
  await Promise.all(
    thumbs.map(async (t) => thumbByProject.set(t.projectId, await presignGet(t.storageKey))),
  );
  const jobsLatest = rows.length
    ? await db
        .select()
        .from(schema.jobs)
        .where(
          inArray(
            schema.jobs.projectId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(desc(schema.jobs.createdAt))
    : [];
  const jobByProject = new Map<string, JobRow>();
  for (const j of jobsLatest) if (!jobByProject.has(j.projectId)) jobByProject.set(j.projectId, j);
  return rows.map((r) => ({
    ...r,
    thumbnailUrl: thumbByProject.get(r.id) ?? null,
    job: jobByProject.get(r.id) ?? null,
  }));
}

export async function getProject(userId: string, id: string) {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.userId, userId),
        isNull(schema.projects.deletedAt),
      ),
    );
  if (!project) return null;
  const assets = await db.select().from(schema.assets).where(eq(schema.assets.projectId, id));
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.projectId, id))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(1);
  const withUrls = await Promise.all(
    assets.map(async (a) => ({
      ...a,
      url: await presignGet(a.storageKey, a.kind.startsWith("output") ? a.filename : undefined),
    })),
  );
  return { project, assets: withUrls, job: job ?? null };
}
