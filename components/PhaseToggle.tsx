"use client";

import type { Phase } from "@/lib/types";

const PHASES: Phase[] = ["2A", "2B", "2C"];

/** Compact segmented control for the registration phase. */
export function PhaseToggle({
  phase,
  onChange,
  size = "md",
}: {
  phase: Phase;
  onChange: (phase: Phase) => void;
  size?: "md" | "lg";
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Registration phase"
      className="inline-flex gap-0.5 rounded-[10px] bg-[#eee4cc] p-[3px]"
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
              "rounded-lg font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
              (size === "lg"
                ? "px-3.5 py-2 text-sm "
                : "px-3.5 py-1.5 text-[13px] ") +
              (active
                ? "bg-primary text-white shadow-sm"
                : "text-eyebrow hover:text-ink")
            }
          >
            Phase {p}
          </button>
        );
      })}
    </div>
  );
}
