import { compassPoint } from "@/lib/geo";
import { latestPhase2C, personalisedInsight, TONE_COLOR } from "@/lib/insight";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import type { Band, NearbySchool } from "@/lib/types";
import { BallotStrip } from "./BallotStrip";

const BADGE_BG: Record<Band, string> = {
  near: "#2f7d57",
  mid: "#b07d22",
  far: "#6f6a5e",
};

type Props = {
  school: NearbySchool;
  selected: boolean;
  onSelect: () => void;
};

export function SchoolRow({ school, selected, onSelect }: Props) {
  const insight = personalisedInsight(school, school.band);
  const latest = latestPhase2C(school);
  const tone = TONE_COLOR[insight.tone];
  const tags = school.type.filter((t) => t !== "Neighbourhood");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${school.name}, ${school.distanceKm.toFixed(2)} kilometres away. ${insight.headline}.`}
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
          <BallotStrip ballot={school.ballot} />
          <span
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft"
            title={STATUS_LABEL[latest.status]}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_COLOR[latest.status] }}
            />
            {latest.year}: {STATUS_LABEL[latest.status]}
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
