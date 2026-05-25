import { BALLOT_YEARS, outcomeFor, realYearCount } from "@/lib/ballot";
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
  const { real, total } = realYearCount(school, phase);
  const allReal = real === total;
  const noneReal = real === 0;

  return (
    <div className="space-y-2">
      <div
        className={
          "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold " +
          (allReal
            ? "bg-good-soft text-good"
            : noneReal
              ? "bg-caution-soft text-caution"
              : "bg-sand/70 text-ink-soft")
        }
      >
        <span>
          {allReal
            ? "✓ Verified against MOE figures"
            : noneReal
              ? "⚠ Illustrative — pending the next MOE refresh"
              : `${real} of ${total} years verified against MOE`}
        </span>
        <span className="text-[10px] font-normal opacity-70">
          {noneReal ? "Check MOE for official figures" : `Source: MOE Past Vacancies`}
        </span>
      </div>
      <div className="flex items-end gap-1.5" style={{ minHeight: height }}>
        {BALLOT_YEARS.map((y) => {
          const o = outcomeFor(school, phase, y);
          const status = o?.status ?? "open";
          const ratio = o && o.vacancy > 0 ? o.totalApplied / o.vacancy : 0;
          const isReal = o?.isReal ?? false;
          return (
            <div key={y} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={
                  "relative w-full rounded-t-md " +
                  (isReal ? "" : "opacity-70 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(0,0,0,0.08)_4px_5px)]")
                }
                style={{
                  height: 16 + DEPTH[status],
                  background: ballotColor(status, o?.intensity ?? 0),
                }}
                title={
                  o
                    ? `${y}: ${o.totalApplied} applied vs ${o.vacancy} places${isReal ? " (MOE verified)" : " (illustrative)"}`
                    : `${y}: no record`
                }
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
              <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
                &lsquo;{String(y).slice(2)}
                {isReal ? (
                  <span
                    aria-label="MOE verified"
                    title="MOE verified"
                    className="rounded-sm bg-good px-1 text-[8px] font-bold leading-[1.2] text-white"
                  >
                    MOE
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
