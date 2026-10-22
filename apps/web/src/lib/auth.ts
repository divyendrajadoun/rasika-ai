import "server-only";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { adminEmails, notifyAdmins } from "@/lib/notify";
import { siteUrl } from "@/lib/site";

export interface SessionUser {
  id: string;
  email: string;
}

/** Current Supabase user, or null. */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return { id: user.id, email: user.email };
}

/** Redirects to /login when signed out; ensures a `profiles` row exists (free plan, 1 credit). */
export async function requireUser(
  next = "/dashboard",
): Promise<SessionUser & { credits: number; plan: string }> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  await ensureProfile(user);
  const [profile] = await db
    .update(schema.profiles)
    .set({ email: user.email })
    .where(eq(schema.profiles.userId, user.id))
    .returning({ credits: schema.profiles.credits, plan: schema.profiles.plan });
  return { ...user, credits: profile?.credits ?? 0, plan: profile?.plan ?? "free" };
}

/** The first visit after signing up makes the profile (free plan, 1 credit) and tells the admins. */
async function ensureProfile(user: SessionUser): Promise<void> {
  const [created] = await db
    .insert(schema.profiles)
    .values({ userId: user.id, email: user.email })
    .onConflictDoNothing({ target: schema.profiles.userId })
    .returning({ userId: schema.profiles.userId });
  if (created) {
    await db.insert(schema.creditLedger).values({ userId: user.id, delta: 1, reason: "signup" });
    await notifyAdmins(
      `New sign-up: ${user.email}`,
      `${user.email} just signed up on Rasika (${new Date().toUTCString()}).

Every sign-up: ${siteUrl}/admin`,
    );
  }
}

/** The admin pages: signed in with an email listed in ADMIN_EMAILS, or a 404. */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!adminEmails().includes(user.email.toLowerCase())) notFound();
  return user;
}

/** For Route Handlers: returns the user or a 401 Response. */
export async function requireApiUser(): Promise<SessionUser | Response> {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  await ensureProfile(user);
  return user;
}

export const profilesTable = schema.profiles;
export const byUser = (userId: string) => eq(schema.projects.userId, userId);
