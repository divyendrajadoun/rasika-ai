import { NextResponse, type NextRequest } from "next/server";

// MOCK: Phase 1 auth gate. A `rasika_session` cookie stands in for a Supabase session
// so "Get started" → /login → /dashboard works end-to-end. Replaced by Supabase Auth in Phase 2.
export const SESSION_COOKIE = "rasika_session";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname === "/login" && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = req.nextUrl.searchParams.get("next") ?? "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
