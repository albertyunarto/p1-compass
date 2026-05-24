// Accuracy audit — picks a few east-side locations, lists the nearest
// schools, and cross-checks each app-stored school coord against the
// SLA-derived truth in data/schools-truth.json.
// Run with:  bun scripts/test-east-accuracy.ts

import schoolsRaw from "../data/schools.json";
import truthRaw from "../data/schools-truth.json";
import { haversineKm } from "../lib/geo";
import { geocode } from "../lib/geocode";
import { searchSchools } from "../lib/schools";
import type { School } from "../lib/types";

const schools = schoolsRaw as School[];
type TruthEntry = { postal: string; address: string; lat: number; lng: number };
const truth = truthRaw as Record<string, TruthEntry | string[]>;

type Place = { label: string; postal: string; lat: number; lng: number };
// Reference locations with hand-checked lat/lng — used to compute the
// "what would MOE say" distance for each nearby school.
const tests: Place[] = [
  { label: "Grand Dunman (1 Dunman Rd)", postal: "437001", lat: 1.3076, lng: 103.8939 },
  { label: "Kong Hwa School (71 Guillemard Rd)", postal: "399786", lat: 1.3097, lng: 103.8867 },
  { label: "Tampines St 21 (HDB hub)", postal: "521201", lat: 1.353, lng: 103.945 },
  { label: "Pasir Ris Dr 1 (HDB)", postal: "519438", lat: 1.376, lng: 103.953 },
  { label: "Bedok North (HDB)", postal: "460538", lat: 1.331, lng: 103.929 },
];

const fmt = (n: number, p = 2) => n.toFixed(p);

function truthOf(id: string): TruthEntry | null {
  const e = truth[id];
  if (!e || Array.isArray(e)) return null;
  return e as TruthEntry;
}

for (const t of tests) {
  console.log(`\n══ ${t.label} ══`);
  console.log(`  postal: ${t.postal}   MOE-grade origin: ${t.lat}, ${t.lng}`);

  const geo = await geocode(t.postal);
  const originDrift = haversineKm(t.lat, t.lng, geo.lat, geo.lng);
  console.log(
    `  app resolved:   ${geo.lat}, ${geo.lng}   source=${geo.source}   drift from MOE-grade origin: ${fmt(originDrift)} km`,
  );

  const { within } = searchSchools(geo);
  const within1 = within.filter((s) => s.distanceKm < 1);
  console.log(
    `  app counts:  within 1 km = ${within1.length}   within 2 km = ${within.length}`,
  );

  console.log(`  app's 6 nearest:`);
  for (const s of within.slice(0, 6)) {
    const k = truthOf(s.id);
    if (!k) {
      console.log(
        `    ${fmt(s.distanceKm)} km  ${s.name}  (no SLA truth — likely manual override)`,
      );
      continue;
    }
    const moeDist = haversineKm(t.lat, t.lng, k.lat, k.lng);
    const coordDrift = haversineKm(s.lat, s.lng, k.lat, k.lng);
    const postalOk = s.postal === k.postal ? "✓" : `✗ (real ${k.postal})`;
    const verdict = coordDrift < 0.01 ? "EXACT" : coordDrift < 0.1 ? "close" : "DRIFT";
    console.log(
      `    ${fmt(s.distanceKm)} km  ${s.name.padEnd(38)}` +
        `   |  MOE dist ${fmt(moeDist)} km  ${verdict} ${fmt(coordDrift, 3)} km  postal ${postalOk}`,
    );
  }
}

// Whole-dataset summary: how many schools agree with SLA truth exactly.
console.log(`\n\n══ Dataset-wide accuracy ══`);
let exact = 0;
let close = 0;
let drift = 0;
let postalOk = 0;
let postalBad = 0;
const drifters: string[] = [];
for (const s of schools) {
  const k = truthOf(s.id);
  if (!k) continue;
  const d = haversineKm(s.lat, s.lng, k.lat, k.lng);
  if (d < 0.01) exact++;
  else if (d < 0.1) close++;
  else {
    drift++;
    drifters.push(`${fmt(d, 3)} km  ${s.name}`);
  }
  if (s.postal === k.postal) postalOk++;
  else postalBad++;
}
console.log(
  `  coords: ${exact} exact, ${close} close (<100m), ${drift} drift (≥100m) — out of ${exact + close + drift} comparable schools.`,
);
console.log(`  postals: ${postalOk} match SLA, ${postalBad} disagree.`);
if (drifters.length > 0) {
  console.log(`  drift entries:`);
  for (const d of drifters.slice(0, 20)) console.log(`    ${d}`);
}
