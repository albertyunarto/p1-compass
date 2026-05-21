import { BALLOT_YEARS, outcomeFor } from "@/lib/ballot";
import { ballotColor } from "@/lib/labels";
import type { BallotStatus, Phase, School } from "@/lib/types";

// Bar height (px) added on top of a 16px base, per ballot depth.
const DEPTH: Record<BallotStatus, number> = {
  open: 6,
  b_far: 24,
  b_mid: 42,
  b_near: 60,
};

/** Rich 5-year ballot-depth chart for one phase — taller, deeper = tougher. */
export function BallotLane({
  school,
  phase,
  height = 84,
}: {
  school: School;
  phase: Phase;
  height?: number;
}) {
  return (
    <div className="flex items-end gap-1.5" style={{ minHeight: height }}>
      {BALLOT_YEARS.map((y) => {
        const o = outcomeFor(school, phase, y);
        const status = o?.status ?? "open";
        const ratio = o && o.vacancy > 0 ? o.totalApplied / o.vacancy : 0;
        return (
          <div key={y} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="relative w-full rounded-t-md"
              style={{
                height: 16 + DEPTH[status],
                background: ballotColor(status, o?.intensity ?? 0),
              }}
            >
              {ratio > 1 ? (
                <span
                  className="absolute inset-x-0 top-1 text-center text-[10px] font-bold text-white"
                  style={{ textShadow: "0 1px 1px rgba(0,0,0,0.25)" }}
                >
                  {ratio.toFixed(1)}×
                </span>
              ) : null}
            </div>
            <span className="text-[11px] font-semibold text-ink-muted">
              &lsquo;{String(y).slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
