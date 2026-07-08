import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tripListQuerySchema } from "@/lib/validation";
import { serializeTripSummary } from "@/lib/trips";
import type { Prisma } from "@prisma/client";

// FSD §4.7 — GET /api/trips: public, unauthenticated. Filters
// status = PUBLISHED at the query level, so drafts are never serialized
// (BRD open question §8.6, closed as "yes" in FSD §8.5).
export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = tripListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const { sort, order } = parsed.data;

  let orderBy: Prisma.TripOrderByWithRelationInput = { startDate: "asc" };
  if (sort === "date") orderBy = { startDate: order };
  else if (sort === "difficulty") orderBy = { difficulty: order };

  const trips = await prisma.trip.findMany({
    where: { status: "PUBLISHED" },
    orderBy,
  });

  let result = trips.map(serializeTripSummary);
  if (sort === "duration") {
    result = result.sort((a, b) =>
      order === "desc" ? b.durationDays - a.durationDays : a.durationDays - b.durationDays
    );
  }

  return NextResponse.json({ trips: result });
}
