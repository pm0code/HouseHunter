# HouseHunter Session Handoff — 2026-05-23 (Scaffolding Complete)

## Resume Command

```
/forensic-ground-truth

Resuming HouseHunter session from 2026-05-23 (scaffold session).

Handoff document: D:\projects\HouseHunter\docs\handoffs\HANDOFF_20260523_scaffold.md

Current state: Full project scaffold complete. 45 source files written.
No source has been installed or run yet (npm install not done).
Stack confirmed: Next.js 15 + TypeScript + MapLibre GL JS + PMTiles + Drizzle ORM
               + PostGIS + Valkey + OSRM + Nominatim + Nodemailer + Docker Compose

First action: Read this handoff. Then ask the user what to do next:
  Option A: `npm install` and verify the TypeScript compilation
  Option B: Implement a specific UI component or feature
  Option C: Run the stack end-to-end (docker compose up + bootstrap scripts)
```

---

## Session Summary

Technology audit updated to reflect FOSS/self-hosted constraints. Full project scaffold
written from scratch: 45 source files covering Docker Compose, package.json, TypeScript
config, Drizzle schema, API routes, UI components, bootstrap scripts, and enrichment pipeline.
No code has been installed or executed.

---

## Completed Work This Session

- [x] **Tech audit updated** — `docs/tech-audit/technology_audit_v1.md` amended to reflect:
  - PMTiles self-hosted (not MapTiler cloud)
  - OSRM self-hosted (not Mapbox Directions)
  - Nominatim self-hosted (not Geocodio or Mapbox Geocoding)
  - Valkey (not Redis — SSPL not FOSS-approved)
  - Docker Compose (not Railway/Supabase)
  - Listing source RESOLVED (marketplace pivot — not Furnished Finder CONCERN)
  - Full FOSS license table and open questions updated

- [x] **docker-compose.yml** — PostgreSQL/PostGIS :5433, Valkey :6380, Mailpit :8025, OSRM :5000 (profile: enrichment), Nominatim :7070 (profile: enrichment)

- [x] **package.json** — all production and dev dependencies, npm scripts

- [x] **TypeScript/Next.js config** — tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs, drizzle.config.ts

- [x] **Core types** — `src/types/index.ts` (PublishedListing, ListingFilters, etc.)

- [x] **Database schema** — `src/lib/db/schema.ts` (listings, subway_stations, nta_polygons, nta_safety_scores with PostGIS geometry columns)

- [x] **Database client** — `src/lib/db/index.ts` (Drizzle + postgres.js, port 5433)

- [x] **Valkey client** — `src/lib/valkey.ts` (ioredis singleton, port 6380, global hot-reload safe)

- [x] **Token generator** — `src/lib/tokens.ts` (nanoid, 48-char, 286 bits entropy)

- [x] **Email** — `src/lib/email.ts` (Nodemailer + Mailpit; 4 email templates: submission confirmation, admin approval request, listing live, rejection notice)

- [x] **Enrichment pipeline** — `src/lib/enrichment.ts` (Nominatim geocode → OSRM walk route → PostGIS ST_Within NTA → safety score → publish listing)

- [x] **Zustand store** — `src/store/map.ts` (viewport, hovered/selected listing, safety overlay toggle)

- [x] **App shell** — `src/app/layout.tsx` (NuqsAdapter + QueryClientProvider), `src/app/page.tsx`, `src/app/globals.css`

- [x] **Map components** — `MapLayout.tsx` (split view), `MapView.tsx` (MapLibre GL JS + PMTiles, property pins, clustering, hover/click handlers)

- [x] **Listing components** — `ListingList.tsx` (scrollable card list), `PropertyDetailPanel.tsx` (detail + Contact Landlord CTA)

- [x] **Filter component** — `FilterPanel.tsx` (price slider, subway line toggles, walk time toggles)

- [x] **Hooks** — `useListingFilters.ts` (nuqs URL state), `useListings.ts` (TanStack Query)

- [x] **API routes**:
  - `GET /api/listings` — filtered listing query with Valkey cache
  - `GET /api/listings/[id]` — single listing with Valkey cache
  - `POST /api/submit` — multipart form, photo upload, token generation, dual emails
  - `GET /api/approve/[token]` — enriches listing, publishes, busts cache, emails landlord
  - `GET /api/reject/[token]` — rejects listing, emails landlord
  - `GET /api/edit/[token]` — returns listing for landlord to edit
  - `PATCH /api/edit/[token]` — saves edits or removes listing, busts cache

- [x] **Submit page** — `src/app/submit/page.tsx` (multi-field form with react-hook-form + zod, photo upload, success state)

- [x] **Edit page** — `src/app/edit/[token]/page.tsx` (landlord self-service edit/remove via tokenized URL)

- [x] **Bootstrap scripts**:
  - `scripts/bootstrap/import-stations.ts` — upserts Brooklyn subway stations from data.ny.gov Socrata
  - `scripts/bootstrap/import-nta.ts` — upserts 45 Brooklyn NTA polygons from NYC Open Data
  - `scripts/bootstrap/import-nypd.ts` — computes NTA safety scores from NYPD complaint data
  - `scripts/enrich-listing.ts` — manual enrichment runner (re-enriches a listing by ID)

- [x] **DB init SQL** — `db/init/001_extensions.sql` (PostGIS + pg_trgm extensions, auto-run by Docker on first start)

