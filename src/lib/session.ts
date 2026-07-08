import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

// Admin session per FSD §4.1: HTTP-only, Secure, SameSite=Lax cookie with a
// sliding inactivity expiry (default 45 minutes, configurable via env).

export interface AdminSessionData {
  adminId?: string;
  username?: string;
  /** Unix ms timestamp of the last authenticated request (sliding expiry). */
  lastActivityAt?: number;
}

export const SESSION_COOKIE_NAME = "tripapp_admin_session";

export function sessionTtlMinutes(): number {
  const raw = Number(process.env.SESSION_TTL_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 45;
}

export function sessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: secret,
    // Cookie lifetime is generous; the real inactivity window is enforced
    // server-side via lastActivityAt (sliding expiry).
    ttl: 60 * 60 * 24,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession(): Promise<IronSession<AdminSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, sessionOptions());
}

/**
 * Returns the active admin session or null if not logged in / expired.
 * Refreshes the sliding-expiry timestamp on every successful check.
 */
export async function getActiveAdminSession(): Promise<IronSession<AdminSessionData> | null> {
  const session = await getSession();
  if (!session.adminId || !session.lastActivityAt) return null;

  const ttlMs = sessionTtlMinutes() * 60 * 1000;
  if (Date.now() - session.lastActivityAt > ttlMs) {
    session.destroy();
    return null;
  }

  session.lastActivityAt = Date.now();
  await session.save();
  return session;
}
