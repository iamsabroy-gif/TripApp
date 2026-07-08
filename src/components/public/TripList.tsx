"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface TripSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  coverImageUrl: string | null;
  shortDescription: string | null;
  difficulty: "EASY" | "MODERATE" | "DIFFICULT" | null;
  basePrice: number | null;
  status: string;
}

type SortKey = "date" | "difficulty" | "duration";

const DIFFICULTY_RANK = { EASY: 0, MODERATE: 1, DIFFICULT: 2 };

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  DIFFICULT: "bg-rose-100 text-rose-800",
};

export function formatDateRange(startDate: string, endDate: string): string {
  const fmt = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(new Date(startDate))} – ${fmt.format(new Date(endDate))}`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

// FSD §4.7 optional sort — applied client-side over the ISR-rendered list
// (data volume is tens to low hundreds of trips, so this is instant and
// keeps the page statically cacheable).
export function TripList({ trips }: { trips: TripSummary[] }) {
  const [sort, setSort] = useState<SortKey>("date");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const copy = [...trips];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sort === "date") cmp = a.startDate.localeCompare(b.startDate);
      else if (sort === "duration") cmp = a.durationDays - b.durationDays;
      else if (sort === "difficulty")
        cmp =
          (a.difficulty ? DIFFICULTY_RANK[a.difficulty] : -1) -
          (b.difficulty ? DIFFICULTY_RANK[b.difficulty] : -1);
      return order === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [trips, sort, order]);

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
        No treks are published yet — check back soon!
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <label className="text-stone-600" htmlFor="sort">
          Sort by
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5"
        >
          <option value="date">Start date</option>
          <option value="difficulty">Difficulty</option>
          <option value="duration">Duration</option>
        </select>
        <button
          type="button"
          onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100"
          aria-label={`Sort ${order === "asc" ? "descending" : "ascending"}`}
        >
          {order === "asc" ? "↑ Ascending" : "↓ Descending"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((trip) => (
          <Link
            key={trip.id}
            href={`/trips/${trip.id}`}
            className="group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative h-44 w-full bg-forest-100">
              {trip.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trip.coverImageUrl}
                  alt={trip.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl">
                  🏔️
                </div>
              )}
              {trip.difficulty && (
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${DIFFICULTY_BADGE[trip.difficulty]}`}
                >
                  {trip.difficulty.charAt(0) + trip.difficulty.slice(1).toLowerCase()}
                </span>
              )}
            </div>
            <div className="p-4">
              <h2 className="text-lg font-semibold text-stone-900 group-hover:text-forest-700">
                {trip.name}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {formatDateRange(trip.startDate, trip.endDate)} · {trip.durationDays}{" "}
                {trip.durationDays === 1 ? "day" : "days"}
              </p>
              {trip.shortDescription && (
                <p className="mt-2 line-clamp-2 text-sm text-stone-600">
                  {trip.shortDescription}
                </p>
              )}
              {trip.basePrice !== null && (
                <p className="mt-3 text-sm font-semibold text-forest-700">
                  From {formatPrice(trip.basePrice)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
