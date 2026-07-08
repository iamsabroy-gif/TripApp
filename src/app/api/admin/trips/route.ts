import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { tripPayloadSchema, flattenZodError } from "@/lib/validation";
import { createTrip, serializeFullTrip, serializeTripSummary } from "@/lib/trips";

// FSD §4.2 — GET /api/admin/trips: all trips (draft + published) with
// summary fields for the dashboard.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const trips = await prisma.trip.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { enquiries: true } } },
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      ...serializeTripSummary(t),
      enquiryCount: t._count.enquiries,
    })),
  });
}

// FSD §4.3/§4.4 — POST /api/admin/trips: create from a single nested payload.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

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

  const trip = await createTrip(parsed.data);
  return NextResponse.json({ trip: serializeFullTrip(trip) }, { status: 201 });
}
