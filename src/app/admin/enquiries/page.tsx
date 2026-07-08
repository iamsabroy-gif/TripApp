"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// FSD §4.5 — Enquiry Management: paginated list, filterable by trip and
// submitted-at date range. Read-only by design (no CRM workflow — Phase 2).

interface EnquiryRow {
  id: string;
  tripId: string;
  tripName: string;
  name: string;
  phone: string;
  email: string;
  submittedAt: string;
}

interface TripOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

export default function AdminEnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<EnquiryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tripOptions, setTripOptions] = useState<TripOption[]>([]);
  const [tripId, setTripId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/trips")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) =>
        setTripOptions(
          data.trips.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
        )
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (tripId) params.set("trip_id", tripId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`/api/admin/enquiries?${params}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEnquiries(data.enquiries);
      setTotal(data.total);
      setError(null);
    } catch {
      setError("Failed to load enquiries.");
    }
  }, [page, tripId, from, to, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">Enquiries</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
        <div>
          <label htmlFor="f-trip" className="block text-xs font-medium text-stone-500">
            Trip
          </label>
          <select
            id="f-trip"
            value={tripId}
            onChange={(e) => {
              setTripId(e.target.value);
              setPage(1);
            }}
            className="mt-1 rounded-md border border-stone-300 bg-white px-3 py-1.5"
          >
            <option value="">All trips</option>
            {tripOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className="block text-xs font-medium text-stone-500">
            From
          </label>
          <input
            id="f-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="mt-1 rounded-md border border-stone-300 px-3 py-1.5"
          />
        </div>
        <div>
          <label htmlFor="f-to" className="block text-xs font-medium text-stone-500">
            To
          </label>
          <input
            id="f-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="mt-1 rounded-md border border-stone-300 px-3 py-1.5"
          />
        </div>
        {(tripId || from || to) && (
          <button
            type="button"
            onClick={() => {
              setTripId("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto self-center text-stone-500">
          {total} enquir{total === 1 ? "y" : "ies"}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {enquiries === null ? (
        <div className="rounded-xl bg-white p-12 text-center text-stone-500">Loading…</div>
      ) : enquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
          No enquiries match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {enquiries.map((e) => (
                <tr key={e.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">{e.name}</td>
                  <td className="px-4 py-3">
                    <a href={`tel:+91${e.phone}`} className="text-forest-700 hover:underline">
                      {e.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${e.email}`} className="text-forest-700 hover:underline">
                      {e.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{e.tripName}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {new Date(e.submittedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100 disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-stone-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
