"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import type { OrderRaw } from "@/lib/billing";
import { sendMail } from "@/lib/notify";
import { siteUrl } from "@/lib/site";

/** Approve: the UTR matched a credit on the bank statement → the pack's credits, once. */
export async function approvePayment(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const done = await db.transaction(async (tx) => {
    const [order] = await tx
      .update(schema.payments)
      .set({
        status: "paid",
        raw: sql`${schema.payments.raw} || ${JSON.stringify({ decidedAt: new Date().toISOString(), decidedBy: admin.email })}::jsonb`,
      })
      .where(and(eq(schema.payments.id, id), eq(schema.payments.status, "submitted")))
      .returning();
    if (!order) return null; // already decided (a double click, or another admin)
    const raw = order.raw as OrderRaw;
    const [profile] = await tx
      .update(schema.profiles)
      .set({
        credits: sql`${schema.profiles.credits} + ${raw.reels}`,
        plan: "creator",
        updatedAt: schema.now,
      })
      .where(eq(schema.profiles.userId, order.userId))
      .returning({ email: schema.profiles.email, credits: schema.profiles.credits });
    await tx
      .insert(schema.creditLedger)
      .values({
        userId: order.userId,
        delta: raw.reels,
        reason: `purchase:${raw.pack}:${raw.ref}`,
      });
    await tx.insert(schema.auditLog).values({
      userId: order.userId,
      action: "payment.approved",
      entity: "payment",
      entityId: id,
      meta: { by: admin.email, utr: raw.utr, reels: raw.reels, amount: order.amountMinor / 100 },
    });
    return {
      email: profile?.email,
      credits: profile?.credits,
      raw,
      rupees: order.amountMinor / 100,
    };
  });
  if (done?.email)
    await sendMail(
      done.email,
      `Your Rasika credits are ready (${done.raw.reels} reel${done.raw.reels === 1 ? "" : "s"})`,
      `We received your payment of ₹${done.rupees} (UTR ${done.raw.utr}).\n` +
        `${done.raw.reels} credit${done.raw.reels === 1 ? "" : "s"} added; you now have ${done.credits}.\n\n` +
        `Make a reel: ${siteUrl}/dashboard/new\n\nThank you!\nRasika`,
    );
  revalidatePath("/admin");
}

/** Reject: no matching credit on the statement. The buyer sees the reason on their order. */
export async function rejectPayment(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const reason = String(fd.get("reason") ?? "").slice(0, 300) || "No matching payment found";
  const [order] = await db
    .update(schema.payments)
    .set({
      status: "rejected",
      raw: sql`${schema.payments.raw} || ${JSON.stringify({ decidedAt: new Date().toISOString(), decidedBy: admin.email, reason })}::jsonb`,
    })
    .where(and(eq(schema.payments.id, id), eq(schema.payments.status, "submitted")))
    .returning();
  if (!order) return;
  await db.insert(schema.auditLog).values({
    userId: order.userId,
    action: "payment.rejected",
    entity: "payment",
    entityId: id,
    meta: { by: admin.email, reason },
  });
  const [p] = await db
    .select({ email: schema.profiles.email })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, order.userId));
  const raw = order.raw as OrderRaw;
  if (p?.email)
    await sendMail(
      p.email,
      "About your Rasika payment",
      `We couldn't match your payment of ₹${order.amountMinor / 100} (UTR ${raw.utr}, order ${raw.ref}).\n` +
        `Reason: ${reason}\n\nIf money left your account, reply to this email with a screenshot of the ` +
        `payment and we'll sort it out.\n\nRasika`,
    );
  revalidatePath("/admin");
}

/** Give credits by hand (a refund for a failed reel, a friend, a promotion). */
export async function grantCredits(fd: FormData) {
  const admin = await requireAdmin();
  const userId = String(fd.get("userId") ?? "");
  const n = Math.trunc(Number(fd.get("credits") ?? 0));
  if (!/^[0-9a-f-]{36}$/.test(userId) || !n || Math.abs(n) > 1000) return;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.profiles)
      .set({ credits: sql`greatest(0, ${schema.profiles.credits} + ${n})`, updatedAt: schema.now })
      .where(eq(schema.profiles.userId, userId));
    await tx
      .insert(schema.creditLedger)
      .values({ userId, delta: n, reason: `admin:${admin.email}` });
  });
  revalidatePath("/admin");
}
