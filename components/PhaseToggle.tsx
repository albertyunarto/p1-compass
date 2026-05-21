"use client";

import { PHASE_META } from "@/lib/labels";
import type { Phase } from "@/lib/types";

const PHASES: Phase[] = ["2A", "2B", "2C"];

type Props = {
  phase: Phase;
  onChange: (phase: Phase) => void;
};

export function PhaseToggle({ phase, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
        Registration phase
      </span>
      <div
        role="radiogroup"
        aria-label="Registration phase"
        className="flex gap-1 rounded-lg bg-sand p-1"
      >
        {PHASES.map((p) => {
          const active = p === phase;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(p)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
                (active
                  ? "bg-primary text-white shadow-sm"
                  : "text-ink-soft hover:text-ink")
              }
            >
              {PHASE_META[p].label}
            </button>
          );
        })}
      </div>
      <span className="text-sm text-ink-soft">
        <span className="font-semibold text-ink">{PHASE_META[phase].label}</span>{" "}
        — {PHASE_META[phase].who}
      </span>
    </div>
  );
}
