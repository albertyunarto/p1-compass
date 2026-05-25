/**
 * import-st-ballot.ts — load a tab-separated table from the Straits Times
 * P1 vacancies graphic (sourced from MOE) into data/ballot-truth.json.
 *
 *   bun scripts/import-st-ballot.ts <year> <path-to.tsv>
 *
 * Row format (8 cols, tab-separated, no header):
 *   School name  2A_vac  2A_app  2B_vac  2B_app  2C_vac  2C_app  Balloting(Yes/No)
 *
 * School names may carry trailing asterisks (*, **, ***, ****) marking the
 * SC/PR conditions in the ST footnote — these are stripped before matching.
 *
 * Per-band breakdown (applied.near/mid/far) is not in the ST table, so we
 * synthesise a proportional split. The fields parents care about — vacancies,
 * applicants, balloted — are populated from the real data and marked
 * isReal: true.
 *
 * Existing per-phase entries that already carry richer detail (e.g. the
 * Anderson 2C ballotedBand/ballotedVacancies/ballotedApplicants pulled
 * from kiasuparents) are preserved if their (vacancy, total) match.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHOOL_DEFS, makeId } from "./build-schools";
import type { Phase, PhaseBallot } from "../lib/types";

const [yearArg, tsvPath] = process.argv.slice(2);
if (!yearArg || !tsvPath) {
  console.error("Usage: bun scripts/import-st-ballot.ts <year> <path-to.tsv>");
  process.exit(2);
}
const YEAR = Number(yearArg);
if (!Number.isInteger(YEAR) || YEAR < 2020) {
  console.error(`Bad year ${yearArg}`);
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────
// school id lookup
// ─────────────────────────────────────────────────────────────────────
const usedIds = new Set<string>();
const SCHOOLS: { id: string; name: string; normName: string }[] = [];
for (const def of SCHOOL_DEFS) {
  const [name] = def;
  SCHOOLS.push({ id: makeId(name, usedIds), name, normName: norm(name) });
}

function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/[.,()]/g, "")
    .replace(/\bST\b/g, "SAINT")
    .replace(/\bPRIMARY SECTION\b/g, "PRIMARY")
    .replace(/\s+/g, " ")
    .trim();
}

function stripStMarks(name: string): string {
  return name.replace(/\*+\s*$/, "").trim();
}

function findSchool(rawName: string) {
  const cleaned = stripStMarks(rawName);
  const n = norm(cleaned);
  return SCHOOLS.find((s) => s.normName === n) ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// merge into existing ballot-truth.json
// ─────────────────────────────────────────────────────────────────────
const outPath = join(import.meta.dirname, "..", "data", "ballot-truth.json");
const existing = existsSync(outPath)
  ? (JSON.parse(readFileSync(outPath, "utf8")) as Record<string, unknown>)
  : {};
const out: Record<string, unknown> = { ...existing };

function buildPhase(vac: number, total: number, phase: Phase): PhaseBallot {
  // Per-phase balloted = oversubscribed. We don't have the band split or
  // ballotedVacancies/Applicants from this source; downstream merge keeps
  // any pre-existing detailed entry that already matches (vacancy, total).
  const balloted = total > vac;
  // Proportional applied-band split — illustrative, not from MOE.
  // The verdict engine uses these to estimate per-band pressure; the
  // user-facing banner reflects that totals are MOE-verified.
  let near = 0, mid = 0, far = 0;
  if (balloted && phase === "2C") {
    // common pattern: within-1km filled, balloting in 1-2km.
    near = Math.min(vac, Math.round(total * 0.55));
    mid = Math.min(total - near, Math.max(0, vac - near + Math.round((total - vac) * 0.7)));
    far = Math.max(0, total - near - mid);
  } else {
    near = Math.round(total * 0.4);
    mid = Math.round(total * 0.35);
    far = Math.max(0, total - near - mid);
  }
  return {
    vacancy: vac,
    total,
    balloted,
    applied: { near, mid, far },
    isReal: true,
    source: `MOE ${YEAR} (ST graphic)`,
  };
}

function mergePhase(
  id: string,
  year: number,
  phase: Phase,
  fresh: PhaseBallot,
) {
  const entry = (out[id] as Record<string, unknown>) ?? {};
  const yearEntry = (entry[year] as Record<string, unknown>) ?? {};
  const prev = yearEntry[phase] as PhaseBallot | undefined;

  // Preserve detail-rich entries (with ballotedBand) when (vacancy, total)
  // agree — they came from a higher-fidelity source (e.g. kiasuparents).
  if (
    prev &&
    prev.ballotedBand &&
    prev.vacancy === fresh.vacancy &&
    (prev.total ?? -1) === fresh.total
  ) {
    yearEntry[phase] = { ...prev, isReal: true, source: prev.source ?? fresh.source };
  } else {
    yearEntry[phase] = fresh;
  }
  entry[year] = yearEntry;
  out[id] = entry;
}

// ─────────────────────────────────────────────────────────────────────
// parse and import
// ─────────────────────────────────────────────────────────────────────
const lines = readFileSync(tsvPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

let matched = 0;
const unmatched: string[] = [];

for (const line of lines) {
  const cells = line.split("\t").map((c) => c.trim());
  if (cells.length < 8) {
    console.warn(`skip malformed row: ${line.slice(0, 60)}…`);
    continue;
  }
  const [name, vacA, appA, vacB, appB, vacC, appC] = cells;
  const sch = findSchool(name);
  if (!sch) {
    unmatched.push(stripStMarks(name));
    continue;
  }
  mergePhase(sch.id, YEAR, "2A", buildPhase(+vacA, +appA, "2A"));
  mergePhase(sch.id, YEAR, "2B", buildPhase(+vacB, +appB, "2B"));
  mergePhase(sch.id, YEAR, "2C", buildPhase(+vacC, +appC, "2C"));
  matched++;
}

out._lastUpdated = new Date().toISOString().slice(0, 10);
out._source = `MOE ${YEAR} via Straits Times graphic (https://www.straitstimes.com — MINISTRY OF EDUCATION source).`;

writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

console.log(`Matched ${matched}/${lines.length} ST rows.`);
if (unmatched.length > 0) {
  console.log(`\nUnmatched rows (no SCHOOL_DEFS entry for these — likely new schools):`);
  for (const u of unmatched) console.log(`  - ${u}`);
}

// Coverage summary against SCHOOL_DEFS
const truthSchools = new Set(
  Object.keys(out).filter((k) => !k.startsWith("_")),
);
const allIds = new Set(SCHOOLS.map((s) => s.id));
const missing = [...allIds].filter((id) => !truthSchools.has(id));
console.log(
  `\nDataset coverage: ${truthSchools.size}/${allIds.size} schools have ${YEAR} ballot data.`,
);
if (missing.length > 0 && missing.length <= 20) {
  console.log(`Schools in SCHOOL_DEFS without ${YEAR} data:`);
  for (const id of missing) {
    const s = SCHOOLS.find((x) => x.id === id);
    console.log(`  - ${s?.name ?? id}`);
  }
}

console.log(`\nWrote ${outPath}.`);
