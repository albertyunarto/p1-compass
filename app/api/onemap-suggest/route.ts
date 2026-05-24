import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { onemapSuggest } from "@/lib/onemap";

// Per-IP rate limit: a typeahead with a 180 ms debounce can fire a handful
// of requests per search, so this budget is roomier than /api/geocode.
const RATE_LIMIT = 200;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { suggestions: [], error: "rate-limited" },
      { status: 429 },
    );
  }

  const suggestions = await onemapSuggest(q, 8);
  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "public, max-age=120" } },
  );
}
