import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tripPayloadSchema, flattenZodError, TRIP_STATUSES } from "@/lib/validation";
import { deleteTrip, getFullTrip, serializeFullTrip, updateTrip } from "@/lib/trips";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/trips/:id — full payload for the editor (drafts included).
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const trip = await getFullTrip(id);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  return NextResponse.json({ trip: serializeFullTrip(trip) });
}

// FSD §4.3/§4.4 — PUT /api/admin/trips/:id: full update with nested itinerary.
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = tripPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: flattenZodError(parsed.error) },
      { status: 422 }
    );
  }

  const trip = await updateTrip(id, parsed.data);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  return NextResponse.json({ trip: serializeFullTrip(trip) });
}

// FSD §4.2 — PATCH /api/admin/trips/:id: partial update (status toggle from
// the dashboard). Publishing via PATCH enforces the publish rule set.
const patchSchema = z.object({ status: z.enum(TRIP_STATUSES) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: flattenZodError(parsed.error) },
      { status: 422 }
    );
  }

  const trip = await getFullTrip(id);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  if (parsed.data.status === "PUBLISHED" && trip.days.length === 0) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: { days: "A published trip needs at least one itinerary day" },
      },
      { status: 422 }
    );
  }

  const updated = await prisma.trip.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ trip: { id: updated.id, status: updated.status } });
}

// FSD §4.2 — DELETE /api/admin/trips/:id (cascades through the itinerary tree).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const deleted = await deleteTrip(id);
  if (!deleted) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
