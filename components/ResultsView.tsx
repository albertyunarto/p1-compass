"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { personalisedInsight } from "@/lib/insight";
import type { InsightTone } from "@/lib/insight";
import type { NearbySchool, Phase } from "@/lib/types";
import { BeyondPanel } from "./BeyondPanel";
import { GeoMapLazy } from "./GeoMapLazy";
import { MapErrorBoundary } from "./MapErrorBoundary";
import {
  ResultsFilterBar,
  type DistanceFilter,
  type SortKey,
  type TypeFilter,
} from "./ResultsFilterBar";
import { SchoolDetailShell } from "./SchoolDetailShell";
import { SchoolList } from "./SchoolList";
import { ShortlistBar } from "./ShortlistBar";
import { ShortlistPreview } from "./ShortlistPreview";
import { useShortlist, type ShortlistOrigin } from "./ShortlistContext";

type Props = {
  within: NearbySchool[];
  beyond: NearbySchool[];
  origin: ShortlistOrigin;
};

const TONE_RANK: Record<InsightTone, number> = {
  good: 0,
  caution: 1,
  unlikely: 2,
};

function matchesType(s: NearbySchool, type: TypeFilter): boolean {
  if (type === "all") return true;
  if (type === "sap") return s.type.includes("SAP");
  return s.affiliations.length > 0;
}

function sorted(
  list: NearbySchool[],
  sort: SortKey,
  phase: Phase,
): NearbySchool[] {
  if (sort === "distance") return list;
  return [...list].sort(
    (a, b) =>
      TONE_RANK[personalisedInsight(a, a.band, phase).tone] -
        TONE_RANK[personalisedInsight(b, b.band, phase).tone] ||
      a.distanceKm - b.distanceKm,
  );
}

function MapFallback() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg bg-sand text-center text-sm text-ink-muted">
      The distance map could not be drawn.
      <br />
      The school list is still accurate.
    </div>
  );
}

export function ResultsView({ within, beyond, origin }: Props) {
  const { setOrigin } = useShortlist();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const [phase, setPhase] = useState<Phase>("2C");
  const [distance, setDistance] = useState<DistanceFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("distance");
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);

  // If the user arrived via "?focus=<school-id>" (typing a school name in
  // the search box), open that school's detail panel automatically.
  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  // Remember the search origin so the Compare page can measure distances.
  useEffect(() => {
    setOrigin(origin);
  }, [origin, setOrigin]);

  const all = useMemo(() => [...within, ...beyond], [within, beyond]);

  const typedWithin = useMemo(
    () => within.filter((s) => matchesType(s, type)),
    [within, type],
  );
  const typedBeyond = useMemo(
    () => beyond.filter((s) => matchesType(s, type)),
    [beyond, type],
  );

  const listWithin = useMemo(() => {
    let l = typedWithin;
    if (distance === "near") l = l.filter((s) => s.band === "near");
    else if (distance === "mid") l = l.filter((s) => s.band === "mid");
    else if (distance === "far") l = [];
    return sorted(l, sort, phase);
  }, [typedWithin, distance, sort, phase]);

  const listBeyond = useMemo(
    () => sorted(typedBeyond, sort, phase),
    [typedBeyond, sort, phase],
  );

  const mapSchools = useMemo(() => {
    if (typedWithin.length === 0) return typedBeyond.slice(0, 6);
    if (distance === "near") return typedWithin.filter((s) => s.band === "near");
    if (distance === "mid") return typedWithin.filter((s) => s.band === "mid");
    return typedWithin;
  }, [typedWithin, typedBeyond, distance]);

  const selected = all.find((s) => s.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId(id);
    const school = all.find((s) => s.id === id);
    if (school) {
      track("school_detail_open", {
        school: school.name,
        band: school.band,
        phase,
        distanceKm: Number(school.distanceKm.toFixed(2)),
      });
    }
  }

  const showWithin = distance !== "far";
  const showBeyond = distance === "all" || distance === "far";

  return (
    <div className="flex flex-col gap-5">
      <div
        role="note"
        className="rounded-md border border-good/30 bg-good-soft px-3 py-2 text-xs sm:text-[13px] leading-snug text-good"
      >
        <strong>Ballot figures verified against MOE 2021–2025.</strong>{" "}
        School locations and distances are exact, sourced from the Singapore
        Land Authority dataset. See <a href="/about" className="underline">how we keep the data honest</a>.
      </div>
      <ResultsFilterBar
        phase={phase}
        onPhase={(p) => {
          setPhase(p);
          track("phase_change", { phase: p });
        }}
        distance={distance}
        onDistance={setDistance}
        type={type}
        onType={setType}
        sort={sort}
        onSort={setSort}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
            <MapErrorBoundary fallback={<MapFallback />}>
              <GeoMapLazy
                schools={mapSchools}
                phase={phase}
                selectedId={selectedId}
                onSelect={handleSelect}
                origin={{ lat: origin.lat, lng: origin.lng }}
              />
            </MapErrorBoundary>
          </div>
          <p className="mt-2 px-1 text-xs text-ink-muted">
            Pins are coloured by your Phase {phase} odds. Tap a pin or a row to
            see school details.
          </p>
          <div className="mt-3">
            <ShortlistPreview schools={all} phase={phase} />
          </div>
        </div>

        <div>
          {typedWithin.length === 0 ? (
            <div className="mb-5 rounded-card border border-line bg-sand/70 p-5">
              <h3 className="font-display text-lg font-medium text-ink">
                No primary schools within 2 km
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                You fall in the beyond-2 km band for every school here — the
                lowest-priority group. Look up any school&rsquo;s ballot history
                and odds below.
              </p>
            </div>
          ) : null}

          {showWithin && listWithin.length > 0 ? (
            <SchoolList
              within={listWithin}
              phase={phase}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          ) : null}

          {showWithin &&
          listWithin.length === 0 &&
          typedWithin.length > 0 ? (
            <p className="text-sm text-ink-muted">
              No schools in this distance band match your filters.
            </p>
          ) : null}

          {showBeyond ? (
            <div className={showWithin && listWithin.length > 0 ? "mt-6" : ""}>
              <BeyondPanel
                schools={listBeyond}
                phase={phase}
                selectedId={selectedId}
                onSelect={handleSelect}
                defaultOpen={distance === "far" || typedWithin.length === 0}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ShortlistBar />

      {selected ? (
        <SchoolDetailShell
          school={selected}
          phase={phase}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
