"use client";

import { useMemo, useState } from "react";
import { compassPoint } from "@/lib/geo";
import { personalisedInsight, TONE_COLOR } from "@/lib/insight";
import type { NearbySchool, Phase } from "@/lib/types";

const VB = 360;
const C = VB / 2;
const R1 = 75; // 1 km ring
const R2 = 150; // 2 km ring

function plotRadius(km: number): number {
  if (km > 2) return R2 + 13;
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
  const tooltipBelow = active !== null && active.y < 92;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-auto w-full"
        role="group"
        aria-label="Polar map of nearby primary schools by distance and direction from your home"
      >
        {/* distance bands */}
        <circle cx={C} cy={C} r={R2} fill="#f1e7d2" />
        <circle cx={C} cy={C} r={R2} fill="#cf9f33" opacity={0.1} />
        <circle cx={C} cy={C} r={R1} fill="#3f9b6e" opacity={0.12} />

        {/* spokes */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={C}
              y1={C}
              x2={C + R2 * Math.sin(rad)}
              y2={C - R2 * Math.cos(rad)}
              stroke="#d8ccb4"
              strokeWidth={1}
            />
          );
        })}

        {/* rings */}
        <circle
          cx={C}
          cy={C}
          r={R1}
          fill="none"
          stroke="#bfae8d"
          strokeWidth={1.25}
          strokeDasharray="3 4"
        />
        <circle
          cx={C}
          cy={C}
          r={R2}
          fill="none"
          stroke="#bfae8d"
          strokeWidth={1.5}
        />

        {/* ring labels */}
        {[
          { r: R1, label: "1 km" },
          { r: R2, label: "2 km" },
        ].map(({ r, label }) => (
          <text
            key={label}
            x={C}
            y={C - r + 11}
            textAnchor="middle"
            className="font-sans"
            fontSize={9}
            fontWeight={600}
            fill="#8a7d5f"
            paintOrder="stroke"
            stroke="#f1e7d2"
            strokeWidth={3}
          >
            {label}
          </text>
        ))}

        {/* compass labels */}
        {[
          { t: "N", x: C, y: 13 },
          { t: "S", x: C, y: VB - 6 },
          { t: "E", x: VB - 8, y: C + 4 },
          { t: "W", x: 8, y: C + 4 },
        ].map(({ t, x, y }) => (
          <text
            key={t}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#9b9070"
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
            stroke="#1c6b5a"
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
              {isActive ? (
                <circle r={11} fill={color} opacity={0.25} />
              ) : null}
              <circle
                r={isActive ? 7 : 5.5}
                fill={color}
                stroke="#faf6ef"
                strokeWidth={2}
              />
            </g>
          );
        })}

        {/* home marker */}
        <g aria-label="Your home">
          <circle r={6} cx={C} cy={C} fill="#23201a" />
          <circle r={2.4} cx={C} cy={C} fill="#faf6ef" />
        </g>
      </svg>

      {/* hover / selection tooltip */}
      {active ? (
        <div
          className="anim-fade pointer-events-none absolute z-10 w-max max-w-[170px] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
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
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
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
