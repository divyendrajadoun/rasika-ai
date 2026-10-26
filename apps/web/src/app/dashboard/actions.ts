"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/queue";
import { deleteObject } from "@/lib/storage/s3";
import { ACTIVE_STATUSES } from "@/lib/projects";
import { briefKind } from "@/config/briefs";
import { env } from "@/lib/env";

/** Photo settings from the wizard merge into what the asset already records (an AI image keeps its
 *  source and prompt, every image its size) instead of replacing it. */
const mergeMeta = (patch: Record<string, unknown>) =>
  sql`${schema.assets.meta} || ${JSON.stringify(patch)}::jsonb` as unknown as schema.AssetMeta;
/** Thrown inside a transaction to roll it back with a message for the user. */
class UserError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Take `cost` credits atomically (never below zero) and write the ledger line. An unlimited
 * account (lib/auth.ts) spends nothing; its ledger line records the reel at zero. */
async function spendCredits(
  tx: Tx,
  userId: string,
  cost: number,
  jobId: string,
  unlimited = false,
) {
  if (unlimited) {
    await tx
      .insert(schema.creditLedger)
      .values({ userId, delta: 0, reason: "reel (unlimited)", jobId });
    return;
  }
  const [left] = await tx
    .update(schema.profiles)
    .set({ credits: sql`${schema.profiles.credits} - ${cost}`, updatedAt: schema.now })
    .where(and(eq(schema.profiles.userId, userId), sql`${schema.profiles.credits} >= ${cost}`))
    .returning({ credits: schema.profiles.credits });
  if (!left)
    throw new UserError(
      `This needs ${cost} credit${cost === 1 ? "" : "s"}. Buy more on the Credits page.`,
    );
  await tx.insert(schema.creditLedger).values({ userId, delta: -cost, reason: "reel", jobId });
}

/** Run a charging transaction; a UserError rolls it back and comes back as the message. */
async function chargedTx(fn: (tx: Tx) => Promise<unknown>): Promise<string | null> {
  try {
    await db.transaction(fn);
    return null;
  } catch (e) {
    if (e instanceof UserError) return e.message;
    throw e;
  }
}

