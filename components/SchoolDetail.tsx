"use client";

import {
  BALLOT_YEARS,
  type BandOutcome,
  latestOutcome,
  outcomeFor,
} from "@/lib/ballot";
import { personalisedInsight, TONE_COLOR } from "@/lib/insight";
import {
  BAND_LABEL,
  ballotColor,
  PHASE_LABEL,
  PHASE_META,
  STATUS_DEPTH,
  STATUS_LABEL,
} from "@/lib/labels";
import type { Band, NearbySchool, Phase } from "@/lib/types";
import { Modal } from "./Modal";

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
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
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
          className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink"
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

export function SchoolDetail({
  school,
  phase,
  onClose,
}: {
  school: NearbySchool;
  phase: Phase;
  onClose: () => void;
}) {
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
    <Modal open onClose={onClose} labelledBy="school-detail-title">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* header */}
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-paper px-5 py-4 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-white">
          {school.short}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="school-detail-title"
            className="font-display text-xl font-semibold leading-tight text-ink"
          >
            {school.name}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {school.distanceKm.toFixed(2)} km from your home ·{" "}
            {BAND_LABEL[school.band]} band
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink"
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

      {/* personalised insight for the selected phase */}
      <div className="px-5 py-4 sm:px-6">
        <div
          className="rounded-card border p-4"
          style={{ background: `${tone}14`, borderColor: `${tone}45` }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
              style={{ background: tone }}
            >
              {insight.headline}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {PHASE_META[phase].label} — {PHASE_META[phase].who}
            </span>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            {insight.verdict}
          </p>
        </div>
      </div>

      {/* type */}
      {school.type.length > 0 ? (
        <Section title="School profile">
          <Chips items={school.type} />
        </Section>
      ) : null}

      {/* per-band breakdown for the selected phase */}
      <Section
        title={`${PHASE_LABEL[phase]} balloting — ${year} cycle`}
      >
        <p className="mb-2.5 text-sm text-ink-soft">
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
              <tr className="bg-sand text-left text-xs text-ink-soft">
                <th className="px-3 py-1.5 font-semibold">Distance band</th>
                <th className="px-3 py-1.5 text-right font-semibold">
                  Applied
                </th>
                <th className="px-3 py-1.5 text-right font-semibold">Places</th>
                <th className="px-3 py-1.5 font-semibold">Outcome</th>
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
                    style={
                      bo.balloted
                        ? { background: `${ballotColor(outcome.status, outcome.intensity)}26` }
                        : undefined
                    }
                  >
                    <td className="px-3 py-1.5 font-medium text-ink">
                      {BAND_LABEL[b]}
                      {here ? (
                        <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                          YOU
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                      {bo.applied}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
                      {bo.places}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">
                      {bandOutcomeText(bo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ballot depth chart for the selected phase */}
      <Section title={`${PHASE_LABEL[phase]} ballot depth (2021–2025)`}>
        <div className="flex h-[104px] items-end gap-2">
          {BALLOT_YEARS.map((y) => {
            const o = outcomeFor(school, phase, y);
            const status = o?.status ?? "open";
            return (
              <div
                key={y}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  title={`${y}: ${STATUS_LABEL[status]}`}
                  style={{
                    height: 14 + STATUS_DEPTH[status] * 21,
                    background: ballotColor(status, o?.intensity ?? 0),
                  }}
                  className="w-full rounded-t-md"
                />
                <span className="text-xs text-ink-soft">{y}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Taller, deeper bars mean balloting reached closer in and was more
          oversubscribed.
        </p>
      </Section>

      {/* all-phase history grid */}
      <Section title="All phases by year">
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-sand">
                <th className="px-2 py-1.5 text-left font-semibold text-ink-soft">
                  Year
                </th>
                {PHASES.map((p) => (
                  <th key={p} className="px-2 py-1.5 font-semibold text-ink">
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
                            background: ballotColor(
                              status,
                              o?.intensity ?? 0,
                            ),
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
        <p className="mt-2 text-xs text-ink-soft">
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

      {/* footer */}
      <div className="border-t border-line px-5 py-4 sm:px-6">
        <p className="text-sm text-ink-soft">{school.address}</p>
        <a
          href="https://www.moe.gov.sg/schoolfinder"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2"
        >
          View on MOE School Finder
          <span aria-hidden>↗</span>
        </a>
      </div>
    </Modal>
  );
}
