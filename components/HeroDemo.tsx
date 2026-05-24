"use client";

import { useState } from "react";
import { personalisedInsight } from "@/lib/insight";
import type { NearbySchool } from "@/lib/types";
import { GeoMapLazy } from "./GeoMapLazy";
import { VerdictPill } from "./VerdictPill";

type Origin = { lat: number; lng: number };

/** Live geographic-map preview shown in the landing hero, using real data. */
export function HeroDemo({
  schools,
  origin,
}: {
  schools: NearbySchool[];
  origin: Origin;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    schools[0]?.id ?? null,
  );

  if (schools.length === 0) return null;

  const selected = schools.find((s) => s.id === selectedId) ?? schools[0];
  const insight = personalisedInsight(selected, selected.band, "2C");

  return (
    <div className="rounded-3xl border border-line bg-gradient-to-br from-surface to-sand p-5 shadow-[0_24px_48px_-16px_rgba(28,21,10,0.14)]">
      <div className="mb-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-eyebrow">
          Live preview · postal 569824
        </div>
        <div className="mt-0.5 font-display text-lg font-medium text-ink">
          {schools.length} schools within 2 km
        </div>
      </div>
      <GeoMapLazy
        schools={schools}
        phase="2C"
        selectedId={selectedId}
        onSelect={setSelectedId}
        origin={origin}
      />
      <div className="mt-3 rounded-xl border border-line bg-surface p-3">
        <VerdictPill tone={insight.tone} label={insight.headline} size="sm" />
        <div className="mt-1.5 font-display text-sm font-medium text-ink">
          {selected.name}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {insight.verdict}
        </p>
      </div>
    </div>
  );
}
