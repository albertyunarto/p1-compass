export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-sand" />
        <div className="h-8 w-80 max-w-full animate-pulse rounded bg-sand" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="aspect-square animate-pulse rounded-card bg-sand" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-xl bg-sand"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
