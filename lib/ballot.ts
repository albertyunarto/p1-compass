// Derives ballot outcomes from the raw applied-vs-places data.
//
// MOE fills a phase by distance priority: <1 km applicants first, then 1–2 km,
// then >2 km. The band where places run out is the "balloted" band; bands
// before it are fully admitted, bands after get nothing.

import type { Band, BallotStatus, Phase, PhaseBallot, School } from "./types";

export const BALLOT_YEARS = [2021, 2022, 2023, 2024, 2025];

const BAND_ORDER: Band[] = ["near", "mid", "far"];
const STATUS_FOR_BAND: Record<Band, BallotStatus> = {
  near: "b_near",
  mid: "b_mid",
  far: "b_far",
};

export type BandOutcome = {
  applied: number;
  /** Places still available to this band when it was reached. */
  places: number;
  taken: number;
  balloted: boolean;
};

export type PhaseOutcome = {
  status: BallotStatus;
  vacancy: number;
  totalApplied: number;
  bands: Record<Band, BandOutcome>;
  ballotedBand: Band | null;
  /** 0–1, how oversubscribed the balloted band was — drives colour intensity. */
  intensity: number;
};

export function resolvePhase(pb: PhaseBallot): PhaseOutcome {
  let remaining = pb.vacancy;
  const bands = {} as Record<Band, BandOutcome>;
  let ballotedBand: Band | null = null;

  for (const band of BAND_ORDER) {
    const applied = pb.applied[band];
    const places = Math.max(remaining, 0);
    const taken = Math.min(applied, places);
    if (ballotedBand === null && places > 0 && applied > places) {
      ballotedBand = band;
    }
    bands[band] = { applied, places, taken, balloted: false };
    remaining -= taken;
  }
  if (ballotedBand) bands[ballotedBand].balloted = true;

  const totalApplied =
    pb.applied.near + pb.applied.mid + pb.applied.far;

  let intensity = 0;
  if (ballotedBand) {
    const o = bands[ballotedBand];
    const ratio = o.places > 0 ? o.applied / o.places : 2;
    intensity = Math.max(0, Math.min(1, (ratio - 1) / 1.6));
  }

  return {
    status: ballotedBand ? STATUS_FOR_BAND[ballotedBand] : "open",
    vacancy: pb.vacancy,
    totalApplied,
    bands,
    ballotedBand,
    intensity,
  };
}

const EMPTY: PhaseBallot = { vacancy: 0, applied: { near: 0, mid: 0, far: 0 } };

/** Outcome for a phase in a specific year, or null if not recorded. */
export function outcomeFor(
  school: School,
  phase: Phase,
  year: number,
): PhaseOutcome | null {
  const pb = school.ballot[year]?.[phase];
  return pb ? resolvePhase(pb) : null;
}

/** Most recent recorded outcome for a phase. */
export function latestOutcome(
  school: School,
  phase: Phase,
): { year: number; outcome: PhaseOutcome } {
  const years = Object.keys(school.ballot)
    .map(Number)
    .sort((a, b) => b - a);
  for (const year of years) {
    const pb = school.ballot[year]?.[phase];
    if (pb) return { year, outcome: resolvePhase(pb) };
  }
  return { year: years[0] ?? 0, outcome: resolvePhase(EMPTY) };
}

/** Count of recorded years whose phase outcome matched a given status. */
export function countStatus(
  school: School,
  phase: Phase,
  status: BallotStatus,
): number {
  let n = 0;
  for (const year of BALLOT_YEARS) {
    const o = outcomeFor(school, phase, year);
    if (o && o.status === status) n++;
  }
  return n;
}

/** Number of years with any recorded data for a phase. */
export function recordedYears(school: School, phase: Phase): number {
  return BALLOT_YEARS.filter((y) => school.ballot[y]?.[phase]).length;
}
