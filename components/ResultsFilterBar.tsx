"use client";

import type { Phase } from "@/lib/types";
import { PhaseToggle } from "./PhaseToggle";

export type DistanceFilter = "all" | "near" | "mid" | "far";
export type TypeFilter = "all" | "sap" | "affiliated";
export type SortKey = "distance" | "verdict";

const DISTANCES: { k: DistanceFilter; l: string }[] = [
  { k: "all", l: "All" },
  { k: "near", l: "< 1 km" },
  { k: "mid", l: "1–2 km" },
  { k: "far", l: "> 2 km" },
];

const TYPES: { k: TypeFilter; l: string }[] = [
  { k: "all", l: "Any" },
  { k: "sap", l: "SAP" },
  { k: "affiliated", l: "Affiliated" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-eyebrow">
      {children}
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
        (active
          ? "border border-primary bg-good-soft text-primary"
          : "border border-line text-ink-soft hover:border-primary/40")
      }
    >
      {children}
    </button>
  );
}

type Props = {
  phase: Phase;
  onPhase: (p: Phase) => void;
  distance: DistanceFilter;
  onDistance: (d: DistanceFilter) => void;
  type: TypeFilter;
  onType: (t: TypeFilter) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
};

export function ResultsFilterBar({
  phase,
  onPhase,
  distance,
  onDistance,
  type,
  onType,
  sort,
  onSort,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3">
      <Eyebrow>Phase</Eyebrow>
      <PhaseToggle phase={phase} onChange={onPhase} />

      <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />

      <Eyebrow>Distance</Eyebrow>
      {DISTANCES.map((d) => (
        <Chip
          key={d.k}
          active={distance === d.k}
          onClick={() => onDistance(d.k)}
        >
          {d.l}
        </Chip>
      ))}

      <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />

      <Eyebrow>Type</Eyebrow>
      {TYPES.map((t) => (
        <Chip key={t.k} active={type === t.k} onClick={() => onType(t.k)}>
          {t.l}
        </Chip>
      ))}

      <button
        type="button"
        onClick={() => onSort(sort === "distance" ? "verdict" : "distance")}
        className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition hover:border-primary/40 sm:ml-auto"
      >
        Sort: {sort === "distance" ? "Distance" : "Best odds"} ↕
      </button>
    </div>
  );
}
