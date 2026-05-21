import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-sand/60 mt-16">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">P1 Compass is a planning aid, not an
          official source.</strong>{" "}
          Ballot history shown here is illustrative and may not reflect the
          latest cycle. Always confirm vacancies and balloting outcomes against{" "}
          <a
            href="https://www.moe.gov.sg/primary/p1-registration"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            MOE&apos;s official P1 registration site
          </a>
          . Registration itself happens only on MOE&apos;s portal.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">
            Search
          </Link>
          <Link href="/about" className="hover:text-ink">
            How it works &amp; data sources
          </Link>
          <span className="text-ink-soft/70">
            Distances are straight-line, matching MOE methodology.
          </span>
        </div>
      </div>
    </footer>
  );
}
