"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";

type Props = {
  variant?: "hero" | "compact";
  initialValue?: string;
  autoFocus?: boolean;
};

const ALL_DIGITS = /^\d+$/;

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
    const query = value.trim();

    if (!query) {
      setError("Enter a postal code, address or area.");
      return;
    }
    // A purely numeric query is treated as a postal code — it must be 6 digits.
    const isPostal = ALL_DIGITS.test(query);
    if (isPostal && query.length !== 6) {
      setError("A postal code must be exactly 6 digits.");
      return;
    }

    setError(null);
    track("location_search", { variant, kind: isPostal ? "postal" : "text" });
    const href = isPostal
      ? `/search?postal=${query}`
      : `/search?q=${encodeURIComponent(query)}`;
    startTransition(() => {
      router.push(href);
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
          <label htmlFor={`location-${variant}`} className="sr-only">
            Postal code, address or area
          </label>
          <input
            id={`location-${variant}`}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder={
              isHero
                ? "Postal code, address or area — e.g. Ang Mo Kio"
                : "Postal code, address or area"
            }
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `location-err-${variant}` : undefined}
            className={
              "w-full rounded-xl border bg-surface text-ink placeholder:text-ink-soft/60 " +
              "outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 " +
              (error ? "border-near " : "border-line ") +
              (isHero ? "h-14 px-5 text-lg" : "h-11 px-4 text-base")
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
          id={`location-err-${variant}`}
          role="alert"
          className="mt-2 text-sm font-medium text-near"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
