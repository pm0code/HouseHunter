# Technology Audit — v1 (amended post-FOSS constraint)
## Project: Brooklyn Short-Term Rental Discovery Platform
**Original date:** 2026-05-23  
**Amended:** 2026-05-23 (FOSS/self-hosted/single-language constraints applied; architecture pivot to marketplace)  
**Auditor:** Claude Opus 4.7 (Master Architect Mandate active)  
**Scope:** Full stack audit reflecting PRD v2.1 — FOSS-only, self-hosted, single application language.  
**Verdict format:** CONFIRMED / CHANGE / CONCERN / RESOLVED per category.

---

## Amendment Note (v1 original → v1 amended)

After initial audit, three hard constraints were added to PRD v2.1:
1. **FOSS-only**: Every dependency must have an OSI-approved open source license.
2. **Self-hosted**: All services run on operator-controlled infrastructure via Docker Compose. No cloud platforms.
3. **Single application language**: TypeScript (Node.js runtime) — frontend, API, and enrichment job.

Additionally, the architecture pivoted from aggregator (scraping) to **marketplace** (landlord self-submission). This resolves Q1 (Furnished Finder ToS), Q2 (monetization), and Q3 (inquiry CTA) simultaneously.

All decisions below reflect the amended constraints.

---

## Audit Summary Table (Amended — Current State)

| Category | PRD v2 Proposal | v1 Verdict | **Amended Verdict** | **Current Stack** |
|---|---|---|---|---|
| Map renderer | Mapbox GL JS | CHANGE | **CONFIRMED** | MapLibre GL JS v5.24 |
| Map tiles | Mapbox tiles | CHANGE (→MapTiler) | **CHANGE** | PMTiles (Protomaps, self-hosted) |
| Walk-time routing | Mapbox Directions API | CONFIRMED (pre-compute) | **CHANGE** | OSRM v26.5 (self-hosted Docker, pedestrian profile) |
| Cache | Redis | — | **CHANGE** | Valkey 8 (BSD-3-Clause, LF fork of Redis) |
| ORM | Unspecified | ADD | **CONFIRMED** | Drizzle ORM |
| Language | Unspecified | ADD | **CONFIRMED** | TypeScript (Node.js 22 LTS) |
| CSS / UI | Unspecified | ADD | **CONFIRMED** | Tailwind CSS + shadcn/ui |
| State management | Unspecified | ADD | **CONFIRMED** | nuqs + Zustand + TanStack Query |
| Geocoding (ingest) | Mapbox Geocoding | CHANGE (→Geocodio) | **CHANGE** | Nominatim 4.x (self-hosted Docker) |
| Geocoding (user search) | Mapbox Geocoding | CONFIRMED | **CHANGE** | Nominatim 4.x (same self-hosted instance) |
| Listing source | Furnished Finder via Apify | CONCERN (Q1 blocker) | **RESOLVED** | Landlord self-submission marketplace |
| Crime / safety data | NYC Open Data NYPD | CONFIRMED | **CONFIRMED** | NYC Open Data NYPD |
| NTA polygon data | Unspecified (Q4) | RESOLVED | **CONFIRMED** | NYC Open Data 2020 NTAs (45 Brooklyn) |
| Subway station data | MTA GTFS CSV | UPGRADE | **CONFIRMED** | data.ny.gov Socrata (5f5g-n3cz) |
| Deployment | Unspecified | ADD (→Railway + Supabase) | **CHANGE** | Docker Compose (self-hosted) |
| Email | Unspecified | — | **ADD** | Nodemailer + Mailpit (dev SMTP) |

---

## 1. Map Renderer: CHANGE Mapbox GL JS → MapLibre GL JS

### Evidence

**Mapbox GL JS v2+:** Dropped BSD-3-Clause in December 2020. Now proprietary, requires a Mapbox access token, and the renderer is metered via Mapbox's billing. **Not FOSS-compatible. Eliminated.**

