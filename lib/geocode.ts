// Resolve a Singapore postal code to a location.
//
// Resolution order:
//   1. OneMap — live, exact, always up-to-date (~150ms, cached per-process).
//   2. data/postal_coords.json — bundled offline index, fallback when OneMap
//      is unreachable or times out.
//   3. Postal-sector centroid — an approximate last resort.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sectorData from "@/data/postal_sectors.json";
import { onemapSearch, onemapSearchPostal } from "./onemap";
import type { GeoResult, PostalSector } from "./types";

const sectors = sectorData as Record<string, PostalSector>;
const SG_CENTRE: PostalSector = { area: "Singapore", lat: 1.3521, lng: 103.8198 };

// [lat, lng, "block road"] — the bundled postal index entry shape.
type PostalEntry = [number, number, string];

// Loaded lazily from disk (it is large) and cached for the process lifetime.
let postalIndex: Record<string, PostalEntry> | null = null;

function loadPostalIndex(): Record<string, PostalEntry> {
  if (postalIndex) return postalIndex;
  try {
    const file = join(process.cwd(), "data", "postal_coords.json");
    postalIndex = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      PostalEntry
    >;
  } catch {
    postalIndex = {};
  }
  return postalIndex;
}

const cache = new Map<string, GeoResult>();

export function isValidPostal(postal: string): boolean {
  return /^\d{6}$/.test(postal);
}

/** Small deterministic spread so distinct postals in one sector aren't identical. */
function jitter(postal: string): { dLat: number; dLng: number } {
  const seed = Number(postal.slice(2)) || 0;
  return {
    dLat: ((seed % 97) / 97 - 0.5) * 0.012,
    dLng: (((seed * 7) % 89) / 89 - 0.5) * 0.012,
  };
}

export async function geocode(postal: string): Promise<GeoResult> {
  const clean = postal.trim();
  if (!isValidPostal(clean)) {
    throw new Error("Postal code must be exactly 6 digits.");
  }

  const hit = cache.get(clean);
  if (hit) return { ...hit, cached: true };

  // 1. OneMap — live, exact, always up-to-date.
  const onemap = await onemapSearchPostal(clean);
  if (onemap) {
    const result: GeoResult = {
      postal: clean,
      address: onemap.address,
      lat: onemap.lat,
      lng: onemap.lng,
      cached: false,
      source: "onemap",
    };
    cache.set(clean, result);
    return result;
  }

  // 2. Bundled offline index — fallback when OneMap is unreachable.
  const entry = loadPostalIndex()[clean];
  if (entry) {
    const [lat, lng, addr] = entry;
    const result: GeoResult = {
      postal: clean,
      address: addr ? `${addr}, Singapore ${clean}` : `Singapore ${clean}`,
      lat,
      lng,
      cached: false,
      source: "index",
    };
    cache.set(clean, result);
    return result;
  }

  // 3. postal-sector centroid (approximate last resort)
  const sectorKey = clean.slice(0, 2);
  const base = sectors[sectorKey] ?? SG_CENTRE;
  const { dLat, dLng } = jitter(clean);
  const result: GeoResult = {
    postal: clean,
    address: `${base.area} — postal sector ${sectorKey} (approximate location)`,
    lat: +(base.lat + dLat).toFixed(6),
    lng: +(base.lng + dLng).toFixed(6),
    cached: false,
    source: "sector",
  };
  cache.set(clean, result);
  return result;
}

/**
 * Resolve a free-text query — a 6-digit postal code, an address, a building
 * name or an area (e.g. "Ang Mo Kio") — to a location. Postal codes route
 * through the offline index; everything else goes through OneMap's search.
 * Throws when nothing can be resolved.
 */
export async function geocodeQuery(query: string): Promise<GeoResult> {
  const clean = query.trim();
  if (!clean) throw new Error("Enter a postal code, address or area.");
  if (isValidPostal(clean)) return geocode(clean);

  const hit = await onemapSearch(clean);
  if (!hit) throw new Error("Could not find that address or place.");

  // When OneMap returns a postal code, prefer the exact offline index entry.
  if (hit.postal && isValidPostal(hit.postal)) {
    try {
      return await geocode(hit.postal);
    } catch {
      // fall through to the raw OneMap hit
    }
  }

  return {
    postal: hit.postal && isValidPostal(hit.postal) ? hit.postal : "",
    address: hit.address,
    lat: hit.lat,
    lng: hit.lng,
    cached: false,
    source: "onemap",
  };
}
