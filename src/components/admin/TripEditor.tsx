"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPicker } from "./MapPicker";
import { ImageUploader, type UploadedImage } from "./ImageUploader";
import type { FullTrip } from "@/components/public/types";

// FSD §4.3/§4.4 — trip creation form + itinerary builder. Everything is
// edited in local state and saved as one nested payload (POST for new trips,
// PUT for existing). Days support drag-and-drop and arrow reordering;
// sort_order and day_number are derived from array position on save.

interface ImageDraft {
  imageUrl: string;
  cloudPublicId: string | null;
}

interface SiteDraft {
  key: string;
  siteName: string;
  siteDescription: string;
  images: ImageDraft[];
}

interface DayDraft {
  key: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  dayDescription: string;
  sites: SiteDraft[];
}

interface TripDraft {
  name: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  coverImagePublicId: string | null;
  shortDescription: string;
  difficulty: "" | "EASY" | "MODERATE" | "DIFFICULT";
  basePrice: string;
}

let keyCounter = 0;
const nextKey = () => `k${++keyCounter}`;

function emptyDay(): DayDraft {
  return {
    key: nextKey(),
    locationName: "",
    latitude: null,
    longitude: null,
    dayDescription: "",
    sites: [],
  };
}

function emptySite(): SiteDraft {
  return { key: nextKey(), siteName: "", siteDescription: "", images: [] };
}

function fromFullTrip(trip: FullTrip): { trip: TripDraft; days: DayDraft[] } {
  return {
    trip: {
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      coverImageUrl: trip.coverImageUrl,
      coverImagePublicId: trip.coverImagePublicId ?? null,
      shortDescription: trip.shortDescription ?? "",
      difficulty: trip.difficulty ?? "",
      basePrice: trip.basePrice === null ? "" : String(trip.basePrice),
    },
    days: trip.days.map((day) => ({
      key: nextKey(),
      locationName: day.locationName,
      latitude: day.latitude,
      longitude: day.longitude,
      dayDescription: day.dayDescription ?? "",
      sites: day.sites.map((site) => ({
        key: nextKey(),
        siteName: site.siteName,
        siteDescription: site.siteDescription ?? "",
        images: site.images.map((img) => ({
          imageUrl: img.imageUrl,
          cloudPublicId: img.cloudPublicId,
        })),
      })),
    })),
  };
}

