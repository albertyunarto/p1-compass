import Link from "next/link";
import { PostalSearch } from "@/components/PostalSearch";

const SAMPLES = [
  { postal: "569824", area: "Ang Mo Kio" },
  { postal: "460074", area: "Bedok" },
  { postal: "520103", area: "Tampines" },
];

const STEPS = [
  {
    n: "1",
    title: "Enter your postal code",
    body: "We resolve your home to a precise location using OneMap, Singapore's official map service.",
  },
  {
    n: "2",
    title: "See every school within 2 km",
    body: "Schools plotted on a distance-band map — your <1 km and 1–2 km Phase 2C priority zones at a glance.",
  },
  {
    n: "3",
    title: "Read your real odds",
    body: "Each school pairs your exact distance with its multi-year ballot history into one plain verdict.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* hero */}
      <section className="py-16 text-center sm:py-24">
        <p className="mb-4 inline-block rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
          For Singapore Primary 1 registration
        </p>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          Know your <span className="text-primary">Primary 1 odds</span> before
          you register.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Enter your postal code to see every primary school within 2 km — mapped
          by distance band, with years of ballot history and a personalised read
          on your Phase 2C chances.
        </p>

        <div className="mx-auto mt-8 max-w-lg">
          <PostalSearch variant="hero" autoFocus />
          <p className="mt-3 text-sm text-ink-soft">
            No code handy? Try{" "}
            {SAMPLES.map((s, i) => (
              <span key={s.postal}>
                {i > 0 ? ", " : ""}
                <Link
                  href={`/search?postal=${s.postal}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {s.postal}
                </Link>{" "}
                <span className="text-ink-soft/70">({s.area})</span>
              </span>
            ))}
            .
          </p>
        </div>
      </section>

      {/* how it works */}
      <section className="border-t border-line py-14">
        <h2 className="text-center font-display text-2xl font-semibold text-ink sm:text-3xl">
          From postal code to a clear answer
        </h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="rounded-card border border-line bg-surface p-6"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-white">
                {step.n}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* reassurance */}
      <section className="border-t border-line py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Data you can scan in one screen
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            The official MOE checker is authoritative but works one school at a
            time. P1 Compass brings distance, direction and ballot trends
            together so you can shortlist with confidence — then register on
            MOE&apos;s portal as usual. It is a free planning aid, not a
            registration tool.
          </p>
          <Link
            href="/about"
            className="mt-5 inline-block text-sm font-semibold text-primary underline underline-offset-2"
          >
            How it works &amp; where the data comes from
          </Link>
        </div>
      </section>
    </div>
  );
}
