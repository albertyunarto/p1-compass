/**
 * scrape-ballot.ts — populate data/ballot-truth.json with real MOE P1
 * vacancies + balloting figures by scraping a public aggregator.
 *
 * MUST RUN LOCALLY — the deployment sandbox can't reach the sources.
 *
 * Usage:
 *   bun scripts/scrape-ballot.ts --source p1reg --url <annual-url>
 *   bun scripts/scrape-ballot.ts --source elite --year 2025
 *   bun scripts/scrape-ballot.ts --source elite --school anderson-primary-school
 *   bun scripts/scrape-ballot.ts --source p1reg --file ./local.html
 *
 *   --dry          parse + print, don't write the file
 *   --verbose      dump first 2 kB of fetched HTML on parse failures
 *
 * Sources:
 *   p1reg   — p1registration.sg annual analysis posts (one URL covers
 *             ALL schools for a given year/phase). Best for bulk pulls.
 *             Pass the article URL via --url. Example:
 *             https://www.p1registration.sg/2025/07/10/p1-registration-phase-2c-results-2025-balloting-analysis/
 *   elite   — elite.com.sg/ballot/<slug>/ per-school pages. Slower but
 *             gives every phase + year in one go per school.
 *
 * If either source redesigns, the parsers below will need a tweak —
 * they print diagnostics to make that obvious.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHOOL_DEFS, makeId } from "./build-schools";
import type { Phase, PhaseBallot } from "../lib/types";

// ─────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────
type Args = {
  source: "elite" | "p1reg";
  url?: string;
  file?: string;
  year?: number;
  school?: string;
  dryRun: boolean;
  verbose: boolean;
};
function parseArgs(): Args {
  const a: Args = { source: "p1reg", dryRun: false, verbose: false };
  for (let i = 2; i < process.argv.length; i++) {
    const v = process.argv[i];
    if (v === "--source") a.source = process.argv[++i] as Args["source"];
    else if (v === "--url") a.url = process.argv[++i];
    else if (v === "--file") a.file = process.argv[++i];
    else if (v === "--year") a.year = Number(process.argv[++i]);
    else if (v === "--school") a.school = process.argv[++i];
    else if (v === "--dry") a.dryRun = true;
    else if (v === "--verbose") a.verbose = true;
  }
  return a;
}
const args = parseArgs();

// ─────────────────────────────────────────────────────────────────────
// schools list (consumes the canonical SCHOOL_DEFS so this can't drift)
// ─────────────────────────────────────────────────────────────────────
const usedIds = new Set<string>();
const SCHOOLS: { id: string; name: string }[] = [];
for (const def of SCHOOL_DEFS) {
  const [name] = def;
  SCHOOLS.push({ id: makeId(name, usedIds), name });
}

/** Look up a school by a free-text school name (case + punct insensitive). */
function findSchool(rawName: string): { id: string; name: string } | null {
  const n = norm(rawName);
  // Try exact normalised match first, then suffix match (some sources omit "School").
  let s = SCHOOLS.find((x) => norm(x.name) === n);
  if (!s) s = SCHOOLS.find((x) => norm(x.name).startsWith(n) || n.startsWith(norm(x.name)));
  return s ?? null;
}
function norm(s: string): string {
  return s
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/[.,()]/g, "")
    .replace(/\bST\b/g, "SAINT")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (c) => stripTags(c[1]),
    );
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** Compose a PhaseBallot from raw figures the way build-schools does. */
function makeBallot(
  vacancy: number,
  total: number,
  balloted: boolean,
  ballotedBand: PhaseBallot["ballotedBand"] | undefined,
  ballotedVac?: number,
  ballotedApps?: number,
  year?: number,
): PhaseBallot {
  let near = 0, mid = 0, far = 0;
  if (balloted && ballotedVac && ballotedApps && ballotedBand) {
    if (ballotedBand === "1to2km") {
      near = Math.max(0, vacancy - ballotedVac);
      mid = ballotedApps;
      far = Math.max(0, total - near - mid);
    } else if (ballotedBand === "within1km") {
      near = ballotedApps;
      mid = Math.max(0, total - near);
      far = 0;
    } else {
      near = Math.round(vacancy * 0.5);
      mid = Math.round(vacancy * 0.3);
      far = Math.max(0, total - near - mid);
    }
  } else {
    near = Math.round(total * 0.4);
    mid = Math.round(total * 0.35);
    far = Math.max(0, total - near - mid);
  }
  return {
    vacancy,
    total,
    balloted,
    ...(ballotedBand ? { ballotedBand } : {}),
    ...(ballotedVac !== undefined ? { ballotedVacancies: ballotedVac } : {}),
    ...(ballotedApps !== undefined ? { ballotedApplicants: ballotedApps } : {}),
    applied: { near, mid, far },
    source: year ? `MOE ${year}` : "MOE",
  };
}

