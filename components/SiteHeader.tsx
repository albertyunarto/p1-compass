"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassMark } from "./Logo";

export function SiteHeader() {
  const pathname = usePathname();
  const isSearch = pathname === "/" || pathname.startsWith("/search");
  const isCompare = pathname.startsWith("/compare");
  const isAbout = pathname.startsWith("/about");

  return (
    <header className="print-hide sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-ink transition-opacity hover:opacity-80"
        >
          <CompassMark className="h-[22px] w-[22px] text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">
            P1 Compass
          </span>
        </Link>
        <nav className="flex items-center gap-3.5 text-[13.5px] font-semibold text-ink-muted sm:gap-5">
          <Link
            href="/"
            className={isSearch ? "text-ink" : "transition-colors hover:text-ink"}
          >
            Search
          </Link>
          <Link
            href="/compare"
            className={isCompare ? "text-ink" : "transition-colors hover:text-ink"}
          >
            Compare
          </Link>
          <Link
            href="/about"
            className={isAbout ? "text-ink" : "transition-colors hover:text-ink"}
          >
            How it works
          </Link>
          <a
            href="https://www.moe.gov.sg/primary/p1-registration"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-ink transition-colors hover:border-primary/40"
          >
            MOE portal ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
