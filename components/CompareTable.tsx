"use client";

import { latestOutcome } from "@/lib/ballot";
import { compassPoint } from "@/lib/geo";
import { personalisedInsight } from "@/lib/insight";
import { BAND_COLOR, BAND_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { NearbySchool, Phase } from "@/lib/types";
import { BallotLane } from "./BallotLane";
import { VerdictPill } from "./VerdictPill";

function RowHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center border-t border-line bg-paper p-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-eyebrow">
      {children}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-l border-line p-4">{children}</div>;
}

export function CompareTable({
  schools,
  phase,
  onRemove,
}: {
  schools: NearbySchool[];
  phase: Phase;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div
        className="grid min-w-[640px]"
        style={{
          gridTemplateColumns: `minmax(150px,170px) repeat(${schools.length}, minmax(220px,1fr))`,
        }}
      >
        {/* header */}
        <div className="border-b border-line bg-[#f8f1e0] p-4" />
        {schools.map((s) => (
          <div
            key={s.id}
            className="relative border-b border-l border-line bg-[#f8f1e0] p-4"
          >
            <span
              style={{ background: BAND_COLOR[s.band] }}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] text-[10.5px] font-extrabold text-white"
            >
              {s.short}
            </span>
            <div className="mt-2.5 pr-6 font-display text-base font-medium leading-tight text-ink">
              {s.name}
            </div>
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              aria-label={`Remove ${s.name} from shortlist`}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-ink-muted transition hover:bg-line hover:text-ink"
            >
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
            </button>
          </div>
        ))}

        {/* verdict */}
        <RowHead>Verdict</RowHead>
        {schools.map((s) => {
          const insight = personalisedInsight(s, s.band, phase);
          return (
            <Cell key={s.id}>
              <VerdictPill tone={insight.tone} label={insight.headline} />
              <p className="mt-2 text-[13px] leading-snug text-ink-soft">
                {insight.verdict.split(". ")[0]}.
              </p>
            </Cell>
          );
        })}

        {/* distance */}
        <RowHead>Distance &amp; direction</RowHead>
        {schools.map((s) => (
          <Cell key={s.id}>
            <div className="font-display text-2xl leading-none text-ink">
              {s.distanceKm.toFixed(2)}{" "}
              <span className="text-sm text-ink-muted">km</span>
            </div>
            <div className="mt-1.5 text-[13px] text-ink-muted">
              {compassPoint(s.bearingDeg)} · {BAND_LABEL[s.band]}
            </div>
          </Cell>
        ))}

        {/* trend */}
        <RowHead>Phase {phase} 5-year trend</RowHead>
        {schools.map((s) => {
          const { year, outcome } = latestOutcome(s, phase);
          return (
            <Cell key={s.id}>
              <BallotLane school={s} phase={phase} height={72} />
              <div className="mt-2 text-[12.5px] text-ink-soft">
                {year}:{" "}
                <strong className="text-ink">
                  {STATUS_LABEL[outcome.status]}
                </strong>
              </div>
            </Cell>
          );
        })}

        {/* oversubscription */}
        <RowHead>Latest oversubscription</RowHead>
        {schools.map((s) => {
          const { outcome } = latestOutcome(s, phase);
          const ratio =
            outcome.vacancy > 0 ? outcome.totalApplied / outcome.vacancy : 0;
          const pct = Math.min(100, (ratio / 3) * 100);
          const color =
            ratio > 1.5 ? "#a8362a" : ratio > 1 ? "#b45a1d" : "#1f7a56";
          return (
            <Cell key={s.id}>
              <div className="font-display text-2xl leading-none text-ink">
                {ratio.toFixed(1)}×
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </Cell>
          );
        })}

        {/* profile */}
        <RowHead>Profile</RowHead>
        {schools.map((s) => (
          <Cell key={s.id}>
            <div className="flex flex-wrap gap-1.5">
              {s.type.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[#efe3c4] px-2 py-0.5 text-[11px] font-semibold text-eyebrow"
                >
                  {t}
                </span>
              ))}
            </div>
            {s.affiliations.length > 0 ? (
              <div className="mt-2 text-xs text-ink-muted">
                Affiliated: {s.affiliations.join(", ")}
              </div>
            ) : null}
          </Cell>
        ))}

        {/* programmes */}
        <RowHead>Distinctive programmes</RowHead>
        {schools.map((s) => (
          <Cell key={s.id}>
            {s.programmes.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-ink">
                {s.programmes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px] text-ink-muted">—</span>
            )}
          </Cell>
        ))}
      </div>
    </div>
  );
}
