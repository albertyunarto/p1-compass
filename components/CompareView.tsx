"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bearingDeg, distanceBand, haversineKm } from "@/lib/geo";
import type { NearbySchool, Phase, School } from "@/lib/types";
import { CompareTable } from "./CompareTable";
import { PhaseToggle } from "./PhaseToggle";
import { useShortlist, type ShortlistOrigin } from "./ShortlistContext";

function annotate(origin: ShortlistOrigin, s: School): NearbySchool {
  const distanceKm = haversineKm(origin.lat, origin.lng, s.lat, s.lng);
  return {
    ...s,
    distanceKm,
    bearingDeg: bearingDeg(origin.lat, origin.lng, s.lat, s.lng),
    band: distanceBand(distanceKm),
  };
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-display text-3xl font-medium text-ink">{title}</h1>
      <p className="mt-2 text-ink-soft">{body}</p>
      <Link
        href="/search"
        className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark"
      >
        Go to search
      </Link>
    </div>
  );
}

export function CompareView() {
  const { ids, origin, remove } = useShortlist();
  const [allSchools, setAllSchools] = useState<School[] | null>(null);
  const [phase, setPhase] = useState<Phase>("2C");

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/schools", { signal: ctrl.signal });
        setAllSchools((await res.json()) as School[]);
      } catch {
        setAllSchools([]);
      }
    })();
    return () => ctrl.abort();
  }, []);

  if (ids.length === 0) {
    return (
      <EmptyState
        title="No schools shortlisted yet"
        body="Star schools on the results page and they will line up here for a side-by-side comparison."
      />
    );
  }

  if (!origin) {
    return (
      <EmptyState
        title="Run a search first"
        body="Compare needs your home location to measure distances. Search your postal code, then star a few schools."
      />
    );
  }

  if (allSchools === null) {
    return (
      <p className="py-20 text-center text-ink-muted">
        Loading your shortlist…
      </p>
    );
  }

  const picked = ids
    .map((id) => allSchools.find((s) => s.id === id))
    .filter((s): s is School => Boolean(s))
    .map((s) => annotate(origin, s));

  if (picked.length === 0) {
    return (
      <EmptyState
        title="Shortlist unavailable"
        body="Those schools could not be found. Start a fresh search to build a new shortlist."
      />
    );
  }

  return (
    <>
      <div className="mb-5">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-eyebrow">
          Shortlist · {picked.length} school{picked.length === 1 ? "" : "s"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-medium text-ink sm:text-3xl">
          Side-by-side comparison
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Distances and ballot trends measured from {origin.address}.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-eyebrow">
          Phase
        </span>
        <PhaseToggle phase={phase} onChange={setPhase} />
      </div>

      <CompareTable schools={picked} phase={phase} onRemove={remove} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-sand p-4">
        <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
          Pick your top three in the order you&rsquo;d register. P1 Compass is a
          planning aid — you still register on MOE&rsquo;s portal.
        </p>
        <div className="print-hide flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-[13.5px] font-semibold text-ink transition hover:border-primary/40"
          >
            Print
          </button>
          <Link
            href="/search"
            className="rounded-xl bg-primary px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-primary-dark"
          >
            Back to search
          </Link>
        </div>
      </div>
    </>
  );
}
