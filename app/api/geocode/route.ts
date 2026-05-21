import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { geocode, isValidPostal } from "@/lib/geocode";

// In-memory per-IP rate limit — guards against postal-code enumeration.
const RATE_LIMIT = 60;
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
  const postal = request.nextUrl.searchParams.get("postal")?.trim() ?? "";

  if (!isValidPostal(postal)) {
    return NextResponse.json(
      { error: "Postal code must be exactly 6 digits." },
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

  try {
    const result = await geocode(postal);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not resolve that postal code." },
      { status: 400 },
    );
  }
}
