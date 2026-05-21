"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import type { NearbySchool } from "@/lib/types";
import { DistanceMap } from "./DistanceMap";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { SchoolDetail } from "./SchoolDetail";
import { SchoolList } from "./SchoolList";

type Props = {
  within: NearbySchool[];
  beyond: NearbySchool[];
};

function MapFallback() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg bg-sand text-center text-sm text-ink-soft">
      The distance map could not be drawn.
      <br />
      The school list below is still accurate.
    </div>
  );
}

export function ResultsView({ within, beyond }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapSchools = within.length > 0 ? within : beyond;
  const all = [...within, ...beyond];
  const selected = all.find((s) => s.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId(id);
    const school = all.find((s) => s.id === id);
    if (school) {
      track("school_detail_open", {
        school: school.name,
        band: school.band,
        distanceKm: Number(school.distanceKm.toFixed(2)),
      });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
          <MapErrorBoundary fallback={<MapFallback />}>
            <DistanceMap
              schools={mapSchools}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </MapErrorBoundary>
        </div>
        <p className="mt-2 px-1 text-xs text-ink-soft">
          {within.length > 0
            ? `${within.length} school${
                within.length === 1 ? "" : "s"
              } within 2 km — tap a dot or a row for the full read.`
            : "Nearest schools shown at the map edge — all beyond 2 km."}
        </p>
      </div>

      <div>
        <SchoolList
          within={within}
          beyond={beyond}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {selected ? (
        <SchoolDetail school={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
