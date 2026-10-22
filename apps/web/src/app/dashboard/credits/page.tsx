import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatPrice, paidPacks, perReel } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { upiConfig, type OrderRaw } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { buyPack } from "./actions";

export const metadata: Metadata = { title: "Credits", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  created: "Waiting for your payment",
  submitted: "Paid · we're confirming it",
  paid: "Credits added",
  rejected: "Not matched",
};

/** Credits: the balance, the three packs (UPI), and the account's orders. */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const user = await requireUser("/dashboard/credits");
  const { pack: picked } = await searchParams;
  const upi = upiConfig();
  const orders = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.userId, user.id))
    .orderBy(desc(schema.payments.createdAt))
    .limit(20);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Credits</h1>
      <p className="text-muted mt-1 text-[14px]">
        You have <span className="text-text font-medium tabular-nums">{user.credits}</span> credit
        {user.credits === 1 ? "" : "s"}. 1 credit = 1 reel up to 90 s. Credits never expire.
      </p>

      {upi ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {paidPacks.map((p) => (
            <li
              key={p.id}
              className={cn(
                "bg-surface flex flex-col rounded-[8px] p-5",
                (picked === p.id || (!picked && p.highlight)) && "ring-accent ring-2",
              )}
            >
              <p className="text-xl font-semibold tracking-[-0.02em]">{p.name}</p>
              <p className="mt-1 text-2xl tabular-nums">{formatPrice(p.inr)}</p>
              <p className="text-muted text-[13px]">
                {formatPrice(perReel(p))} a reel · {p.blurb}
              </p>
              <form action={buyPack} className="mt-4">
                <input type="hidden" name="pack" value={p.id} />
                <button type="submit" className="button w-full">
                  Pay {formatPrice(p.inr)} by UPI
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bg-surface mt-8 rounded-[8px] p-5 text-[14px]">
          Payments are not switched on yet. Please check back soon.
        </p>
      )}
      <p className="text-muted mt-3 text-[13px]">
        Pay from any UPI app (GPay, PhonePe, Paytm, your bank). After paying, enter the 12-digit UTR
        from the payment details; credits are added once we confirm it, usually within a few hours.
      </p>

      {orders.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Your orders</h2>
          <ul className="mt-3 divide-y divide-[color:var(--line,#ffffff1a)]">
            {orders.map((o) => {
              const raw = (o.raw ?? {}) as OrderRaw;
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-[14px]"
                >
                  <span>
                    {raw.reels} reel{raw.reels === 1 ? "" : "s"} ·{" "}
                    {formatPrice(o.amountMinor / 100)} ·{" "}
                    <span className="text-muted">{raw.ref}</span>
                  </span>
                  <span className="text-muted">{o.createdAt.toLocaleDateString("en-IN")}</span>
                  <Link href={`/dashboard/credits/${o.id}`} className="link">
                    {STATUS[o.status] ?? o.status}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