export function TripEditor({ tripId }: { tripId?: string }) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripDraft>({
    name: "",
    startDate: "",
    endDate: "",
    coverImageUrl: null,
    coverImagePublicId: null,
    shortDescription: "",
    difficulty: "",
    basePrice: "",
  });
  const [days, setDays] = useState<DayDraft[]>([]);
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tripId));
  const [saving, setSaving] = useState<false | "DRAFT" | "PUBLISHED">(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/admin/trips/${tripId}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          throw new Error("unauthorized");
        }
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        const loaded = fromFullTrip(data.trip);
        setTrip(loaded.trip);
        setDays(loaded.days);
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== "unauthorized") {
          setGlobalError("Failed to load trip.");
          setLoading(false);
        }
      });
  }, [tripId, router]);

  // ---- client-side validation mirroring FSD §4.3 / §4.4 -------------------

  function validate(status: "DRAFT" | "PUBLISHED"): boolean {
    const next: Record<string, string> = {};
    if (!trip.name.trim()) next.name = "Trip name is required";
    if (!trip.startDate) next.startDate = "Start date is required";
    if (!trip.endDate) next.endDate = "End date is required";
    if (trip.startDate && trip.endDate && trip.endDate < trip.startDate)
      next.endDate = "End date must be on or after the start date";

    if (status === "PUBLISHED") {
      if (days.length === 0)
        next.days = "A published trip needs at least one itinerary day";
      days.forEach((day, i) => {
        if (!day.locationName.trim())
          next[`day.${day.key}`] = `Day ${i + 1} needs a location name`;
        else if (day.latitude === null || day.longitude === null)
          next[`day.${day.key}`] = `Day ${i + 1} needs a map location (drop a pin)`;
      });
    } else {
      // Drafts may be incomplete, but days that DO have coordinates must at
      // least carry a name so the payload passes server validation.
      days.forEach((day, i) => {
        if (!day.locationName.trim() || day.latitude === null || day.longitude === null)
          next[`day.${day.key}`] =
            `Day ${i + 1} needs a location name and a map pin (or remove the day before saving)`;
      });
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(status: "DRAFT" | "PUBLISHED") {
    setGlobalError(null);
    if (!validate(status)) return;
    setSaving(status);

    const payload = {
      name: trip.name.trim(),
      startDate: trip.startDate,
      endDate: trip.endDate,
      coverImageUrl: trip.coverImageUrl,
      coverImagePublicId: trip.coverImagePublicId,
      shortDescription: trip.shortDescription.trim() || null,
      difficulty: trip.difficulty || null,
      basePrice: trip.basePrice === "" ? null : Number(trip.basePrice),
      status,
      days: days.map((day, i) => ({
        dayNumber: i + 1,
        sortOrder: i + 1,
        locationName: day.locationName.trim(),
        latitude: day.latitude,
        longitude: day.longitude,
        dayDescription: day.dayDescription.trim() || null,
        sites: day.sites
          .filter((s) => s.siteName.trim())
          .map((site) => ({
            siteName: site.siteName.trim(),
            siteDescription: site.siteDescription.trim() || null,
            images: site.images,
          })),
      })),
    };

    try {
      const res = await fetch(tripId ? `/api/admin/trips/${tripId}` : "/api/admin/trips", {
        method: tripId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.push("/admin/trips");
        return;
      }
      const data = await res.json().catch(() => null);
      setGlobalError(
        data?.fields
          ? `Validation failed: ${Object.values<string>(data.fields).join("; ")}`
          : (data?.error ?? "Save failed.")
      );
    } catch {
      setGlobalError("Network error — please try again.");
    }
    setSaving(false);
  }

  // ---- day helpers ---------------------------------------------------------

  function patchDay(key: string, patch: Partial<DayDraft>) {
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function moveDay(index: number, delta: number) {
    setDays((ds) => {
      const target = index + delta;
      if (target < 0 || target >= ds.length) return ds;
      const copy = [...ds];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function dropDayOn(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    setDays((ds) => {
      const from = ds.findIndex((d) => d.key === dragKey);
      const to = ds.findIndex((d) => d.key === targetKey);
      if (from < 0 || to < 0) return ds;
      const copy = [...ds];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
    setDragKey(null);
  }

  function patchSite(dayKey: string, siteKey: string, patch: Partial<SiteDraft>) {
    setDays((ds) =>
      ds.map((d) =>
        d.key === dayKey
          ? {
              ...d,
              sites: d.sites.map((s) => (s.key === siteKey ? { ...s, ...patch } : s)),
            }
          : d
      )
    );
  }

  // ---- render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-stone-500">
        Loading trip…
      </div>
    );
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-1 focus:ring-forest-500";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">
          {tripId ? "Edit trip" : "New trip"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving !== false}
            onClick={() => save("DRAFT")}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            {saving === "DRAFT" ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            disabled={saving !== false}
            onClick={() => save("PUBLISHED")}
            className="rounded-lg bg-forest-600 px-4 py-2 font-medium text-white hover:bg-forest-700 disabled:opacity-50"
          >
            {saving === "PUBLISHED" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {globalError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {globalError}
        </div>
      )}

      {/* Trip-level fields (FSD §4.3) */}
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-stone-900">Trip details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="t-name" className="block text-sm font-medium text-stone-700">
              Trip name *
            </label>
            <input
              id="t-name"
              type="text"
              maxLength={150}
              value={trip.name}
              onChange={(e) => setTrip({ ...trip, name: e.target.value })}
              className={inputCls}
            />
            {errors.name && <p className="mt-1 text-sm text-rose-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="t-start" className="block text-sm font-medium text-stone-700">
              Start date *
            </label>
            <input
              id="t-start"
              type="date"
              value={trip.startDate}
              onChange={(e) => setTrip({ ...trip, startDate: e.target.value })}
              className={inputCls}
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-rose-600">{errors.startDate}</p>
            )}
          </div>

          <div>
            <label htmlFor="t-end" className="block text-sm font-medium text-stone-700">
              End date *
            </label>
            <input
              id="t-end"
              type="date"
              value={trip.endDate}
              min={trip.startDate || undefined}
              onChange={(e) => setTrip({ ...trip, endDate: e.target.value })}
              className={inputCls}
            />
            {errors.endDate && <p className="mt-1 text-sm text-rose-600">{errors.endDate}</p>}
          </div>

          <div>
            <label htmlFor="t-diff" className="block text-sm font-medium text-stone-700">
              Difficulty
            </label>
            <select
              id="t-diff"
              value={trip.difficulty}
              onChange={(e) =>
                setTrip({ ...trip, difficulty: e.target.value as TripDraft["difficulty"] })
              }
              className={inputCls}
            >
              <option value="">Not set</option>
              <option value="EASY">Easy</option>
              <option value="MODERATE">Moderate</option>
              <option value="DIFFICULT">Difficult</option>
            </select>
          </div>

          <div>
            <label htmlFor="t-price" className="block text-sm font-medium text-stone-700">
              Base price (₹)
            </label>
            <input
              id="t-price"
              type="number"
              min={0}
              step="0.01"
              value={trip.basePrice}
              onChange={(e) => setTrip({ ...trip, basePrice: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="t-desc" className="block text-sm font-medium text-stone-700">
              Short description
            </label>
            <textarea
              id="t-desc"
              rows={3}
              value={trip.shortDescription}
              onChange={(e) => setTrip({ ...trip, shortDescription: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <span className="block text-sm font-medium text-stone-700">Cover image</span>
            <div className="mt-2 flex items-center gap-3">
              {trip.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trip.coverImageUrl}
                  alt="Cover"
                  className="h-20 w-32 rounded-lg border border-stone-200 object-cover"
                />
              )}
              <ImageUploader
                label={trip.coverImageUrl ? "Replace cover" : "Upload cover"}
                multiple={false}
                onUploaded={([img]: UploadedImage[]) =>
                  setTrip({
                    ...trip,
                    coverImageUrl: img.imageUrl,
                    coverImagePublicId: img.cloudPublicId,
                  })
                }
              />
              {trip.coverImageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setTrip({ ...trip, coverImageUrl: null, coverImagePublicId: null })
                  }
                  className="text-xs text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Itinerary builder (FSD §4.3) */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">Itinerary</h2>
          <button
            type="button"
            onClick={() => {
              const day = emptyDay();
              setDays([...days, day]);
              setOpenDayKey(day.key);
            }}
            className="rounded-lg border border-forest-300 bg-forest-50 px-3 py-1.5 text-sm font-medium text-forest-700 hover:bg-forest-100"
          >
            + Add day
          </button>
        </div>
        {errors.days && <p className="mb-3 text-sm text-rose-600">{errors.days}</p>}

        {days.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
            No days yet. Drafts can be saved without an itinerary; publishing
            requires at least one location-tagged day.
          </div>
        )}

        <div className="space-y-3">
          {days.map((day, i) => {
            const open = openDayKey === day.key;
            return (
              <div
                key={day.key}
                draggable
                onDragStart={() => setDragKey(day.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropDayOn(day.key)}
                onDragEnd={() => setDragKey(null)}
                className={`rounded-xl border bg-white shadow-sm transition ${
                  dragKey === day.key ? "opacity-50" : ""
                } ${errors[`day.${day.key}`] ? "border-rose-300" : "border-stone-200"}`}
              >
                <div className="flex items-center gap-3 p-4">
                  <span className="cursor-grab text-stone-400" title="Drag to reorder">
                    ⠿
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenDayKey(open ? null : day.key)}
                    className="min-w-0 flex-1 truncate text-left font-medium text-stone-800 hover:text-forest-700"
                  >
                    {day.locationName || <span className="text-stone-400">Untitled day</span>}
                    {day.latitude !== null && (
                      <span className="ml-2 text-xs font-normal text-stone-400">
                        {day.latitude.toFixed(3)}°, {day.longitude?.toFixed(3)}°
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveDay(i, -1)}
                      disabled={i === 0}
                      className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                      aria-label="Move day up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDay(i, 1)}
                      disabled={i === days.length - 1}
                      className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                      aria-label="Move day down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setDays(days.filter((d) => d.key !== day.key))}
                      className="rounded px-2 py-1 text-rose-500 hover:bg-rose-50"
                      aria-label="Remove day"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {errors[`day.${day.key}`] && (
                  <p className="px-4 pb-2 text-sm text-rose-600">
                    {errors[`day.${day.key}`]}
                  </p>
                )}

                {open && (
                  <div className="border-t border-stone-100 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-700">
                            Location name *
                          </label>
                          <input
                            type="text"
                            maxLength={150}
                            value={day.locationName}
                            onChange={(e) =>
                              patchDay(day.key, { locationName: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-stone-700">
                              Latitude *
                            </label>
                            <input
                              type="number"
                              step="0.000001"
                              min={-90}
                              max={90}
                              value={day.latitude ?? ""}
                              onChange={(e) =>
                                patchDay(day.key, {
                                  latitude:
                                    e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700">
                              Longitude *
                            </label>
                            <input
                              type="number"
                              step="0.000001"
                              min={-180}
                              max={180}
                              value={day.longitude ?? ""}
                              onChange={(e) =>
                                patchDay(day.key, {
                                  longitude:
                                    e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700">
                            Day description
                          </label>
                          <textarea
                            rows={4}
                            value={day.dayDescription}
                            onChange={(e) =>
                              patchDay(day.key, { dayDescription: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block text-sm font-medium text-stone-700">
                          Map location *
                        </span>
                        <MapPicker
                          latitude={day.latitude}
                          longitude={day.longitude}
                          onChange={(lat, lng, locationName) =>
                            patchDay(day.key, {
                              latitude: lat,
                              longitude: lng,
                              ...(locationName && !day.locationName
                                ? { locationName }
                                : {}),
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Sites within the day */}
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-stone-800">
                          Sites visited
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            patchDay(day.key, { sites: [...day.sites, emptySite()] })
                          }
                          className="text-xs font-medium text-forest-700 hover:underline"
                        >
                          + Add site
                        </button>
                      </div>
                      <div className="space-y-3">
                        {day.sites.map((site) => (
                          <div
                            key={site.key}
                            className="rounded-lg border border-stone-200 bg-stone-50 p-3"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-2">
                                <input
                                  type="text"
                                  maxLength={150}
                                  placeholder="Site name"
                                  value={site.siteName}
                                  onChange={(e) =>
                                    patchSite(day.key, site.key, {
                                      siteName: e.target.value,
                                    })
                                  }
                                  className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                                />
                                <textarea
                                  rows={2}
                                  placeholder="Site description"
                                  value={site.siteDescription}
                                  onChange={(e) =>
                                    patchSite(day.key, site.key, {
                                      siteDescription: e.target.value,
                                    })
                                  }
                                  className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  patchDay(day.key, {
                                    sites: day.sites.filter((s) => s.key !== site.key),
                                  })
                                }
                                className="rounded px-2 py-1 text-rose-500 hover:bg-rose-50"
                                aria-label="Remove site"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Site images (FSD §4.3: multiple images, remove by ID) */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {site.images.map((img, imgIdx) => (
                                <div key={imgIdx} className="relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img.imageUrl}
                                    alt=""
                                    className="h-16 w-24 rounded-md border border-stone-200 object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchSite(day.key, site.key, {
                                        images: site.images.filter(
                                          (_, j) => j !== imgIdx
                                        ),
                                      })
                                    }
                                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-xs text-white shadow"
                                    aria-label="Remove image"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <ImageUploader
                                label="Add images"
                                onUploaded={(imgs: UploadedImage[]) =>
                                  patchSite(day.key, site.key, {
                                    images: [...site.images, ...imgs],
                                  })
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
