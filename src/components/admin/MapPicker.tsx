"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// FSD §4.3 — map picker embedded in the day editor: click-to-pin, plus a
// search box backed by the Nominatim (OSM) geocoding API. Writes lat/lng
// back into the day form state.

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number, locationName?: string) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export function MapPicker({ latitude, longitude, onChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);

  function placeMarker(lat: number, lng: number, pan = false) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "day-marker",
          html: "📍",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(map);
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 11));
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      if (latitude !== null && longitude !== null) {
        map.setView([latitude, longitude], 11);
        placeMarker(latitude, longitude);
      } else {
        map.setView([23.5, 80], 4); // India-wide default
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        placeMarker(lat, lng);
        onChangeRef.current(lat, lng);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Initialize once; subsequent coordinate updates flow through placeMarker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external coordinate edits (e.g. typing in the lat/lng inputs)
  useEffect(() => {
    if (latitude !== null && longitude !== null) placeMarker(latitude, longitude);
  }, [latitude, longitude]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "in");
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) setResults(await res.json());
    } catch {
      // search failure is non-fatal — admin can still click-to-pin
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r: NominatimResult) {
    const lat = Number(Number(r.lat).toFixed(6));
    const lng = Number(Number(r.lon).toFixed(6));
    placeMarker(lat, lng, true);
    onChangeRef.current(lat, lng, r.display_name.split(",")[0]);
    setResults([]);
    setQuery("");
  }

  return (
    <div>
      <form onSubmit={search} className="mb-2 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place in India…"
          className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={searching}
          className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mb-2 divide-y divide-stone-100 rounded-md border border-stone-200 bg-white text-sm shadow-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pickResult(r)}
                className="block w-full px-3 py-2 text-left hover:bg-stone-50"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={containerRef}
        className="z-0 h-64 w-full rounded-lg border border-stone-200"
      />
      <p className="mt-1 text-xs text-stone-500">
        Click the map to drop a pin, or search above.
      </p>
    </div>
  );
}
