"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { FullTrip } from "./types";
import { ImageGallery } from "./ImageGallery";
import { EnquiryForm } from "./EnquiryForm";
import { formatDateRange, formatPrice } from "./TripList";

// Leaflet is lazy-loaded only on the trip-detail route (NFR: load time).
const TripMap = dynamic(() => import("./TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl bg-stone-200 sm:h-96" />
  ),
});

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  DIFFICULT: "bg-rose-100 text-rose-800",
};

export function TripDetail({ trip }: { trip: FullTrip }) {
  const [activeDayId, setActiveDayId] = useState<string | null>(
    trip.days[0]?.id ?? null
  );
  const dayRefs = useRef<Map<string, HTMLElement>>(new Map());

  function selectDay(dayId: string) {
    setActiveDayId(dayId);
    dayRefs.current.get(dayId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Trip-level metadata (FSD §4.8) */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">
            {trip.name}
          </h1>
          {trip.difficulty && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${DIFFICULTY_BADGE[trip.difficulty]}`}
            >
              {trip.difficulty.charAt(0) + trip.difficulty.slice(1).toLowerCase()}
            </span>
          )}
        </div>
        <p className="mt-2 text-stone-600">
          {formatDateRange(trip.startDate, trip.endDate)} · {trip.durationDays}{" "}
          {trip.durationDays === 1 ? "day" : "days"}
          {trip.basePrice !== null && (
            <>
              {" "}
              · <span className="font-semibold text-forest-700">
                From {formatPrice(trip.basePrice)}
              </span>
            </>
          )}
        </p>
        {trip.shortDescription && (
          <p className="mt-3 max-w-3xl text-stone-700">{trip.shortDescription}</p>
        )}
      </div>

      {trip.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trip.coverImageUrl}
          alt={trip.name}
          className="mb-6 h-64 w-full rounded-xl object-cover sm:h-80"
        />
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Route map: numbered day markers + polyline (FSD §4.8) */}
          {trip.days.length > 0 && (
            <TripMap
              days={trip.days}
              activeDayId={activeDayId}
              onSelectDay={selectDay}
            />
          )}

          {/* Day-by-day itinerary */}
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-stone-900">Itinerary</h2>
            {trip.days.map((day) => (
              <article
                key={day.id}
                ref={(el) => {
                  if (el) dayRefs.current.set(day.id, el);
                }}
                onClick={() => setActiveDayId(day.id)}
                className={`cursor-pointer rounded-xl border bg-white p-5 transition ${
                  activeDayId === day.id
                    ? "border-forest-400 ring-1 ring-forest-400"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <header className="flex items-baseline gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-600 text-sm font-bold text-white">
                    {day.dayNumber}
                  </span>
                  <div>
                    <h3 className="font-semibold text-stone-900">{day.locationName}</h3>
                    <p className="text-xs text-stone-500">
                      {Number(day.latitude).toFixed(4)}°, {Number(day.longitude).toFixed(4)}°
                    </p>
                  </div>
                </header>
                {day.dayDescription && (
                  <p className="mt-3 text-sm text-stone-700">{day.dayDescription}</p>
                )}
                {day.sites.map((site) => (
                  <div key={site.id} className="mt-4 border-l-2 border-forest-200 pl-4">
                    <h4 className="text-sm font-semibold text-stone-800">
                      📍 {site.siteName}
                    </h4>
                    {site.siteDescription && (
                      <p className="mt-1 text-sm text-stone-600">{site.siteDescription}</p>
                    )}
                    <ImageGallery images={site.images} alt={site.siteName} />
                  </div>
                ))}
              </article>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-20 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <EnquiryForm tripId={trip.id} tripName={trip.name} />
          </div>
        </aside>
      </div>
    </div>
  );
}
