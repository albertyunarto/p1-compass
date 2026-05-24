"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { track } from "@/lib/analytics";

type Props = {
  variant?: "hero" | "compact";
  initialValue?: string;
  autoFocus?: boolean;
};

type Suggestion = {
  address: string;
  postal?: string;
  lat: number;
  lng: number;
};

const ALL_DIGITS = /^\d+$/;
const POSTAL_RE = /^\d{6}$/;
const DEBOUNCE_MS = 180;
const MIN_QUERY = 2;

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s,/(-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

/** Highlight the matched substring (case-insensitive) inside `text`. */
function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const lower = text.toLowerCase();
  const i = lower.indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-bold text-ink">
        {text.slice(i, i + q.length)}
      </strong>
      {text.slice(i + q.length)}
    </>
  );
}

export function PostalSearch({
  variant = "hero",
  initialValue = "",
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, Suggestion[]>());

  const isHero = variant === "hero";
  const listboxId = useId();

  const navigateToSuggestion = useCallback(
    (s: Suggestion) => {
      const target =
        s.postal && POSTAL_RE.test(s.postal)
          ? `/search?postal=${s.postal}`
          : `/search?q=${encodeURIComponent(s.address)}`;
      track("location_search", {
        variant,
        kind: "suggestion",
        hasPostal: Boolean(s.postal),
      });
      setOpen(false);
      setError(null);
      startTransition(() => {
        router.push(target);
      });
    },
    [router, variant],
  );

  // Debounced suggest fetch.
  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setSuggestions([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    // Skip the API when the user has typed an exact 6-digit postal — the
    // submit path resolves it directly via the offline index / OneMap.
    if (POSTAL_RE.test(q)) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const cached = cache.current.get(q);
    if (cached) {
      setSuggestions(cached);
      setHighlight(cached.length > 0 ? 0 : -1);
      return;
    }

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/onemap-suggest?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const list = data.suggestions ?? [];
        cache.current.set(q, list);
        setSuggestions(list);
        setHighlight(list.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (open && highlight >= 0 && suggestions[highlight]) {
      navigateToSuggestion(suggestions[highlight]);
      return;
    }
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
    setOpen(false);
    track("location_search", { variant, kind: isPostal ? "postal" : "text" });
    const href = isPostal
      ? `/search?postal=${query}`
      : `/search?q=${encodeURIComponent(query)}`;
    startTransition(() => {
      router.push(href);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Home") {
      setHighlight(0);
    } else if (e.key === "End") {
      setHighlight(suggestions.length - 1);
    }
  }

  const showDropdown =
    open &&
    value.trim().length >= MIN_QUERY &&
    !POSTAL_RE.test(value.trim()) &&
    (suggestions.length > 0 || loading);

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className={isHero ? "flex flex-col gap-3 sm:flex-row" : "flex gap-2"}>
        <div className="relative flex-1" ref={wrapRef}>
          <label htmlFor={`location-${variant}`} className="sr-only">
            Postal code, address or area
          </label>
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={
              "pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-muted " +
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
            ref={inputRef}
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
              setOpen(true);
              if (error) setError(null);
            }}
            onFocus={() => {
              if (value.trim().length >= MIN_QUERY) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={
              showDropdown && highlight >= 0
                ? `${listboxId}-opt-${highlight}`
                : undefined
            }
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

          {showDropdown ? (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-[0_18px_40px_-12px_rgba(28,21,10,0.18)]"
            >
              {loading && suggestions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-ink-muted">Searching…</li>
              ) : null}
              {suggestions.map((s, i) => {
                const primary = titleCase(s.address);
                return (
                  <li
                    key={`${s.postal ?? "x"}-${i}`}
                    id={`${listboxId}-opt-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => navigateToSuggestion(s)}
                    className={
                      "flex cursor-pointer items-start gap-2.5 px-3 py-2 " +
                      (i === highlight ? "bg-sand/60" : "hover:bg-sand/40")
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted"
                    >
                      <path
                        d="M12 21s-6.5-5.2-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.8 12 21 12 21z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="10.5" r="2.2" fill="currentColor" />
                    </svg>
                    <span className="min-w-0 flex-1 text-sm leading-snug text-ink-soft">
                      <span className="block truncate text-ink">
                        {highlightMatch(primary, value)}
                      </span>
                      {s.postal ? (
                        <span className="block text-xs text-ink-muted">
                          Singapore {s.postal}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
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
