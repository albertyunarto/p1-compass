"use client";

import { useMemo, useState } from "react";
import { compassPoint } from "@/lib/geo";
import { personalisedInsight, TONE_COLOR } from "@/lib/insight";
import type { NearbySchool, Phase } from "@/lib/types";

const VB = 360;
const C = VB / 2;
const R1 = 80; // 1 km ring
const R2 = 160; // 2 km ring

function plotRadius(km: number): number {
  if (km > 2) return R2 + 14;
  return (km / 2) * R2;
}

type Props = {
  schools: NearbySchool[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const LEGEND: { tone: keyof typeof TONE_COLOR; label: string }[] = [
  { tone: "good", label: "Good odds" },
  { tone: "caution", label: "Borderline" },
  { tone: "unlikely", label: "Unlikely" },
];

export function DistanceMap({ schools, phase, selectedId, onSelect }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const placed = useMemo(
    () =>
      schools.map((school) => {
        const r = plotRadius(school.distanceKm);
        const rad = (school.bearingDeg * Math.PI) / 180;
        const insight = personalisedInsight(school, school.band, phase);
        return {
          school,
          insight,
          color: TONE_COLOR[insight.tone],
          x: C + r * Math.sin(rad),
          y: C - r * Math.cos(rad),
        };
      }),
    [schools, phase],
  );

  const activeId = hoverId ?? selectedId;
  const active = placed.find((p) => p.school.id === activeId) ?? null;
  const tooltipBelow = active !== null && active.y < 96;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-auto w-full"
        role="group"
        aria-label="Polar map of nearby primary schools by distance and direction from your home"
      >
        <defs>
          <radialGradient id="p1-map-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f4ebd6" />
            <stop offset="60%" stopColor="#f0e6cd" />
            <stop offset="100%" stopColor="#eadbb8" />
          </radialGradient>
        </defs>

        {/* far halo + 2 km disc */}
        <circle cx={C} cy={C} r={R2 + 22} fill="#f8f1e0" opacity={0.65} />
        <circle cx={C} cy={C} r={R2} fill="url(#p1-map-bg)" />
        {/* 1 km good zone */}
        <circle cx={C} cy={C} r={R1} fill="#1f7a56" opacity={0.085} />

        {/* spokes */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={C}
              y1={C}
              x2={C + (R2 + 8) * Math.sin(rad)}
              y2={C - (R2 + 8) * Math.cos(rad)}
              stroke="#d9c99a"
              strokeWidth={deg % 90 === 0 ? 1 : 0.5}
              opacity={deg % 90 === 0 ? 0.7 : 0.4}
            />
          );
        })}

        {/* rings */}
        <circle
          cx={C}
          cy={C}
          r={R1}
          fill="none"
          stroke="#b89c5c"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.7}
        />
        <circle
          cx={C}
          cy={C}
          r={R2}
          fill="none"
          stroke="#b89c5c"
          strokeWidth={1.25}
          opacity={0.85}
        />

        {/* ring labels */}
        {(
          [
            [R1, "1 km"],
            [R2, "2 km"],
          ] as [number, string][]
        ).map(([r, label]) => (
          <text
            key={label}
            x={C}
            y={C - r + 12}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={700}
            fill="#7c6d43"
            paintOrder="stroke"
            stroke="#f4ebd6"
            strokeWidth={3}
          >
            {label}
          </text>
        ))}

        {/* compass labels */}
        {[
          { t: "N", x: C, y: 14 },
          { t: "S", x: C, y: VB - 5 },
          { t: "E", x: VB - 8, y: C + 4 },
          { t: "W", x: 8, y: C + 4 },
        ].map(({ t, x, y }) => (
          <text
            key={t}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#9e8a55"
          >
            {t}
          </text>
        ))}

        {/* connector to active school */}
        {active ? (
          <line
            x1={C}
            y1={C}
            x2={active.x}
            y2={active.y}
            stroke="#0e5346"
            strokeWidth={1.5}
            strokeDasharray="2 3"
          />
        ) : null}

        {/* school dots */}
        {placed.map(({ school, x, y, color }) => {
          const isActive = school.id === activeId;
          return (
            <g
              key={school.id}
              transform={`translate(${x} ${y})`}
              role="button"
              tabIndex={0}
              aria-label={`${school.name}, ${school.distanceKm.toFixed(
                2,
              )} kilometres ${compassPoint(school.bearingDeg)}`}
              className="cursor-pointer focus:outline-none"
              onClick={() => onSelect(school.id)}
              onMouseEnter={() => setHoverId(school.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(school.id)}
              onBlur={() => setHoverId(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(school.id);
                }
              }}
            >
              {isActive ? <circle r={12} fill={color} opacity={0.22} /> : null}
              <circle
                r={isActive ? 7.5 : 6}
                fill={color}
                stroke="#fbf7ee"
                strokeWidth={2.2}
              />
            </g>
          );
        })}

        {/* home marker */}
        <g aria-label="Your home">
          <circle r={7.5} cx={C} cy={C} fill="#13231d" />
          <circle r={2.6} cx={C} cy={C} fill="#fbf7ee" />
        </g>
      </svg>

      {/* hover / selection tooltip */}
      {active ? (
        <div
          className="anim-fade pointer-events-none absolute z-10 w-max max-w-[180px] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
          style={{
            left: `${(active.x / VB) * 100}%`,
            top: `${(active.y / VB) * 100}%`,
            transform: tooltipBelow
              ? "translate(-50%, 14px)"
              : "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <span className="font-semibold">{active.school.name}</span>
          <br />
          {active.school.distanceKm.toFixed(2)} km ·{" "}
          {compassPoint(active.school.bearingDeg)} · {active.insight.headline}
        </div>
      ) : null}

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#13231d]" />
          Your home
        </span>
        {LEGEND.map(({ tone, label }) => (
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
