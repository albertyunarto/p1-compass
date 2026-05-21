import type { Metadata } from "next";
import { PostalSearch } from "@/components/PostalSearch";
import { ResultsView } from "@/components/ResultsView";
import { geocode, isValidPostal } from "@/lib/geocode";
import { searchSchools } from "@/lib/schools";

type SearchParams = Promise<{ postal?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { postal } = await searchParams;
  const clean = (postal ?? "").trim();
  if (!isValidPostal(clean)) {
    return { title: "Find primary schools near you" };
  }
  return {
    title: `Primary schools near ${clean}`,
    description: `Every primary school within 2 km of postal code ${clean}, with distance bands, ballot history and personalised Phase 2C odds.`,
    alternates: { canonical: `/search?postal=${clean}` },
  };
}

function SearchPrompt() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink">
        Find your schools
      </h1>
      <p className="mt-2 text-ink-soft">
        Enter a 6-digit Singapore postal code to see nearby primary schools.
      </p>
      <div className="mt-6">
        <PostalSearch variant="hero" autoFocus />
      </div>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { postal } = await searchParams;
  const clean = (postal ?? "").trim();

  if (!isValidPostal(clean)) {
    return <SearchPrompt />;
  }

  const geo = await geocode(clean);
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
            Postal {clean} ·{" "}
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
          <PostalSearch variant="compact" initialValue={clean} />
        </div>
      </div>

      <ResultsView within={within} beyond={beyond} />
    </div>
  );
}
