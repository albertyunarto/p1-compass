"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { track } from "@/lib/analytics";

/** The geocoded home location a shortlist's distances are measured from. */
export type ShortlistOrigin = {
  postal: string;
  address: string;
  lat: number;
  lng: number;
};

type ShortlistValue = {
  ids: string[];
  origin: ShortlistOrigin | null;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setOrigin: (origin: ShortlistOrigin) => void;
};

const ShortlistCtx = createContext<ShortlistValue | null>(null);

const IDS_KEY = "p1c_shortlist:v1";
const ORIGIN_KEY = "p1c_origin:v1";

/** Shortlist state shared across the results and compare pages, persisted to localStorage. */
export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [origin, setOriginState] = useState<ShortlistOrigin | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state once on mount (client only).
  useEffect(() => {
    void (async () => {
      try {
        const rawIds = localStorage.getItem(IDS_KEY);
        if (rawIds) setIds(JSON.parse(rawIds) as string[]);
        const rawOrigin = localStorage.getItem(ORIGIN_KEY);
        if (rawOrigin) setOriginState(JSON.parse(rawOrigin) as ShortlistOrigin);
      } catch {
        // ignore unavailable / malformed storage
      }
      setHydrated(true);
    })();
  }, []);

  // Persist id changes after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(IDS_KEY, JSON.stringify(ids));
    } catch {
      // ignore quota / unavailable storage
    }
  }, [ids, hydrated]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const present = prev.includes(id);
      track(present ? "shortlist_remove" : "shortlist_add", { school: id });
      return present ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const setOrigin = useCallback((next: ShortlistOrigin) => {
    setOriginState(next);
    try {
      localStorage.setItem(ORIGIN_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ShortlistValue>(
    () => ({
      ids,
      origin,
      has: (id) => ids.includes(id),
      toggle,
      remove,
      clear,
      setOrigin,
    }),
    [ids, origin, toggle, remove, clear, setOrigin],
  );

  return (
    <ShortlistCtx.Provider value={value}>{children}</ShortlistCtx.Provider>
  );
}

export function useShortlist(): ShortlistValue {
  const ctx = useContext(ShortlistCtx);
  if (!ctx) {
    throw new Error("useShortlist must be used within ShortlistProvider");
  }
  return ctx;
}
