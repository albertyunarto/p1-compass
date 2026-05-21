// Personalised insight engine — the differentiating feature.
//
// Combines the user's distance band to a school with that school's most recent
// ballot outcome for a chosen phase into a plain-language verdict. Rules-based
// and deterministic: 3 distance bands x 4 ballot statuses = 12 cases.

import { countStatus, latestOutcome, recordedYears } from "./ballot";
import { PHASE_LABEL } from "./labels";
import type { Band, BallotStatus, Phase, School } from "./types";

export type InsightTone = "good" | "caution" | "unlikely";

export type Insight = {
  tone: InsightTone;
  /** Short chip label, e.g. "Strong odds". */
  headline: string;
  /** 1–2 sentence verdict for the parent. */
  verdict: string;
};

export const TONE_COLOR: Record<InsightTone, string> = {
  good: "#3f9b6e",
  caution: "#e0792f",
  unlikely: "#d24a3f",
};

type Cell = { tone: InsightTone; headline: string; verdict: string };

// {P} is replaced with the phase label, e.g. "Phase 2C".
const MATRIX: Record<Band, Record<BallotStatus, Cell>> = {
  near: {
    open: {
      tone: "good",
      headline: "Safe bet",
      verdict:
        "You are within 1 km and this school has not needed a ballot in {P} recently — a comfortable, low-risk choice.",
    },
    b_far: {
      tone: "good",
      headline: "Strong odds",
      verdict:
        "You are within 1 km. {P} balloting has only reached the outer >2 km band, so your distance priority here is strong.",
    },
    b_mid: {
      tone: "good",
      headline: "Strong odds",
      verdict:
        "You are within 1 km, which sits ahead of the 1–2 km band where {P} balloting has landed — you hold priority and good odds.",
    },
    b_near: {
      tone: "caution",
      headline: "Competitive",
      verdict:
        "You are within 1 km, but {P} balloting has reached inside the 1 km band — likely workable, though not guaranteed. Register on the first day.",
    },
  },
  mid: {
    open: {
      tone: "good",
      headline: "Good odds",
      verdict:
        "You are in the 1–2 km band and this school filled {P} without a ballot recently — your odds look good.",
    },
    b_far: {
      tone: "good",
      headline: "Good odds",
      verdict:
        "You are in the 1–2 km band and {P} balloting has only reached the outer >2 km band — you should be comfortable.",
    },
    b_mid: {
      tone: "caution",
      headline: "Borderline",
      verdict:
        "You are in the 1–2 km band and that is exactly where recent {P} ballots landed — it is borderline. Line up a nearer backup school.",
    },
    b_near: {
      tone: "unlikely",
      headline: "A stretch",
      verdict:
        "You are in the 1–2 km band but {P} filled within 1 km — entry here is unlikely. Treat it as a stretch and prioritise closer schools.",
    },
  },
  far: {
    open: {
      tone: "caution",
      headline: "Possible",
      verdict:
        "You are beyond 2 km. The school has not balloted {P} recently so a place is possible, but you are in the lowest-priority distance group.",
    },
    b_far: {
      tone: "unlikely",
      headline: "Long shot",
      verdict:
        "You are beyond 2 km and {P} balloting already reaches your band — realistically this is a long shot.",
    },
    b_mid: {
      tone: "unlikely",
      headline: "Unlikely",
      verdict:
        "You are beyond 2 km, but {P} filled within the 1–2 km band — entry from your distance is very unlikely.",
    },
    b_near: {
      tone: "unlikely",
      headline: "Out of reach",
      verdict:
        "You are beyond 2 km and {P} filled within 1 km — this school is effectively out of reach in this phase.",
    },
  },
};

export function personalisedInsight(
  school: School,
  userBand: Band,
  phase: Phase,
): Insight {
  const { outcome } = latestOutcome(school, phase);
  const cell = MATRIX[userBand][outcome.status];
  const totalYears = recordedYears(school, phase);

  let trend = "";
  const nearYears = countStatus(school, phase, "b_near");
  const openYears = countStatus(school, phase, "open");
  if (nearYears >= 3) {
    trend = ` It has balloted within 1 km in ${nearYears} of the last ${totalYears} years.`;
  } else if (openYears === totalYears && totalYears > 0) {
    trend = ` It has not needed a ballot in this phase in any of the last ${totalYears} years.`;
  } else if (nearYears === 0 && outcome.status !== "b_near") {
    trend = " It has never balloted into the 1 km band in the recorded history.";
  }

  return {
    tone: cell.tone,
    headline: cell.headline,
    verdict: cell.verdict.replaceAll("{P}", PHASE_LABEL[phase]) + trend,
  };
}
