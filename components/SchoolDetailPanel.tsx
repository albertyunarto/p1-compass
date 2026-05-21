"use client";

import {
  BALLOT_YEARS,
  type BandOutcome,
  latestOutcome,
  outcomeFor,
} from "@/lib/ballot";
import { compassPoint } from "@/lib/geo";
import { personalisedInsight, TONE_COLOR, TONE_SOFT } from "@/lib/insight";
import {
  BAND_LABEL,
  ballotColor,
  PHASE_LABEL,
  PHASE_META,
  STATUS_LABEL,
} from "@/lib/labels";
import type { Band, NearbySchool, Phase } from "@/lib/types";
import { BallotLane } from "./BallotLane";
import { SchoolRecommendations } from "./SchoolRecommendations";
import { useShortlist } from "./ShortlistContext";
import { VerdictPill } from "./VerdictPill";

const PHASES: Phase[] = ["2A", "2B", "2C"];
const BANDS: Band[] = ["near", "mid", "far"];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line px-5 py-4 sm:px-6">
      <h3 className="mb-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-eyebrow">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-[#efe3c4] px-2.5 py-1 text-xs font-semibold text-eyebrow"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function bandOutcomeText(b: BandOutcome): string {
  if (b.balloted) return `Balloted — ${(b.applied / b.places).toFixed(1)}×`;
  if (b.applied === 0) return "No applicants";
  if (b.taken >= b.applied) return `All ${b.applied} admitted`;
  return "Missed out — no places";
}

