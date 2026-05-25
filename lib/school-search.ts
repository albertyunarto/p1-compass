"use client";

import index from "@/data/school-index.json";
import { ALIAS_INDEX } from "./school-aliases";

export type SchoolHit = {
  id: string;
  name: string;
  short: string;
  postal: string;
  lat: number;
  lng: number;
  matched: string; // the alias/term that matched, used for highlighting
};

type Indexed = {
  id: string;
  name: string;
  short: string;
  postal: string;
  lat: number;
  lng: number;
};

const SCHOOLS: Indexed[] = index as Indexed[];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, Indexed>();
for (const s of SCHOOLS) BY_NAME.set(norm(s.name), s);

// Pre-resolve aliases to indexed schools.
const ALIASES: { alias: string; aliasNorm: string; school: Indexed }[] = (() => {
  const out: { alias: string; aliasNorm: string; school: Indexed }[] = [];
  for (const { alias, name } of ALIAS_INDEX) {
    const sch = BY_NAME.get(norm(name));
    if (!sch) continue;
    out.push({ alias, aliasNorm: norm(alias), school: sch });
  }
  return out;
})();

/**
 * Search schools by free-text query. Matches against:
 *   1. Exact-alias  (e.g. "ACS" → Anglo-Chinese (Primary))   — highest rank
 *   2. Alias starts-with (e.g. "ACSJ" → ACS Junior)
 *   3. School short code (e.g. "TKPS" → Tanjong Katong Primary)
 *   4. Name substring (e.g. "Tao Nan")
 *
 * Returns up to `limit` deduplicated hits, ranked by relevance.
 */
export function findSchools(query: string, limit = 5): SchoolHit[] {
  const q = norm(query);
  if (q.length < 2) return [];

  const scored = new Map<string, { hit: SchoolHit; score: number }>();

  const add = (s: Indexed, score: number, matched: string) => {
    const prev = scored.get(s.id);
    if (prev && prev.score >= score) return;
    scored.set(s.id, {
      score,
      hit: {
        id: s.id,
        name: s.name,
        short: s.short,
        postal: s.postal,
        lat: s.lat,
        lng: s.lng,
        matched,
      },
    });
  };

  // 1. Exact alias match (case-insensitive).
  for (const a of ALIASES) {
    if (a.aliasNorm === q) add(a.school, 100, a.alias);
    else if (a.aliasNorm.startsWith(q)) add(a.school, 80, a.alias);
    else if (q.startsWith(a.aliasNorm)) add(a.school, 70, a.alias);
  }

  // 2. School `short` field (e.g. "TKPS").
  for (const s of SCHOOLS) {
    const shortNorm = norm(s.short);
    if (shortNorm === q) add(s, 90, s.short);
    else if (shortNorm.startsWith(q)) add(s, 75, s.short);
  }

  // 3. Name substring (last resort, lowest rank).
  for (const s of SCHOOLS) {
    const n = norm(s.name);
    if (n.startsWith(q)) add(s, 60, s.name);
    else if (n.includes(` ${q}`) || n.includes(q)) add(s, 40, s.name);
  }

  const ranked = [...scored.values()].sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => r.hit);
}
