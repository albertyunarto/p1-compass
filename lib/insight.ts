// Personalised insight engine — the differentiating feature.
//
// Combines the user's distance band to a school with that school's latest
// Phase 2C ballot depth into a plain-language verdict. Rules-based and
// deterministic: 3 distance bands x 4 ballot statuses = 12 cases.

import type { Band, BallotStatus, School } from "./types";

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

const MATRIX: Record<Band, Record<BallotStatus, Cell>> = {
  near: {
    open: {
      tone: "good",
      headline: "Safe bet",
      verdict:
        "You are within 1 km and this school has not needed a Phase 2C ballot recently — a comfortable, low-risk choice.",
    },
    b_far: {
      tone: "good",
      headline: "Strong odds",
      verdict:
        "You are within 1 km. Balloting has only reached the outer >2 km band, so your distance priority here is strong.",
    },
    b_mid: {
      tone: "good",
      headline: "Strong odds",
      verdict:
        "You are within 1 km, which sits ahead of the 1–2 km band where balloting has landed — you hold priority and good odds.",
    },
    b_near: {
      tone: "caution",
      headline: "Competitive",
      verdict:
        "You are within 1 km, but Phase 2C balloting has reached inside the 1 km band — likely workable, though not guaranteed. Register on the first day.",
    },
  },
  mid: {
    open: {
      tone: "good",
      headline: "Good odds",
      verdict:
        "You are in the 1–2 km band and this school filled without a ballot recently — your odds look good.",
    },
    b_far: {
      tone: "good",
      headline: "Good odds",
      verdict:
        "You are in the 1–2 km band and balloting has only reached the outer >2 km band — you should be comfortable.",
    },
    b_mid: {
      tone: "caution",
      headline: "Borderline",
      verdict:
        "You are in the 1–2 km band and that is exactly where recent ballots landed — it is borderline. Line up a nearer backup school.",
    },
    b_near: {
      tone: "unlikely",
      headline: "A stretch",
      verdict:
        "You are in the 1–2 km band but Phase 2C filled within 1 km — entry here is unlikely. Treat it as a stretch and prioritise closer schools.",
    },
  },
  far: {
    open: {
      tone: "caution",
      headline: "Possible",
      verdict:
        "You are beyond 2 km. The school has not balloted recently so a place is possible, but you are in the lowest-priority distance group.",
    },
    b_far: {
      tone: "unlikely",
      headline: "Long shot",
      verdict:
        "You are beyond 2 km and balloting already reaches your band — realistically this is a long shot.",
    },
    b_mid: {
      tone: "unlikely",
      headline: "Unlikely",
      verdict:
        "You are beyond 2 km, but Phase 2C filled within the 1–2 km band — entry from your distance is very unlikely.",
    },
    b_near: {
      tone: "unlikely",
      headline: "Out of reach",
      verdict:
        "You are beyond 2 km and Phase 2C filled within 1 km — this school is effectively out of reach via Phase 2C.",
    },
  },
};

/** Most recent Phase 2C ballot status across the recorded years. */
export function latestPhase2C(school: School): {
  year: number;
  status: BallotStatus;
} {
  const years = Object.keys(school.ballot)
    .map(Number)
    .sort((a, b) => b - a);
  for (const year of years) {
    const status = school.ballot[year]?.["2C"];
    if (status) return { year, status };
  }
  return { year: years[0] ?? 0, status: "open" };
}

/** Count of recorded years whose Phase 2C matched a given status. */
function countYears(school: School, status: BallotStatus): number {
  return Object.values(school.ballot).filter((p) => p["2C"] === status).length;
}

export function personalisedInsight(school: School, band: Band): Insight {
  const { status } = latestPhase2C(school);
  const cell = MATRIX[band][status];
  const totalYears = Object.keys(school.ballot).length;

  let trend = "";
  const nearYears = countYears(school, "b_near");
  const openYears = countYears(school, "open");
  if (nearYears >= 3) {
    trend = ` It has balloted within 1 km in ${nearYears} of the last ${totalYears} years.`;
  } else if (openYears === totalYears && totalYears > 0) {
    trend = ` It has not needed a Phase 2C ballot in any of the last ${totalYears} years.`;
  } else if (nearYears === 0 && status !== "b_near") {
    trend = ` It has never balloted into the 1 km band in the recorded history.`;
  }

  return {
    tone: cell.tone,
    headline: cell.headline,
    verdict: cell.verdict + trend,
  };
}
