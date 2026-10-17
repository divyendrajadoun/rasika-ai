"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}
const email = (fd: FormData) =>
  String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
const back = (next: string, q: Record<string, string>) =>
  redirect(`/login?${new URLSearchParams({ next, ...q }).toString()}`);

/** Magic link (Supabase email OTP). Note: Supabase's built-in mailer is rate-limited. */
export async function sendMagicLink(fd: FormData) {
  const next = safeNext(fd.get("next"));
  const e = email(fd);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) back(next, { error: "email" });
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: e,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) back(next, { error: error.message });
  back(next, { sent: "link", email: e });
}

/** Email + password sign-in (so testing isn't blocked by email rate limits). */
export async function signInWithPassword(fd: FormData) {
  const next = safeNext(fd.get("next"));
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: email(fd),
    password: String(fd.get("password") ?? ""),
  });
  if (error) back(next, { error: error.message, mode: "password" });
  redirect(next);
}

export async function signUpWithPassword(fd: FormData) {
  const next = safeNext(fd.get("next"));
  const e = email(fd);
  const password = String(fd.get("password") ?? "");
  if (password.length < 8)
    back(next, { error: "Password must be at least 8 characters.", mode: "password" });
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: e,
    password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) back(next, { error: error.message, mode: "password" });
  if (!data.session) back(next, { sent: "confirm", email: e });
  redirect(next);
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
