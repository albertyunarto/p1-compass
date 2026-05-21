import { STATUS_COLOR, STATUS_DEPTH, STATUS_LABEL } from "@/lib/labels";
import type { BallotHistory } from "@/lib/types";

const YEARS = [2021, 2022, 2023, 2024, 2025];

/** Compact 5-year Phase 2C ballot history — one bar per year. */
export function BallotStrip({ ballot }: { ballot: BallotHistory }) {
  const summary = YEARS.map((y) => {
    const status = ballot[y]?.["2C"] ?? "open";
    return `${y} ${STATUS_LABEL[status]}`;
  }).join("; ");

  return (
    <div
      role="img"
      aria-label={`Phase 2C ballot history — ${summary}`}
      className="flex h-6 items-end gap-[3px]"
    >
      {YEARS.map((y) => {
        const status = ballot[y]?.["2C"] ?? "open";
        return (
          <span
            key={y}
            title={`${y}: ${STATUS_LABEL[status]}`}
            style={{
              height: 7 + STATUS_DEPTH[status] * 5,
              background: STATUS_COLOR[status],
            }}
            className="w-[7px] rounded-[2px]"
          />
        );
      })}
    </div>
  );
}
