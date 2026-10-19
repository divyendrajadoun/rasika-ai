"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/queue";
import { briefKind } from "@/config/briefs";

/** Photo settings from the wizard merge into what the asset already records (an AI image keeps its
 *  source and prompt, every image its size) instead of replacing it. */
const mergeMeta = (patch: Record<string, unknown>) =>
  sql`${schema.assets.meta} || ${JSON.stringify(patch)}::jsonb` as unknown as schema.AssetMeta;
import {
  BriefSubmission,
  PresenterSubmission,
  ScriptSubmission,
  WizardSubmission,
  creditCost,
  estimateSpokenSeconds,
} from "@/lib/wizard-schema";

/** A reference edit is written over this neutral preset (apps/worker pipeline.REFERENCE_BASE_PRESET). */
const REFERENCE_BASE_PRESET = "ghost-clean";

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
  if (w.referenceAssetId) {
    const [ref] = await db
      .select({ kind: schema.assets.kind })
      .from(schema.assets)
      .where(
        and(eq(schema.assets.id, w.referenceAssetId), eq(schema.assets.projectId, w.projectId)),
      );
    if (!ref || ref.kind !== "reference_video")
      return { ok: false, error: "Upload the reference reel first" };
  }

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
        stylePreset: w.referenceAssetId ? REFERENCE_BASE_PRESET : w.stylePreset,
        styleText: w.styleText || null,
        styleOptions: w.referenceAssetId
          ? { ...w.options, source: "reference", fidelity: w.fidelity }
          : { ...w.options, source: "take" },
        brand: w.brand,
        durationSec: w.durationSec,
        creditsCost: cost,
        updatedAt: schema.now,
      })
      .where(eq(schema.projects.id, w.projectId));
    for (const [i, ph] of w.photos.entries()) {
      await tx
        .update(schema.assets)
        .set({ meta: mergeMeta({ label: ph.label, sayWhen: ph.sayWhen, crop: ph.crop, order: i }) })
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
      payload: {
        source_key: source.storageKey,
        language_hint: w.options.language,
        max_duration_sec: plan.maxSeconds,
      },
    });
  });
  revalidatePath("/dashboard");
  return { ok: true, projectId: w.projectId };
}

/** Script-only reels need a project before the photos step (images upload against a project id). */
export async function createDraftProject(title: string): Promise<ActionResult> {
  const user = await requireUser("/dashboard/new");
  const clean = String(title || "Untitled reel")
    .trim()
    .slice(0, 120);
  const [p] = await db
    .insert(schema.projects)
    .values({ userId: user.id, title: clean || "Untitled reel" })
    .returning({ id: schema.projects.id });
  return { ok: true, projectId: p!.id };
}

/** "Create my edit" for a script-only reel: enqueue the narration job; it hands off to probe. */
export async function createScriptEdit(input: unknown): Promise<ActionResult> {
  const user = await requireUser("/dashboard/new");
  const parsed = ScriptSubmission.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const w = parsed.data;

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, w.projectId), eq(schema.projects.userId, user.id)));
  if (!project) return { ok: false, error: "Project not found" };

  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  const est = estimateSpokenSeconds(w.script);
  if (est > plan.maxSeconds) {
    return {
      ok: false,
      error: `Spoken, this script runs about ${Math.round(est)} s; your ${plan.name} plan allows ${plan.maxSeconds} s.`,
    };
  }
  const cost = creditCost(Math.max(1, est));
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
        styleOptions: { ...w.options, language: "en", source: "script", faceless: true, voice: w.voice },
        brand: w.brand,
        durationSec: Math.round(est),
        creditsCost: cost,
        updatedAt: schema.now,
      })
      .where(eq(schema.projects.id, w.projectId));
    for (const [i, ph] of w.photos.entries()) {
      await tx
        .update(schema.assets)
        .set({ meta: mergeMeta({ label: ph.label, sayWhen: ph.sayWhen, crop: ph.crop, order: i }) })
        .where(and(eq(schema.assets.id, ph.assetId), eq(schema.assets.projectId, w.projectId)));
    }
    const [job] = await tx
      .insert(schema.jobs)
      .values({
        projectId: w.projectId,
        userId: user.id,
        type: "synth",
        status: "uploaded",
        message: "Queued",
      })
      .returning({ id: schema.jobs.id });
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_script_edit",
      entity: "project",
      entityId: w.projectId,
      meta: { cost, preset: w.stylePreset, photos: w.photos.length, voice: w.voice, words: w.script.split(/\s+/).length },
    });
    await enqueueJob({
      job_id: job!.id,
      project_id: w.projectId,
      user_id: user.id,
      type: "synth",
      payload: {
        script: w.script,
        voice: w.voice,
        language_hint: "en",
        max_duration_sec: plan.maxSeconds,
      },
    });
  });
  revalidatePath("/dashboard");
  return { ok: true, projectId: w.projectId };
}

