import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// FSD §4.1 — POST /api/admin/logout
export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
