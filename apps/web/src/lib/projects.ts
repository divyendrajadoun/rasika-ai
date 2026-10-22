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
  const [transcript] = await db
    .select()
    .from(schema.transcripts)
    .where(eq(schema.transcripts.projectId, id))
    .orderBy(desc(schema.transcripts.version))
    .limit(1);
  const [plan] = await db
    .select({
      id: schema.editPlans.id,
      version: schema.editPlans.version,
      createdBy: schema.editPlans.createdBy,
      createdAt: schema.editPlans.createdAt,
      plan: schema.editPlans.plan,
    })
    .from(schema.editPlans)
    .where(eq(schema.editPlans.projectId, id))
    .orderBy(desc(schema.editPlans.version))
    .limit(1);
  return {
    project,
    assets: withUrls,
    job: job ?? null,
    transcript: transcript ?? null,
    plan: plan ?? null,
  };
}

export type ProjectAsset = AssetRow & { url: string };

/**
 * What the editor works on: the original take (every edit starts from it), the transcript that is
 * its own, the cuts the worker suggests and the words the current cut leaves out. Null while there
 * is no transcript of the original yet.
 */
export async function getEditor(projectId: string, assets: ProjectAsset[]) {
  const takes = assets
    .filter((a) => a.kind === "source_video")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const original = takes.find((a) => !a.meta.cleanCut);
  if (!original) return null;
  const cut = takes.find((a) => a.meta.cleanCut);
  let version = original.meta.transcriptVersion ?? (cut?.meta.userEdit ? cut.meta.transcriptOf : undefined);
  if (!version) {
    // takes from before the editor: the newest transcript written before the cut existed
    const rows = await db
      .select({ version: schema.transcripts.version, createdAt: schema.transcripts.createdAt })
      .from(schema.transcripts)
      .where(eq(schema.transcripts.projectId, projectId))
      .orderBy(desc(schema.transcripts.version));
    version = (cut ? rows.find((r) => r.createdAt < cut.createdAt) : rows[0])?.version;
  }
  if (!version) return null;
  const [t] = await db
    .select({ words: schema.transcripts.words, language: schema.transcripts.language })
    .from(schema.transcripts)
    .where(and(eq(schema.transcripts.projectId, projectId), eq(schema.transcripts.version, version)));
  if (!t || t.words.length === 0) return null;
  const removed = !cut
    ? []
    : cut.meta.userEdit
      ? cut.meta.transcriptOf === version
        ? (cut.meta.removedIdx ?? [])
        : []
      : (cut.meta.removed ?? []).map((r) => r.i);
  return {
    originalUrl: original.url,
    version,
    language: t.language,
    words: t.words,
    suggested: original.meta.suggestedCuts ?? [],
    removed,
    edited: Boolean(cut?.meta.userEdit),
    /** changes whenever a new cut lands (the editor starts again from it) */
    cutId: cut?.id ?? "none",
  };
}
export type EditorData = NonNullable<Awaited<ReturnType<typeof getEditor>>>;