**MapLibre GL JS:** BSD-3-Clause fork of Mapbox GL JS v1, created 2021. Current version: **v5.24.0** (released April 23, 2026). GitHub: 10,700 stars, actively maintained. Backed by AWS (multi-year commitment through 2025), Microsoft (Gold Sponsor 2025), Meta, Esri. Confirmed support for all four features this project requires:
- GeoJSON layers ✓ (property pins, station markers)
- Choropleth fills ✓ (NTA safety overlay)
- Clustered markers ✓ (property density clustering)
- Custom vector tile sources ✓ (neighborhood boundaries)

**API compatibility:** ~95% compatible with Mapbox GL JS v1 API. Notable gap: `mapbox://` protocol URLs not supported — use raw tile URLs from PMTiles. None of the Mapbox v2/v3-specific features (globe view, Standard style, 3D terrain) are needed for this project.

### Decision

```
DECISION: MapLibre GL JS v5.24.0
LICENSE: BSD-3-Clause ✓ (OSI-approved)
GOVERNING RULE: FOSS-only constraint; PRD §12 license table
EVIDENCE: github.com/maplibre/maplibre-gl-js (BSD-3, 10.7k stars)
RATIONALE: Drop-in for all required features. BSD-licensed. Eliminates proprietary
           renderer lock-in and per-map-load billing entirely.
```

---

## 2. Map Tiles: CHANGE → PMTiles (Protomaps, self-hosted)

### Evidence

**MapTiler Cloud (v1 recommendation):** Free tier is cloud-hosted. Violates self-hosted constraint. **Eliminated.**

**OpenFreeMap:** Community-maintained CDN. No SLA, external infrastructure. Violates self-hosted constraint. **Eliminated.**

**Protomaps PMTiles:** A single-file tile archive format (`.pmtiles`) that encodes an entire OpenStreetMap base map. Served via HTTP Range requests — can be hosted as a static file from any web server (including Next.js). No tile server process required. NYC-region extract is ~2 GB and covers all needed territory.
- Library: MIT license
- OSM tile data: ODbL (Open Database License, OSI-compatible)
- Self-hosted: serve from Next.js static route or Docker-mounted volume
- Compatible with MapLibre GL JS via `pmtiles://` protocol URL

**Protomaps basemap styles:** Pre-built, open-source map styles designed for PMTiles. BSD-3-Clause. No Mapbox or MapTiler style dependency.

### Decision

```
DECISION: Protomaps PMTiles (NYC region extract, self-hosted)
LICENSE: MIT (library) + ODbL (OSM data) — both OSI-compatible ✓
GOVERNING RULE: FOSS-only + self-hosted constraints
EVIDENCE: docs.protomaps.com; protomaps.com/basemaps
RATIONALE: Single-file archive eliminates all external tile API calls. Served as a
           static asset. Zero per-tile cost. Full offline operation after download.
SETUP: Download NYC-region .pmtiles file once at bootstrap (~2 GB); place in
       public/ or a Docker volume; serve via Next.js static route.
```

---

## 3. Walk-Time Routing: CHANGE → OSRM (self-hosted Docker)

### Evidence

**Mapbox Directions API (v1 recommendation):** Proprietary, metered. Violates FOSS-only constraint. **Eliminated.**

**OSRM (Open Source Routing Machine):** BSD-2-Clause, self-hosted Docker image, sub-10ms queries for walking routes. Current version: v26.5 (May 2026). Process a NYC OSM extract with the pedestrian profile once; serve locally via the OSRM HTTP API. Each listing is enriched with walk_time_seconds and route GeoJSON at approval time — no runtime routing calls from the frontend.

**Architecture (unchanged from v1 pre-compute principle):**
1. At enrichment time (once per new listing approval): call OSRM locally for walk time + route polyline to nearest station.
2. Store `walk_time_seconds` (integer) and `route_geojson` (JSONB) in PostGIS with the listing record.
3. At render time: map reads pre-stored route GeoJSON — zero runtime routing API call.

**OSRM resource requirements:** Geofabrik `new-york-city.osm.pbf` (~500 MB). Processed graph: ~4 GB RAM during preprocessing, ~1 GB during serving. Docker image: `ghcr.io/project-osrm/osrm-backend`.

### Decision