- [x] **Gitkeeps** — `public/tiles/`, `public/uploads/`, `data/osrm/`, `db/migrations/meta/`

---

## Architecture State

```
src/
  app/
    layout.tsx            ← NuqsAdapter + QueryClientProvider
    page.tsx              ← MapLayout (server shell)
    globals.css           ← MapLibre CSS + Tailwind + CSS vars
    submit/page.tsx       ← Public listing submission form
    edit/[token]/page.tsx ← Landlord tokenized edit/remove page
    api/
      listings/route.ts          ← GET — filtered listings + Valkey cache
      listings/[id]/route.ts     ← GET — single listing
      submit/route.ts            ← POST — form submission + photo upload
      approve/[token]/route.ts   ← GET — admin approve link
      reject/[token]/route.ts    ← GET — admin reject link
      edit/[token]/route.ts      ← GET/PATCH — landlord edit API
  components/
    providers/QueryProvider.tsx  ← TanStack Query client
    map/MapLayout.tsx            ← Split-view layout (60/40)
    map/MapView.tsx              ← MapLibre GL JS + PMTiles + pins
    listings/ListingList.tsx     ← Scrollable listing cards
    listings/PropertyDetailPanel.tsx ← Detail + contact CTA
    filters/FilterPanel.tsx      ← Price/line/walk time filters
  hooks/
    useListingFilters.ts   ← nuqs URL state hook
    useListings.ts         ← TanStack Query for listings API
  lib/
    db/schema.ts     ← Drizzle schema (all 4 tables)
    db/index.ts      ← Drizzle client (postgres.js, port 5433)
    valkey.ts        ← ioredis singleton (port 6380)
    tokens.ts        ← nanoid token generator
    email.ts         ← Nodemailer email templates
    enrichment.ts    ← Geocode → route → NTA → publish pipeline
    utils.ts         ← shadcn/ui cn() utility
  store/map.ts       ← Zustand map state
  types/index.ts     ← Shared TypeScript types
scripts/
  bootstrap/import-stations.ts  ← Subway station import
  bootstrap/import-nta.ts       ← NTA polygon import
  bootstrap/import-nypd.ts      ← Safety score computation
  enrich-listing.ts             ← Manual enrichment runner
db/
  init/001_extensions.sql       ← PostGIS extension (Docker auto-run)
  migrations/meta/              ← Drizzle migration metadata (generated)
```

---

## Critical Notes for Next Session

### What is NOT done yet (next work items)

1. **`npm install` has not been run** — run before anything else
2. **Drizzle migration generation** — run `npm run db:generate` to generate SQL from schema, then `npm run db:migrate` to apply
3. **Protomaps basemap style** — `MapView.tsx` has an empty `layers: []` in the map style object. The base map tiles won't render until a proper Protomaps style is configured. Options:
   - Download a Protomaps basemap style JSON (from `protomaps.com/basemaps`) and bundle it locally
   - Reference the Protomaps CDN style URL in dev (not self-hosted but acceptable for local dev)
   - The listing pins and interactions WILL work regardless — only the base map background is missing
4. **shadcn/ui components** — UI is built with raw HTML/Tailwind + Radix UI. `shadcn@latest init` and component installs have not been run. Consider: `npx shadcn@latest init` then `npx shadcn@latest add slider sheet carousel card form toggle-group`
5. **Google Fonts (next/font/google)** — layout.tsx uses Inter from Google Fonts. Downloads at build time, not a runtime call, but violates the spirit of "no external dependencies at runtime." Replace with a locally hosted font if strict FOSS self-hosting is required.
6. **OSRM preprocessing** — requires a one-time setup (see docker-compose.yml comments). Data directory: `data/osrm/`
7. **Nominatim import** — requires setting `NOMINATIM_PBF_URL` and running `docker compose --profile enrichment up nominatim`. Takes several hours for full NYC import.
8. **Mobile layout** — `FilterPanel` and `ListingList` are desktop-only. The shadcn `Sheet` bottom drawer for mobile is not yet wired (FR-4.1).

### Known Technical Decisions

- `MapView.tsx` uses `dynamic(() => import(...), { ssr: false })` in MapLayout — MapLibre must not run on the server. This is correct.
- Valkey/ioredis uses `globalThis.valkey` singleton pattern — prevents multiple connections during Next.js HMR in dev.
- `import-nypd.ts` uses a VALUES-list approach for PostGIS spatial join — capped at 50,000 complaints to avoid huge queries. Full dataset has ~300K rows/year for Brooklyn. For a production import, use PostgreSQL COPY instead.
- The `approvalToken` and `submissionToken` are both 48-char random strings (286 bits entropy) — unguessable for MVP scale.

### Open Questions (unchanged from PRD v2.1 §13)

| # | Question | Status |
|---|---|---|
| Q5 | WCAG colorblind palette for choropleth | Open |
| Q6 | Route GeoJSON: pre-compute in PostGIS (recommended) vs real-time OSRM | Open |
| Q7 | Nominatim RAM: full NYC vs Brooklyn-only OSM import | Open |
| Q8 | Production SMTP: Postfix in Docker vs other self-hosted MTA | Open |

---

## Ports Reference

| Service | Port |
|---|---|
| Next.js (frontend + API) | **3100** |
| PostgreSQL + PostGIS | **5433** |
| Valkey | **6380** |
| OSRM (pedestrian routing) | **5000** |
| Nominatim (geocoding) | **7070** |
| Mailpit (dev SMTP UI) | **8025** |
