import { prisma } from "@/lib/db";
import { destroyCloudinaryAssets } from "@/lib/cloudinary";
import type { TripPayload } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Serialization: Prisma Date/Decimal -> plain JSON for API responses
// ---------------------------------------------------------------------------

const fullTripInclude = {
  days: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      sites: { include: { images: true } },
    },
  },
} satisfies Prisma.TripInclude;

type FullTrip = Prisma.TripGetPayload<{ include: typeof fullTripInclude }>;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function serializeTripSummary(trip: FullTrip | Prisma.TripGetPayload<object>) {
  return {
    id: trip.id,
    name: trip.name,
    startDate: toIsoDate(trip.startDate),
    endDate: toIsoDate(trip.endDate),
    durationDays:
      Math.round(
        (trip.endDate.getTime() - trip.startDate.getTime()) / (24 * 60 * 60 * 1000)
      ) + 1,
    coverImageUrl: trip.coverImageUrl,
    shortDescription: trip.shortDescription,
    difficulty: trip.difficulty,
    basePrice: trip.basePrice === null ? null : Number(trip.basePrice),
    status: trip.status,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

export function serializeFullTrip(trip: FullTrip) {
  return {
    ...serializeTripSummary(trip),
    coverImagePublicId: trip.coverImagePublicId,
    days: trip.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      locationName: day.locationName,
      latitude: Number(day.latitude),
      longitude: Number(day.longitude),
      dayDescription: day.dayDescription,
      sortOrder: day.sortOrder,
      sites: day.sites.map((site) => ({
        id: site.id,
        siteName: site.siteName,
        siteDescription: site.siteDescription,
        images: site.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          cloudPublicId: img.cloudPublicId,
        })),
      })),
    })),
  };
}

export async function getFullTrip(id: string, publishedOnly = false) {
  return prisma.trip.findFirst({
    where: publishedOnly ? { id, status: "PUBLISHED" } : { id },
    include: fullTripInclude,
  });
}

// ---------------------------------------------------------------------------
// Create / update from the nested admin payload (FSD §4.3)
// ---------------------------------------------------------------------------

function tripScalarData(payload: TripPayload) {
  return {
    name: payload.name,
    startDate: new Date(payload.startDate),
    endDate: new Date(payload.endDate),
    coverImageUrl: payload.coverImageUrl ?? null,
    coverImagePublicId: payload.coverImagePublicId ?? null,
    shortDescription: payload.shortDescription ?? null,
    difficulty: payload.difficulty ?? null,
    basePrice: payload.basePrice ?? null,
    status: payload.status,
  };
}

function daysCreateData(payload: TripPayload): Prisma.ItineraryDayCreateWithoutTripInput[] {
  return payload.days.map((day) => ({
    dayNumber: day.dayNumber,
    locationName: day.locationName,
    latitude: day.latitude,
    longitude: day.longitude,
    dayDescription: day.dayDescription ?? null,
    sortOrder: day.sortOrder,
    sites: {
      create: day.sites.map((site) => ({
        siteName: site.siteName,
        siteDescription: site.siteDescription ?? null,
        images: {
          create: site.images.map((img) => ({
            imageUrl: img.imageUrl,
            cloudPublicId: img.cloudPublicId ?? null,
          })),
        },
      })),
    },
  }));
}

export async function createTrip(payload: TripPayload) {
  return prisma.trip.create({
    data: {
      ...tripScalarData(payload),
      days: { create: daysCreateData(payload) },
    },
    include: fullTripInclude,
  });
}

/**
 * Full update (PUT): scalar fields are updated in place; the itinerary tree
 * (days -> sites -> images) is replaced with the incoming payload inside a
 * transaction. Cloudinary assets that disappeared from the payload are
 * destroyed best-effort afterwards (FSD §4.6, no orphaned storage).
 */
export async function updateTrip(id: string, payload: TripPayload) {
  const before = await getFullTrip(id);
  if (!before) return null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.itineraryDay.deleteMany({ where: { tripId: id } });
    return tx.trip.update({
      where: { id },
      data: {
        ...tripScalarData(payload),
        days: { create: daysCreateData(payload) },
      },
      include: fullTripInclude,
    });
  });

  // Cloudinary cleanup for images removed in this update
  const beforeIds = new Set<string>();
  for (const day of before.days)
    for (const site of day.sites)
      for (const img of site.images)
        if (img.cloudPublicId) beforeIds.add(img.cloudPublicId);
  if (before.coverImagePublicId) beforeIds.add(before.coverImagePublicId);

  const afterIds = new Set<string>();
  for (const day of payload.days)
    for (const site of day.sites)
      for (const img of site.images)
        if (img.cloudPublicId) afterIds.add(img.cloudPublicId);
  if (payload.coverImagePublicId) afterIds.add(payload.coverImagePublicId);

  destroyCloudinaryAssets([...beforeIds].filter((pid) => !afterIds.has(pid)));

  return updated;
}

export async function deleteTrip(id: string) {
  const trip = await getFullTrip(id);
  if (!trip) return false;

  // ON DELETE CASCADE (FSD §5) removes days, sites, images and enquiries.
  await prisma.trip.delete({ where: { id } });

  const publicIds: (string | null)[] = [trip.coverImagePublicId];
  for (const day of trip.days)
    for (const site of day.sites)
      for (const img of site.images) publicIds.push(img.cloudPublicId);
  destroyCloudinaryAssets(publicIds);

  return true;
}

/**
 * Duplicate a trip + itinerary days + sites, excluding images
 * (FSD §4.2: images excluded unless deep-copy is confirmed in scope).
 * The copy is always created as a DRAFT.
 */
export async function duplicateTrip(id: string) {
  const source = await getFullTrip(id);
  if (!source) return null;

  return prisma.trip.create({
    data: {
      name: `${source.name} (copy)`,
      startDate: source.startDate,
      endDate: source.endDate,
      shortDescription: source.shortDescription,
      difficulty: source.difficulty,
      basePrice: source.basePrice,
      status: "DRAFT",
      days: {
        create: source.days.map((day) => ({
          dayNumber: day.dayNumber,
          locationName: day.locationName,
          latitude: day.latitude,
          longitude: day.longitude,
          dayDescription: day.dayDescription,
          sortOrder: day.sortOrder,
          sites: {
            create: day.sites.map((site) => ({
              siteName: site.siteName,
              siteDescription: site.siteDescription,
            })),
          },
        })),
      },
    },
    include: fullTripInclude,
  });
}

/**
 * Bulk day reorder (FSD §4.3). Two-pass update inside a transaction because
 * of the UNIQUE(trip_id, sort_order) constraint: park rows on negative
 * sort orders first, then apply the final values.
 */
export async function reorderDays(
  tripId: string,
  days: { id: string; sortOrder: number }[]
): Promise<boolean> {
  const existing = await prisma.itineraryDay.findMany({
    where: { tripId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((d) => d.id));
  if (days.length !== existingIds.size || !days.every((d) => existingIds.has(d.id))) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    for (const [i, day] of days.entries()) {
      await tx.itineraryDay.update({
        where: { id: day.id },
        data: { sortOrder: -(i + 1) },
      });
    }
    for (const day of days) {
      await tx.itineraryDay.update({
        where: { id: day.id },
        data: { sortOrder: day.sortOrder },
      });
    }
  });

  return true;
}
