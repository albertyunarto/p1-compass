"use client";

import dynamic from "next/dynamic";

/**
 * Client-only loader for `GeoMap`. Leaflet touches `window`, so the map
 * must not be server-rendered.
 */
export const GeoMapLazy = dynamic(
  () => import("./GeoMap").then((m) => m.GeoMap),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square w-full animate-pulse rounded-lg bg-sand/60" />
    ),
  },
);
