"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/queue";
import { WizardSubmission, creditCost } from "@/lib/wizard-schema";

export type ActionResult = { ok: true; projectId: string } | { ok: false; error: string };

/** "Create my edit": finalises the project and enqueues the first pipeline job. */
export async function createEdit(input: unknown): Promise<ActionResult> {
  const user = await requireUser("/dashboard/new");
  const parsed = WizardSubmission.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const w = parsed.data;

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, w.projectId), eq(schema.projects.userId, user.id)));
  if (!project) return { ok: false, error: "Project not found" };
  const [source] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.id, w.sourceAssetId), eq(schema.assets.projectId, w.projectId)));
  if (!source || source.kind !== "source_video")
    return { ok: false, error: "Upload the reel first" };

  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  if (w.durationSec > plan.maxSeconds) {
    return {
      ok: false,
      error: `Your ${plan.name} plan allows reels up to ${plan.maxSeconds} s. This one is ${Math.round(w.durationSec)} s.`,
    };
  }
  const cost = creditCost(w.durationSec);
  if (user.credits < cost)
    return { ok: false, error: `This edit needs ${cost} credit(s); you have ${user.credits}.` };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.projects)
      .set({
        title: w.title,
        status: "uploaded",
        stylePreset: w.stylePreset,
        styleText: w.styleText || null,
        styleOptions: w.options,
        brand: w.brand,
        durationSec: w.durationSec,
        creditsCost: cost,
        updatedAt: schema.now,
      })
      .where(eq(schema.projects.id, w.projectId));
    for (const [i, ph] of w.photos.entries()) {
      await tx
        .update(schema.assets)
        .set({ meta: { label: ph.label, sayWhen: ph.sayWhen, crop: ph.crop, order: i } })
        .where(and(eq(schema.assets.id, ph.assetId), eq(schema.assets.projectId, w.projectId)));
    }
    const [job] = await tx
      .insert(schema.jobs)
      .values({
        projectId: w.projectId,
        userId: user.id,
        type: "probe",
        status: "uploaded",
        message: "Queued",
      })
      .returning({ id: schema.jobs.id });
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_edit",
      entity: "project",
      entityId: w.projectId,
      meta: { cost, preset: w.stylePreset, photos: w.photos.length },
    });
    await enqueueJob({
      job_id: job!.id,
      project_id: w.projectId,
      user_id: user.id,
      type: "probe",
      payload: { source_key: source.storageKey, language_hint: w.options.language },
    });
  });
  revalidatePath("/dashboard");
  return { ok: true, projectId: w.projectId };
}

export async function deleteProject(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db
    .update(schema.projects)
    .set({ deletedAt: schema.now, status: "canceled" })
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)));
  await db
    .insert(schema.auditLog)
    .values({ userId: user.id, action: "project.delete", entity: "project", entityId: id });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function duplicateProject(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const [p] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)));
  if (!p) redirect("/dashboard");
  const assets = await db.select().from(schema.assets).where(eq(schema.assets.projectId, id));
  const newId = await db.transaction(async (tx) => {
    const [n] = await tx
      .insert(schema.projects)
      .values({
        userId: user.id,
        title: `${p.title} (copy)`,
        status: "draft",
        stylePreset: p.stylePreset,
        styleText: p.styleText,
        styleOptions: p.styleOptions,
        brand: p.brand,
        durationSec: p.durationSec,
        creditsCost: p.creditsCost,
      })
      .returning({ id: schema.projects.id });
    for (const a of assets) {
      if (a.kind === "source_video" || a.kind === "image" || a.kind === "thumbnail") {
        const [na] = await tx
          .insert(schema.assets)
          .values({ ...a, id: undefined, projectId: n!.id, createdAt: undefined })
          .returning({ id: schema.assets.id, kind: schema.assets.kind });
        if (na?.kind === "thumbnail")
          await tx
            .update(schema.projects)
            .set({ thumbnailAssetId: na.id })
            .where(eq(schema.projects.id, n!.id));
      }
    }
    return n!.id;
  });
  revalidatePath("/dashboard");
  redirect(`/dashboard/p/${newId}`);
}
