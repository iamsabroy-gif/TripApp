import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

// FSD §4.1 — POST /api/admin/login
// Identical generic message + 401 for every failure mode, so the response
// never reveals whether the username or the password was wrong.
const GENERIC_FAILURE = { error: "Invalid username or password" };

const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = checkRateLimit(`login:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { username: parsed.data.username },
  });

  // Constant-shape comparison: hash check runs against a dummy hash when the
  // user doesn't exist, keeping timing roughly uniform.
  const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZL8QkAxvGXlqOZzcnO3q0nO3q0nO3q";
  const ok = await bcrypt.compare(
    parsed.data.password,
    admin?.passwordHash ?? DUMMY_HASH
  );

  if (!admin || !ok) {
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const session = await getSession();
  session.adminId = admin.id;
  session.username = admin.username;
  session.lastActivityAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true, username: admin.username });
}
