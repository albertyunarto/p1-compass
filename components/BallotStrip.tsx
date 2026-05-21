import { BALLOT_YEARS, outcomeFor } from "@/lib/ballot";
import { ballotColor, STATUS_LABEL } from "@/lib/labels";
import type { BallotStatus, Phase, School } from "@/lib/types";

// Bar height (px) added on top of a 6px base, per ballot depth.
const DEPTH: Record<BallotStatus, number> = {
  open: 0,
  b_far: 6,
  b_mid: 11,
  b_near: 18,
};

/** Compact 5-year ballot history for one phase — one bar per year. */
export function BallotStrip({
  school,
  phase,
}: {
  school: School;
  phase: Phase;
}) {
  const summary = BALLOT_YEARS.map((y) => {
    const o = outcomeFor(school, phase, y);
    return `${y} ${STATUS_LABEL[o?.status ?? "open"]}`;
  }).join("; ");

  return (
    <div
      role="img"
      aria-label={`Phase ${phase} ballot history — ${summary}`}
      className="flex h-[26px] items-end gap-[3px]"
    >
      {BALLOT_YEARS.map((y) => {
        const o = outcomeFor(school, phase, y);
        const status = o?.status ?? "open";
        return (
          <span
            key={y}
            title={`${y}: ${STATUS_LABEL[status]}`}
            style={{
              height: 6 + DEPTH[status],
              background: ballotColor(status, o?.intensity ?? 0),
            }}
            className="w-[9px] rounded-[2px]"
          />
        );
      })}
    </div>
  );
}
