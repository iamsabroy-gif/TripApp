import { prisma } from "@/lib/db";
import { serializeTripSummary } from "@/lib/trips";
import { TripList } from "@/components/public/TripList";

// FSD §4.7: ISR — revalidate every 5 minutes; trip data changes only when
// the admin publishes, so this comfortably meets the 2–3 s 4G load target.
export const revalidate = 300;

async function loadPublishedTrips() {
  try {
    return await prisma.trip.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { startDate: "asc" },
    });
  } catch {
    // Fail soft when the DB is unreachable (e.g. build-time prerender in CI):
    // the page is regenerated with real data on the next ISR revalidation.
    return [];
  }
}

export default async function TripListingPage() {
  const trips = await loadPublishedTrips();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Upcoming Treks
        </h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Hand-crafted trekking itineraries across India. Open a trek to walk
          its route on the map, day by day.
        </p>
      </div>
      <TripList trips={trips.map(serializeTripSummary)} />
    </div>
  );
}
