import { notFound } from "next/navigation";
import { getFullTrip, serializeFullTrip } from "@/lib/trips";
import { TripDetail } from "@/components/public/TripDetail";
import type { Metadata } from "next";

// FSD §4.8 — trip detail page. ISR keeps it fast; drafts are excluded at the
// query level and simply 404 on the public site.
export const revalidate = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadTrip(id: string) {
  if (!UUID_RE.test(id)) return null;
  return getFullTrip(id, /* publishedOnly */ true);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) return {};
  return {
    title: trip.name,
    description: trip.shortDescription ?? undefined,
  };
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) notFound();

  return <TripDetail trip={serializeFullTrip(trip)} />;
}