/** "Create my film" for a film made from a brief: enqueue the compose job; it hands off to probe. */
export async function createBriefEdit(input: unknown): Promise<ActionResult> {
  const user = await requireUser("/dashboard/new");
  const parsed = BriefSubmission.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const w = parsed.data;
  const kind = briefKind(w.kind);
  if (!kind) return { ok: false, error: "Unknown kind of film" };

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, w.projectId), eq(schema.projects.userId, user.id)));
  if (!project) return { ok: false, error: "Project not found" };

  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  const seconds = Math.min(w.seconds ? Number(w.seconds) + 2 : kind.maxSeconds, plan.maxSeconds);
  const cost = creditCost(seconds);
  if (user.credits < cost)
    return { ok: false, error: `This film needs ${cost} credit(s); you have ${user.credits}.` };

  const brief = {
    kind: w.kind,
    ...(w.url ? { url: w.url } : {}),
    ...(w.recipe ? { recipe: w.recipe } : {}),
    ...(w.subject ? { subject: w.subject } : {}),
    ...(w.topic ? { topic: w.topic } : {}),
    ...(w.focus ? { focus: w.focus } : {}),
    ...(w.seconds ? { seconds: Number(w.seconds) } : {}),
    ...(w.kind === "flyover" ? { brand: w.brand.name, line: w.closeLine ?? "", tail: w.closeTail ?? "" } : {}),
    ...(w.a ? { a: w.a, b: w.b, winner: w.winner } : {}),
    ...(w.kind === "machine" && w.line ? { line: w.line, end: w.end || "ONE PROMPT" } : {}),
    narrate: w.narrate ?? kind.narrate,
    ...(w.voice ? { voice: w.voice } : {}),
  };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.projects)
      .set({
        title: w.title || kind.title,
        status: "uploaded",
        stylePreset: kind.preset,
        styleText: null,
        styleOptions: {
          captions: kind.narrate,
          sfxIntensity: w.options.sfxIntensity,
          music: true,
          language: "en",
          source: "brief",
          faceless: true,
          brief,
        },
        brand: w.brand,
        durationSec: seconds,
        creditsCost: cost,
        updatedAt: schema.now,
      })
      .where(eq(schema.projects.id, w.projectId));
    for (const [i, ph] of w.photos.entries()) {
      await tx
        .update(schema.assets)
        .set({ meta: mergeMeta({ label: ph.label, sayWhen: ph.sayWhen, crop: ph.crop, order: i }) })
        .where(and(eq(schema.assets.id, ph.assetId), eq(schema.assets.projectId, w.projectId)));
    }
    const [job] = await tx
      .insert(schema.jobs)
      .values({
        projectId: w.projectId,
        userId: user.id,
        type: "compose",
        status: "uploaded",
        message: "Queued",
      })
      .returning({ id: schema.jobs.id });
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_brief_film",
      entity: "project",
      entityId: w.projectId,
      meta: { cost, kind: w.kind, preset: kind.preset, photos: w.photos.length },
    });
    await enqueueJob({
      job_id: job!.id,
      project_id: w.projectId,
      user_id: user.id,
      type: "compose",
      payload: { max_duration_sec: plan.maxSeconds },
    });
  });
  revalidatePath("/dashboard");
  return { ok: true, projectId: w.projectId };
}

