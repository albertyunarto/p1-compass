// AI recommendation engine.
//
// Turns one school's ballot history plus a parent's home distance into
// concrete, prioritised admission advice via Gemini. Considers all three
// balloted phases (2A/2B/2C) so the advice can point a parent at an earlier
// phase — e.g. volunteering for Phase 2B — when that improves their odds.

import { type BandOutcome, countStatus, latestOutcome, recordedYears } from "./ballot";
import { geminiJson } from "./gemini";
import { personalisedInsight } from "./insight";
import { BAND_LABEL, PHASE_LABEL, STATUS_LABEL } from "./labels";
import type { Band, Phase, RecommendResult, School } from "./types";

const PHASES: Phase[] = ["2A", "2B", "2C"];

const SYSTEM = `You are an experienced advisor on Singapore's Ministry of Education (MOE) Primary 1 (P1) registration exercise. A parent is considering one specific primary school. Give short, practical, realistic advice on how to improve their child's chance of securing a place there.

How P1 registration works:
- After Phase 1 (children with a sibling already in the school), the balloted phases run in order:
  - Phase 2A: for a child whose parent or sibling studied at the school, or whose parent belongs to the school's alumni association, or whose parent is a staff member. Alumni-association membership generally must be in place well before registration.
  - Phase 2B: for a child whose parent has completed at least 40 hours of volunteer service to the school, OR is a member of the church or clan the school is affiliated with, OR is endorsed as an active community leader. Volunteering usually must start 1-2 years before registration to count.
  - Phase 2C: open to every remaining applicant.
- Within each phase, places are allocated by citizenship, then by home-to-school distance: within 1 km first, then 1-2 km, then beyond 2 km. When a distance group has more applicants than places, a computerised ballot decides.

You receive JSON describing the school, the parent's home distance, and the recent ballot outcome for each phase. Use only that data.

Write a one-sentence summary of the best strategy, then 2-4 prioritised recommendations. Guidance:
- Be specific and cite the data (distance band, oversubscription, which band balloted).
- Recommend acting in an earlier phase (2A or 2B) only when it is genuinely plausible — e.g. suggest Phase 2B volunteering for an oversubscribed school the parent can reach — and note the eligibility or timing catch.
- If the school is comfortably within reach at the parent's distance, say so plainly instead of inventing pressure; a low-priority "register on the opening day" tip is enough.
- Never invent affiliations, programmes or facts not present in the data.
- Keep each action under 8 words; keep each detail to 1-2 plain sentences a busy parent can act on.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    recommendations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          action: { type: "STRING" },
          detail: { type: "STRING" },
          phase: { type: "STRING", enum: ["2A", "2B", "2C", "general"] },
          priority: { type: "STRING", enum: ["high", "medium", "low"] },
        },
        required: ["action", "detail", "phase", "priority"],
        propertyOrdering: ["action", "detail", "phase", "priority"],
      },
    },
  },
  required: ["summary", "recommendations"],
  propertyOrdering: ["summary", "recommendations"],
};

function bandSummary(o: BandOutcome) {
  return { applied: o.applied, placesAvailableToBand: o.places, balloted: o.balloted };
}

function phaseBrief(school: School, band: Band, phase: Phase) {
  const { year, outcome } = latestOutcome(school, phase);
  return {
    phase: PHASE_LABEL[phase],
    latestRecordedYear: year,
    result: STATUS_LABEL[outcome.status],
    places: outcome.vacancy,
    totalApplied: outcome.totalApplied,
    oversubscription:
      outcome.vacancy > 0
        ? Number((outcome.totalApplied / outcome.vacancy).toFixed(2))
        : 0,
    byDistanceBand: {
      "within 1 km": bandSummary(outcome.bands.near),
      "1-2 km": bandSummary(outcome.bands.mid),
      "beyond 2 km": bandSummary(outcome.bands.far),
    },
    yearsBallotedWithin1km: countStatus(school, phase, "b_near"),
    yearsRecorded: recordedYears(school, phase),
    rulesBasedVerdict: personalisedInsight(school, band, phase).verdict,
  };
}

function buildBrief(school: School, band: Band, distanceKm: number) {
  return {
    school: {
      name: school.name,
      types: school.type,
      affiliations: school.affiliations,
      programmes: school.programmes,
    },
    parentHome: {
      distanceFromSchoolKm: Number(distanceKm.toFixed(2)),
      distanceBand: BAND_LABEL[band],
    },
    phases: PHASES.map((p) => phaseBrief(school, band, p)),
  };
}

/**
 * Generate prioritised admission recommendations for a school + parent.
 * Returns null when Gemini is unconfigured, unreachable or returns nothing
 * usable — callers treat that as "no recommendations to show".
 */
export async function getRecommendations(
  school: School,
  band: Band,
  distanceKm: number,
): Promise<RecommendResult | null> {
  const brief = buildBrief(school, band, distanceKm);

  const result = await geminiJson<RecommendResult>({
    system: SYSTEM,
    prompt: `School and parent data:\n\`\`\`json\n${JSON.stringify(
      brief,
      null,
      2,
    )}\n\`\`\`\n\nReturn a one-sentence \`summary\` and 2-4 \`recommendations\` ordered from highest to lowest priority.`,
    schema: SCHEMA,
  });

  if (!result || !Array.isArray(result.recommendations)) return null;
  const recommendations = result.recommendations
    .filter((r) => r && r.action && r.detail)
    .slice(0, 4);
  if (recommendations.length === 0) return null;

  return { summary: result.summary ?? "", recommendations };
}
