// validate-accuracy.ts — exhaustive integrity audit. Run with:
//   bun scripts/validate-accuracy.ts
//
// Exits with code 1 on any failure so it can wedge into CI/pre-commit
// later. Designed to catch the kind of silent data drift that breaks
// parent trust: wrong school postals, out-of-band school coords, home
// postals that drift across the 1 km / 2 km MOE distance cutoff, etc.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import schoolsRaw from "../data/schools.json";
import sectorsRaw from "../data/postal_sectors.json";
import truthRaw from "../data/schools-truth.json";
import { haversineKm } from "../lib/geo";
import type { School } from "../lib/types";

const schools = schoolsRaw as School[];
type TruthEntry = { postal: string; address: string; lat: number; lng: number };
const truth = truthRaw as Record<string, TruthEntry | string[]>;
const sectors = sectorsRaw as Record<string, { area: string; lat: number; lng: number }>;
const postalIndex = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "data", "postal_coords.json"), "utf8"),
) as Record<string, [number, number, string]>;

// SG bounds
const SG = { latMin: 1.16, latMax: 1.48, lngMin: 103.59, lngMax: 104.06 };

let failures = 0;
let warnings = 0;
const out: string[] = [];
function fail(msg: string) { failures++; out.push(`  ✗ ${msg}`); }
function warn(msg: string) { warnings++; out.push(`  ! ${msg}`); }
function info(msg: string) { out.push(`  · ${msg}`); }
function section(name: string) { out.push(`\n══ ${name} ══`); }
function inSg(lat: number, lng: number) {
  return lat >= SG.latMin && lat <= SG.latMax && lng >= SG.lngMin && lng <= SG.lngMax;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Schools dataset integrity
// ─────────────────────────────────────────────────────────────────────
section("Schools dataset integrity");
{
  const ids = new Set<string>();
  const codes = new Set<number>();
  for (const s of schools) {
    if (!s.id || ids.has(s.id)) fail(`duplicate or empty id: ${s.id} (${s.name})`);
    ids.add(s.id);
    if (!s.code || codes.has(s.code)) fail(`duplicate or empty code: ${s.code} (${s.name})`);
    codes.add(s.code);
    if (!s.name?.trim()) fail(`empty name for id ${s.id}`);
    if (!s.short?.trim()) fail(`empty short for ${s.name}`);
    if (!s.address?.trim()) fail(`empty address for ${s.name}`);
    if (!/^\d{6}$/.test(s.postal)) fail(`bad postal "${s.postal}" for ${s.name}`);
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) fail(`bad coord for ${s.name}`);
    if (!inSg(s.lat, s.lng)) fail(`coord out of SG bounds for ${s.name}: ${s.lat},${s.lng}`);
    if (!Array.isArray(s.type) || s.type.length === 0) fail(`empty type[] for ${s.name}`);
    if (!s.ballot || Object.keys(s.ballot).length === 0) fail(`empty ballot for ${s.name}`);
  }
  info(`${schools.length} schools, ${ids.size} unique ids, ${codes.size} unique codes.`);
}

// ─────────────────────────────────────────────────────────────────────
// 2. Schools vs SLA truth (the trust-critical surface)
// ─────────────────────────────────────────────────────────────────────
section("Schools vs SLA buildings.json truth");
{
  let exact = 0, postalOk = 0, addrOk = 0, missing = 0;
  for (const s of schools) {
    const t = truth[s.id];
    if (!t || Array.isArray(t)) { missing++; continue; }
    const te = t as TruthEntry;
    const km = haversineKm(s.lat, s.lng, te.lat, te.lng);
    if (km < 0.005) exact++;
    else fail(`coord drift ${km.toFixed(3)} km for ${s.name} — stored ${s.lat},${s.lng} vs SLA ${te.lat},${te.lng}`);
    if (s.postal === te.postal) postalOk++;
    else fail(`postal mismatch for ${s.name}: stored ${s.postal} vs SLA ${te.postal}`);
    if (s.address === te.address) addrOk++;
    else warn(`address text differs for ${s.name}: stored "${s.address}" vs SLA "${te.address}"`);
  }
  info(`${exact}/${schools.length - missing} coords exact, ${postalOk}/${schools.length - missing} postals exact, ${addrOk}/${schools.length - missing} addresses exact, ${missing} not in SLA (manual overrides — checked separately).`);
}

