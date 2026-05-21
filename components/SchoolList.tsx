import { BAND_COLOR } from "@/lib/labels";
import type { Band, NearbySchool, Phase } from "@/lib/types";
import { SchoolRow } from "./SchoolRow";

type Props = {
  within: NearbySchool[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const GROUPS: { band: Band; label: string }[] = [
  { band: "near", label: "Within 1 km — top priority" },
  { band: "mid", label: "1–2 km — second priority" },
];

/** Distance-band-grouped list of schools within 2 km. */
export function SchoolList({ within, phase, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-7">
      {GROUPS.map(({ band, label }) => {
        const schools = within.filter((s) => s.band === band);
        if (schools.length === 0) return null;
        return (
          <section key={band}>
            <div className="mb-3.5 flex items-baseline gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: BAND_COLOR[band] }}
                aria-hidden
              />
              <h3 className="font-display text-xl font-medium text-ink">
                {label}
              </h3>
              <span className="text-[13px] font-semibold text-ink-muted">
                {schools.length} school{schools.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {schools.map((school) => (
                <SchoolRow
                  key={school.id}
                  school={school}
                  phase={phase}
                  selected={school.id === selectedId}
                  onSelect={() => onSelect(school.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
