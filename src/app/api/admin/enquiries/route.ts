import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

// FSD §4.5 — GET /api/admin/enquiries?trip_id=&from=&to=&page=&page_size=
// Paginated, filterable by trip and submitted-at date range.

const querySchema = z.object({
  trip_id: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const { trip_id, from, to, page, page_size } = parsed.data;

  const where: Prisma.EnquiryWhereInput = {};
  if (trip_id) where.tripId = trip_id;
  if (from || to) {
    where.submittedAt = {};
    if (from) where.submittedAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.submittedAt.lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [total, enquiries] = await prisma.$transaction([
    prisma.enquiry.count({ where }),
    prisma.enquiry.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * page_size,
      take: page_size,
      include: { trip: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize: page_size,
    enquiries: enquiries.map((e) => ({
      id: e.id,
      tripId: e.tripId,
      tripName: e.trip.name,
      name: e.name,
      phone: e.phone,
      email: e.email,
      submittedAt: e.submittedAt.toISOString(),
    })),
  });
}
