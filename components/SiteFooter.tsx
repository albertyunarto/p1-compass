import Link from "next/link";
import { CompassMark } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="print-hide mt-16 border-t border-line bg-sand">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-2.5 flex items-center gap-2">
          <CompassMark className="h-[18px] w-[18px] text-primary" />
          <span className="font-display text-base font-semibold text-ink">
            P1 Compass
          </span>
        </div>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
          <strong className="text-ink">
            A planning aid, not an official source.
          </strong>{" "}
          Ballot figures are MOE 2021&ndash;2025; registration itself happens
          only on{" "}
          <a
            href="https://www.moe.gov.sg/primary/p1-registration"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            MOE&apos;s official P1 registration site
          </a>
          .
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
          <Link href="/about" className="hover:text-ink">
            How it works &amp; data sources
          </Link>
          <span aria-hidden>·</span>
          <span>Distances are straight-line, matching MOE methodology.</span>
          <span aria-hidden>·</span>
          <span>Made for Singapore parents · Free, no sign-up</span>
        </div>
      </div>
    </footer>
  );
}
