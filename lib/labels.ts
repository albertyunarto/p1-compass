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

export const BAND_COLOR: Record<Band, string> = {
  near: "#3f9b6e",
  mid: "#cf9f33",
  far: "#8a8578",
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

export const STATUS_COLOR: Record<BallotStatus, string> = {
  open: "#3f9b6e",
  b_far: "#cf9f33",
  b_mid: "#e0792f",
  b_near: "#d24a3f",
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
  "2CS": "Phase 2C (S)",
};
