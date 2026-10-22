import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatPrice } from "@/config/pricing";
import { listSignups } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import type { OrderRaw } from "@/lib/billing";
import { approvePayment, grantCredits, rejectPayment } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "—";

/** The owner's desk: payments to confirm against the bank statement, then every sign-up. */
export default async function AdminPage() {
  await requireAdmin();
  const [signups, pending, recent] = await Promise.all([
    listSignups(),
    db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.status, "submitted"))
      .orderBy(desc(schema.payments.createdAt)),
    db
      .select()
      .from(schema.payments)
      .where(inArray(schema.payments.status, ["paid", "rejected"]))
      .orderBy(desc(schema.payments.createdAt))
      .limit(30),
  ]);
  const emailOf = new Map(signups.map((s) => [s.userId, s.email]));
  const today = new Date(Date.now() - 24 * 3600 * 1000);
  const revenue = recent
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amountMinor / 100, 0);
  const stats: Array<[string, string]> = [
    ["Accounts", String(signups.length)],
    ["New in 24 h", String(signups.filter((s) => s.joined > today).length)],
    ["Made a reel", String(signups.filter((s) => s.reels > 0).length)],
    ["Paying", String(signups.filter((s) => s.paidRupees > 0).length)],
    ["To confirm", String(pending.length)],
    ["Revenue (last 30 orders)", formatPrice(revenue)],
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Admin</h1>
        <a href="/admin/signups.csv" className="button button-ghost">
          Download sign-ups (CSV)
        </a>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="bg-surface rounded-[8px] p-4">
            <dt className="text-muted text-[13px]">{k}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-xl font-semibold">Payments to confirm</h2>
        <p className="text-muted mt-1 text-[14px]">
          Find the UTR and amount in your bank app or statement before approving. Approving adds the
          credits and emails the buyer.
        </p>
        {pending.length === 0 ? (
          <p className="text-muted mt-3 text-[14px]">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((o) => {
              const raw = o.raw as OrderRaw;
              return (
                <li key={o.id} className="bg-surface rounded-[8px] p-4 text-[14px]">
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="text-lg font-semibold tabular-nums">
                      {formatPrice(o.amountMinor / 100)}
                    </span>
                    <span>
                      UTR <span className="select-all font-medium tabular-nums">{raw.utr}</span>
                    </span>
                    <span>Ref {raw.ref}</span>
                    <span>
                      {raw.reels} reel{raw.reels === 1 ? "" : "s"}
                    </span>
                    <span className="text-muted">{emailOf.get(o.userId) ?? o.userId}</span>
                    <span className="text-muted">sent {when(raw.submittedAt ?? o.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={approvePayment}>
                      <input type="hidden" name="id" value={o.id} />
                      <button type="submit" className="button h-9 px-4 text-[14px]">
                        Approve · add {raw.reels} credit{raw.reels === 1 ? "" : "s"}
                      </button>
                    </form>
                    <form action={rejectPayment} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={o.id} />
                      <input
                        name="reason"
                        placeholder="Reason (shown to the buyer)"
                        className="bg-raised h-9 min-w-[240px] rounded-[6px] px-3"
                      />
                      <button type="submit" className="button button-ghost h-9 px-4 text-[14px]">
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Sign-ups ({signups.length})</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[14px]">
            <thead className="text-muted text-[13px]">
              <tr>
                <th className="py-2 pr-4 font-normal">Email</th>
                <th className="py-2 pr-4 font-normal">Name</th>
                <th className="py-2 pr-4 font-normal">Joined</th>
                <th className="py-2 pr-4 font-normal">Sign-in</th>
                <th className="py-2 pr-4 font-normal">Last seen</th>
                <th className="py-2 pr-4 font-normal">Reels</th>
                <th className="py-2 pr-4 font-normal">Credits</th>
                <th className="py-2 pr-4 font-normal">Paid</th>
                <th className="py-2 font-normal">Give credits</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((s) => (
                <tr
                  key={s.userId}
                  className="border-t border-[color:var(--line,#ffffff1a)] align-top"
                >
                  <td className="select-all py-2 pr-4">{s.email}</td>
                  <td className="py-2 pr-4">{s.name ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{when(s.joined)}</td>
                  <td className="py-2 pr-4">
                    {s.provider}
                    {s.provider === "email" && !s.confirmed ? " (unconfirmed)" : ""}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{when(s.lastSignIn)}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.reels}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.credits}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {s.paidRupees ? formatPrice(s.paidRupees) : "—"}
                  </td>
                  <td className="py-2">
                    <form action={grantCredits} className="flex gap-1">
                      <input type="hidden" name="userId" value={s.userId} />
                      <input
                        name="credits"
                        type="number"
                        defaultValue={1}
                        min={-100}
                        max={1000}
                        aria-label={`Credits for ${s.email}`}
                        className="bg-raised h-8 w-16 rounded-[6px] px-2"
                      />
                      <button type="submit" className="button button-ghost h-8 px-3 text-[13px]">
                        Give
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Decided payments</h2>
          <ul className="mt-3 space-y-1 text-[14px]">
            {recent.map((o) => {
              const raw = o.raw as OrderRaw;
              return (
                <li key={o.id} className="text-muted">
                  {o.status === "paid" ? "✓" : "✗"} {formatPrice(o.amountMinor / 100)} · UTR{" "}
                  {raw.utr} · {emailOf.get(o.userId) ?? o.userId} · {when(raw.decidedAt ?? null)}
                  {raw.reason ? ` · ${raw.reason}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p>
        <Link href="/dashboard" className="link text-[14px]">
          Back to the dashboard
        </Link>
      </p>
    </div>
  );
}
