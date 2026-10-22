"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { paidPacks } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { orderRef, upiConfig, UTR_RE, type OrderRaw } from "@/lib/billing";
import { notifyAdmins } from "@/lib/notify";
import { siteUrl } from "@/lib/site";

/** "Buy": an order for the pack (an unpaid one for the same pack is reused), then its pay page. */
export async function buyPack(fd: FormData) {
  const user = await requireUser("/dashboard/credits");
  const pack = paidPacks.find((p) => p.id === String(fd.get("pack") ?? ""));
  if (!pack || !upiConfig()) redirect("/dashboard/credits");
  const [open] = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.userId, user.id),
        eq(schema.payments.status, "created"),
        sql`${schema.payments.raw}->>'pack' = ${pack.id}`,
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);
  if (open) redirect(`/dashboard/credits/${open.id}`);
  const raw: OrderRaw = { pack: pack.id, reels: pack.reels, ref: orderRef() };
  const [row] = await db
    .insert(schema.payments)
    .values({
      userId: user.id,
      provider: "upi",
      amountMinor: pack.inr * 100,
      status: "created",
      raw,
    })
    .returning({ id: schema.payments.id });
  redirect(`/dashboard/credits/${row!.id}`);
}

/** "I've paid": the buyer's UTR goes to the admins to match against the bank statement. */
export async function submitUtr(fd: FormData) {
  const user = await requireUser("/dashboard/credits");
  const id = String(fd.get("id") ?? "");
  const utr = String(fd.get("utr") ?? "").replace(/\s+/g, "");
  const back = (error: string) =>
    redirect(`/dashboard/credits/${id}?error=${encodeURIComponent(error)}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/dashboard/credits");
  if (!UTR_RE.test(utr)) back("The UTR is the 12-digit number in your UPI app's payment details.");
  const [order] = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.id, id), eq(schema.payments.userId, user.id)));
  if (!order) redirect("/dashboard/credits");
  if (order.status !== "created") redirect(`/dashboard/credits/${id}`);
  const [used] = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(
      and(
        sql`${schema.payments.raw}->>'utr' = ${utr}`,
        sql`${schema.payments.status} <> 'rejected'`,
      ),
    )
    .limit(1);
  if (used) back("This UTR has already been sent for another order.");
  const raw = { ...(order.raw as OrderRaw), utr, submittedAt: new Date().toISOString() };
  const [moved] = await db
    .update(schema.payments)
    .set({ status: "submitted", providerRef: utr, raw })
    .where(and(eq(schema.payments.id, id), eq(schema.payments.status, "created")))
    .returning({ id: schema.payments.id });
  if (moved) {
    await db.insert(schema.auditLog).values({
      userId: user.id,
      action: "payment.submitted",
      entity: "payment",
      entityId: id,
      meta: { utr, amount: order.amountMinor / 100, pack: raw.pack },
    });
    await notifyAdmins(
      `Payment to confirm: ₹${order.amountMinor / 100} from ${user.email}`,
      `${user.email} says they paid ₹${order.amountMinor / 100} for ${raw.reels} reel(s).\n` +
        `UTR: ${utr}\nReference: ${raw.ref}\n\nCheck your bank statement, then approve or reject: ${siteUrl}/admin`,
    );
  }
  revalidatePath(`/dashboard/credits/${id}`);
  redirect(`/dashboard/credits/${id}`);
}