export function SchoolDetailPanel({
  school,
  phase,
  onClose,
  titleId,
}: {
  school: NearbySchool;
  phase: Phase;
  onClose: () => void;
  titleId: string;
}) {
  const { has, toggle } = useShortlist();
  const shortlisted = has(school.id);
  const insight = personalisedInsight(school, school.band, phase);
  const tone = TONE_COLOR[insight.tone];
  const { year, outcome } = latestOutcome(school, phase);
  const ratio =
    outcome.vacancy > 0 ? outcome.totalApplied / outcome.vacancy : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: school.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: school.address,
      postalCode: school.postal,
      addressCountry: "SG",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: school.lat,
      longitude: school.lng,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* sticky header */}
      <div className="sticky top-0 z-10 border-b border-line bg-paper px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[11px] bg-primary text-[11.5px] font-extrabold text-white">
            {school.short}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-display text-xl font-medium leading-tight text-ink"
            >
              {school.name}
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              <strong className="text-ink">
                {school.distanceKm.toFixed(2)} km
              </strong>{" "}
              · {compassPoint(school.bearingDeg)} · {BAND_LABEL[school.band]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-sand hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={() => toggle(school.id)}
            className={
              "flex-1 rounded-[10px] px-3.5 py-2 text-[13px] font-bold transition " +
              (shortlisted
                ? "bg-primary text-white"
                : "border-[1.5px] border-primary text-primary hover:bg-good-soft")
            }
          >
            {shortlisted ? "★ Shortlisted" : "☆ Add to shortlist"}
          </button>
          <a
            href="https://www.moe.gov.sg/schoolfinder"
            target="_blank"
            rel="noreferrer"
            className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-soft transition hover:border-primary/40"
          >
            MOE Finder ↗
          </a>
        </div>
      </div>

      {/* scroll body */}
      <div className="scroll-slim flex-1 overflow-y-auto">
        {/* verdict */}
        <div className="px-5 py-4 sm:px-6">
          <div
            className="rounded-card border p-4"
            style={{ background: TONE_SOFT[insight.tone], borderColor: `${tone}55` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <VerdictPill tone={insight.tone} label={insight.headline} size="md" />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-eyebrow">
                {PHASE_META[phase].label} · {PHASE_META[phase].who}
              </span>
            </div>
            <p className="mt-2.5 font-display text-base leading-relaxed text-ink">
              {insight.verdict}
            </p>

            {/* confidence meter */}
            <div className="mt-3.5">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-eyebrow">
                Confidence — 5-yr trend
              </div>
              <div className="flex h-2 gap-[3px]">
                {BALLOT_YEARS.map((y) => {
                  const o = outcomeFor(school, phase, y);
                  return (
                    <div
                      key={y}
                      className="flex-1 rounded-[2px]"
                      title={`${y}: ${STATUS_LABEL[o?.status ?? "open"]}`}
                      style={{
                        background: ballotColor(
                          o?.status ?? "open",
                          o?.intensity ?? 0,
                        ),
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
                {BALLOT_YEARS.map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI recommendations — concise, button-triggered */}
        <SchoolRecommendations
          key={`${school.id}:${phase}`}
          schoolId={school.id}
          schoolName={school.name}
          band={school.band}
          distanceKm={school.distanceKm}
          phase={phase}
        />

        {/* profile */}
        {school.type.length > 0 ? (
          <Section title="School profile">
            <Chips items={school.type} />
          </Section>
        ) : null}

        {/* this-year per-band table */}
        <Section title={`${PHASE_LABEL[phase]} balloting — ${year} cycle`}>
          <p className="mb-2.5 text-sm text-ink-muted">
            {outcome.totalApplied} applied for {outcome.vacancy} place
            {outcome.vacancy === 1 ? "" : "s"}
            {ratio > 0 ? (
              <span className="font-semibold text-ink">
                {" "}
                — {ratio.toFixed(1)}× subscribed
              </span>
            ) : null}
            .
          </p>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sand text-left text-xs text-eyebrow">
                  <th className="px-3 py-1.5 font-bold">Distance band</th>
                  <th className="px-3 py-1.5 text-right font-bold">Applied</th>
                  <th className="px-3 py-1.5 text-right font-bold">Places</th>
                  <th className="px-3 py-1.5 font-bold">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {BANDS.map((b) => {
                  const bo = outcome.bands[b];
                  const here = school.band === b;
                  return (
                    <tr
                      key={b}
                      className="border-t border-line"
                      style={here ? { background: "#e0f0e8" } : undefined}
                    >
                      <td className="px-3 py-1.5 font-medium text-ink">
                        {BAND_LABEL[b]}
                        {here ? (
                          <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            YOU
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                        {bo.applied}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">
                        {bo.places}
                      </td>
                      <td className="px-3 py-1.5 text-ink-muted">
                        {bandOutcomeText(bo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5-year ballot depth */}
        <Section title={`${PHASE_LABEL[phase]} ballot depth (2021–2025)`}>
          <BallotLane school={school} phase={phase} />
          <p className="mt-2 text-xs text-ink-muted">
            Taller, deeper bars mean balloting reached closer in and was more
            oversubscribed.
          </p>
        </Section>

        {/* all phases by year */}
        <Section title="All phases by year">
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr className="bg-sand">
                  <th className="px-2 py-1.5 text-left font-bold text-eyebrow">
                    Year
                  </th>
                  {PHASES.map((p) => (
                    <th key={p} className="px-2 py-1.5 font-bold text-ink">
                      {PHASE_LABEL[p]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...BALLOT_YEARS].reverse().map((y) => (
                  <tr key={y} className="border-t border-line">
                    <td className="px-2 py-1.5 text-left font-medium text-ink">
                      {y}
                    </td>
                    {PHASES.map((p) => {
                      const o = outcomeFor(school, p, y);
                      const status = o?.status ?? "open";
                      return (
                        <td key={p} className="p-1">
                          <span
                            title={`${PHASE_LABEL[p]} ${y}: ${STATUS_LABEL[status]}${
                              o
                                ? ` (${o.totalApplied} applied / ${o.vacancy} places)`
                                : ""
                            }`}
                            style={{
                              background: ballotColor(status, o?.intensity ?? 0),
                            }}
                            className="block h-6 rounded"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Each cell is the phase outcome that year — deeper colour means a
            tougher ballot. Hover for the numbers.
          </p>
        </Section>

        {/* affiliations */}
        {school.affiliations.length > 0 ? (
          <Section title="Affiliations">
            <ul className="space-y-1 text-sm text-ink">
              {school.affiliations.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* programmes */}
        {school.programmes.length > 0 ? (
          <Section title="Distinctive programmes">
            <ul className="space-y-1 text-sm text-ink">
              {school.programmes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* ccas */}
        {school.ccas.length > 0 ? (
          <Section title="Co-curricular activities">
            <Chips items={school.ccas} />
          </Section>
        ) : null}

        {/* address */}
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <p className="text-sm text-ink-muted">{school.address}</p>
        </div>
      </div>
    </>
  );
}
