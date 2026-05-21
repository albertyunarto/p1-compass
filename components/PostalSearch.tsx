"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";

type Props = {
  variant?: "hero" | "compact";
  initialValue?: string;
  autoFocus?: boolean;
};

export function PostalSearch({
  variant = "hero",
  initialValue = "",
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isHero = variant === "hero";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clean = value.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) {
      setError("Enter all 6 digits of your home postal code.");
      return;
    }
    setError(null);
    track("postal_search", { postal: clean, variant });
    startTransition(() => {
      router.push(`/search?postal=${clean}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div
        className={
          isHero
            ? "flex flex-col gap-3 sm:flex-row"
            : "flex flex-row gap-2"
        }
      >
        <div className="relative flex-1">
          <label htmlFor={`postal-${variant}`} className="sr-only">
            Home postal code
          </label>
          <input
            id={`postal-${variant}`}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="postal-code"
            autoFocus={autoFocus}
            maxLength={6}
            placeholder={isHero ? "e.g. 569824" : "Postal code"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (error) setError(null);
            }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `postal-err-${variant}` : undefined}
            className={
              "w-full rounded-xl border bg-surface text-ink placeholder:text-ink-soft/60 " +
              "outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 " +
              (error ? "border-near " : "border-line ") +
              (isHero
                ? "h-14 px-5 text-lg tracking-[0.18em] font-medium"
                : "h-11 px-4 text-base tracking-[0.12em]")
            }
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={
            "shrink-0 rounded-xl bg-primary font-semibold text-white shadow-sm " +
            "transition hover:bg-primary-dark active:scale-[0.99] disabled:opacity-60 " +
            (isHero ? "h-14 px-7 text-lg" : "h-11 px-5 text-sm")
          }
        >
          {pending ? "Finding…" : isHero ? "Find schools" : "Search"}
        </button>
      </div>
      {error ? (
        <p
          id={`postal-err-${variant}`}
          role="alert"
          className="mt-2 text-sm font-medium text-near"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
