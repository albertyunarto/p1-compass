"use client";

import {
  latestPhase2C,
  personalisedInsight,
  TONE_COLOR,
} from "@/lib/insight";
import {
  BAND_LABEL,
  PHASE_LABEL,
  STATUS_COLOR,
  STATUS_DEPTH,
  STATUS_LABEL,
} from "@/lib/labels";
import type { NearbySchool, Phase } from "@/lib/types";
import { Modal } from "./Modal";

const YEARS = [2021, 2022, 2023, 2024, 2025];
const PHASES: Phase[] = ["2A", "2B", "2C", "2CS"];
const STATUSES = ["open", "b_far", "b_mid", "b_near"] as const;

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

export function SchoolDetail({
  school,
  onClose,
}: {
  school: NearbySchool;
  onClose: () => void;
}) {
  const insight = personalisedInsight(school, school.band);
  const latest = latestPhase2C(school);
  const tone = TONE_COLOR[insight.tone];
  const v = school.vacancies;

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

      {/* personalised insight — the headline verdict */}
      <div className="px-5 py-4 sm:px-6">
        <div
          className="rounded-card border p-4"
          style={{ background: `${tone}14`, borderColor: `${tone}45` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
              style={{ background: tone }}
            >
              {insight.headline}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              What this means for you
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

      {/* ballot chart */}
      <Section title="Phase 2C ballot depth (2021–2025)">
        <div className="flex h-[104px] items-end gap-2">
          {YEARS.map((year) => {
            const status = school.ballot[year]?.["2C"] ?? "open";
            return (
              <div
                key={year}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  title={`${year}: ${STATUS_LABEL[status]}`}
                  style={{
                    height: 14 + STATUS_DEPTH[status] * 21,
                    background: STATUS_COLOR[status],
                  }}
                  className="w-full rounded-t-md"
                />
                <span className="text-xs text-ink-soft">{year}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Taller bars mean balloting reached closer in. Latest cycle ({latest.year}):{" "}
          <span className="font-semibold text-ink">
            {STATUS_LABEL[latest.status]}
          </span>
          .
        </p>
      </Section>

      {/* full history grid */}
      <Section title="Ballot history by phase">
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
              {[...YEARS].reverse().map((year) => (
                <tr key={year} className="border-t border-line">
                  <td className="px-2 py-1.5 text-left font-medium text-ink">
                    {year}
                  </td>
                  {PHASES.map((phase) => {
                    const status = school.ballot[year]?.[phase] ?? "open";
                    return (
                      <td key={phase} className="p-1">
                        <span
                          title={`${PHASE_LABEL[phase]} ${year}: ${STATUS_LABEL[status]}`}
                          style={{ background: STATUS_COLOR[status] }}
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
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {STATUSES.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1.5 text-xs text-ink-soft"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: STATUS_COLOR[s] }}
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </Section>

      {/* vacancies */}
      <Section title={`Vacancies — ${v.year} cycle`}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {[
            { label: "Total", value: v.total },
            { label: "Phase 1", value: v.phase1 },
            { label: "Phase 2A", value: v.phase2a },
            { label: "Phase 2B", value: v.phase2b },
            { label: "Phase 2C", value: v.phase2c },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-sand px-2 py-2 text-center"
            >
              <div className="font-display text-lg font-semibold text-ink">
                {stat.value}
              </div>
              <div className="text-[11px] text-ink-soft">{stat.label}</div>
            </div>
          ))}
        </div>
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
