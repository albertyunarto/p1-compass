"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { PHASE_LABEL } from "@/lib/labels";
import type { Band, Phase, RecommendResult, RecPriority } from "@/lib/types";

// Browser-side cache. A generated plan is stable per school + band + phase, so
// once it has been generated, repeat views cost zero tokens.
const CACHE_PREFIX = "p1c_rec:v1:";
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function cacheKey(schoolId: string, band: Band, phase: Phase): string {
  return `${CACHE_PREFIX}${schoolId}:${band}:${phase}`;
}

function readCache(key: string): RecommendResult | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: RecommendResult };
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: RecommendResult): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore quota / unavailable storage
  }
}

type State =
  | { kind: "checking" }
  | { kind: "hidden" }
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: RecommendResult }
  | { kind: "error" };

const PRIORITY_COLOR: Record<RecPriority, string> = {
  high: "#a8362a",
  medium: "#b45a1d",
  low: "#1f7a56",
};

export function SchoolRecommendations({
  schoolId,
  schoolName,
  band,
  distanceKm,
  phase,
}: {
  schoolId: string;
  schoolName: string;
  band: Band;
  distanceKm: number;
  phase: Phase;
}) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const key = cacheKey(schoolId, band, phase);

  // On open: serve a cached plan instantly, else check availability. Neither
  // path spends Gemini tokens.
  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const cached = readCache(key);
      if (cached) {
        setState({ kind: "ready", data: cached });
        return;
      }
      try {
        const res = await fetch("/api/recommend", { signal: ctrl.signal });
        const data = (await res.json()) as { configured?: boolean };
        setState(data.configured ? { kind: "idle" } : { kind: "hidden" });
      } catch {
        setState({ kind: "hidden" });
      }
    })();
    return () => ctrl.abort();
  }, [key]);

  async function generate() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, band, distanceKm, phase }),
      });
      const data = (await res.json()) as RecommendResult;
      if (res.ok && data.recommendations?.length > 0) {
        writeCache(key, data);
        setState({ kind: "ready", data });
        track("recommendations_generated", {
          school: schoolName,
          band,
          phase,
          count: data.recommendations.length,
        });
      } else {
        setState({ kind: "error" });
      }
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "checking" || state.kind === "hidden") return null;

  return (
    <section className="border-t border-line px-5 py-4 sm:px-6">
      <h3 className="mb-2 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-eyebrow">
        Ways to improve your {PHASE_LABEL[phase]} odds
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold tracking-normal text-primary">
          AI
        </span>
      </h3>

      {state.kind === "idle" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[13px] text-ink-muted">
            A short, AI-written action plan for {PHASE_LABEL[phase]}.
          </p>
          <button
            type="button"
            onClick={generate}
            className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-primary-dark active:scale-[0.99]"
          >
            Generate
          </button>
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-primary"
            aria-hidden
          />
          Analysing the ballot history…
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[13px] text-ink-muted">
            Couldn&rsquo;t generate recommendations.
          </p>
          <button
            type="button"
            onClick={generate}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink transition hover:border-primary/40"
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <>
          {state.data.summary ? (
            <p className="mb-2 text-[13px] leading-snug text-ink-muted">
              {state.data.summary}
            </p>
          ) : null}
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {state.data.recommendations.map((rec, i) => (
              <li key={i}>
                <details open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: PRIORITY_COLOR[rec.priority] ?? "#7b7466",
                      }}
                      aria-hidden
                    />
                    <span className="flex-1 text-sm font-semibold text-ink">
                      {rec.action}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform [details[open]_&]:rotate-90"
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
                  </summary>
                  <p className="px-3 pb-2.5 pl-7 text-xs leading-relaxed text-ink-muted">
                    {rec.detail}
                  </p>
                </details>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-muted/80">
            Rule-based guidance pairing your distance band with each
            school&apos;s 5-year MOE ballot history. Always confirm phase
            eligibility on MOE&apos;s portal.
          </p>
        </>
      ) : null}
    </section>
  );
}
