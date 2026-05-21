import { latestOutcome } from "@/lib/ballot";
import { compassPoint } from "@/lib/geo";
import { personalisedInsight, TONE_COLOR } from "@/lib/insight";
import { ballotColor, STATUS_LABEL } from "@/lib/labels";
import type { Band, NearbySchool, Phase } from "@/lib/types";
import { BallotStrip } from "./BallotStrip";

const BADGE_BG: Record<Band, string> = {
  near: "#2f7d57",
  mid: "#b07d22",
  far: "#6f6a5e",
};

type Props = {
  school: NearbySchool;
  phase: Phase;
  selected: boolean;
  onSelect: () => void;
};

export function SchoolRow({ school, phase, selected, onSelect }: Props) {
  const insight = personalisedInsight(school, school.band, phase);
  const { year, outcome } = latestOutcome(school, phase);
  const tone = TONE_COLOR[insight.tone];
  const tags = school.type.filter((t) => t !== "Neighbourhood");
  const ratio = outcome.vacancy > 0 ? outcome.totalApplied / outcome.vacancy : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${school.name}, ${school.distanceKm.toFixed(2)} kilometres away. Phase ${phase}: ${insight.headline}.`}
      className={
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition " +
        "hover:border-primary/50 hover:bg-surface focus:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-primary/40 " +
        (selected
          ? "border-primary bg-surface shadow-sm"
          : "border-line bg-surface/60")
      }
    >
      <span
        style={{ background: BADGE_BG[school.band] }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-tight text-white"
      >
        {school.short}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-ink">
          {school.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">
            {school.distanceKm.toFixed(2)} km
          </span>
          <span aria-hidden>·</span>
          <span>{compassPoint(school.bearingDeg)}</span>
          {tags.length > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{tags.join(" · ")}</span>
            </>
          ) : null}
        </span>
        <span className="mt-2 flex items-center gap-2">
          <BallotStrip school={school} phase={phase} />
          <span
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft"
            title={`Phase ${phase} ${year}: ${STATUS_LABEL[outcome.status]}`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: ballotColor(outcome.status, outcome.intensity) }}
            />
            {year}: {STATUS_LABEL[outcome.status]}
            {outcome.status !== "open" && ratio >= 1
              ? ` · ${ratio.toFixed(1)}× applied`
              : ""}
          </span>
        </span>
      </span>

      <span
        style={{ background: `${tone}1f`, color: tone }}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
      >
        {insight.headline}
      </span>
    </button>
  );
}
