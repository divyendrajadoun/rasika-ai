"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "rasika_session";

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

// MOCK: magic-link sign-in. Sets a cookie with the email so the dashboard can greet the user.
// Phase 2 replaces this with Supabase Auth (email magic link + Google).
export async function mockSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`/login?error=email&next=${encodeURIComponent(safeNext(formData.get("next")))}`);
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(safeNext(formData.get("next")));
}

export async function mockSignOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}
