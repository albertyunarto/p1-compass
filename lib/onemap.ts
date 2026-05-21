// OneMap geocoding client.
//
// Auth strategy, in priority order:
//   1. ONEMAP_TOKEN  — a ready access token (expires ~3 days).
//   2. ONEMAP_EMAIL + ONEMAP_PASSWORD — fetch + cache a token automatically.
//   3. none — every call returns null and the caller falls back gracefully.
//
// The token is cached in module scope so real users never wait on token fetches.

const TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const FALLBACK_TTL_MS = 3 * 24 * 60 * 60 * 1000;

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

/** Pull the `exp` claim (ms) out of a JWT without verifying it. */
function jwtExpiryMs(jwt: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString("utf8"),
    ) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function getToken(): Promise<string | null> {
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  const staticToken = process.env.ONEMAP_TOKEN?.trim();
  if (staticToken) {
    cached = {
      token: staticToken,
      expiresAt: jwtExpiryMs(staticToken) || now + FALLBACK_TTL_MS,
    };
    return cached.token;
  }

  const email = process.env.ONEMAP_EMAIL?.trim();
  const password = process.env.ONEMAP_PASSWORD?.trim();
  if (!email || !password) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token?: string;
      expiry_timestamp?: string | number;
    };
    if (!data.access_token) return null;
    const expiry = data.expiry_timestamp
      ? Number(data.expiry_timestamp) * 1000
      : jwtExpiryMs(data.access_token);
    cached = {
      token: data.access_token,
      // refresh an hour before the real expiry as a safety buffer
      expiresAt: (expiry || now + FALLBACK_TTL_MS) - 60 * 60 * 1000,
    };
    return cached.token;
  } catch {
    return null;
  }
}

export type OneMapHit = {
  lat: number;
  lng: number;
  address: string;
  postal?: string;
};

type OneMapResult = {
  SEARCHVAL?: string;
  BLK_NO?: string;
  ROAD_NAME?: string;
  BUILDING?: string;
  ADDRESS?: string;
  POSTAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};

function formatAddress(hit: OneMapResult): string {
  const clean = (v?: string) => (v && v !== "NIL" ? v.trim() : "");
  const building = clean(hit.BUILDING);
  const street = [clean(hit.BLK_NO), clean(hit.ROAD_NAME)]
    .filter(Boolean)
    .join(" ");
  const main = [building, street].filter(Boolean).join(", ") || clean(hit.ADDRESS);
  return main || "Singapore";
}

function toHit(r: OneMapResult): OneMapHit | null {
  const lat = Number(r.LATITUDE);
  const lng = Number(r.LONGITUDE);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const postal = r.POSTAL && r.POSTAL !== "NIL" ? r.POSTAL : undefined;
  return { lat, lng, address: formatAddress(r), postal };
}

async function rawSearch(searchVal: string): Promise<OneMapResult[]> {
  const token = await getToken();
  if (!token) return [];

  try {
    const url = `${SEARCH_URL}?searchVal=${encodeURIComponent(
      searchVal,
    )}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const res = await fetch(url, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: OneMapResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

/** Resolve a 6-digit postal code via OneMap, or null on any failure. */
export async function onemapSearchPostal(
  postal: string,
): Promise<OneMapHit | null> {
  const results = await rawSearch(postal);
  const match = results.find((r) => String(r.POSTAL) === postal) ?? results[0];
  return match ? toHit(match) : null;
}

/** Resolve a free-text query (e.g. a school name) to its first valid hit. */
export async function onemapSearch(
  searchVal: string,
): Promise<OneMapHit | null> {
  const results = await rawSearch(searchVal);
  for (const r of results) {
    const hit = toHit(r);
    if (hit) return hit;
  }
  return null;
}
