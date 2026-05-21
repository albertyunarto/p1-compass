"use client";

import { latestOutcome } from "@/lib/ballot";
import { compassPoint } from "@/lib/geo";
import { personalisedInsight } from "@/lib/insight";
import { ballotColor, BAND_COLOR, STATUS_LABEL } from "@/lib/labels";
import type { NearbySchool, Phase } from "@/lib/types";
import { BallotStrip } from "./BallotStrip";
import { useShortlist } from "./ShortlistContext";
import { StarButton } from "./StarButton";
import { VerdictPill } from "./VerdictPill";

type Props = {
  school: NearbySchool;
  phase: Phase;
  selected: boolean;
  onSelect: () => void;
};

export function SchoolRow({ school, phase, selected, onSelect }: Props) {
  const { has, toggle } = useShortlist();
  const insight = personalisedInsight(school, school.band, phase);
  const { year, outcome } = latestOutcome(school, phase);
  const tags = school.type.filter((t) => t !== "Neighbourhood");
  const ratio = outcome.vacancy > 0 ? outcome.totalApplied / outcome.vacancy : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${school.name}, ${school.distanceKm.toFixed(2)} kilometres away. Phase ${phase}: ${insight.headline}.`}
      className={
        "flex w-full cursor-pointer items-start gap-3.5 rounded-[14px] border p-4 text-left transition " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
        (selected
          ? "border-primary bg-surface shadow-sm"
          : "border-line bg-surface hover:border-primary/40")
      }
    >
      <span
        style={{ background: BAND_COLOR[school.band] }}
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[10px] text-[11px] font-extrabold tracking-tight text-white"
      >
        {school.short}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-ink">
          {school.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
          <span className="font-semibold text-ink">
            {school.distanceKm.toFixed(2)} km
          </span>
          <span aria-hidden className="text-line">
            ·
          </span>
          <span>{compassPoint(school.bearingDeg)}</span>
          {tags.length > 0 ? (
            <>
              <span aria-hidden className="text-line">
                ·
              </span>
              <span className="truncate">{tags.join(" · ")}</span>
            </>
          ) : null}
        </span>
        <span className="mt-2.5 flex items-center gap-3">
          <BallotStrip school={school} phase={phase} />
          <span
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
            title={`Phase ${phase} ${year}: ${STATUS_LABEL[outcome.status]}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: ballotColor(outcome.status, outcome.intensity) }}
            />
            {year}: {STATUS_LABEL[outcome.status]}
            {outcome.status !== "open" && ratio >= 1
              ? ` · ${ratio.toFixed(1)}× applied`
              : ""}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-2">
        <VerdictPill tone={insight.tone} label={insight.headline} />
        <StarButton
          active={has(school.id)}
          onToggle={() => toggle(school.id)}
        />
      </span>
    </div>
  );
}