/** "Create my edit" for an AI presenter reel: enqueue the HeyGen job; it hands off to probe. */
export async function createPresenterEdit(input: unknown): Promise<ActionResult> {
  const user = await requireUser("/dashboard/new");
  const parsed = PresenterSubmission.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const w = parsed.data;
  if (!w.lookId && !w.photoAssetId)
    return { ok: false, error: "Upload a photo or choose a stock presenter" };

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, w.projectId), eq(schema.projects.userId, user.id)));
  if (!project) return { ok: false, error: "Project not found" };
  if (w.photoAssetId) {
    const [ph] = await db
      .select({ kind: schema.assets.kind })
      .from(schema.assets)
      .where(and(eq(schema.assets.id, w.photoAssetId), eq(schema.assets.projectId, w.projectId)));
    if (!ph || ph.kind !== "presenter_image")
      return { ok: false, error: "Upload the presenter photo first" };
  }

  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  const est = estimateSpokenSeconds(w.script);
  if (est > plan.maxSeconds) {
    return {
      ok: false,
      error: `Spoken, this script runs about ${Math.round(est)} s; your ${plan.name} plan allows ${plan.maxSeconds} s.`,
    };
  }
  const cost = creditCost(Math.max(1, est));
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
        styleOptions: {
          ...w.options,
          source: "presenter",
          presenterVoice: w.voiceId,
          presenterLook: w.lookId,
        },
        brand: w.brand,
        durationSec: Math.round(est),
        creditsCost: cost,
        updatedAt: schema.now,
      })
      .where(eq(schema.projects.id, w.projectId));
    for (const [i, ph] of w.photos.entries()) {
      await tx
        .update(schema.assets)
        .set({ meta: mergeMeta({ label: ph.label, sayWhen: ph.sayWhen, crop: ph.crop, order: i }) })
        .where(and(eq(schema.assets.id, ph.assetId), eq(schema.assets.projectId, w.projectId)));
    }
    const [job] = await tx
      .insert(schema.jobs)
      .values({
        projectId: w.projectId,
        userId: user.id,
        type: "presenter",
        status: "uploaded",
        message: "Queued",
      })
      .returning({ id: schema.jobs.id });
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_presenter_edit",
      entity: "project",
      entityId: w.projectId,
      meta: { cost, preset: w.stylePreset, voice: w.voiceId, look: w.lookId, photo: Boolean(w.photoAssetId) },
    });
    await enqueueJob({
      job_id: job!.id,
      project_id: w.projectId,
      user_id: user.id,
      type: "presenter",
      payload: {
        script: w.script,
        voice_id: w.voiceId,
        look_id: w.lookId,
        language_hint: w.options.language,
        max_duration_sec: plan.maxSeconds,
      },
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

/** Re-run the pipeline from the video check (idempotent: outputs are overwritten, credits are not
 * charged again). Used when a run failed or the worker stopped reporting. */
export async function retryEdit(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, user.id)));
  if (!project) return;
  const [source] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, id), eq(schema.assets.kind, "source_video")));
  if (!source) return;
  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  const [job] = await db
    .insert(schema.jobs)
    .values({ projectId: id, userId: user.id, type: "probe", status: "uploaded" })
    .returning();
  await db
    .update(schema.projects)
    .set({ status: "uploaded", updatedAt: schema.now })
    .where(eq(schema.projects.id, id));
  await db.insert(schema.auditLog).values({
    userId: user.id,
    action: "project.retry",
    entity: "project",
    entityId: id,
    meta: { job: job!.id },
  });
  await enqueueJob({
    job_id: job!.id,
    project_id: id,
    user_id: user.id,
    type: "probe",
    payload: {
      source_key: source.storageKey,
      language_hint: project.styleOptions.language,
      max_duration_sec: plan.maxSeconds,
    },
  });
  revalidatePath(`/dashboard/p/${id}`);
}