```
DECISION: OSRM v26.5, self-hosted Docker, pedestrian profile, pre-compute at enrichment time
LICENSE: BSD-2-Clause ✓ (OSI-approved)
GOVERNING RULE: FOSS-only + self-hosted constraints
EVIDENCE: project-osrm.org; github.com/Project-OSRM/osrm-backend
RATIONALE: Eliminates all runtime routing costs. Pre-computation reduces OSRM
           calls from per-user-click to per-new-listing-approval (orders of magnitude
           less). Walk time is stable data — no need to recompute per session.
PORT: OSRM internal at :5000 (not exposed externally)
```

---

## 4. Cache: CHANGE Redis → Valkey 8

### Evidence

**Redis:** Changed license to SSPL (Server Side Public License) in March 2024. SSPL is not an OSI-approved open source license. **Not FOSS-compatible. Eliminated.**

**Valkey:** Linux Foundation-backed fork of Redis 7.2.4, created March 2024 in direct response to the Redis license change. License: BSD-3-Clause (OSI-approved). Wire-compatible with Redis — all Redis clients (ioredis, redis-py, etc.) work unchanged. Current version: Valkey 8.x. Actively maintained; AWS, Google Cloud, Oracle, and Ericsson are among the founding members of the Valkey project.

**Use in this project:** Valkey caches listing query results (keyed by filter hash), reducing repeated PostGIS queries for common filter combinations. Also used for rate-limiting the submission form.

### Decision

```
DECISION: Valkey 8 (drop-in Redis replacement)
LICENSE: BSD-3-Clause ✓ (OSI-approved)
GOVERNING RULE: FOSS-only constraint; Redis SSPL license is non-compliant
EVIDENCE: valkey.io; github.com/valkey-io/valkey; OSI SSPL ruling
RATIONALE: Wire-compatible with Redis — zero code change from Redis. BSD-3-Clause
           is fully OSI-approved. LF backing provides long-term maintenance guarantee.
PORT: Valkey at :6380 (not the Redis default :6379 — avoids dev conflicts)
CLIENT: ioredis (MIT) works unchanged against Valkey.
```

---

## 5. ORM: ADD Drizzle ORM (unspecified in PRD v2)

### Evidence

**Prisma (v7.8.0):** Declares geometry columns as `Unsupported("geometry")` — zero typed accessor support. All PostGIS queries must use `$queryRaw`. Issues #1798 (2020) and #25768 (2024) confirm no spatial support on the roadmap. **Eliminated.**

**postgres.js (v3.4.9):** Raw driver, full PostGIS access, no schema safety. Good for the enrichment job but insufficient alone for the Next.js API layer.

**Kysely (v0.29.2) + kysely-postgis:** Typed PostGIS function wrappers. Excellent ergonomics but `kysely-postgis` is a small community package (not in the kysely-org namespace). Single point of failure risk.

**Drizzle ORM (v0.45.2):**
- 34,500 GitHub stars, 8.7M weekly npm downloads
- Typed schema with native `geometry(Point)` column type (added v0.31.0, May 2024)
- Spatial predicates via `sql\`\`` template tags — partial raw SQL, but contained
- Same package works in Next.js API routes AND the enrichment job (TypeScript, tsx runtime)
- Apache 2.0 license ✓

### Decision

```
DECISION: Drizzle ORM v0.45.2+
LICENSE: Apache 2.0 ✓ (OSI-approved)
GOVERNING RULE: FOSS-only constraint; single-language constraint (same ORM for all TS layers)
EVIDENCE: orm.drizzle.team/docs/extensions/pg (geometry column support); GitHub 34.5k stars
RATIONALE: Best TypeScript + PostGIS balance. Single package for Next.js routes and
           enrichment job. Prisma eliminated by geometry unsupported wall.
```

---

## 6. Frontend Language: ADD TypeScript (unspecified in PRD v2)

### Evidence

- Next.js 15+ scaffolds TypeScript by default. `next.config.ts` ships natively in Next.js 15.
- **MapLibre GL JS:** Written entirely in TypeScript; built-in types, no `@types` package needed.
- PostGIS geometry columns: returned as WKB hex strings from the driver. Drizzle's `geometry(Point)` type handles this with a typed accessor.
- Single-language constraint: TypeScript covers frontend, Next.js API routes, and the enrichment job (run via `tsx`).

