import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { geminiConfigured } from "@/lib/gemini";
import { getRecommendations } from "@/lib/recommend";
import { getSchoolById } from "@/lib/schools";
import type { Band, Phase, RecommendResult } from "@/lib/types";

const BANDS: Band[] = ["near", "mid", "far"];
const PHASES: Phase[] = ["2A", "2B", "2C"];

// In-memory per-IP rate limit — Gemini calls cost money, so cap them.
const RATE_LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

// Cache by school + rounded distance + phase — the inputs are stable, so one
// Gemini call serves every parent in the same situation.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: RecommendResult }>();

/** Lets the client know whether to offer the AI feature without spending tokens. */
export function GET() {
  return NextResponse.json({ configured: geminiConfigured() });
}

type Body = {
  schoolId?: unknown;
  band?: unknown;
  distanceKm?: unknown;
  phase?: unknown;
};

export async function POST(request: NextRequest) {
  // Gemini-only: with no key configured there is nothing to generate.
  if (!geminiConfigured()) {
    return NextResponse.json({ recommendations: [] });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const school =
    typeof body.schoolId === "string"
      ? getSchoolById(body.schoolId)
      : undefined;
  const band = body.band as Band;
  const phase = body.phase as Phase;
  const distanceKm = Number(body.distanceKm);

  if (
    !school ||
    !BANDS.includes(band) ||
    !PHASES.includes(phase) ||
    !Number.isFinite(distanceKm)
  ) {
    return NextResponse.json(
      { error: "Unknown school, distance or phase." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests — please try again later." },
      { status: 429 },
    );
  }

  const cacheKey = `${school.id}:${distanceKm.toFixed(1)}:${phase}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.value);
  }

  const result = await getRecommendations(school, band, distanceKm, phase);
  if (!result) {
    return NextResponse.json({ recommendations: [] });
  }

  cache.set(cacheKey, { at: Date.now(), value: result });
  return NextResponse.json(result);
}
