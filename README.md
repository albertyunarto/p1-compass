# P1 Compass

A free web tool that helps Singapore parents make data-driven Primary 1 school
choices. Enter a postal code to see every primary school within 2 km, plotted on
a distance-band map, with multi-year ballot history and a personalised read on
each school's Phase 2C feasibility.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript
- Tailwind CSS v4 · Fraunces + Manrope typography
- OneMap geocoding (with a postal-sector fallback)
- Bun as the package manager

## Getting started

```bash
bun install
bun dev          # http://localhost:3000
```

Other scripts:

```bash
bun run build    # production build + type check
bun run lint     # eslint
```

## Environment

Copy `.env.example` to `.env.local`. Everything is optional — the app falls back
to a bundled postal-sector centroid table when OneMap is unavailable.

| Variable | Purpose |
| --- | --- |
| `ONEMAP_TOKEN` | A ready OneMap access token (expires ~3 days). |
| `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` | OneMap credentials — the app fetches and caches tokens itself. |
| `GEMINI_API_KEY` | Enables AI admission recommendations in the school detail view. The section is hidden when unset. |
| `GEMINI_MODEL` | Overrides the Gemini model (defaults to `gemini-2.5-flash`). |
| `NEXT_PUBLIC_POSTHOG_KEY` | Enables PostHog event tracking when set. |

## Data

Three data files are committed:

| File | Contents |
| --- | --- |
| `data/schools.json` | The 184 schools — real coordinates; ballot history is synthetic. |
| `data/postal_coords.json` | Offline geocoder: ~120k Singapore postal codes → coordinates. |
| `data/postal_sectors.json` | Coarse postal-sector centroids (last-resort fallback). |

Regenerate them:

```bash
bun run build:postal   # rebuilds data/postal_coords.json from the open dataset
bun run build:data     # rebuilds data/schools.json
```

School **coordinates** are real (OneMap-derived); **ballot history** is synthetic
and illustrative — not official MOE figures. `build:data` geocodes each school
by name through OneMap when reachable, otherwise it uses the curated coordinates
baked into the script.

## Routes

- `/` — landing page with the postal-code search
- `/search?postal=NNNNNN` — results: distance map + school list + detail modals
- `/about` — methodology and data sources
- `/api/geocode?postal=NNNNNN` — postal → `{ lat, lng, address }`
- `/api/schools` — the static school dataset
- `/api/recommend` — `POST` school + distance → AI admission recommendations (Gemini)

P1 Compass is a planning aid only. Registration happens on MOE's official portal.
