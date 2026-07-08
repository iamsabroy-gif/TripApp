"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { TripDay } from "./types";

interface TripMapProps {
  days: TripDay[];
  activeDayId: string | null;
  onSelectDay: (dayId: string) => void;
}

// FSD §4.8 — Leaflet map with a numbered marker per day, connected by a
// polyline in sort_order sequence. Marker click selects that day, and the
// page shows its sites/description/gallery. Leaflet is only loaded on this
// route (dynamic import in TripDetail) per the NFR lazy-load decision.
export function TripMap({ days, activeDayId, onSelectDay }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const onSelectRef = useRef(onSelectDay);
  onSelectRef.current = onSelectDay;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const ordered = [...days].sort((a, b) => a.sortOrder - b.sortOrder);
      const latLngs = ordered.map(
        (d) => [d.latitude, d.longitude] as [number, number]
      );

      if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: "#346842",
          weight: 3,
          dashArray: "6 8",
        }).addTo(map);
      }

      for (const day of ordered) {
        const marker = L.marker([day.latitude, day.longitude], {
          icon: L.divIcon({
            className: "day-marker",
            html: String(day.dayNumber),
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
          title: `Day ${day.dayNumber}: ${day.locationName}`,
        }).addTo(map);
        marker.on("click", () => onSelectRef.current(day.id));
        markersRef.current.set(day.id, marker);
      }

      if (latLngs.length > 0) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 12 });
      } else {
        map.setView([23.5, 80], 5); // India-wide fallback
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // The itinerary is immutable on the public page — init once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight the active marker
  useEffect(() => {
    for (const [dayId, marker] of markersRef.current) {
      const el = marker.getElement();
      if (!el) continue;
      el.classList.toggle("day-marker--active", dayId === activeDayId);
    }
  }, [activeDayId]);

  return (
    <div
      ref={containerRef}
      className="z-0 h-72 w-full rounded-xl border border-stone-200 sm:h-96"
      role="application"
      aria-label="Trek route map"
    />
  );
}
