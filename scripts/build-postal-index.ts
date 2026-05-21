/**
 * build-postal-index.ts — builds data/postal_coords.json, an offline geocoder
 * covering ~120k Singapore postal codes so the app resolves a home location
 * precisely without depending on the OneMap API at request time.
 *
 *   bun scripts/build-postal-index.ts   (or: bun run build:postal)
 *
 * Source: the OneMap building dataset mirrored at
 * github.com/xkjyeah/singapore-postal-codes. Each record becomes:
 *
 *   "<postal>": [lat, lng, "<block> <road>"]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/xkjyeah/singapore-postal-codes/master/buildings.json";

type RawBuilding = {
  POSTAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
  BLK_NO?: string;
  ROAD_NAME?: string;
};

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

console.log("Fetching Singapore building dataset…");
const res = await fetch(SOURCE);
if (!res.ok) {
  throw new Error(`Failed to fetch dataset (HTTP ${res.status}).`);
}
const buildings = (await res.json()) as RawBuilding[];

const index: Record<string, [number, number, string]> = {};
let skipped = 0;

for (const b of buildings) {
  const postal = b.POSTAL ?? "";
  if (!/^\d{6}$/.test(postal)) {
    skipped++;
    continue;
  }
  const lat = Number(b.LATITUDE);
  const lng = Number(b.LONGITUDE);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 1 || lat > 1.5) {
    skipped++;
    continue;
  }
  const blk = b.BLK_NO && b.BLK_NO !== "NIL" ? `${b.BLK_NO} ` : "";
  const road = b.ROAD_NAME && b.ROAD_NAME !== "NIL" ? b.ROAD_NAME : "";
  index[postal] = [
    +lat.toFixed(5),
    +lng.toFixed(5),
    titleCase((blk + road).trim()),
  ];
}

const dataDir = join(import.meta.dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, "postal_coords.json"), JSON.stringify(index));

console.log(
  `Wrote ${Object.keys(index).length} postal codes (skipped ${skipped}).`,
);
