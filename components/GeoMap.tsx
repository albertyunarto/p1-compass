"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { personalisedInsight, TONE_COLOR, type InsightTone } from "@/lib/insight";
import type { NearbySchool, Phase } from "@/lib/types";

type Origin = { lat: number; lng: number };

export type GeoMapProps = {
  schools: NearbySchool[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin: Origin;
};

const TONE_LEGEND: { tone: InsightTone; label: string }[] = [
  { tone: "good", label: "Good odds" },
  { tone: "caution", label: "Borderline" },
  { tone: "unlikely", label: "Unlikely" },
];

function homeIcon(): L.DivIcon {
  return L.divIcon({
    className: "p1-marker",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#13231d;border:3px solid #fbf7ee;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function schoolIcon(color: string, selected: boolean): L.DivIcon {
  const r = selected ? 11 : 8;
  const dot = `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};border:2px solid #fbf7ee;box-shadow:0 1px 2px rgba(0,0,0,0.3);"></div>`;
  const halo = selected
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.25;"></div>`
    : "";
  return L.divIcon({
    className: "p1-marker",
    html: `<div style="position:relative;width:${r * 2}px;height:${r * 2}px;">${halo}${dot}</div>`,
    iconSize: [r * 2, r * 2],
    iconAnchor: [r, r],
  });
}

/** Re-fit the map to the latest origin + schools whenever they change. */
function FitBounds({
  origin,
  schools,
}: {
  origin: Origin;
  schools: NearbySchool[];
}) {
  const map = useMap();
  const bounds = useMemo(() => {
    const points: L.LatLngTuple[] = [[origin.lat, origin.lng]];
    for (const s of schools) points.push([s.lat, s.lng]);
    // Ensure the 2 km ring is always in view (~2.2 km in each cardinal).
    const dDeg = 2.2 / 111;
    points.push([origin.lat + dDeg, origin.lng]);
    points.push([origin.lat - dDeg, origin.lng]);
    points.push([origin.lat, origin.lng + dDeg]);
    points.push([origin.lat, origin.lng - dDeg]);
    return L.latLngBounds(points);
  }, [origin, schools]);

  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);

  return null;
}

/** Real geographic map: home pin, 1 km / 2 km rings, coloured school pins. */
export function GeoMap({
  schools,
  phase,
  selectedId,
  onSelect,
  origin,
}: GeoMapProps) {
  return (
    <div>
      <div className="relative isolate aspect-square w-full overflow-hidden rounded-lg">
        <MapContainer
          center={[origin.lat, origin.lng]}
          zoom={15}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.onemap.gov.sg" target="_blank" rel="noreferrer">OneMap</a> &middot; Singapore Land Authority'
            maxZoom={19}
          />
          <Circle
            center={[origin.lat, origin.lng]}
            radius={1000}
            pathOptions={{
              color: "#1f7a56",
              weight: 1,
              fillColor: "#1f7a56",
              fillOpacity: 0.08,
              dashArray: "4 4",
            }}
          />
          <Circle
            center={[origin.lat, origin.lng]}
            radius={2000}
            pathOptions={{
              color: "#b89c5c",
              weight: 1.25,
              fillOpacity: 0,
            }}
          />
          <Marker
            position={[origin.lat, origin.lng]}
            icon={homeIcon()}
            interactive={false}
          />
          {schools.map((s) => {
            const insight = personalisedInsight(s, s.band, phase);
            const selected = s.id === selectedId;
            return (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={schoolIcon(TONE_COLOR[insight.tone], selected)}
                eventHandlers={{ click: () => onSelect(s.id) }}
                keyboard
                title={`${s.name} — ${s.distanceKm.toFixed(2)} km`}
              />
            );
          })}
          <FitBounds origin={origin} schools={schools} />
        </MapContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#13231d]" />
          Your home
        </span>
        {TONE_LEGEND.map(({ tone, label }) => (
          <span key={tone} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: TONE_COLOR[tone] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
