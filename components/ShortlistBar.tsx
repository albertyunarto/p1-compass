"use client";

import Link from "next/link";
import { useShortlist } from "./ShortlistContext";

/** Sticky bottom shortlist bar — mobile only. */
export function ShortlistBar() {
  const { ids } = useShortlist();
  if (ids.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-white shadow-[0_-8px_24px_-8px_rgba(28,21,10,0.18)] lg:hidden">
      <span className="text-[13.5px]">
        <strong>
          {ids.length} shortlisted
        </strong>
        <span className="text-[#90c0ae]"> · ready to compare</span>
      </span>
      <Link
        href="/compare"
        className="rounded-full bg-[#f4ebd6] px-3.5 py-1.5 text-xs font-bold text-primary"
      >
        Compare →
      </Link>
    </div>
  );
}
