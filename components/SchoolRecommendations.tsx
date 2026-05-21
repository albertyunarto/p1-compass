"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { Band, RecommendResult, RecPriority } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: RecommendResult }
  | { kind: "empty" };

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
}: {
  schoolId: string;
  schoolName: string;
  band: Band;
  distanceKm: number;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, band, distanceKm }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<RecommendResult>) : null))
      .then((data) => {
        if (data && data.recommendations?.length > 0) {
          setState({ kind: "ready", data });
          track("recommendations_shown", {
            school: schoolName,
            band,
            count: data.recommendations.length,
          });
        } else {
          setState({ kind: "empty" });
        }
      })
      .catch(() => {
        // Aborts and failures are silent — Gemini-only means hide on failure.
        setState((s) => (s.kind === "loading" ? { kind: "empty" } : s));
      });

    return () => ctrl.abort();
  }, [schoolId, schoolName, band, distanceKm]);

  if (state.kind === "empty") return null;

  return (
    <section className="border-t border-line px-5 py-4 sm:px-6">
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Ways to improve your odds
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-primary">
          AI
        </span>
      </h3>

      {state.kind === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-primary"
            aria-hidden
          />
          Analysing the ballot history…
        </div>
      ) : (
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
                    style={{ background: PRIORITY_COLOR[rec.priority] ?? "#8a8578" }}
                    aria-hidden
                  />
                  <span className="font-semibold text-ink">{rec.action}</span>
                  {rec.phase !== "general" ? (
                    <span className="ml-auto shrink-0 rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                      Phase {rec.phase}
                    </span>
                  ) : null}
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
      )}
    </section>
  );
}
