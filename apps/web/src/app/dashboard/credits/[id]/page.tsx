import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatPrice } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { upiConfig, upiLink, upiQrSvg, type OrderRaw } from "@/lib/billing";
import { submitUtr } from "../actions";

export const metadata: Metadata = { title: "Pay by UPI", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One order: pay by UPI (QR on a computer, the app button on a phone), then send the UTR. */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser("/dashboard/credits");
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [order] = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.id, id), eq(schema.payments.userId, user.id)));
  if (!order) notFound();
  const raw = (order.raw ?? {}) as OrderRaw;
  const rupees = order.amountMinor / 100;
  const upi = upiConfig();

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/credits" className="link text-muted text-[14px]">
        Credits
      </Link>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em]">
        {raw.reels} reel{raw.reels === 1 ? "" : "s"} · {formatPrice(rupees)}
      </h1>
      <p className="text-muted mt-1 text-[14px]">Order {raw.ref}</p>

      {order.status === "paid" && (
        <div className="bg-surface mt-6 rounded-[8px] p-5">
          <p className="font-medium">Payment confirmed: {raw.reels} credits added.</p>
          <Link href="/dashboard/new" className="button mt-4">
            Make a reel
          </Link>
        </div>
      )}
      {order.status === "submitted" && (
        <div className="bg-surface mt-6 rounded-[8px] p-5 text-[14px]">
          <p className="font-medium">Thanks! We&apos;re confirming your payment.</p>
          <p className="text-muted mt-1">
            UTR {raw.utr}. We match it against our bank statement, usually within a few hours, and
            the credits appear on your account. You can close this page.
          </p>
        </div>
      )}
      {order.status === "rejected" && (
        <div className="bg-surface mt-6 rounded-[8px] p-5 text-[14px]">
          <p className="font-medium">We couldn&apos;t match this payment.</p>
          <p className="text-muted mt-1">
            {raw.reason || "The UTR did not match a payment we received."} If money left your
            account, reply to our email or write to us with a screenshot and we&apos;ll sort it out.
          </p>
        </div>
      )}

      {order.status === "created" &&
        (upi ? (
          <Pay
            id={order.id}
            link={upiLink(upi, rupees, raw.ref)}
            svg={await upiQrSvg(upiLink(upi, rupees, raw.ref))}
            vpa={upi.vpa}
            payee={upi.payee}
            rupees={rupees}
            reference={raw.ref}
            error={error}
          />
        ) : (
          <p className="bg-surface mt-6 rounded-[8px] p-5 text-[14px]">
            Payments are not switched on yet.
          </p>
        ))}
    </div>
  );
}

function Pay(p: {
  id: string;
  link: string;
  svg: string;
  vpa: string;
  payee: string;
  rupees: number;
  reference: string;
  error?: string;
}) {
  return (
    <>
      <ol className="mt-6 space-y-6">
        <li className="bg-surface rounded-[8px] p-5">
          <p className="label">1 · Pay {formatPrice(p.rupees)}</p>
          <div className="mt-3 flex flex-wrap items-start gap-6">
            <div
              className="w-[200px] shrink-0 rounded-[8px] bg-white p-2"
              aria-label={`UPI QR code for ${formatPrice(p.rupees)} to ${p.vpa}`}
              role="img"
              dangerouslySetInnerHTML={{ __html: p.svg }}
            />
            <div className="min-w-[200px] flex-1 space-y-2 text-[14px]">
              <p>Scan with any UPI app, or on your phone:</p>
              <a href={p.link} className="button">
                Open my UPI app
              </a>
              <p className="text-muted pt-2">
                Or pay <span className="text-text font-medium">{formatPrice(p.rupees)}</span> to{" "}
                <span className="text-text select-all font-medium">{p.vpa}</span> ({p.payee}) and
                add <span className="text-text select-all font-medium">{p.reference}</span> in the
                note.
              </p>
            </div>
          </div>
        </li>
        <li className="bg-surface rounded-[8px] p-5">
          <p className="label">2 · Send us the UTR</p>
          <p className="text-muted mt-1 text-[14px]">
            After paying, open the payment in your UPI app: the UTR (or UPI reference / transaction
            ID) is a 12-digit number.
          </p>
          <form action={submitUtr} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input
              name="utr"
              inputMode="numeric"
              pattern="[0-9 ]{12,15}"
              required
              placeholder="12-digit UTR"
              aria-label="UTR"
              className="bg-raised h-11 min-w-[220px] flex-1 rounded-[8px] px-3 tabular-nums"
            />
            <button type="submit" className="button">
              I&apos;ve paid
            </button>
          </form>
          {p.error && <p className="mt-2 text-[13px] text-[#ff8a66]">{p.error}</p>}
        </li>
      </ol>
      <p className="text-muted mt-4 text-[13px]">
        Credits are added once we confirm the payment, usually within a few hours. Please pay the
        exact amount so we can match it.
      </p>
    </>
  );
}