import {
  BriefSubmission,
  ClipsSubmission,
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

  const txError = await chargedTx(async (tx) => {
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
    await spendCredits(tx, user.id, cost, job!.id, user.unlimited);
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
  if (txError) return { ok: false, error: txError };
  revalidatePath("/dashboard");
  return { ok: true, projectId: w.projectId };
}

/** Script-only reels need a project before the photos step (images upload against a project id). */
/** the clips of a many-clips reel together, before the dead air and the earlier takes come out */
const MAX_CLIPS_SECONDS = 15 * 60;

/** "Create my edit" for many clips: enqueue the assemble job; it joins the clips and hands off to
 *  probe, so the rest of the chain is the one a single take runs. */
export async function createClipsEdit(input: unknown): Promise<ActionResult> {
  const user = await requireUser("/dashboard/new");
  const parsed = ClipsSubmission.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const w = parsed.data;
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, w.projectId), eq(schema.projects.userId, user.id)));
  if (!project) return { ok: false, error: "Project not found" };
  if (project.status !== "draft") return { ok: false, error: "This reel was already created" };
  const clips = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, w.projectId), eq(schema.assets.kind, "source_clip")));
  const byId = new Map(clips.map((c) => [c.id, c]));
  const picked = [...new Set(w.clipAssetIds)];
  if (picked.some((id) => !byId.has(id)))
    return { ok: false, error: "A clip is missing; upload it again" };
  // a clip still uploading has no length yet (the upload's "complete" writes it)
  if (picked.some((id) => !byId.get(id)!.meta.durationSec))
    return { ok: false, error: "Wait for every clip to finish uploading" };
  const rawSec = picked.reduce((s, id) => s + (byId.get(id)!.meta.durationSec ?? 0), 0);
  if (rawSec > MAX_CLIPS_SECONDS)
    return { ok: false, error: `Up to ${MAX_CLIPS_SECONDS / 60} minutes of clips in one reel.` };

  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  // charged on the joined take, which may be no longer than the plan allows
  const durationSec = Math.min(rawSec, plan.maxSeconds);
  const cost = creditCost(Math.max(1, durationSec));
  if (user.credits < cost)
    return { ok: false, error: `This edit needs ${cost} credit(s); you have ${user.credits}.` };
  const dropped = clips.filter((c) => !picked.includes(c.id));

  const txError = await chargedTx(async (tx) => {
    await tx
      .update(schema.projects)
      .set({
        title: w.title,
        status: "uploaded",
        stylePreset: w.stylePreset,
        styleText: w.styleText || null,
        styleOptions: { ...w.options, source: "clips", clipScript: w.script || undefined },
        brand: w.brand,
        durationSec,
        creditsCost: cost,
        updatedAt: schema.now,
      })
      .where(eq(schema.projects.id, w.projectId));
    for (const [i, id] of picked.entries()) {
      await tx
        .update(schema.assets)
        .set({ meta: mergeMeta({ order: i }) })
        .where(eq(schema.assets.id, id));
    }
    // clips removed in the wizard after they had finished uploading
    for (const c of dropped) await tx.delete(schema.assets).where(eq(schema.assets.id, c.id));
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
        type: "assemble",
        status: "uploaded",
        message: "Queued",
      })
      .returning({ id: schema.jobs.id });
    await spendCredits(tx, user.id, cost, job!.id, user.unlimited);
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_clips_edit",
      entity: "project",
      entityId: w.projectId,
      meta: {
        cost,
        preset: w.stylePreset,
        clips: picked.length,
        rawSec,
        script: Boolean(w.script),
      },
    });
    await enqueueJob({
      job_id: job!.id,
      project_id: w.projectId,
      user_id: user.id,
      type: "assemble",
      payload: { language_hint: w.options.language, max_duration_sec: plan.maxSeconds },
    });
  });
  if (txError) return { ok: false, error: txError };
  for (const c of dropped) await deleteObject(c.storageKey).catch(() => {});
  revalidatePath("/dashboard");
  return { ok: true, projectId: w.projectId };
}

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

  const txError = await chargedTx(async (tx) => {
    await tx
      .update(schema.projects)
      .set({
        title: w.title,
        status: "uploaded",
        stylePreset: w.stylePreset,
        styleText: w.styleText || null,
        styleOptions: {
          ...w.options,
          language: "en",
          source: "script",
          faceless: true,
          voice: w.voice,
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
        type: "synth",
        status: "uploaded",
        message: "Queued",
      })
      .returning({ id: schema.jobs.id });
    await spendCredits(tx, user.id, cost, job!.id, user.unlimited);
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_script_edit",
      entity: "project",
      entityId: w.projectId,
      meta: {
        cost,
        preset: w.stylePreset,
        photos: w.photos.length,
        voice: w.voice,
        words: w.script.split(/\s+/).length,
      },
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
  if (txError) return { ok: false, error: txError };
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
  const presenter = w.kind === "roundup" && w.speaker === "presenter";
  if (w.kind === "roundup" && w.roundupLook === "reference") {
    const [ref] = await db
      .select({ kind: schema.assets.kind })
      .from(schema.assets)
      .where(
        and(
          eq(schema.assets.id, w.referenceAssetId ?? ""),
          eq(schema.assets.projectId, w.projectId),
        ),
      );
    if (!ref || ref.kind !== "reference_video")
      return { ok: false, error: "Upload the reel whose style you want first" };
  }
  if (presenter && !env.presenterEnabled)
    return { ok: false, error: "The AI presenter is not available yet; choose the voice." };

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
    ...(w.kind === "flyover"
      ? { brand: w.brand.name, line: w.closeLine ?? "", tail: w.closeTail ?? "" }
      : {}),
    ...(w.a ? { a: w.a, b: w.b, winner: w.winner } : {}),
    ...(w.kind === "roundup"
      ? {
          post: w.post ?? "",
          mode: w.speaker,
          ...(w.roundupLook === "reference"
            ? { reference_asset: w.referenceAssetId }
            : { look: w.roundupLook }),
          ...(presenter ? { look_id: w.lookId, presenter_voice: w.presenterVoice } : {}),
        }
      : {}),
    ...(w.kind === "machine" && w.line ? { line: w.line, end: w.end || "ONE PROMPT" } : {}),
    narrate: w.narrate ?? kind.narrate,
    ...(w.voice ? { voice: w.voice } : {}),
  };

  const txError = await chargedTx(async (tx) => {
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
          faceless: !presenter,
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
    await spendCredits(tx, user.id, cost, job!.id, user.unlimited);
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
  if (txError) return { ok: false, error: txError };
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

  const txError = await chargedTx(async (tx) => {
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
    await spendCredits(tx, user.id, cost, job!.id, user.unlimited);
    await tx.insert(schema.auditLog).values({
      userId: user.id,
      action: "project.create_presenter_edit",
      entity: "project",
      entityId: w.projectId,
      meta: {
        cost,
        preset: w.stylePreset,
        voice: w.voiceId,
        look: w.lookId,
        photo: Boolean(w.photoAssetId),
      },
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
  if (txError) return { ok: false, error: txError };
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
  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  if (!source && project.styleOptions.source === "clips") {
    // the clips were never joined (or the join failed): start again from the clips
    const [job] = await db
      .insert(schema.jobs)
      .values({ projectId: id, userId: user.id, type: "assemble", status: "uploaded" })
      .returning();
    await db
      .update(schema.projects)
      .set({ status: "uploaded", updatedAt: schema.now })
      .where(eq(schema.projects.id, id));
    await enqueueJob({
      job_id: job!.id,
      project_id: id,
      user_id: user.id,
      type: "assemble",
      payload: { language_hint: project.styleOptions.language, max_duration_sec: plan.maxSeconds },
    });
    revalidatePath(`/dashboard/p/${id}`);
    return;
  }
  if (!source) return;
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

/** The project, when it is the user's and nothing is running on it (one job at a time). */
async function idleProject(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
  if (!project || project.deletedAt) return { error: "Project not found" } as const;
  const [job] = await db
    .select({ status: schema.jobs.status })
    .from(schema.jobs)
    .where(eq(schema.jobs.projectId, projectId))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(1);
  if (job && ACTIVE_STATUSES.has(job.status))
    return { error: "Wait for the current render to finish" } as const;
  return { project } as const;
}

/** re-edits of one reel that are not charged again (each re-plans and re-renders the reel) */
const MAX_FREE_RECUTS = 5;

const RecutInput = z.object({
  projectId: z.string().uuid(),
  transcriptVersion: z.number().int().positive(),
  removed: z.array(z.number().int().min(0)).max(20000),
  studioSound: z.boolean(),
});

/** The editor's "Render this edit": the original take is cut to the kept words, then the usual
 *  probe → transcribe → plan → render runs on the cut. Re-edits of a reel are not charged again. */
export async function recutEdit(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = RecutInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid edit" };
  const r = parsed.data;
  const got = await idleProject(user.id, r.projectId);
  if ("error" in got) return { ok: false, error: got.error! };
  const [t] = await db
    .select({ words: schema.transcripts.words })
    .from(schema.transcripts)
    .where(
      and(
        eq(schema.transcripts.projectId, r.projectId),
        eq(schema.transcripts.version, r.transcriptVersion),
      ),
    );
  if (!t) return { ok: false, error: "That transcript is gone; reload the page" };
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.projectId, r.projectId), eq(schema.jobs.type, "recut")));
  if (n >= MAX_FREE_RECUTS)
    return {
      ok: false,
      error: `Each reel includes ${MAX_FREE_RECUTS} re-edits; start a new edit for more.`,
    };
  const removed = [...new Set(r.removed)].filter((i) => i < t.words.length).sort((a, b) => a - b);
  if (removed.length >= t.words.length) return { ok: false, error: "Keep at least one word" };

  const [job] = await db
    .insert(schema.jobs)
    .values({
      projectId: r.projectId,
      userId: user.id,
      type: "recut",
      status: "uploaded",
      message: "Queued",
    })
    .returning({ id: schema.jobs.id });
  await db
    .update(schema.projects)
    .set({
      status: "uploaded",
      styleOptions: { ...got.project.styleOptions, studioSound: r.studioSound },
      updatedAt: schema.now,
    })
    .where(eq(schema.projects.id, r.projectId));
  await db.insert(schema.auditLog).values({
    userId: user.id,
    action: "project.recut",
    entity: "project",
    entityId: r.projectId,
    meta: { job: job!.id, removed: removed.length, studioSound: r.studioSound },
  });
  await enqueueJob({
    job_id: job!.id,
    project_id: r.projectId,
    user_id: user.id,
    type: "recut",
    payload: { transcript_version: r.transcriptVersion, removed },
  });
  revalidatePath(`/dashboard/p/${r.projectId}`);
  return { ok: true, projectId: r.projectId };
}

const ReassembleInput = z.object({
  projectId: z.string().uuid(),
  /** the clips to keep, in this order */
  order: z.array(z.string().uuid()).min(1, "Keep at least one clip").max(30),
});

/** The clips panel's "Join again": the clips in the user's own order, then the usual chain. It
 *  counts as one of the reel's free re-edits. */
export async function reassembleClips(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ReassembleInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  const r = parsed.data;
  const got = await idleProject(user.id, r.projectId);
  if ("error" in got) return { ok: false, error: got.error! };
  if (got.project.styleOptions.source !== "clips")
    return { ok: false, error: "This reel has no clips" };
  const clips = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, r.projectId), eq(schema.assets.kind, "source_clip")));
  const have = new Set(clips.map((c) => c.id));
  const order = [...new Set(r.order)].filter((id) => have.has(id));
  if (!order.length) return { ok: false, error: "Keep at least one clip" };
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(
      and(eq(schema.jobs.projectId, r.projectId), inArray(schema.jobs.type, ["recut", "assemble"])),
    );
  // the first assemble made the reel; it is not a re-edit
  if (n - 1 >= MAX_FREE_RECUTS)
    return {
      ok: false,
      error: `Each reel includes ${MAX_FREE_RECUTS} re-edits; start a new edit for more.`,
    };
  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  const [job] = await db
    .insert(schema.jobs)
    .values({
      projectId: r.projectId,
      userId: user.id,
      type: "assemble",
      status: "uploaded",
      message: "Queued",
    })
    .returning({ id: schema.jobs.id });
  await db
    .update(schema.projects)
    .set({ status: "uploaded", updatedAt: schema.now })
    .where(eq(schema.projects.id, r.projectId));
  await db.insert(schema.auditLog).values({
    userId: user.id,
    action: "project.reassemble",
    entity: "project",
    entityId: r.projectId,
    meta: { job: job!.id, kept: order.length, of: clips.length },
  });
  await enqueueJob({
    job_id: job!.id,
    project_id: r.projectId,
    user_id: user.id,
    type: "assemble",
    payload: {
      order,
      language_hint: got.project.styleOptions.language,
      max_duration_sec: plan.maxSeconds,
    },
  });
  revalidatePath(`/dashboard/p/${r.projectId}`);
  return { ok: true, projectId: r.projectId };
}

const ExportInput = z.object({
  projectId: z.string().uuid(),
  format: z.enum(["1:1", "4:5", "16:9"]),
});

/** The finished reel in another shape, fitted on a blurred backdrop (worker media.export_shape). */
export async function exportReel(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ExportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown shape" };
  const r = parsed.data;
  const got = await idleProject(user.id, r.projectId);
  if ("error" in got) return { ok: false, error: got.error! };
  const [out] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, r.projectId), eq(schema.assets.kind, "output_1080")));
  if (!out) return { ok: false, error: "Render the reel first" };
  const [job] = await db
    .insert(schema.jobs)
    .values({
      projectId: r.projectId,
      userId: user.id,
      type: "export",
      status: "uploaded",
      message: `Exporting ${r.format}…`,
    })
    .returning({ id: schema.jobs.id });
  await enqueueJob({
    job_id: job!.id,
    project_id: r.projectId,
    user_id: user.id,
    type: "export",
    payload: { format: r.format },
  });
  revalidatePath(`/dashboard/p/${r.projectId}`);
  return { ok: true, projectId: r.projectId };
}
