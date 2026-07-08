import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, sessionTtlMinutes, type AdminSessionData } from "@/lib/session";

// FSD §4.1 — every /admin/* page is behind the session check. API routes
// (/api/admin/*) additionally enforce this themselves via requireAdmin().
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<AdminSessionData>(req, res, sessionOptions());

  const ttlMs = sessionTtlMinutes() * 60 * 1000;
  const active =
    session.adminId &&
    session.lastActivityAt &&
    Date.now() - session.lastActivityAt <= ttlMs;

  if (!active) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
