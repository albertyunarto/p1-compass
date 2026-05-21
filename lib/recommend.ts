// AI recommendation engine.
//
// Turns one school's ballot history for a single registration phase, plus a
// parent's home distance, into concrete prioritised admission advice via
// Gemini. Scoped to the phase the parent has selected — the advice covers
// that phase only.

import { type BandOutcome, countStatus, latestOutcome, recordedYears } from "./ballot";
import { geminiJson } from "./gemini";
import { personalisedInsight } from "./insight";
import { BAND_LABEL, PHASE_LABEL, PHASE_META, STATUS_LABEL } from "./labels";
import type { Band, Phase, RecommendResult, School } from "./types";

const SYSTEM = `You are an experienced advisor on Singapore's Ministry of Education (MOE) Primary 1 (P1) registration exercise. A parent is considering one specific primary school and is focused on ONE registration phase. Give short, practical, realistic advice on how to improve their child's chance of securing a place there in that phase.

How P1 registration works:
- After Phase 1 (children with a sibling already in the school), the balloted phases run in order:
  - Phase 2A: for a child whose parent or sibling studied at the school, or whose parent belongs to the school's alumni association, or whose parent is a staff member. Alumni-association membership generally must be in place well before registration.
  - Phase 2B: for a child whose parent has completed at least 40 hours of volunteer service to the school, OR is a member of the church or clan the school is affiliated with, OR is endorsed as an active community leader. Volunteering usually must start 1-2 years before registration to count.
  - Phase 2C: open to every remaining applicant.
- Within each phase, places are allocated by citizenship, then by home-to-school distance: within 1 km first, then 1-2 km, then beyond 2 km. When a distance group has more applicants than places, a computerised ballot decides.

You receive JSON with the school, the parent's home distance, and — under \`focusPhase\` — the recent ballot outcome for the one phase the parent is looking at. Use only that data.

Give recommendations for the focus phase ONLY; do not advise on other phases.

Write a one-sentence summary of the best strategy for that phase, then 2-4 prioritised recommendations. Guidance:
- Be specific and cite the data (distance band, oversubscription, which band balloted).
- Phase 2A advice centres on alumni-association membership or staff eligibility. Phase 2B advice centres on volunteering about 40 hours (which usually must start 1-2 years ahead) or affiliated church/clan membership. Phase 2C advice centres on distance priority, registering on the opening day, and lining up backup schools.
- Only suggest an action the parent can plausibly still take, and note any eligibility or timing catch.
- If the school is comfortably within reach at the parent's distance, say so plainly instead of inventing pressure.
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
          priority: { type: "STRING", enum: ["high", "medium", "low"] },
        },
        required: ["action", "detail", "priority"],
        propertyOrdering: ["action", "detail", "priority"],
      },
    },
  },
  required: ["summary", "recommendations"],
  propertyOrdering: ["summary", "recommendations"],
};

function bandSummary(o: BandOutcome) {
  return { applied: o.applied, placesAvailableToBand: o.places, balloted: o.balloted };
}

function buildBrief(
  school: School,
  band: Band,
  distanceKm: number,
  phase: Phase,
) {
  const { year, outcome } = latestOutcome(school, phase);
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
    focusPhase: {
      phase: PHASE_LABEL[phase],
      eligibility: PHASE_META[phase].who,
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
    },
  };
}

/**
 * Generate prioritised admission recommendations for a school + parent, scoped
 * to one registration phase. Returns null when Gemini is unconfigured,
 * unreachable or returns nothing usable.
 */
export async function getRecommendations(
  school: School,
  band: Band,
  distanceKm: number,
  phase: Phase,
): Promise<RecommendResult | null> {
  const brief = buildBrief(school, band, distanceKm, phase);

  const result = await geminiJson<RecommendResult>({
    system: SYSTEM,
    prompt: `School and parent data:\n\`\`\`json\n${JSON.stringify(
      brief,
      null,
      2,
    )}\n\`\`\`\n\nThe parent is focused on ${PHASE_LABEL[phase]}. Return a one-sentence \`summary\` and 2-4 \`recommendations\` for ${PHASE_LABEL[phase]} only, ordered from highest to lowest priority.`,
    schema: SCHEMA,
  });

  if (!result || !Array.isArray(result.recommendations)) return null;
  const recommendations = result.recommendations
    .filter((r) => r && r.action && r.detail)
    .slice(0, 4);
  if (recommendations.length === 0) return null;

  return { summary: result.summary ?? "", recommendations };
}