### Decision

```
DECISION: TypeScript (Node.js 22 LTS) throughout — frontend, API routes, enrichment job
LICENSE: Apache 2.0 (TypeScript compiler) ✓
GOVERNING RULE: PRD §3 single-application-language constraint
EVIDENCE: nextjs.org/docs/getting-started/installation (TS default); MapLibre source is TS
RATIONALE: Type safety prevents the category of bugs (null PostGIS result, wrong API shape)
           most likely to surface in a data-heavy map app. No tradeoff at setup time.
```

---

## 7. CSS / UI Components: ADD Tailwind CSS + shadcn/ui (unspecified in PRD v2)

### Evidence

**Required components:** Filter sidebar, price slider, date picker, subway line toggles, property cards, bottom-sheet mobile drawer, photo carousel.

**shadcn/ui:** Copy-into-repo model — zero runtime dependency on the library. Install per component. Compatible with Next.js 15 App Router and React 19 (confirmed). All required components available: `Sheet` (mobile bottom drawer), `Slider` (price range), `Calendar` + `Popover` (date picker), `ToggleGroup` (subway line filter), `Card` (property listing), `Carousel` (photo), `Form` (submission form). MIT license.

**Mantine UI:** All needed components present but every component is `'use client'` — no server component usage. Larger baseline bundle. Rejected.

**Tailwind alone:** Missing accessible Slider, Carousel, Drawer primitives. Rejected.

### Decision

```
DECISION: Tailwind CSS + shadcn/ui
LICENSE: MIT ✓ (both)
GOVERNING RULE: FOSS-only constraint; NFR-1 (< 2.0s P95 load); NFR-7 (WCAG 2.1 AA)
EVIDENCE: ui.shadcn.com/docs/installation/next (App Router); ui.shadcn.com/docs/react-19
RATIONALE: Zero-runtime-dependency model minimizes bundle size. All required UI components
           available. Radix UI primitives (used by shadcn/ui) are WCAG-compliant by default.
```

---

## 8. State Management: ADD nuqs + Zustand + TanStack Query (unspecified in PRD v2)

### Evidence

**Three distinct state domains:**

1. **Filter state** (price range, subway lines, walk time, date): survives page refresh, shareable via URL, SSR-readable. → **nuqs** (6 KB gzipped, `useState`-like API, Next.js App Router native ≥ 14.2, batch URL updates via `useQueryStates`). MIT license.

2. **Ephemeral UI state** (map viewport center/zoom/bounds, hovered property, selected property, panel visibility): changes on every map drag event — must not go in URL or trigger full-tree re-renders. → **Zustand** (1.1 KB, excellent TypeScript inference, client-only store). MIT license.

3. **Server state** (listings API data): async, cacheable, needs background refetch when filters change. → **TanStack Query** keyed off nuqs filter params. Handles caching, pagination, background revalidation. MIT license.

**React Context:** Rejected for filter and UI state — re-renders entire subtree on every change. Map drag events firing 60×/second would cause catastrophic performance.

### Decision

```
DECISION: nuqs (filter/URL state) + Zustand (ephemeral UI state) + TanStack Query (server state)
LICENSE: MIT ✓ (all three)
GOVERNING RULE: NFR-1 (< 2.0s P95 — no full-tree re-renders on map drag)
EVIDENCE: nuqs.dev; zustand docs; tanstack.com/query
RATIONALE: Each library owns exactly one state domain. Combination is the confirmed 2025
           production pattern for Next.js + map applications.
```

---

## 9. Geocoding: CHANGE → Nominatim 4.x (self-hosted Docker)

### Evidence

**Two geocoding use cases in v1:**
- Batch ingest (listing addresses → lat/lon): v1 recommended Geocodio ($1/1K). **Commercial SaaS. Violates FOSS-only + self-hosted constraints. Eliminated.**
- User-facing search (neighborhood/zip → bounding box): v1 recommended Mapbox Geocoding. **Proprietary. Violates FOSS-only constraint. Eliminated.**

