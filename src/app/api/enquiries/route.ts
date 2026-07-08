import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enquirySchema, flattenZodError } from "@/lib/validation";
import { notifyEnquiryCreated } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

// FSD §4.9 — POST /api/enquiries: public lead-capture endpoint.
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  // Light abuse guard on top of the honeypot: 10 submissions / 15 min / IP.
  const limit = checkRateLimit(`enquiry:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: flattenZodError(parsed.error) },
      { status: 422 }
    );
  }
  const { tripId, name, phone, email } = parsed.data;

  // Enquiries may only target published trips.
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, status: "PUBLISHED" },
    select: { id: true, name: true },
  });
  if (!trip) {
    return NextResponse.json(
      { error: "Validation failed", fields: { tripId: "Trip not found" } },
      { status: 422 }
    );
  }

  const enquiry = await prisma.enquiry.create({
    data: { tripId, name, phone, email },
  });

  // Fire-and-forget notification stub (FSD §8.3).
  void notifyEnquiryCreated({
    enquiryId: enquiry.id,
    tripId: trip.id,
    tripName: trip.name,
    name,
    phone,
    email,
    submittedAt: enquiry.submittedAt.toISOString(),
  });

  return NextResponse.json({ ok: true, id: enquiry.id }, { status: 201 });
}
