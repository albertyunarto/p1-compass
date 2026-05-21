"use client";

import { useMemo, useState } from "react";
import type { NearbySchool, Phase } from "@/lib/types";
import { SchoolRow } from "./SchoolRow";

const PREVIEW = 8;
const MAX_RESULTS = 24;

type Props = {
  schools: NearbySchool[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  defaultOpen?: boolean;
};

export function BeyondPanel({
  schools,
  phase,
  selectedId,
  onSelect,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return schools.slice(0, PREVIEW);
    return schools
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [schools, q]);

  if (schools.length === 0) return null;

  return (
    <section className="rounded-[14px] border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <svg
          viewBox="0 0 24 24"
          className={
            "h-4 w-4 shrink-0 text-ink-muted transition-transform " +
            (open ? "rotate-90" : "")
          }
          aria-hidden
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="font-display text-xl font-medium text-ink">
          Beyond 2 km
        </span>
        <span className="text-[13px] font-semibold text-ink-muted">
          {schools.length} school{schools.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-[13px] font-semibold text-primary">
          {open ? "Hide" : "Look up a school"}
        </span>
      </button>

      {open ? (
        <div className="border-t border-line p-4">
          <p className="mb-3 text-sm text-ink-muted">
            You are in the lowest-priority distance band for these schools, but
            you can still check any school&rsquo;s ballot history and odds —
            search for one by name.
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name — e.g. Anglo-Chinese"
            aria-label="Search schools beyond 2 km by name"
            className="h-11 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
          />

          {matches.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {matches.map((school) => (
                <SchoolRow
                  key={school.id}
                  school={school}
                  phase={phase}
                  selected={school.id === selectedId}
                  onSelect={() => onSelect(school.id)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              No school beyond 2 km matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}

          {!q ? (
            <p className="mt-2.5 text-xs text-ink-muted">
              Showing the {Math.min(PREVIEW, schools.length)} nearest. Search
              above to find any other school.
            </p>
          ) : matches.length === MAX_RESULTS ? (
            <p className="mt-2.5 text-xs text-ink-muted">
              Showing the first {MAX_RESULTS} matches — narrow your search to see
              more.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