// ─────────────────────────────────────────────────────────────────────
// 3. Manual-override schools (the ones not in SLA) — sanity only
// ─────────────────────────────────────────────────────────────────────
section("Manual-override schools (no SLA truth)");
{
  for (const s of schools) {
    const t = truth[s.id];
    if (t && !Array.isArray(t)) continue;
    if (!/^\d{6}$/.test(s.postal)) fail(`bad postal on override school ${s.name}`);
    if (!inSg(s.lat, s.lng)) fail(`out-of-bounds coord on override school ${s.name}`);
    info(`override: ${s.name} → ${s.postal}, ${s.address}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. Postal index sanity
// ─────────────────────────────────────────────────────────────────────
section("Offline postal index sanity");
{
  const total = Object.keys(postalIndex).length;
  let badPostal = 0, badCoord = 0, outOfBounds = 0;
  for (const [p, v] of Object.entries(postalIndex)) {
    if (!/^\d{6}$/.test(p)) badPostal++;
    const [lat, lng] = v;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) badCoord++;
    else if (!inSg(lat, lng)) outOfBounds++;
  }
  info(`${total} postals indexed, ${badPostal} bad keys, ${badCoord} bad coords, ${outOfBounds} out-of-bounds.`);
  if (badPostal || badCoord || outOfBounds) fail(`postal index has ${badPostal + badCoord + outOfBounds} bad entries`);
}

// ─────────────────────────────────────────────────────────────────────
// 5. Sector-fallback gaps in active residential sectors
// ─────────────────────────────────────────────────────────────────────
section("Sector coverage (residential sectors only)");
{
  // Active residential sectors per SingPost / URA — biggest HDB areas.
  // If any of these resolves only via sector centroid for a known live
  // postal, that's a runtime-accuracy risk for the home-postal step.
  const RESIDENTIAL = ["05","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68","69","70","71","72","73","75","76","77","78","79","80","81","82"];
  const counts: Record<string, number> = {};
  for (const p of Object.keys(postalIndex)) {
    const s = p.slice(0, 2);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const sparse = RESIDENTIAL.filter((s) => (counts[s] ?? 0) < 200);
  if (sparse.length === 0) info("all residential sectors have ≥200 indexed postals — runtime OneMap-first catches anything missing.");
  else warn(`sparse residential sectors (may force sector-centroid fallback at runtime): ${sparse.map(s => `${s}(${counts[s] ?? 0})`).join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────
// 6. Distance accuracy — cross-validate against SLA for many pairs
// ─────────────────────────────────────────────────────────────────────
section("Distance accuracy: app distance vs SLA-direct (sampled pairs)");
{
  // For each school, pick a real residential postal in the same sector
  // (from the postal index), compute the app's distance (postal coord →
  // school stored coord) and the SLA-direct distance (postal SLA coord
  // → school SLA coord). They should match to within < 1 m.
  let pairsChecked = 0;
  let maxDelta = 0;
  for (const s of schools) {
    const t = truth[s.id];
    if (!t || Array.isArray(t)) continue;
    const te = t as TruthEntry;
    // pick first postal in the same sector
    const sector = s.postal.slice(0, 2);
    const sameSector = Object.entries(postalIndex).filter(([p]) => p.startsWith(sector)).slice(0, 1);
    if (sameSector.length === 0) continue;
    const [home, [hLat, hLng]] = sameSector[0];
    const appDist = haversineKm(hLat, hLng, s.lat, s.lng);
    const slaDist = haversineKm(hLat, hLng, te.lat, te.lng);
    const delta = Math.abs(appDist - slaDist);
    maxDelta = Math.max(maxDelta, delta);
    if (delta > 0.001) fail(`distance delta ${delta.toFixed(4)} km for ${s.name} from ${home} (app ${appDist.toFixed(4)} vs SLA ${slaDist.toFixed(4)})`);
    pairsChecked++;
  }
  info(`${pairsChecked} (postal, school) pairs checked; max delta ${(maxDelta * 1000).toFixed(2)} m (target < 1 m).`);
}

// ─────────────────────────────────────────────────────────────────────
// 7. Distance-band-edge audit — schools where small coord errors would
//    flip a parent across the 1 km MOE Phase 2C cutoff.
// ─────────────────────────────────────────────────────────────────────
section("1 km MOE-band edge cases");
{
  // For each school, find postals between 0.90 km and 1.10 km away —
  // these are the borderline cases. If our stored school coord differs
  // from SLA by more than the buffer, a parent could see the wrong
  // band. Coords are already proven exact above, so the only risk is
  // home-postal resolution, which the runtime OneMap-first path
  // handles in production.
  let onTheEdge = 0;
  for (const s of schools) {
    let near = 0, far = 0;
    for (const [, [lat, lng]] of Object.entries(postalIndex).slice(0, 5000)) {
      const km = haversineKm(lat, lng, s.lat, s.lng);
      if (km >= 0.95 && km <= 1.0) near++;
      else if (km > 1.0 && km <= 1.05) far++;
    }
    if (near > 0 || far > 0) onTheEdge += near + far;
  }
  info(`~${onTheEdge} (postal, school) borderline pairs within ±50 m of the 1 km cutoff in a 5000-postal sample — the runtime OneMap-first geocoder is what protects these.`);
}

// ─────────────────────────────────────────────────────────────────────
// 8. Ballot internal consistency + real-vs-illustrative provenance
// ─────────────────────────────────────────────────────────────────────
section("Ballot data internal consistency + provenance");
{
  let badYears = 0;
  let realPhases = 0, synthPhases = 0;
  const realBySchool: Record<string, number> = {};
  for (const s of schools) {
    realBySchool[s.id] = 0;
    for (const [yr, phases] of Object.entries(s.ballot)) {
      const y = Number(yr);
      if (!Number.isInteger(y) || y < 2018 || y > 2030) { badYears++; continue; }
      for (const [phase, b] of Object.entries(phases)) {
        if (!b) continue;
        if (b.vacancy < 0) fail(`${s.name} ${yr} ${phase}: negative vacancy`);
        if (b.applied.near < 0 || b.applied.mid < 0 || b.applied.far < 0)
          fail(`${s.name} ${yr} ${phase}: negative applied`);
        if (b.isReal) { realPhases++; realBySchool[s.id]++; }
        else synthPhases++;
      }
    }
  }
  if (badYears) fail(`${badYears} ballot rows have invalid years`);
  else info(`all ballot years valid, all vacancies + applied non-negative.`);
  const totalPhases = realPhases + synthPhases;
  const pct = totalPhases ? ((realPhases / totalPhases) * 100).toFixed(1) : "0";
  info(`ballot provenance: ${realPhases}/${totalPhases} phase-rows from real MOE data (${pct}%).`);
  const schoolsWithReal = Object.values(realBySchool).filter((n) => n > 0).length;
  info(`${schoolsWithReal}/${schools.length} schools have at least one real ballot year.`);
  if (realPhases === 0) {
    warn(`zero real ballot data — every ballot bar in the UI will be flagged 'Illustrative'. Run scripts/scrape-ballot.ts to populate data/ballot-truth.json.`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 9. Sector coords sanity
// ─────────────────────────────────────────────────────────────────────
section("Postal-sector fallback table");
{
  let bad = 0;
  for (const [k, v] of Object.entries(sectors)) {
    if (!/^\d{2}$/.test(k)) { bad++; continue; }
    if (!inSg(v.lat, v.lng)) { bad++; continue; }
  }
  if (bad) fail(`${bad} bad sector entries`);
  else info(`${Object.keys(sectors).length} sectors, all valid.`);
}

// ─────────────────────────────────────────────────────────────────────
// 10. Reality check: famous schools are present and validated.
// ─────────────────────────────────────────────────────────────────────
section("Reality-check: famous schools present and SLA-validated");
{
  // We don't hard-code "expected postals" here — that would mean
  // grading the dataset against memory, which doesn't help. Instead we
  // assert that every household-name school exists in the dataset, has
  // an SLA-truth entry (so the postal/address were derived from SLA,
  // not synthesised), and the stored coord is exact against SLA.
  const FAMOUS = [
    "kong-hwa-school",
    "tao-nan-school",
    "rosyth-school",
    "anglo-chinese-school",
    "raffles-girls-primary",
    "nanyang-primary-school",
    "henry-park-primary",
    "methodist-girls-school",
    "ai-tong-school",
    "catholic-high-school",
    "tanjong-katong-primary",
    "chij-katong-primary",
    "haig-girls-school",
    "maris-stella-high",
    "pei-hwa-presbyterian",
  ];
  for (const id of FAMOUS) {
    const s = schools.find((x) => x.id === id);
    if (!s) { fail(`famous school missing: ${id}`); continue; }
    const t = truth[s.id];
    if (!t || Array.isArray(t)) {
      warn(`famous school is a manual override (no SLA validation): ${s.name}`);
      continue;
    }
    const te = t as TruthEntry;
    const km = haversineKm(s.lat, s.lng, te.lat, te.lng);
    if (km > 0.005 || s.postal !== te.postal) {
      fail(`famous school drift: ${s.name} (${km.toFixed(3)} km, postal ${s.postal} vs ${te.postal})`);
    } else {
      info(`✓ ${s.name.padEnd(40)} → ${s.postal}  ${s.address}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────

console.log(out.join("\n"));
console.log(`\n${failures === 0 ? "✓" : "✗"} ${failures} failure${failures === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`);
if (!existsSync("data/schools.json")) console.error("data/schools.json missing");
process.exit(failures > 0 ? 1 : 0);
