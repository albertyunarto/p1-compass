// School dataset access + distance search.

import schoolData from "@/data/schools.json";
import { bearingDeg, distanceBand, haversineKm } from "./geo";
import type { NearbySchool, School } from "./types";

const SCHOOLS = schoolData as unknown as School[];

export function getAllSchools(): School[] {
  return SCHOOLS;
}

export function getSchoolById(id: string): School | undefined {
  return SCHOOLS.find((s) => s.id === id);
}

export type SearchResult = {
  /** Schools within MOE's 2 km distance bands, nearest first. */
  within: NearbySchool[];
  /** When nothing is within 2 km, the closest few beyond it (empty-state). */
  beyond: NearbySchool[];
};

function annotate(
  origin: { lat: number; lng: number },
  school: School,
): NearbySchool {
  const distanceKm = haversineKm(origin.lat, origin.lng, school.lat, school.lng);
  return {
    ...school,
    distanceKm,
    bearingDeg: bearingDeg(origin.lat, origin.lng, school.lat, school.lng),
    band: distanceBand(distanceKm),
  };
}

export function searchSchools(
  origin: { lat: number; lng: number },
  schools: School[] = SCHOOLS,
): SearchResult {
  const ranked = schools
    .map((s) => annotate(origin, s))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const within = ranked.filter((s) => s.distanceKm <= 2);
  const beyond = within.length === 0 ? ranked.slice(0, 4) : [];

  return { within, beyond };
}
