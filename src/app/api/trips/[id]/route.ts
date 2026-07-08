import { NextRequest, NextResponse } from "next/server";
import { getFullTrip, serializeFullTrip } from "@/lib/trips";
import { z } from "zod";

// FSD §4.8 — GET /api/trips/:id: full public trip payload (ordered days,
// sites, image URLs). Draft trips 404 — publishedOnly is enforced in the query.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const trip = await getFullTrip(id, /* publishedOnly */ true);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const { coverImagePublicId: _omit, ...publicTrip } = serializeFullTrip(trip);
  return NextResponse.json({ trip: publicTrip });
}
