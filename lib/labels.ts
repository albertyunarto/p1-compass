// Display labels + colours for bands, ballot statuses and phases.

import type { Band, BallotStatus, Phase } from "./types";

export const BAND_LABEL: Record<Band, string> = {
  near: "Within 1 km",
  mid: "1–2 km",
  far: "Beyond 2 km",
};

export const BAND_SHORT: Record<Band, string> = {
  near: "<1 km",
  mid: "1–2 km",
  far: ">2 km",
};

/** Solid badge / section-dot colour per distance band. */
export const BAND_COLOR: Record<Band, string> = {
  near: "#0e5346",
  mid: "#b57a24",
  far: "#7b7466",
};

export const STATUS_LABEL: Record<BallotStatus, string> = {
  open: "No ballot",
  b_far: "Balloted >2 km",
  b_mid: "Balloted 1–2 km",
  b_near: "Balloted <1 km",
};

export const STATUS_DESC: Record<BallotStatus, string> = {
  open: "Every applicant was admitted without a ballot.",
  b_far: "A ballot was held, resolved within the beyond-2 km band.",
  b_mid: "Balloting reached into the 1–2 km band.",
  b_near: "Balloting reached inside the 1 km band — the most competitive outcome.",
};

/** Flat reference colour per status (legends, dots). */
export const STATUS_COLOR: Record<BallotStatus, string> = {
  open: "#3f9b6e",
  b_far: "#c9982e",
  b_mid: "#d9762b",
  b_near: "#c8412f",
};

/** 0–3 depth for charting (open shallowest, b_near deepest). */
export const STATUS_DEPTH: Record<BallotStatus, number> = {
  open: 0,
  b_far: 1,
  b_mid: 2,
  b_near: 3,
};

export const PHASE_LABEL: Record<Phase, string> = {
  "2A": "Phase 2A",
  "2B": "Phase 2B",
  "2C": "Phase 2C",
};

export const PHASE_META: Record<Phase, { label: string; who: string }> = {
  "2A": { label: "Phase 2A", who: "Alumni & staff children" },
  "2B": { label: "Phase 2B", who: "Volunteers & community ties" },
  "2C": { label: "Phase 2C", who: "Open to all" },
};

// --- intensity colour ramp ---------------------------------------------------
// Same hue per status; deeper as the balloted band gets more oversubscribed.

const RAMP: Record<BallotStatus, [string, string]> = {
  open: ["#4fa882", "#3f9b6e"],
  b_far: ["#e0cc8a", "#c9982e"],
  b_mid: ["#e9a77e", "#d9762b"],
  b_near: ["#e0978c", "#a8362a"],
};

function lerpHex(from: string, to: string, t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const a = parse(from);
  const b = parse(to);
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * c));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Colour for a ballot cell, deepening with how oversubscribed it was. */
export function ballotColor(status: BallotStatus, intensity: number): string {
  const [lo, hi] = RAMP[status];
  return lerpHex(lo, hi, intensity);
}
