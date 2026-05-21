"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { PHASE_LABEL } from "@/lib/labels";
import type { Band, Phase, RecommendResult, RecPriority } from "@/lib/types";

// Browser-side cache. A generated plan is stable per school + band + phase, so
// once a parent (or anyone) has generated it, repeat views cost zero tokens.
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
  high: "#d24a3f",
  medium: "#e0792f",
  low: "#3f9b6e",
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

  // On open: serve a cached plan instantly, else check whether the AI feature
  // is available. Neither path spends Gemini tokens.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
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
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Ways to improve your {PHASE_LABEL[phase]} odds
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-primary">
          AI
        </span>
      </h3>

      {state.kind === "idle" ? (
        <>
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            Generate a short, AI-written action plan for {PHASE_LABEL[phase]},
            based on this school&rsquo;s ballot history and your distance from
            it.
          </p>
          <button
            type="button"
            onClick={generate}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark active:scale-[0.99]"
          >
            Generate recommendations
          </button>
        </>
      ) : null}

      {state.kind === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-primary"
            aria-hidden
          />
          Analysing the ballot history…
        </div>
      ) : null}

      {state.kind === "error" ? (
        <>
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            Couldn&rsquo;t generate recommendations right now.
          </p>
          <button
            type="button"
            onClick={generate}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:border-primary/50"
          >
            Try again
          </button>
        </>
      ) : null}

      {state.kind === "ready" ? (
        <>
          {state.data.summary ? (
            <p className="mb-3 text-[15px] leading-relaxed text-ink">
              {state.data.summary}
            </p>
          ) : null}
          <ul className="space-y-2.5">
            {state.data.recommendations.map((rec, i) => (
              <li
                key={i}
                className="rounded-card border border-line bg-surface p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: PRIORITY_COLOR[rec.priority] ?? "#8a8578",
                    }}
                    aria-hidden
                  />
                  <span className="font-semibold text-ink">{rec.action}</span>
                </div>
                <p className="mt-1 pl-4 text-sm leading-relaxed text-ink-soft">
                  {rec.detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-soft/80">
            AI-generated guidance based on the (synthetic) ballot history —
            confirm phase eligibility on MOE&rsquo;s official portal.
          </p>
        </>
      ) : null}
    </section>
  );
}