**Nominatim 4.x:** OSM-based geocoding engine. GPL-3.0. Self-hosted Docker image. Excellent NYC dense-urban address quality (NYC has exceptional OSM coverage). Serves both use cases from a single local instance.
- Batch ingest geocoding: call Nominatim locally during enrichment job. No per-request cost. Results stored in PostGIS — no ToS restriction on storage.
- User-facing search: call Nominatim from the Next.js API route for neighborhood/zip → bounding box.

**Resource requirements:** Full NYC OSM import ~8 GB RAM and several hours of preprocessing. Brooklyn-only import is smaller. Confirm host resources before setup (Q7, open).

### Decision

```
DECISION: Nominatim 4.x, self-hosted Docker, serving both ingest and user-facing geocoding
LICENSE: GPL-3.0 ✓ (OSI-approved)
GOVERNING RULE: FOSS-only + self-hosted constraints
EVIDENCE: nominatim.org; hub.docker.com/r/mediagis/nominatim
RATIONALE: Single self-hosted instance replaces both Geocodio (commercial) and Mapbox
           Geocoding (proprietary). No per-request cost. No storage ToS restrictions.
PORT: Nominatim internal at :7070 (not exposed externally)
OPEN: Q7 — confirm RAM resources for NYC import before setup.
```

---

## 10. Listing Source: RESOLVED — Marketplace Pivot

### Evidence (from v1)

Every major rental platform (Furnished Finder, Craigslist, Zillow/HotPads, Zumper, PadMapper) explicitly prohibits automated data collection in their ToS and actively enforces it. Legal risk: **moderate-to-high**. There is no short-term rental platform with a public listing API or documented data partnership program for Brooklyn.

**Resolution:** Architecture pivots from **aggregator** (scraping data from third-party platforms) to **marketplace** (landlords self-submit listings directly). This is a structurally superior business model — landlords who list here chose to list here, producing higher intent and better conversion than scraped data.

**Three-tier data strategy:**
1. **Landlord self-submission** (primary, sustainable): public `/submit` form, email verification, tokenized edit links, admin approval queue
2. **Admin-seeded listings** (immediate, launch day): operator manually enters 50–100 listings sourced by browsing as a human — legally clean
3. **NYC STR Registry** (supplemental): public government dataset from `strr-portal.ose.nyc.gov` (Local Law 18) — used as outreach list to invite registered Brooklyn hosts to self-submit

### Decision

```
DECISION: RESOLVED — landlord self-submission marketplace model. Scraping eliminated entirely.
GOVERNING RULE: PRD §4 (Data Strategy); FOSS-only constraint (Apify = commercial SaaS)
EVIDENCE: All major rental platform ToS reviewed; NYC STR Registry confirmed public at OSE portal
RATIONALE: Self-submission eliminates Q1 (legal), enables Q2 (landlord monetization),
           and resolves Q3 (contact info captured at submission). Three blockers resolved
           by one architectural decision.
STATUS: Q1, Q2, Q3 all CLOSED. No open blockers remain.
```

---

## 11. Crime / Safety Data: CONFIRMED + Operational Detail

### Evidence

**NYPD Complaint Data via NYC Open Data — confirmed details:**
- Historic dataset endpoint: `https://data.cityofnewyork.us/resource/qgea-i56i.json`
- YTD dataset endpoint: `https://data.cityofnewyork.us/resource/5uac-w243.json`
- Brooklyn filter: `?boro_nm=BROOKLYN` (SoQL parameter)
- Rate limit: effectively unthrottled with a free registered app token (register at data.cityofnewyork.us)
- Update frequency: YTD dataset quarterly; Historic dataset annually
- No ToS restrictions on storage — public government data

### Decision

```
DECISION: NYC Open Data NYPD Complaint Data — download + store in PostGIS at bootstrap
LICENSE: NYC Open Data (public government data) ✓
GOVERNING RULE: FOSS-only + self-hosted constraints; PRD §5
EVIDENCE: data.cityofnewyork.us; dev.socrata.com/docs/app-tokens
OPERATIONAL NOTE: Register a free app token before running the bootstrap import script.
                  Token avoids IP-based rate limiting. Store in .env.local.
```

