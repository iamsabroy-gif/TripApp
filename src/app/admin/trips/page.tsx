"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// FSD §4.2 — Trip Management Dashboard: all trips (draft + published) with
// Edit / Publish-Unpublish / Duplicate / Delete actions.

interface DashboardTrip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  difficulty: string | null;
  basePrice: number | null;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
  enquiryCount: number;
}

export default function AdminTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<DashboardTrip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/trips");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setTrips(data.trips);
    } catch {
      setError("Failed to load trips.");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(trip: DashboardTrip) {
    setBusyId(trip.id);
    setError(null);
    const res = await fetch(`/api/admin/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: trip.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.fields ? Object.values<string>(data.fields).join("; ") : "Update failed."
      );
    }
    await load();
    setBusyId(null);
  }

  async function duplicate(trip: DashboardTrip) {
    setBusyId(trip.id);
    setError(null);
    const res = await fetch(`/api/admin/trips/${trip.id}/duplicate`, { method: "POST" });
    if (!res.ok) setError("Duplicate failed.");
    await load();
    setBusyId(null);
  }

  async function remove(trip: DashboardTrip) {
    if (
      !window.confirm(
        `Delete "${trip.name}"? This removes its full itinerary and ${trip.enquiryCount} enquir${trip.enquiryCount === 1 ? "y" : "ies"}, permanently.`
      )
    ) {
      return;
    }
    setBusyId(trip.id);
    setError(null);
    const res = await fetch(`/api/admin/trips/${trip.id}`, { method: "DELETE" });
    if (!res.ok) setError("Delete failed.");
    await load();
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Trips</h1>
        <Link
          href="/admin/trips/new"
          className="rounded-lg bg-forest-600 px-4 py-2 font-medium text-white hover:bg-forest-700"
        >
          + New trip
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {trips === null ? (
        <div className="rounded-xl bg-white p-12 text-center text-stone-500">Loading…</div>
      ) : trips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
          No trips yet. Create your first trek!
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Enquiries</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    <Link
                      href={`/admin/trips/${trip.id}`}
                      className="hover:text-forest-700 hover:underline"
                    >
                      {trip.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {trip.startDate} → {trip.endDate}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{trip.difficulty ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        trip.status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {trip.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{trip.enquiryCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === trip.id}
                        onClick={() => toggleStatus(trip)}
                        className="rounded-md border border-stone-300 px-2.5 py-1 text-xs hover:bg-stone-100 disabled:opacity-50"
                      >
                        {trip.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      <Link
                        href={`/admin/trips/${trip.id}`}
                        className="rounded-md border border-stone-300 px-2.5 py-1 text-xs hover:bg-stone-100"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === trip.id}
                        onClick={() => duplicate(trip)}
                        className="rounded-md border border-stone-300 px-2.5 py-1 text-xs hover:bg-stone-100 disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        disabled={busyId === trip.id}
                        onClick={() => remove(trip)}
                        className="rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
