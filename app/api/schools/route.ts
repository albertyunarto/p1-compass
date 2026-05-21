import { NextResponse } from "next/server";
import { getAllSchools } from "@/lib/schools";

// Static dataset — safe to cache aggressively; it only changes on redeploy.
export function GET() {
  return NextResponse.json(getAllSchools(), {
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
