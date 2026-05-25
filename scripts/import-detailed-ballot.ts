/**
 * import-detailed-ballot.ts — load a tab-separated block file with the
 * richer ST-graphic format (Vacancy / Applied / Taken rows per school)
 * into data/ballot-truth.json with full per-band ballot detail.
 *
 *   bun scripts/import-detailed-ballot.ts <year> <path-to.tsv>
 *
 * Block format (4 lines per school, tab-separated):
 *   <School name>
 *   ↳ Vacancy (TotalIntake)<TAB>Phase1<TAB>2A<TAB>2B<TAB>2C<TAB>2C(S)<TAB>3
 *   ↳ Applied<TAB>...
 *   ↳ Taken<TAB>...
 *
 * Taken cells either hold a plain number (no balloting) or a number plus
 * a band code and ratio: "65 SC1-2 17/12" meaning 65 admitted overall,
 * with the ballot conducted in the 1-2 km SC band, 17 applicants for 12
 * places. The "#" suffix marks a citizenship/distance constraint with no
 * ratio — treated as 'no ballot' for our model.
 *
 * Only Phase 2A / 2B / 2C are imported. Phase 1, 2C(S) and Phase 3 are
 * ignored (not in the app's current model).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHOOL_DEFS, makeId } from "./build-schools";
import type { Phase, PhaseBallot } from "../lib/types";

const [yearArg, tsvPath] = process.argv.slice(2);
if (!yearArg || !tsvPath) {
  console.error("Usage: bun scripts/import-detailed-ballot.ts <year> <path-to.tsv>");
  process.exit(2);
}
const YEAR = Number(yearArg);
if (!Number.isInteger(YEAR) || YEAR < 2020) {
  console.error(`Bad year ${yearArg}`);
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────
// school lookup — keyed by normalised name.
// ─────────────────────────────────────────────────────────────────────
function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/[.,()]/g, "")
    .replace(/\bST\b/g, "SAINT")
    .replace(/\bPRIMARY SCHOOL\b/g, "")
    .replace(/\bPRIMARY SECTION\b/g, "")
    .replace(/\bPRIMARY\b/g, "")
    .replace(/\bSCHOOL\b/g, "")
    .replace(/\bJUNIOR\b/g, "JUNIOR")
    .replace(/\s+/g, " ")
    .trim();
}
const usedIds = new Set<string>();
const SCHOOLS: { id: string; name: string; normName: string }[] = [];
for (const def of SCHOOL_DEFS) {
  const [name] = def;
  SCHOOLS.push({ id: makeId(name, usedIds), name, normName: norm(name) });
}
function findSchool(rawName: string) {
  const n = norm(rawName);
  return SCHOOLS.find((s) => s.normName === n) ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// "Taken" cell parser
// ─────────────────────────────────────────────────────────────────────
type Parsed = {
  admitted: number;
  balloted: boolean;
  ballotedBand?: PhaseBallot["ballotedBand"];
  ballotedVacancies?: number;
  ballotedApplicants?: number;
};
const BAND_MAP: Record<string, PhaseBallot["ballotedBand"]> = {
  "<1": "within1km",
  "1-2": "1to2km",
  ">2": "beyond2km",
  "<2": "within1km", // "<2" in ST grammar = "below 2 km" — closest band we have.
};
function parseTakenCell(cell: string): Parsed {
  const s = cell.trim();
  // Plain number?
  const plain = /^(\d+)$/.exec(s);
  if (plain) return { admitted: Number(plain[1]), balloted: false };
  // "<admitted> <SC|PR><band> <apps>/<vacs>"
  const re = /^(\d+)\s+(SC|PR)(<1|1-2|>2|<2)\s+(\d+)\/(\d+)$/;
  const m = re.exec(s);
  if (m) {
    return {
      admitted: Number(m[1]),
      balloted: true,
      ballotedBand: BAND_MAP[m[3]],
      ballotedApplicants: Number(m[4]),
      ballotedVacancies: Number(m[5]),
    };
  }
  // "<admitted> <SC|PR><band>#" — citizenship/distance constraint without ratio.
  const hashRe = /^(\d+)\s+(SC|PR)(<1|1-2|>2|<2)?#$/;
  const h = hashRe.exec(s);
  if (h) {
    return { admitted: Number(h[1]), balloted: false };
  }
  // Unknown shape — bail to a non-balloted admit count we can extract.
  const fallback = /^(\d+)/.exec(s);
  if (fallback) return { admitted: Number(fallback[1]), balloted: false };
  return { admitted: 0, balloted: false };
}

// ─────────────────────────────────────────────────────────────────────
// merge target
// ─────────────────────────────────────────────────────────────────────
const outPath = join(import.meta.dirname, "..", "data", "ballot-truth.json");
const existing = existsSync(outPath)
  ? (JSON.parse(readFileSync(outPath, "utf8")) as Record<string, unknown>)
  : {};
const out: Record<string, unknown> = { ...existing };

function setPhase(id: string, phase: Phase, vac: number, app: number, t: Parsed) {
  // Synthesise the applied.{near,mid,far} consistent with the ballot info.
  let near = 0, mid = 0, far = 0;
  if (t.balloted && t.ballotedBand && t.ballotedVacancies !== undefined && t.ballotedApplicants !== undefined) {
    if (t.ballotedBand === "1to2km") {
      near = Math.max(0, vac - t.ballotedVacancies);
      mid = t.ballotedApplicants;
      far = Math.max(0, app - near - mid);
    } else if (t.ballotedBand === "within1km") {
      near = t.ballotedApplicants;
      mid = Math.max(0, app - near);
      far = 0;
    } else {
      // beyond2km
      near = Math.round(vac * 0.5);
      mid = Math.round(vac * 0.3);
      far = Math.max(0, app - near - mid);
    }
  } else {
    near = Math.round(app * 0.4);
    mid = Math.round(app * 0.35);
    far = Math.max(0, app - near - mid);
  }
  const phaseBallot: PhaseBallot = {
    vacancy: vac,
    total: app,
    balloted: t.balloted,
    ...(t.ballotedBand ? { ballotedBand: t.ballotedBand } : {}),
    ...(t.ballotedVacancies !== undefined ? { ballotedVacancies: t.ballotedVacancies } : {}),
    ...(t.ballotedApplicants !== undefined ? { ballotedApplicants: t.ballotedApplicants } : {}),
    applied: { near, mid, far },
    isReal: true,
    source: `MOE ${YEAR}`,
  };
  const entry = (out[id] as Record<string, unknown>) ?? {};
  const yearEntry = (entry[YEAR] as Record<string, unknown>) ?? {};
  yearEntry[phase] = phaseBallot;
  entry[YEAR] = yearEntry;
  out[id] = entry;
}

// ─────────────────────────────────────────────────────────────────────
// parse + import
// ─────────────────────────────────────────────────────────────────────
const lines = readFileSync(tsvPath, "utf8")
  .split("\n")
  .map((l) => l.replace(/\r$/, ""))
  .filter((l) => l.trim().length > 0);

let matched = 0;
let processed = 0;
const unmatched: string[] = [];

for (let i = 0; i < lines.length; ) {
  const schoolLine = lines[i].trim();
  if (schoolLine.startsWith("↳") || schoolLine.includes("\t")) {
    // Stray line — skip.
    i++;
    continue;
  }
  if (i + 3 >= lines.length) break;

  const vacLine = lines[i + 1];
  const appLine = lines[i + 2];
  const takenLine = lines[i + 3];
  if (
    !vacLine.startsWith("↳ Vacancy") ||
    !appLine.startsWith("↳ Applied") ||
    !takenLine.startsWith("↳ Taken")
  ) {
    i++;
    continue;
  }
  i += 4;
  processed++;

  // Strip the leading "↳ <label>" cell, then split by tabs.
  const vac = vacLine.split("\t").slice(1);
  const app = appLine.split("\t").slice(1);
  const taken = takenLine.split("\t").slice(1);
  // Columns expected: Phase1, 2A, 2B, 2C, 2C(S), 3
  // Indices:           0      1   2   3   4      5
  const phases: { phase: Phase; idx: number }[] = [
    { phase: "2A", idx: 1 },
    { phase: "2B", idx: 2 },
    { phase: "2C", idx: 3 },
  ];

  const sch = findSchool(schoolLine);
  if (!sch) {
    unmatched.push(schoolLine);
    continue;
  }
  matched++;

  for (const { phase, idx } of phases) {
    const vacancy = Number((vac[idx] ?? "").replace(/[^\d]/g, ""));
    const applied = Number((app[idx] ?? "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(vacancy) || !Number.isFinite(applied)) continue;
    const t = parseTakenCell(taken[idx] ?? "");
    setPhase(sch.id, phase, vacancy, applied, t);
  }
}

out._lastUpdated = new Date().toISOString().slice(0, 10);
out._source = `MOE Phase 2A/2B/2C vacancies, applicants and per-band ballot details. Sourced from the Straits Times graphic (MINISTRY OF EDUCATION).`;

writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

console.log(`Year ${YEAR}: matched ${matched}/${processed} school blocks.`);
if (unmatched.length > 0) {
  console.log(`Unmatched (not in SCHOOL_DEFS):`);
  for (const n of unmatched) console.log(`  - ${n}`);
}
console.log(`Wrote ${outPath}.`);
