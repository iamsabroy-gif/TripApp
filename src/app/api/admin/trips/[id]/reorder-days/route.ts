import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { reorderDaysSchema, flattenZodError } from "@/lib/validation";
import { reorderDays } from "@/lib/trips";

// FSD §4.3 — PATCH /api/admin/trips/:id/reorder-days: bulk sort_order update
// persisted from drag-and-drop in the itinerary builder.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reorderDaysSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: flattenZodError(parsed.error) },
      { status: 422 }
    );
  }

  const ok = await reorderDays(id, parsed.data.days);
  if (!ok) {
    return NextResponse.json(
      { error: "Reorder payload must cover exactly the trip's itinerary days" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