---

## 12. NTA Polygon Data: RESOLVED (was Q4)

### Evidence

**NYC Open Data 2020 NTA dataset:**
- URL: `https://data.cityofnewyork.us/City-Government/2020-Neighborhood-Tabulation-Areas-NTAs-/9nt8-h7nd`
- GeoJSON endpoint: `data.cityofnewyork.us/resource/9nt8-h7nd.geojson`
- Last updated: November 27, 2025
- Brooklyn NTA count: **45 NTAs** (2020 vintage redesign)
- Authoritative dataset from NYC Department of City Planning
- No ToS restrictions on storage — public government data

One-time import into PostGIS `nta_polygons` table. At enrichment time, each listing is assigned to an NTA via `ST_Within(listing.geom, nta.geom)`. Safety score is pre-computed as incidents per NTA per area.

```
DECISION: NYC Planning 2020 NTA GeoJSON → PostGIS nta_polygons table (one-time import)
LICENSE: NYC Open Data (public government data) ✓
GOVERNING RULE: PRD §7.2 FR-2.4 (NTA-level choropleth)
EVIDENCE: data.cityofnewyork.us (2020 NTAs, 45 Brooklyn, Nov 2025 update)
STATUS: Q4 CLOSED
```

---

## 13. Subway Station Data: UPGRADE Legacy CSV → data.ny.gov Socrata

### Evidence

**Legacy CSV (`web.mta.info/developers/data/nyct/subway/Stations.csv`):** Still live, 472 rows (all boroughs). Flat file, manual download.

**data.ny.gov Socrata endpoint (`5f5g-n3cz`):** Queryable via SoQL API. Filter `borough=BK` → ~170 Brooklyn stations. Structured (includes complex-level grouping, ADA fields). Download once, weekly refresh script.

### Decision

```
DECISION: data.ny.gov Socrata (5f5g-n3cz), filtered to borough=BK → PostGIS subway_stations
LICENSE: Open Data ✓
GOVERNING RULE: PRD §5; self-hosted constraint (download + store, no runtime external call)
EVIDENCE: data.ny.gov/Transportation/MTA-Subway-Stations-and-Complexes/5f5g-n3cz
RATIONALE: SoQL API allows programmatic refresh. 170 rows — negligible import. Station
           data stored in PostGIS; no runtime MTA API call needed.
```

---

## 14. Deployment: CHANGE → Docker Compose (self-hosted)

### Evidence

**Railway (v1 recommendation):** Cloud platform. Violates self-hosted constraint. **Eliminated.**

**Supabase (v1 recommendation):** Cloud SaaS. Violates self-hosted constraint. **Eliminated.**

**Docker Compose:** FOSS (Apache 2.0). Orchestrates all services on operator-controlled infrastructure (local machine for dev, own VPS or bare-metal for production). One `docker-compose.yml` defines the full stack.

**Services in Docker Compose:**
- `postgres`: PostgreSQL 17 + PostGIS 3.5 image (`postgis/postgis:17-3.5`) — port 5433
- `valkey`: Valkey 8 image (`valkey/valkey:8`) — port 6380
- `osrm`: OSRM backend (`ghcr.io/project-osrm/osrm-backend`) — port 5000
- `nominatim`: Nominatim (`mediagis/nominatim:4.x`) — port 7070
- `mailpit`: Mailpit dev SMTP (`axllent/mailpit`) — port 8025 (UI), 1025 (SMTP)
- `app`: Next.js 15 + enrichment job — port 3100

### Decision

```
DECISION: Docker Compose (self-hosted), all services on operator-controlled infrastructure
LICENSE: Apache 2.0 ✓ (Docker Compose)
GOVERNING RULE: FOSS-only + self-hosted constraints; PRD NFR-9 (docker compose up = full stack)
EVIDENCE: docs.docker.com/compose/
RATIONALE: NFR-9 mandates that `docker compose up` starts the full stack from scratch.
           Docker Compose is the only FOSS orchestrator that achieves this without Kubernetes
           overhead for a single-operator MVP.
PRODUCTION: Same Compose file, different .env — deploy on any Linux VPS (Hetzner CX32
            ~€8.50/month is suitable for MVP traffic).
```

