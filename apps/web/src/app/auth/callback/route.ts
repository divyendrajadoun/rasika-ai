import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Supabase redirects here from magic-link / confirmation emails (PKCE code or token hash). */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const supabase = await createSupabaseServer();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let errorMessage: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    errorMessage = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    errorMessage = error?.message ?? null;
  } else {
    errorMessage = "Missing auth code";
  }

  if (errorMessage && code && /code verifier/i.test(errorMessage)) {
    // the link was opened in another browser or app (Gmail's, a phone): Supabase has already
    // confirmed the email, only this browser has no session yet, so ask for a sign-in
    const to = new URL("/login", url.origin);
    to.searchParams.set("sent", "confirmed");
    to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }
  if (errorMessage) {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", errorMessage);
    to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
