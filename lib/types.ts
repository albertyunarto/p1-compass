// Core data shapes for P1 Compass.
// NOTE: the `School` shape is a stable contract — `data/schools.json` and every
// component downstream depend on it.

export type SchoolType =
  | "SAP"
  | "Affiliated"
  | "Boys"
  | "Girls"
  | "GEP"
  | "IP"
  | "Neighbourhood";

/** Registration phases P1 Compass covers (Phase 1 is sibling-only, not balloted). */
export type Phase = "2A" | "2B" | "2C";

/** Distance band — relative to the user's home, and to a school for balloting. */
export type Band = "near" | "mid" | "far";

/**
 * Derived ballot outcome for one phase.
 *  open   = no ballot needed (all applicants admitted)
 *  b_far  = ballot resolved within the >2 km band
 *  b_mid  = balloting reached the 1–2 km band
 *  b_near = balloting reached inside the <1 km band (most competitive)
 */
export type BallotStatus = "open" | "b_far" | "b_mid" | "b_near";

/**
 * Raw balloting inputs for one phase in one year. `applied` is the
 * synthesised per-band breakdown (used by the verdict engine for
 * proportional reasoning). The optional fields below carry the actual
 * MOE-published figures and supersede the synthesised breakdown when
 * present — see data/ballot-truth.json.
 */
export type PhaseBallot = {
  vacancy: number;
  applied: { near: number; mid: number; far: number };
  /** Real total applicants for the phase, from MOE. */
  total?: number;
  /** Whether the phase required balloting. */
  balloted?: boolean;
  /** Distance band where balloting was conducted (if any). */
  ballotedBand?: "within1km" | "1to2km" | "beyond2km" | "all";
  /** Vacancies that went into the ballot. */
  ballotedVacancies?: number;
  /** Applicants in the balloted band. */
  ballotedApplicants?: number;
  /** Set true when this phase's figures came from a real source. */
  isReal?: boolean;
  /** Provenance label, e.g. "MOE 2025". */
  source?: string;
};

export type BallotHistory = {
  [year: number]: Partial<Record<Phase, PhaseBallot>>;
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
  ballot: BallotHistory;
};

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

// --- AI recommendations ------------------------------------------------------

export type RecPriority = "high" | "medium" | "low";

/** One actionable suggestion for improving a child's odds at a school. */
export type Recommendation = {
  /** Short imperative, e.g. "Volunteer at the school". */
  action: string;
  /** 1–2 sentences explaining why, grounded in the ballot data. */
  detail: string;
  priority: RecPriority;
};

export type RecommendResult = {
  /** One-sentence headline strategy for the focused phase. */
  summary: string;
  recommendations: Recommendation[];
};
