import "server-only";
import { createClient } from "@supabase/supabase-js";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/lib/env";

/** How each account signed in, from Supabase Auth (service role; server only). */
async function authUsers(): Promise<
  Map<
    string,
    { provider: string; confirmed: boolean; lastSignIn: string | null; name: string | null }
  >
> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const out = new Map<
    string,
    { provider: string; confirmed: boolean; lastSignIn: string | null; name: string | null }
  >();
  if (!key) return out;
  const admin = createClient(env.supabaseUrl, key, { auth: { persistSession: false } });
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
      out.set(u.id, {
        provider: String(u.app_metadata?.provider ?? "email"),
        confirmed: Boolean(u.email_confirmed_at),
        lastSignIn: u.last_sign_in_at ?? null,
        name: meta.full_name ?? meta.name ?? null,
      });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

/** Every account: who, when, how they signed in, credits, reels made, rupees paid. */
export async function listSignups() {
  const [profiles, reels, paid, auth] = await Promise.all([
    db.select().from(schema.profiles).orderBy(desc(schema.profiles.createdAt)),
    db
      .select({ userId: schema.projects.userId, n: sql<number>`count(*)::int` })
      .from(schema.projects)
      .where(sql`${schema.projects.status} <> 'draft' and ${schema.projects.deletedAt} is null`)
      .groupBy(schema.projects.userId),
    db
      .select({
        userId: schema.payments.userId,
        rupees: sql<number>`sum(${schema.payments.amountMinor})::int / 100`,
      })
      .from(schema.payments)
      .where(eq(schema.payments.status, "paid"))
      .groupBy(schema.payments.userId),
    authUsers(),
  ]);
  const reelsBy = new Map(reels.map((r) => [r.userId, r.n]));
  const paidBy = new Map(paid.map((r) => [r.userId, r.rupees]));
  return profiles.map((p) => ({
    userId: p.userId,
    email: p.email,
    name: auth.get(p.userId)?.name ?? null,
    joined: p.createdAt,
    provider: auth.get(p.userId)?.provider ?? "?",
    confirmed: auth.get(p.userId)?.confirmed ?? false,
    lastSignIn: auth.get(p.userId)?.lastSignIn ?? null,
    plan: p.plan,
    credits: p.credits,
    reels: reelsBy.get(p.userId) ?? 0,
    paidRupees: paidBy.get(p.userId) ?? 0,
  }));
}
export type Signup = Awaited<ReturnType<typeof listSignups>>[number];
