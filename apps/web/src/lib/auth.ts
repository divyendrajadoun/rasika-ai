import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";

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
  const [profile] = await db
    .insert(schema.profiles)
    .values({ userId: user.id, email: user.email })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: { email: user.email } })
    .returning({ credits: schema.profiles.credits, plan: schema.profiles.plan });
  return { ...user, credits: profile?.credits ?? 0, plan: profile?.plan ?? "free" };
}

/** For Route Handlers: returns the user or a 401 Response. */
export async function requireApiUser(): Promise<SessionUser | Response> {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  await db
    .insert(schema.profiles)
    .values({ userId: user.id, email: user.email })
    .onConflictDoNothing({ target: schema.profiles.userId });
  return user;
}

export const profilesTable = schema.profiles;
export const byUser = (userId: string) => eq(schema.projects.userId, userId);
