import { NextResponse } from "next/server";
import { getActiveAdminSession, type AdminSessionData } from "@/lib/session";
import type { IronSession } from "iron-session";

/**
 * Guard for /api/admin/* route handlers (FSD §4.1: all admin routes are
 * protected by a session check). Returns the session, or a 401 response.
 */
export async function requireAdmin(): Promise<
  { session: IronSession<AdminSessionData>; response?: never } | { session?: never; response: NextResponse }
> {
  const session = await getActiveAdminSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}
