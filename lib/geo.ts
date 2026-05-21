// Straight-line geo helpers — matches MOE's distance methodology (not walking).

import type { Band } from "./types";

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Initial bearing from A to B, in degrees clockwise from north (0–360). */
export function bearingDeg(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** MOE Phase 2C distance priority band. */
export function distanceBand(km: number): Band {
  if (km < 1) return "near";
  if (km <= 2) return "mid";
  return "far";
}

const COMPASS_POINTS = [
  "N", "NE", "E", "SE", "S", "SW", "W", "NW",
] as const;

/** Nearest 8-point compass label for a bearing in degrees. */
export function compassPoint(deg: number): string {
  return COMPASS_POINTS[Math.round(deg / 45) % 8];
}
