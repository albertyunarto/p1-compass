import { BALLOT_YEARS, outcomeFor } from "@/lib/ballot";
import { ballotColor, STATUS_DEPTH, STATUS_LABEL } from "@/lib/labels";
import type { Phase, School } from "@/lib/types";

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
      className="flex h-6 items-end gap-[3px]"
    >
      {BALLOT_YEARS.map((y) => {
        const o = outcomeFor(school, phase, y);
        const status = o?.status ?? "open";
        return (
          <span
            key={y}
            title={`${y}: ${STATUS_LABEL[status]}`}
            style={{
              height: 7 + STATUS_DEPTH[status] * 5,
              background: ballotColor(status, o?.intensity ?? 0),
            }}
            className="w-[7px] rounded-[2px]"
          />
        );
      })}
    </div>
  );
}
