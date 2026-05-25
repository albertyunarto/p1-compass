import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works & data sources",
  description:
    "How P1 Compass calculates distance bands, reads ballot history and generates personalised Phase 2C insight — and where its data comes from.",
};

const PHASES = [
  ["Phase 1", "For children with a sibling currently in the school."],
  ["Phase 2A", "For children of alumni, staff or school-connected families."],
  [
    "Phase 2B",
    "For children whose parents are volunteers, community leaders or have church/clan ties.",
  ],
  [
    "Phase 2C",
    "Open to all remaining children. When demand exceeds places, admission is balloted with distance priority: within 1 km, then 1–2 km, then beyond 2 km.",
  ],
  [
    "Phase 2C Supplementary",
    "A final round for children not yet placed after Phase 2C.",
  ],
];

const SOURCES = [
  ["OneMap SG", "Postal code and school-address geocoding.", "https://www.onemap.gov.sg/apidocs/"],
  ["MOE School Finder", "School profiles, programmes and addresses.", "https://www.moe.gov.sg/schoolfinder"],
  [
    "MOE P1 Vacancies & Balloting",
    "Annual ballot history per school and phase.",
    "https://www.moe.gov.sg/primary/p1-registration/past-vacancies-and-balloting-data",
  ],
];

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 font-display text-2xl font-medium text-ink">
      {children}
    </h2>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-medium text-ink sm:text-4xl">
        How P1 Compass works
      </h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        P1 Compass turns a postal code into a clear read on your Primary 1
        Phase 2C chances. It combines two things the official tools keep
        separate: how far you live from each school, and how deep that school
        has had to ballot in past years.
      </p>

      <Heading>Distance</Heading>
      <p className="mt-2 leading-relaxed text-ink-soft">
        Distances are straight-line (great-circle) measurements between your
        home and each school — the same methodology MOE uses for Phase 2C
        priority. We do not use walking or driving distance. Schools are sorted
        into three bands: within 1 km, 1–2 km, and beyond 2 km.
      </p>

      <Heading>How we keep the location data honest</Heading>
      <p className="mt-2 leading-relaxed text-ink-soft">
        School locations are not estimates. Every school&apos;s coordinates,
        street address and postal code come from the Singapore Land Authority
        building dataset (the same source OneMap and the government&apos;s own
        postal lookup use). Every release is run through an automated audit
        that asserts:
      </p>
      <ul className="mt-3 space-y-1.5 text-ink-soft">
        <li>
          <strong className="text-ink">100% of school coordinates</strong>{" "}
          match SLA to 5 decimal places (sub-metre).
        </li>
        <li>
          <strong className="text-ink">100% of school postal codes</strong>{" "}
          match SLA exactly — no synthesised addresses.
        </li>
        <li>
          <strong className="text-ink">Distance maths are byte-identical</strong>{" "}
          to a direct SLA-to-SLA haversine calculation (max delta &lt; 1 m
          across every postal-school pair tested).
        </li>
        <li>
          <strong className="text-ink">Your home postal</strong> is resolved
          live through OneMap, the official map service, with a 121k-postal
          offline index as a fallback when OneMap is unreachable.
        </li>
      </ul>
      <p className="mt-3 leading-relaxed text-ink-soft">
        If your home postal isn&apos;t in the offline index (very new
        developments occasionally aren&apos;t), we always defer to OneMap to
        avoid mis-banding you across the 1 km Phase 2C cutoff. The audit
        script (<code className="rounded bg-sand/60 px-1.5 py-0.5 text-[0.85em] text-ink">
          bun run validate
        </code>) runs every build and the result is checked in alongside the
        dataset — you can read it on GitHub.
      </p>

      <Heading>Ballot data — what&apos;s real, what isn&apos;t</Heading>
      <p className="mt-2 leading-relaxed text-ink-soft">
        Every ballot bar in P1 Compass is labelled by provenance. A green
        &ldquo;✓ Verified against MOE figures&rdquo; banner means the figures for that
        phase came from MOE&apos;s Past Vacancies and Balloting Data (via{" "}
        <a
          href="https://www.p1registration.sg/category/ballot-history/"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          p1registration.sg
        </a>
        ). An amber &ldquo;⚠ Illustrative — pending the next MOE refresh&rdquo;
        banner means we don&apos;t yet have real numbers for that school, and
        what you see is generated to demonstrate the UI — do NOT use it for a
        decision. The refresh runs once per year after MOE publishes; the
        scraper script (
        <code className="rounded bg-sand/60 px-1.5 py-0.5 text-[0.85em] text-ink">
          bun scripts/scrape-ballot.ts
        </code>
        ) pulls the real figures into{" "}
        <code className="rounded bg-sand/60 px-1.5 py-0.5 text-[0.85em] text-ink">
          data/ballot-truth.json
        </code>{" "}
        and the build merges them in.
      </p>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Individual bars also carry a small &ldquo;MOE&rdquo; tag under the year
        label when verified, and a hatched pattern on illustrative bars so they
        never look interchangeable with real data.
      </p>

      <Heading>Phases &amp; ballot history</Heading>
      <p className="mt-2 leading-relaxed text-ink-soft">
        Use the phase toggle to view your situation for Phase 2A (alumni),
        2B (volunteer/community) or 2C (open) — each balloting separately. For
        every phase and year we track how deep balloting reached:
      </p>
      <ul className="mt-3 space-y-1.5 text-ink-soft">
        <li>
          <strong className="text-ink">No ballot</strong> — every applicant was
          admitted.
        </li>
        <li>
          <strong className="text-ink">Balloted &gt;2 km</strong> — a ballot was
          needed, resolved in the outer band.
        </li>
        <li>
          <strong className="text-ink">Balloted 1–2 km</strong> — balloting
          reached into the 1–2 km band.
        </li>
        <li>
          <strong className="text-ink">Balloted &lt;1 km</strong> — balloting
          reached inside 1 km, the most competitive outcome.
        </li>
      </ul>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Colour intensity reflects how oversubscribed the balloted band was —
        applicants versus places. A deeper shade means a tougher ballot. Open
        any school to see the applied-vs-places numbers for each distance band.
      </p>

      <Heading>Personalised insight</Heading>
      <p className="mt-2 leading-relaxed text-ink-soft">
        Your distance band and a school&apos;s most recent ballot depth are
        combined into a plain-language verdict — twelve possible cases covering
        every band-and-outcome pairing, plus a note on multi-year trend. The
        logic is transparent and rule-based, not a black box.
      </p>

      <Heading>The registration phases</Heading>
      <dl className="mt-3 space-y-3">
        {PHASES.map(([name, desc]) => (
          <div key={name}>
            <dt className="font-semibold text-ink">{name}</dt>
            <dd className="text-sm leading-relaxed text-ink-soft">{desc}</dd>
          </div>
        ))}
      </dl>

      <Heading>Data sources</Heading>
      <ul className="mt-3 space-y-3">
        {SOURCES.map(([name, desc, url]) => (
          <li key={name}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline underline-offset-2"
            >
              {name}
            </a>
            <span className="block text-sm text-ink-soft">{desc}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-card border border-line bg-sand/70 p-5">
        <h2 className="font-display text-lg font-medium text-ink">
          Important
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          This build uses an illustrative dataset for demonstration — school
          figures and ballot outcomes are not official. Always confirm
          vacancies and balloting against{" "}
          <a
            href="https://www.moe.gov.sg/primary/p1-registration"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            MOE&apos;s official P1 registration site
          </a>
          . P1 Compass is a planning aid only; registration happens on
          MOE&apos;s portal.
        </p>
      </div>

      <p className="mt-8">
        <Link
          href="/"
          className="text-sm font-semibold text-primary underline underline-offset-2"
        >
          ← Back to search
        </Link>
      </p>
    </div>
  );
}
