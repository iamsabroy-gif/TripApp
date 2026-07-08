import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { duplicateTrip, serializeFullTrip } from "@/lib/trips";

// FSD §4.2 (optional) — POST /api/admin/trips/:id/duplicate: clones trip +
// itinerary days + sites, excluding images; copy is created as DRAFT.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const copy = await duplicateTrip(id);
  if (!copy) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  return NextResponse.json({ trip: serializeFullTrip(copy) }, { status: 201 });
}
