// Core data shapes for P1 Compass.
// NOTE: the `School` shape is a stable contract — `data/schools.json` and every
// component downstream depend on it. Add fields, do not rename or remove.

export type SchoolType =
  | "SAP"
  | "Affiliated"
  | "Boys"
  | "Girls"
  | "GEP"
  | "IP"
  | "Neighbourhood";

export type Phase = "2A" | "2B" | "2C" | "2CS";

/**
 * How deep a school had to ballot in a given phase.
 *  open   = no ballot needed (all applicants admitted)
 *  b_far  = ballot resolved within the >2km band
 *  b_mid  = ballot reached the 1-2km band
 *  b_near = ballot reached the <1km band (most competitive)
 */
export type BallotStatus = "open" | "b_far" | "b_mid" | "b_near";

export type BallotHistory = {
  [year: number]: Partial<Record<Phase, BallotStatus>>;
};

export type Vacancies = {
  year: number;
  total: number;
  phase1: number;
  phase2a: number;
  phase2b: number;
  phase2c: number;
};

export type School = {
  id: string;
  code: number;
  name: string;
  short: string;
  address: string;
  postal: string;
  lat: number;
  lng: number;
  type: SchoolType[];
  affiliations: string[];
  ccas: string[];
  programmes: string[];
  vacancies: Vacancies;
  ballot: BallotHistory;
};

/** Distance band relative to the user's home. */
export type Band = "near" | "mid" | "far";

/** A school annotated with its position relative to a specific search. */
export type NearbySchool = School & {
  distanceKm: number;
  bearingDeg: number;
  band: Band;
};

/** Result of resolving a postal code to a location. */
export type GeoResult = {
  postal: string;
  address: string;
  lat: number;
  lng: number;
  cached: boolean;
  /**
   * "index"  = exact match in the bundled postal dataset
   * "onemap" = live OneMap geocode
   * "sector" = postal-sector centroid fallback (approximate)
   */
  source: "index" | "onemap" | "sector";
};

/** Sector centroid table entry (data/postal_sectors.json). */
export type PostalSector = {
  area: string;
  lat: number;
  lng: number;
};
