import type { Metadata } from "next";
import { PostalSearch } from "@/components/PostalSearch";
import { ResultsView } from "@/components/ResultsView";
import { geocode, geocodeQuery, isValidPostal } from "@/lib/geocode";
import { searchSchools } from "@/lib/schools";
import type { GeoResult } from "@/lib/types";

type SearchParams = Promise<{ postal?: string; q?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { postal, q } = await searchParams;
  const cleanPostal = (postal ?? "").trim();
  const query = (q ?? "").trim();

  if (isValidPostal(cleanPostal)) {
    return {
      title: `Primary schools near ${cleanPostal}`,
      description: `Every primary school within 2 km of postal code ${cleanPostal}, with distance bands, ballot history and personalised odds.`,
      alternates: { canonical: `/search?postal=${cleanPostal}` },
    };
  }
  if (query) {
    return {
      title: `Primary schools near ${query}`,
      description: `Primary schools near ${query}, with distance bands, ballot history and personalised registration odds.`,
      alternates: { canonical: `/search?q=${encodeURIComponent(query)}` },
    };
  }
  return { title: "Find primary schools near you" };
}

/** Resolve whichever search input was supplied, or null if none resolved. */
async function resolveLocation(
  cleanPostal: string,
  query: string,
): Promise<GeoResult | null> {
  try {
    if (isValidPostal(cleanPostal)) return await geocode(cleanPostal);
    if (query) return await geocodeQuery(query);
  } catch {
    return null;
  }
  return null;
}

function SearchPrompt({
  notFound = false,
  initialValue = "",
}: {
  notFound?: boolean;
  initialValue?: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink">
        {notFound ? "We couldn’t find that place" : "Find your schools"}
      </h1>
      <p className="mt-2 text-ink-soft">
        {notFound
          ? "Try a different postal code, a fuller address, or a town like “Ang Mo Kio”."
          : "Enter a 6-digit postal code, an address or an area to see nearby primary schools."}
      </p>
      <div className="mt-6">
        <PostalSearch variant="hero" autoFocus initialValue={initialValue} />
      </div>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { postal, q } = await searchParams;
  const cleanPostal = (postal ?? "").trim();
  const query = (q ?? "").trim();

  if (!cleanPostal && !query) {
    return <SearchPrompt />;
  }

  const geo = await resolveLocation(cleanPostal, query);
  if (!geo) {
    return <SearchPrompt notFound initialValue={query || cleanPostal} />;
  }

  const { within, beyond } = searchSchools(geo);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ink-soft">
            Primary schools near
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            {geo.address}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {geo.postal ? <>Postal {geo.postal} · </> : null}
            {within.length > 0
              ? `${within.length} school${
                  within.length === 1 ? "" : "s"
                } within 2 km`
              : "no schools within 2 km"}
            {geo.source === "sector" ? (
              <span className="text-ink-soft/75">
                {" "}
                · approximate location from postal sector
              </span>
            ) : null}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <PostalSearch
            variant="compact"
            initialValue={cleanPostal || query}
          />
        </div>
      </div>

      <ResultsView within={within} beyond={beyond} />
    </div>
  );
}