// ─────────────────────────────────────────────────────────────────────
// p1registration.sg parser — one URL → many schools, one year, one phase.
// ─────────────────────────────────────────────────────────────────────
type ParsedRow = {
  schoolId: string;
  schoolName: string;
  year: number;
  phase: Phase;
  ballot: PhaseBallot;
};

function parseP1RegPage(html: string, year: number, phase: Phase): ParsedRow[] {
  const out: ParsedRow[] = [];
  const rows = tableRows(html);
  if (args.verbose) console.log(`  → found ${rows.length} table rows in fetched page.`);

  // Heuristic header detection — pick the first row that mentions
  // "School", "Vacanc" and "Applicant" together. The rest of the cells
  // tell us which column is which.
  let header: string[] | null = null;
  let dataStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join(" | ").toLowerCase();
    if (joined.includes("school") && joined.includes("vacan") && joined.includes("applic")) {
      header = rows[i].map((c) => c.toLowerCase());
      dataStart = i + 1;
      break;
    }
  }
  if (!header) {
    if (args.verbose) {
      console.log("  ✗ no recognisable header row. First 5 rows:");
      for (const r of rows.slice(0, 5)) console.log("   ", r);
    }
    return out;
  }

  const col = {
    school: header.findIndex((c) => c.includes("school")),
    vacancy: header.findIndex((c) => c.includes("vacan") && !c.includes("ballot")),
    applicants: header.findIndex((c) => c.includes("applic") && !c.includes("ballot")),
    balloted: header.findIndex((c) => c.includes("ballot") && !c.match(/vacan|applic|band/)),
    ballotedVac: header.findIndex((c) => c.includes("ballot") && c.includes("vacan")),
    ballotedApps: header.findIndex((c) => c.includes("ballot") && c.includes("applic")),
    band: header.findIndex((c) => c.includes("band") || c.includes("distance")),
  };

  for (const r of rows.slice(dataStart)) {
    const name = r[col.school];
    if (!name) continue;
    const sch = findSchool(name);
    if (!sch) continue;
    const vac = Number((r[col.vacancy] ?? "").replace(/[^\d]/g, ""));
    const apps = Number((r[col.applicants] ?? "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(vac) || !Number.isFinite(apps)) continue;
    const balloted =
      col.balloted >= 0
        ? /yes/i.test(r[col.balloted] ?? "")
        : apps > vac;
    const bandTxt = (r[col.band] ?? "").toLowerCase();
    let band: PhaseBallot["ballotedBand"];
    if (bandTxt.includes("1km") && bandTxt.includes("2km")) band = "1to2km";
    else if (bandTxt.match(/<\s*1\s*km|within\s*1/)) band = "within1km";
    else if (bandTxt.match(/>?\s*2\s*km|beyond/)) band = "beyond2km";
    const ballotedVac = col.ballotedVac >= 0 ? Number((r[col.ballotedVac] ?? "").replace(/[^\d]/g, "")) : undefined;
    const ballotedApps = col.ballotedApps >= 0 ? Number((r[col.ballotedApps] ?? "").replace(/[^\d]/g, "")) : undefined;

    out.push({
      schoolId: sch.id,
      schoolName: sch.name,
      year,
      phase,
      ballot: makeBallot(vac, apps, balloted, band, ballotedVac, ballotedApps, year),
    });
  }
  return out;
}

// elite.com.sg per-school parser ─────────────────────────────────────
function eliteSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function parseElitePage(
  html: string,
  years: number[],
): Record<number, Partial<Record<Phase, PhaseBallot>>> {
  const out: Record<number, Partial<Record<Phase, PhaseBallot>>> = {};
  for (const r of tableRows(html)) {
    if (r.length < 4) continue;
    const year = Number(r[0]);
    if (!years.includes(year)) continue;
    const phaseRaw = r[1].toUpperCase().replace(/PHASE\s*/i, "").trim();
    if (!/^2[ABC]$/.test(phaseRaw)) continue;
    const phase = phaseRaw as Phase;
    const vac = Number((r[2] ?? "").replace(/[^\d]/g, ""));
    const apps = Number((r[3] ?? "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(vac) || !Number.isFinite(apps)) continue;
    const balloted = /yes|ballot/i.test(r[4] ?? "") || apps > vac;
    const bv = Number((r[5] ?? "").replace(/[^\d]/g, ""));
    const ba = Number((r[6] ?? "").replace(/[^\d]/g, ""));
    const bandTxt = (r[7] ?? "").toLowerCase();
    let band: PhaseBallot["ballotedBand"];
    if (bandTxt.includes("1km") && bandTxt.includes("2km")) band = "1to2km";
    else if (bandTxt.match(/<\s*1\s*km|within/)) band = "within1km";
    else if (bandTxt.match(/>?\s*2\s*km|beyond/)) band = "beyond2km";
    out[year] = out[year] ?? {};
    out[year][phase] = makeBallot(
      vac, apps, balloted, band,
      Number.isFinite(bv) ? bv : undefined,
      Number.isFinite(ba) ? ba : undefined,
      year,
    );
  }
  return out;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (P1Compass accuracy refresh)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`  HTTP ${res.status} from ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.error(`  fetch error: ${(e as Error).message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────
const truthPath = join(import.meta.dirname, "..", "data", "ballot-truth.json");
const existing = existsSync(truthPath)
  ? (JSON.parse(readFileSync(truthPath, "utf8")) as Record<string, unknown>)
  : {};
const out: Record<string, unknown> = { ...existing };

function mergeRow(row: ParsedRow) {
  const entry = (out[row.schoolId] as Record<string, unknown>) ?? {};
  const yearEntry = (entry[row.year] as Record<string, unknown>) ?? {};
  yearEntry[row.phase] = row.ballot;
  entry[row.year] = yearEntry;
  out[row.schoolId] = entry;
}

if (args.source === "p1reg") {
  if (!args.url && !args.file) {
    console.error("p1reg source requires --url <article-url> or --file <local.html>");
    process.exit(2);
  }
  // Guess the year + phase from the URL (we let --year override).
  let year = args.year ?? new Date().getFullYear();
  let phase: Phase = "2C";
  if (args.url) {
    const ym = args.url.match(/\/(\d{4})\//);
    if (ym) year = Number(ym[1]);
    if (/phase-?\s*2a/i.test(args.url)) phase = "2A";
    else if (/phase-?\s*2b/i.test(args.url)) phase = "2B";
  }
  console.log(`Source: p1registration.sg  year=${year}  phase=${phase}`);
  const html = args.file
    ? readFileSync(args.file, "utf8")
    : await fetchPage(args.url!);
  if (!html) process.exit(1);
  const rows = parseP1RegPage(html, year, phase);
  console.log(`Parsed ${rows.length} school rows.`);
  for (const r of rows) mergeRow(r);
} else if (args.source === "elite") {
  const YEARS = args.year ? [args.year] : [2024, 2025];
  const targets = args.school
    ? SCHOOLS.filter((s) => s.id === args.school)
    : SCHOOLS;
  console.log(`Source: elite.com.sg  years=${YEARS.join(",")}  schools=${targets.length}`);
  let matched = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const url = `https://elite.com.sg/ballot/${eliteSlug(t.name)}/`;
    process.stdout.write(`[${i + 1}/${targets.length}] ${t.name.padEnd(40)} → `);
    const html = await fetchPage(url);
    if (!html) { console.log("MISS"); continue; }
    const parsed = parseElitePage(html, YEARS);
    const phases = Object.values(parsed).reduce((n, p) => n + Object.keys(p).length, 0);
    if (phases === 0) { console.log("no rows"); continue; }
    matched++;
    for (const [yr, phasesObj] of Object.entries(parsed)) {
      for (const [ph, b] of Object.entries(phasesObj) as [Phase, PhaseBallot][]) {
        mergeRow({ schoolId: t.id, schoolName: t.name, year: Number(yr), phase: ph, ballot: b });
      }
    }
    console.log(`OK (${phases} phase${phases === 1 ? "" : "s"})`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`\nMatched ${matched}/${targets.length}.`);
} else {
  console.error(`Unknown --source ${args.source}. Use p1reg or elite.`);
  process.exit(2);
}

out._lastUpdated = new Date().toISOString().slice(0, 10);
out._source =
  args.source === "p1reg"
    ? "MOE figures via p1registration.sg analysis posts."
    : "MOE figures via elite.com.sg/ballot.";

if (args.dryRun) {
  const schoolCount = Object.keys(out).filter((k) => !k.startsWith("_")).length;
  console.log(`\nDRY RUN — would write ${schoolCount} school entries.`);
} else {
  writeFileSync(truthPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${truthPath}.`);
}
