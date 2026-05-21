"use client";

import Link from "next/link";
import { personalisedInsight } from "@/lib/insight";
import type { NearbySchool, Phase } from "@/lib/types";
import { useShortlist } from "./ShortlistContext";
import { VerdictPill } from "./VerdictPill";

/** Teal shortlist summary shown in the results map column (desktop). */
export function ShortlistPreview({
  schools,
  phase,
}: {
  schools: NearbySchool[];
  phase: Phase;
}) {
  const { ids } = useShortlist();
  if (ids.length === 0) return null;

  const picked = ids
    .map((id) => schools.find((s) => s.id === id))
    .filter((s): s is NearbySchool => Boolean(s));

  return (
    <div className="rounded-[14px] bg-primary p-4 text-white">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#90c0ae]">
          Your shortlist
        </span>
        <Link
          href="/compare"
          className="rounded-full bg-[#f4ebd6] px-3 py-1 text-xs font-bold text-primary transition hover:bg-white"
        >
          Compare {ids.length} →
        </Link>
      </div>
      {picked.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {picked.map((s) => {
            const insight = personalisedInsight(s, s.band, phase);
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="truncate font-semibold">{s.name}</span>
                <VerdictPill
                  tone={insight.tone}
                  label={insight.headline}
                  size="sm"
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-[#d7e3dc]">
          Shortlisted schools from another search — open Compare to view them.
        </p>
      )}
    </div>
  );
}
