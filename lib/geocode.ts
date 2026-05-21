// Resolve a Singapore postal code to a location.
//
// Tries OneMap for a precise geocode; on any failure (no credentials, network
// error, no match) it falls back to the centroid of the postal sector — the
// first two digits of the code — so the app always returns a usable location.

import sectorData from "@/data/postal_sectors.json";
import { onemapSearchPostal } from "./onemap";
import type { GeoResult, PostalSector } from "./types";

const sectors = sectorData as Record<string, PostalSector>;
const SG_CENTRE: PostalSector = { area: "Singapore", lat: 1.3521, lng: 103.8198 };

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
