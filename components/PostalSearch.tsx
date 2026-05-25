"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { track } from "@/lib/analytics";
import { findSchools, type SchoolHit } from "@/lib/school-search";

type Props = {
  variant?: "hero" | "compact";
  initialValue?: string;
  autoFocus?: boolean;
};

type AddressSuggestion = {
  address: string;
  postal?: string;
  lat: number;
  lng: number;
};

type Item =
  | { kind: "school"; key: string; school: SchoolHit }
  | { kind: "address"; key: string; address: AddressSuggestion };

const ALL_DIGITS = /^\d+$/;
const POSTAL_RE = /^\d{6}$/;
const DEBOUNCE_MS = 180;
const MIN_QUERY = 2;

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s,/(-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

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
  const [addresses, setAddresses] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, AddressSuggestion[]>());

  const isHero = variant === "hero";
  const listboxId = useId();

  // School matches are computed client-side from the bundled slim index, so
  // they appear instantly without a network round-trip.
  const schools = useMemo<SchoolHit[]>(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY || POSTAL_RE.test(q)) return [];
    return findSchools(q, 5);
  }, [value]);

  // Combined ordered item list (schools first, then addresses) — drives
  // keyboard nav and rendering.
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    schools.forEach((s, i) =>
      out.push({ kind: "school", key: `s-${s.id}-${i}`, school: s }),
    );
    addresses.forEach((a, i) =>
      out.push({
        kind: "address",
        key: `a-${a.postal ?? "x"}-${i}`,
        address: a,
      }),
    );
    return out;
  }, [schools, addresses]);

  const navigateToSchool = useCallback(
    (s: SchoolHit) => {
      track("location_search", { variant, kind: "school", id: s.id });
      setOpen(false);
      setError(null);
      startTransition(() => {
        router.push(`/search?postal=${s.postal}&focus=${s.id}`);
      });
    },
    [router, variant],
  );

  const navigateToAddress = useCallback(
    (s: AddressSuggestion) => {
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

  const navigateToItem = useCallback(
    (it: Item) => {
      if (it.kind === "school") navigateToSchool(it.school);
      else navigateToAddress(it.address);
    },
    [navigateToSchool, navigateToAddress],
  );

  // Debounced address fetch (OneMap).
  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setAddresses([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    if (POSTAL_RE.test(q)) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    const cached = cache.current.get(q);
    if (cached) {
      setAddresses(cached);
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
          setAddresses([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        const list = data.suggestions ?? [];
        cache.current.set(q, list);
        setAddresses(list);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setAddresses([]);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [value]);

  // Keep highlight in range as the item list changes.
  useEffect(() => {
    if (items.length === 0) {
      setHighlight(-1);
    } else if (highlight < 0 || highlight >= items.length) {
      setHighlight(0);
    }
  }, [items, highlight]);

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
    if (open && highlight >= 0 && items[highlight]) {
      navigateToItem(items[highlight]);
      return;
    }
    const query = value.trim();
    if (!query) {
      setError("Enter a postal code, address, school or area.");
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
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Home") {
      setHighlight(0);
    } else if (e.key === "End") {
      setHighlight(items.length - 1);
    }
  }

  const showDropdown =
    open &&
    value.trim().length >= MIN_QUERY &&
    !POSTAL_RE.test(value.trim()) &&
    (items.length > 0 || loading);

  // Section header indices — so we can render a "Schools" / "Places" label
  // above the first item of each kind in the dropdown.
  const firstSchoolIdx = items.findIndex((it) => it.kind === "school");
  const firstAddressIdx = items.findIndex((it) => it.kind === "address");

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className={isHero ? "flex flex-col gap-3 sm:flex-row" : "flex gap-2"}>
        <div className="relative flex-1" ref={wrapRef}>
          <label htmlFor={`location-${variant}`} className="sr-only">
            Postal code, address, school or area
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
                ? "Postal code, address or school — e.g. ACS, SJI, Bishan"
                : "Postal, address or school"
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
              className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-96 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-[0_18px_40px_-12px_rgba(28,21,10,0.18)]"
            >
              {loading && items.length === 0 ? (
                <li className="px-3 py-2 text-sm text-ink-muted">Searching…</li>
              ) : null}

              {items.map((it, i) => {
                const isHi = i === highlight;
                const showSchoolHeader = i === firstSchoolIdx;
                const showAddressHeader = i === firstAddressIdx;
                return (
                  <span key={it.key} className="block">
                    {showSchoolHeader ? (
                      <li
                        role="presentation"
                        className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted"
                      >
                        Schools
                      </li>
                    ) : null}
                    {showAddressHeader ? (
                      <li
                        role="presentation"
                        className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted"
                      >
                        Places
                      </li>
                    ) : null}
                    <li
                      id={`${listboxId}-opt-${i}`}
                      role="option"
                      aria-selected={isHi}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => navigateToItem(it)}
                      className={
                        "flex cursor-pointer items-start gap-2.5 px-3 py-2 " +
                        (isHi ? "bg-sand/60" : "hover:bg-sand/40")
                      }
                    >
                      {it.kind === "school" ? (
                        <SchoolRow s={it.school} query={value} />
                      ) : (
                        <AddressRow s={it.address} query={value} />
                      )}
                    </li>
                  </span>
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

function SchoolRow({ s, query }: { s: SchoolHit; query: string }) {
  return (
    <>
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded bg-primary/10 px-1.5 text-[10px] font-bold uppercase tracking-wide text-primary"
      >
        {s.short || "P1"}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        <span className="block truncate text-ink">
          {highlightMatch(s.name, query)}
        </span>
        <span className="block text-xs text-ink-muted">
          Singapore {s.postal}
        </span>
      </span>
    </>
  );
}

function AddressRow({ s, query }: { s: AddressSuggestion; query: string }) {
  return (
    <>
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
          {highlightMatch(titleCase(s.address), query)}
        </span>
        {s.postal ? (
          <span className="block text-xs text-ink-muted">
            Singapore {s.postal}
          </span>
        ) : null}
      </span>
    </>
  );
}
