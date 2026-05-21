import Link from "next/link";
import { CompassMark } from "./Logo";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper/85 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-ink transition-opacity hover:opacity-80"
        >
          <CompassMark className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">
            P1 Compass
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-ink-soft">
          <Link href="/about" className="transition-colors hover:text-ink">
            How it works
          </Link>
          <a
            href="https://www.moe.gov.sg/primary/p1-registration"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-ink"
          >
            MOE official
          </a>
        </nav>
      </div>
    </header>
  );
}
