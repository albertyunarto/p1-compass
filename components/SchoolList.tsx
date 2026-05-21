import { BAND_COLOR } from "@/lib/labels";
import type { Band, NearbySchool, Phase } from "@/lib/types";
import { SchoolRow } from "./SchoolRow";

type Props = {
  within: NearbySchool[];
  beyond: NearbySchool[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const BAND_SUBTITLE: Record<Band, string> = {
  near: "Top distance priority in Phase 2C balloting.",
  mid: "Second priority — competitive schools may fill before this band.",
  far: "Lowest distance priority for Phase 2C.",
};

function BandGroup({
  band,
  label,
  schools,
  phase,
  selectedId,
  onSelect,
}: {
  band: Band;
  label: string;
  schools: NearbySchool[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: BAND_COLOR[band] }}
          aria-hidden
        />
        <h3 className="font-display text-lg font-semibold text-ink">
          {label}
        </h3>
        <span className="text-sm font-medium text-ink-soft">
          {schools.length} school{schools.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mb-3 text-sm text-ink-soft">{BAND_SUBTITLE[band]}</p>
      <div className="flex flex-col gap-2">
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
}

export function SchoolList({
  within,
  beyond,
  phase,
  selectedId,
  onSelect,
}: Props) {
  if (within.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-card border border-line bg-sand/70 p-5">
          <h3 className="font-display text-lg font-semibold text-ink">
            No primary schools within 2 km
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            For every school here you fall in the beyond-2 km distance band, the
            lowest-priority group. You can still review their ballot history
            below.
          </p>
        </div>
        <section>
          <h3 className="mb-3 font-display text-lg font-semibold text-ink">
            Closest schools beyond 2 km
          </h3>
          <div className="flex flex-col gap-2">
            {beyond.map((school) => (
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
      </div>
    );
  }

  const near = within.filter((s) => s.band === "near");
  const mid = within.filter((s) => s.band === "mid");

  return (
    <div className="flex flex-col gap-6">
      {near.length > 0 ? (
        <BandGroup
          band="near"
          label="Within 1 km"
          schools={near}
          phase={phase}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
      {mid.length > 0 ? (
        <BandGroup
          band="mid"
          label="1–2 km"
          schools={mid}
          phase={phase}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}
