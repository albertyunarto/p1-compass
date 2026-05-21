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
      <div className={isHero ? "flex flex-col gap-3 sm:flex-row" : "flex gap-2"}>
        <div className="relative flex-1">
          <label htmlFor={`location-${variant}`} className="sr-only">
            Postal code, address or area
          </label>
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={
              "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted " +
              (isHero ? "h-5 w-5" : "h-4 w-4")
            }
          >
            <path
              d="M12 21s-6.5-5.2-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.8 12 21 12 21z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="10.5" r="2.4" fill="currentColor" />
          </svg>
          <input
            id={`location-${variant}`}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder={
              isHero
                ? "Postal code, address or area — e.g. Ang Mo Kio"
                : "Postal code or address"
            }
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? `location-err-${variant}` : undefined}
            className={
              "w-full bg-surface text-ink outline-none transition " +
              "placeholder:text-ink-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20 " +
              (error ? "border-near " : "border-line ") +
              (isHero
                ? "h-14 rounded-[14px] border-[1.5px] pl-12 pr-4 text-lg"
                : "h-11 rounded-xl border pl-10 pr-3 text-base")
            }
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={
            "shrink-0 rounded-[14px] bg-primary font-bold text-white shadow-sm " +
            "transition hover:bg-primary-dark active:scale-[0.99] disabled:opacity-60 " +
            (isHero ? "h-14 px-7 text-base" : "h-11 rounded-xl px-5 text-sm")
          }
        >
          {pending ? "Finding…" : isHero ? "Find schools →" : "Search"}
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
