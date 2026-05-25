/**
 * match-school-truth.ts — pair every entry in SCHOOL_DEFS with its real
 * address + postal + lat/lng by matching against SLA's authoritative
 * `buildings.json` (the same dataset our offline postal index consumes).
 *
 * Run with:
 *   bun scripts/match-school-truth.ts
 *
 * Writes:
 *   data/schools-truth.json  — keyed by school id, plus an _unmatched
 *                              list for manual override review.
 *   scripts/.cache/buildings.json — local cache (re-used on subsequent runs).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { haversineKm } from "../lib/geo";
import { makeId, SCHOOL_DEFS } from "./build-schools";

const SOURCE =
  "https://raw.githubusercontent.com/xkjyeah/singapore-postal-codes/master/buildings.json";

const cacheDir = join(import.meta.dirname, ".cache");
const cachePath = join(cacheDir, "buildings.json");
const outPath = join(import.meta.dirname, "..", "data", "schools-truth.json");

type RawBuilding = {
  BUILDING?: string;
  BLK_NO?: string;
  ROAD_NAME?: string;
  POSTAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};

async function loadBuildings(): Promise<RawBuilding[]> {
  if (existsSync(cachePath)) {
    console.log("Using cached buildings dataset.");
    return JSON.parse(readFileSync(cachePath, "utf8")) as RawBuilding[];
  }
  console.log("Fetching SLA buildings dataset (~55 MB)…");
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Failed to fetch buildings.json (HTTP ${res.status}).`);
  const text = await res.text();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, text);
  return JSON.parse(text) as RawBuilding[];
}

function titleCase(value: string): string {
  // Capitalise after spaces, slashes, parens or hyphens — not after
  // apostrophes, so "king's road" → "King's Road" (not "King'S Road").
  return value
    .toLowerCase()
    .replace(/(^|[\s/(-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

/** Normalise a school name for matching: uppercase, St→Saint, strip punct. */
function norm(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bST\.?\b/g, "SAINT")
    .replace(/[‘’]/g, "'")
    .replace(/[.,'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Annexes / prior occupants — never matchable. */
const ANNEX = /^(AFTER\s?SCHOOL|NASCANS|LEARNING LEAP|AMP-MERCU|COMMIT LEARNING|NUTURE|LIFE STUDENT|LEARNING STUDIO|YMCA|PCF\b)|@|FORMER\b/i;
/** Time-bound or under-construction labels — only used if no clean match exists. */
const TIMEBOUND = /\(U\/C\)|\(JAN \d{4}|\(TEMP\)/i;

/** Loosely: looks like a school, an institution, or a CHIJ row. */
function looksLikeSchool(raw: string): boolean {
  return (
    /SCHOOL\b|PRIMARY\b|INSTITUTION\b|JUNIOR\b/i.test(raw) ||
    /^CHIJ\b/i.test(raw)
  );
}

const buildings = await loadBuildings();
console.log(`Loaded ${buildings.length} buildings.`);

// Index school-shaped rows by normalised BUILDING name. We keep both clean
// rows and time-bound (U/C / JAN…) rows; the matcher prefers clean and only
// falls back to time-bound when nothing else hits.
const byName = new Map<string, RawBuilding[]>();
let schoolish = 0;
for (const b of buildings) {
  const raw = (b.BUILDING ?? "").trim();
  if (!raw) continue;
  if (ANNEX.test(raw)) continue;
  if (!looksLikeSchool(raw)) continue;
  schoolish++;
  // Strip the (U/C) / (JAN xxxx - DEC xxxx) suffix for the lookup key — the
  // real school name normalises the same way with or without the suffix.
  const cleaned = raw.replace(/\s*\((U\/C|JAN[^)]+|TEMP)\)\s*$/i, "").trim();
  const key = norm(cleaned);
  const list = byName.get(key) ?? [];
  list.push(b);
  byName.set(key, list);
}
console.log(`Indexed ${schoolish} school-shaped rows under ${byName.size} unique names.`);

const truth: Record<
  string,
  { postal: string; address: string; lat: number; lng: number; matchedName: string }
> = {};
const unmatched: string[] = [];
const usedIds = new Set<string>();

for (const def of SCHOOL_DEFS) {
  const [name, , , curatedLat, curatedLng, tuplePostal] = def;
  const id = makeId(name, usedIds);

  // If the SCHOOL_DEFS tuple already has a manual postal override we don't
  // need this matcher to do anything — the build will use the tuple value.
  if (tuplePostal) continue;

  const key = norm(name);
  const rows = byName.get(key) ?? [];
  if (rows.length === 0) {
    // Soft-match: try a key that strips "PRIMARY" from either end.
    const stripped = key.replace(/\bPRIMARY\b/g, "").replace(/\s+/g, " ").trim();
    const alt = [...byName.entries()].find(([k]) => k === stripped || k === `${stripped} SCHOOL`);
    if (alt) rows.push(...alt[1]);
  }
  if (rows.length === 0) {
    unmatched.push(name);
    continue;
  }

  // Tiebreak: prefer clean rows over (U/C) / (JAN…) time-bound rows; within
  // each tier, closest to the curated coord wins.
  const clean = rows.filter((r) => !TIMEBOUND.test(r.BUILDING ?? ""));
  const pool = clean.length > 0 ? clean : rows;
  let best = pool[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const r of pool) {
    const lat = Number(r.LATITUDE);
    const lng = Number(r.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const km = haversineKm(curatedLat, curatedLng, lat, lng);
    if (km < bestKm) {
      bestKm = km;
      best = r;
    }
  }

  const postal = best.POSTAL ?? "";
  const lat = Number(best.LATITUDE);
  const lng = Number(best.LONGITUDE);
  if (!/^\d{6}$/.test(postal) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    unmatched.push(name);
    continue;
  }

  const blk = best.BLK_NO && best.BLK_NO !== "NIL" ? `${best.BLK_NO} ` : "";
  const road = best.ROAD_NAME && best.ROAD_NAME !== "NIL" ? best.ROAD_NAME : "";
  const street = titleCase((blk + road).trim());
  const address = street ? `${street}, Singapore ${postal}` : `Singapore ${postal}`;

  truth[id] = {
    postal,
    address,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    matchedName: best.BUILDING ?? "",
  };
}

console.log(
  `\nMatched ${Object.keys(truth).length}/${SCHOOL_DEFS.length} schools. Unmatched: ${unmatched.length}.`,
);
if (unmatched.length > 0) {
  console.log("Unmatched (add a (postal, address) override to SCHOOL_DEFS for each):");
  for (const u of unmatched) console.log(`  - ${u}`);
}

// Emit JSON with _unmatched so the misses are traceable in the committed file.
const payload: Record<string, unknown> = { ...truth, _unmatched: unmatched };
writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
console.log(`\nWrote ${outPath}`);
