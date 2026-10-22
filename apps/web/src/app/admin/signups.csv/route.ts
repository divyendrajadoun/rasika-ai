import { listSignups } from "@/lib/admin";
import { getUser } from "@/lib/auth";
import { adminEmails } from "@/lib/notify";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  // quoted, and never read as a formula by a spreadsheet
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Every sign-up as CSV (admins only). */
export async function GET() {
  const user = await getUser();
  if (!user || !adminEmails().includes(user.email.toLowerCase()))
    return new Response("Not found", { status: 404 });
  const rows = await listSignups();
  const head = [
    "email",
    "name",
    "joined",
    "sign_in",
    "confirmed",
    "last_seen",
    "reels",
    "credits",
    "paid_inr",
    "plan",
  ];
  const body = rows.map((r) =>
    [
      r.email,
      r.name,
      r.joined,
      r.provider,
      r.confirmed,
      r.lastSignIn,
      r.reels,
      r.credits,
      r.paidRupees,
      r.plan,
    ]
      .map(cell)
      .join(","),
  );
  return new Response([head.join(","), ...body].join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rasika-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