---

## 15. Email: ADD Nodemailer + Mailpit

### Evidence

**Use cases:** (1) Submission confirmation + tokenized edit link to landlord. (2) Admin approval notification with approve/reject links. (3) "Listing is live" notification to landlord after approval.

**Nodemailer:** MIT, Node.js standard for SMTP email sending. Used in the Next.js API routes.

**Mailpit:** MIT, local SMTP server + web UI for dev. Captures all outgoing email for inspection at `:8025` without sending. Production replaces Mailpit with a real SMTP relay (Postfix in Docker, or a self-hosted MTA — Q8, open).

### Decision

```
DECISION: Nodemailer (MIT) for email sending; Mailpit (MIT) as dev SMTP server
LICENSE: MIT ✓ (both)
GOVERNING RULE: FOSS-only + self-hosted constraints; FR-5.3, FR-5.4, FR-5.5
EVIDENCE: nodemailer.com; mailpit.axllent.org
OPEN: Q8 — production SMTP strategy. Options: Postfix in Docker, or a lightweight
      FOSS SMTP relay. Decide before production launch.
```

---

## Decisions That Remain Open

| # | Question | Status |
|---|---|---|
| Q5 | WCAG colorblind-safe palette for NTA choropleth | Open |
| Q6 | Route GeoJSON: pre-compute OSRM result in PostGIS vs. real-time on pin click | Open — pre-compute recommended |
| Q7 | Nominatim resource requirements: full NYC vs. Brooklyn-only OSM import. Confirm host RAM before setup. | Open |
| Q8 | Production SMTP: Postfix in Docker vs. other self-hosted MTA. Decide before launch. | Open |

**All build blockers are closed.** Q1, Q2, Q3, Q4 resolved. Q5–Q8 are configuration decisions that do not block scaffolding or coding.

---

## Final Stack Summary (Current — Post-Constraint)

| Layer | **Current Stack** | License |
|---|---|---|
| **Application language** | TypeScript (Node.js 22 LTS) | Apache 2.0 |
| **Frontend framework** | Next.js 15 (App Router) | MIT |
| **Map renderer** | MapLibre GL JS v5.24 | BSD-3-Clause |
| **Map tiles** | Protomaps PMTiles (OSM, self-hosted) | ODbL / MIT |
| **CSS framework** | Tailwind CSS | MIT |
| **UI components** | shadcn/ui | MIT |
| **Filter state** | nuqs | MIT |
| **UI state** | Zustand | MIT |
| **Server state** | TanStack Query | MIT |
| **API layer** | Next.js API Routes | MIT |
| **ORM** | Drizzle ORM | Apache 2.0 |
| **Database** | PostgreSQL 17 + PostGIS 3.5 | PostgreSQL License / GPL-2+ |
| **Cache** | Valkey 8 | BSD-3-Clause |
| **Walk-time routing** | OSRM v26.5 (Docker, pedestrian) | BSD-2-Clause |
| **Geocoding** | Nominatim 4.x (Docker) | GPL-3.0 |
| **Email** | Nodemailer + Mailpit (dev) | MIT |
| **Containerization** | Docker + Docker Compose | Apache 2.0 |
| **Listing source** | Landlord self-submission marketplace | — |
| ~~Redis~~ | ~~Eliminated — SSPL not OSI-approved~~ | — |
| ~~Mapbox~~ | ~~Eliminated — proprietary~~ | — |
| ~~Apify / Playwright~~ | ~~Eliminated — scraping not viable~~ | — |
| ~~Railway / Supabase~~ | ~~Eliminated — cloud platforms~~ | — |
| ~~Geocodio~~ | ~~Eliminated — commercial SaaS~~ | — |
| ~~MapTiler~~ | ~~Eliminated — cloud-hosted~~ | — |

**Dev ports (conflict-free):**
- Next.js frontend + API: **3100**
- PostgreSQL + PostGIS: **5433**
- Valkey: **6380**
- OSRM: **5000** (internal)
- Nominatim: **7070** (internal)
- Mailpit UI: **8025** (dev only)
