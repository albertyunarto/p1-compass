import Link from "next/link";
import { HeroDemo } from "@/components/HeroDemo";
import { PostalSearch } from "@/components/PostalSearch";
import { geocode } from "@/lib/geocode";
import { searchSchools } from "@/lib/schools";
import type { NearbySchool } from "@/lib/types";

const SAMPLES = [
  { postal: "569824", area: "Ang Mo Kio" },
  { postal: "460074", area: "Bedok" },
  { postal: "520103", area: "Tampines" },
];

const STEPS = [
  {
    n: "01",
    title: "Enter your postal code",
    body: "We resolve your home through OneMap, Singapore's official map service, so distance is measured the way MOE does it.",
  },
  {
    n: "02",
    title: "Read distance and ballot together",
    body: "Every school is plotted by exact distance and direction, with five years of phase outcomes shown as compact bars.",
  },
  {
    n: "03",
    title: "Get a plain verdict per school",
    body: "A rules-based engine pairs your distance band with each school's recent ballot depth — twelve cases, no black box.",
  },
];

const STATS = [
  { v: "184", l: "Primary schools indexed" },
  { v: "5 yrs", l: "of ballot history" },
  { v: "Free", l: "No sign-up, no ads" },
];

type Demo = {
  schools: NearbySchool[];
  origin: { lat: number; lng: number };
};

async function demoSchools(): Promise<Demo | null> {
  try {
    const geo = await geocode("569824");
    return {
      schools: searchSchools(geo).within.slice(0, 7),
      origin: { lat: geo.lat, lng: geo.lng },
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const demo = await demoSchools();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* HERO */}
      <section className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#efe3c4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            For Singapore P1 registration · 2026 cycle
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-[3.4rem]">
            Know your{" "}
            <em className="text-primary not-italic">Primary 1 odds</em> before
            you register.
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
            Enter a postal code, address or area to see every primary school
            within 2 km — mapped by distance, with five years of ballot history
            and a plain-language read on your chances.
          </p>
          <div className="mt-7 max-w-md">
            <PostalSearch variant="hero" autoFocus />
            <p className="mt-3 text-sm text-ink-muted">
              No code handy? Try{" "}
              {SAMPLES.map((s, i) => (
                <span key={s.postal}>
                  {i > 0 ? ", " : ""}
                  <Link
                    href={`/search?postal=${s.postal}`}
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    {s.postal}
                  </Link>{" "}
                  <span className="text-ink-muted/70">({s.area})</span>
                </span>
              ))}
              .
            </p>
          </div>
          <div className="mt-9 flex gap-7 border-t border-line pt-6">
            {STATS.map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl leading-none text-ink">
                  {s.v}
                </div>
                <div className="mt-1.5 text-xs text-ink-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {demo ? <HeroDemo schools={demo.schools} origin={demo.origin} /> : null}
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-line py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
            From postal code to a clear answer.
          </h2>
          <Link
            href="/about"
            className="text-sm font-semibold text-primary underline underline-offset-2"
          >
            See the methodology →
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <div className="font-display text-sm font-semibold tracking-[0.1em] text-primary">
                {step.n}
              </div>
              <h3 className="mt-2.5 font-display text-xl font-medium leading-snug text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SHORTLIST + COMPARE PROMO */}
      <section className="pb-16">
        <div className="rounded-3xl bg-primary px-8 py-10 sm:px-10">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#90c0ae]">
            New this cycle
          </div>
          <h2 className="mt-2 max-w-xl font-display text-2xl font-medium leading-snug text-paper sm:text-3xl">
            Shortlist schools, then compare them side by side.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#d7e3dc]">
            Star schools as you browse, then open one screen that lines up
            distance, ballot trends and verdicts — so the family conversation is
            about real numbers, not screenshots.
          </p>
        </div>
      </section>
    </div>
  );
}
