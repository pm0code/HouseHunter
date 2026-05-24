# Product Requirements Document — v2.1
## Project: Brooklyn Short-Term Rental Discovery Platform
**Version:** 2.1  
**Date:** 2026-05-23  
**Status:** MVP Scope Locked — Stack Finalized — All Blockers Resolved  
**Supersedes:** v2.0 (2026-05-23)

### Change Log (v2.0 → v2.1)
| # | Change | Reason |
|---|---|---|
| 1 | Added hard constraint: FOSS-only, self-hosted, no cloud dependencies | Architecture directive |
| 2 | Single application language: TypeScript | Reduce complexity; avoid polyglot overhead |
| 3 | Mapbox GL JS → MapLibre GL JS | Mapbox GL JS v2+ is proprietary (ToS-locked, metered) |
| 4 | Mapbox tiles → PMTiles (Protomaps, self-hosted) | Eliminate all Mapbox dependency |
| 5 | Mapbox Directions API → OSRM (self-hosted Docker) | FOSS, no per-request cost |
| 6 | Mapbox Geocoding + Geocodio → Nominatim (self-hosted Docker) | FOSS, no per-request cost |
| 7 | Redis → Valkey | Redis switched to SSPL in March 2024 (not FOSS-approved); Valkey is the LF-backed BSD-3 fork |
| 8 | Playwright/scraping → Landlord self-submission marketplace model | Every major rental platform prohibits automated access with active legal enforcement. No scraping path is legally clean. Self-submission eliminates Q1, Q2, and Q3 simultaneously. |
| 9 | Supabase + Railway → Docker Compose (self-hosted) | No cloud platforms; full local/own-server deployment |
| 10 | Drizzle ORM added | ORM unspecified in v2.0; Drizzle is the correct PostGIS-compatible choice |
| 11 | Tailwind CSS + shadcn/ui added | UI stack unspecified in v2.0 |
| 12 | nuqs + Zustand + TanStack Query added | State management unspecified in v2.0 |
| 13 | Walk-time: pre-compute at ingest | Reduces OSRM calls from per-click to per-new-listing |
| 14 | Subway data: data.ny.gov Socrata → downloaded and stored in PostGIS | Eliminate runtime external API dependency |
| 15 | NTA polygons: NYC Open Data 2020 GeoJSON → imported to PostGIS | Q4 resolved; local storage eliminates external call |
| 16 | NFR-2 rewritten | No API costs; NFR now covers infrastructure cost target |
| 17 | NFR-3 corrected | NYPD YTD data updates quarterly, not monthly |
| 18 | Yelp Fusion (Phase v2.2) → OpenStreetMap Overpass API | Yelp Fusion is not FOSS |
| 19 | NYC STR Registry added as supplemental data source | Public government dataset (Local Law 18); legal, no ToS; provides verified STR listing URLs and landlord outreach list |
| 20 | Q1 CLOSED | Data strategy pivot: aggregation → marketplace. No open blockers remain. |

---

### 1. Executive Summary

A map-centric web application that helps users find furnished short-term rentals (1–2 months) in Brooklyn, NY. The platform layers subway proximity, neighborhood safety signals, and pricing onto an interactive map, eliminating the need to cross-reference multiple sites manually.

MVP is scoped to a single borough (Brooklyn). The entire stack is **Free and Open Source Software (FOSS)**, self-hosted on operator-controlled infrastructure with no cloud platform dependencies, no SaaS subscriptions, and no per-request API costs at runtime.

---

### 2. Target Audience & User Personas

| Persona | Profile | Primary Need |
|---|---|---|
| **The Relocator** | Young professional on a short-term contract (e.g., 6–10 weeks) | Move-in ready furnished unit, near express subway to Midtown/Downtown |
| **The Digital Nomad** | Remote worker, no fixed schedule, stays 4–8 weeks | Safe, walkable neighborhood; flexible lease start |
| **The Student/Intern** | Intern or grad student, budget-conscious, summer or semester term | Affordable furnished studio, near safe subway, quick commute |

All three prioritize: **furnished**, **flexible terms**, **near subway**, **safe block**.

---

### 3. MVP Scope & Constraints

**In scope for MVP:**
- Brooklyn, NY only
- Studio and 1BR furnished apartments
- Lease terms: 30–90 days, flexible start dates
- Core map layers: subway stations, neighborhood safety score, property pins
- Price filter (budget slider)
- Walk time to subway (pre-computed on listing approval, displayed on pin click)
- Inquiry handoff (contact landlord via email — no in-app booking)
- Landlord self-submission form (public, no auth required)
- Admin approval workflow (email-based, no admin UI needed)

**Explicitly out of scope for MVP:**
- Other boroughs or cities
- Isochrone polygon rendering (deferred to feature v2.1)
- Crime hex-bin heatmap (deferred to feature v2.1; safety score used instead)
- Amenities layer (deferred to feature v2.2)
- In-app booking / payment
- Scam prevention module (deferred to feature v2.2)
- Native mobile app
- User accounts / saved searches

**Hard constraints (non-negotiable):**
- **FOSS only**: Every tool, library, and runtime must have an OSI-approved open source license. No proprietary SDKs, no commercial SaaS APIs, no vendor lock-in.
- **Self-hosted**: All services run on operator-controlled infrastructure (local machine for development, own server for production). Zero runtime dependency on cloud platforms (no Vercel, Railway, Supabase, Mapbox, AWS, GCP, Azure, etc.).
- **Single application language**: TypeScript (Node.js runtime) for all application code — frontend, backend API, and ingestion job. SQL (embedded via Drizzle ORM) is the query language; YAML is used for Docker configuration. No additional runtime languages.

---

### 4. Listing Inventory Strategy

**Q1 CLOSED. No open blockers.**

Every major rental aggregator (Furnished Finder, Craigslist, Zillow/HotPads, Zumper, PadMapper) prohibits automated data collection in their ToS and actively enforces it. Scraping is not a viable path. The platform pivots from **aggregator** to **marketplace**: landlords submit their own listings directly.

This is a better business model — landlords who list here chose to list here, producing higher intent and better conversion than scraped data.

#### Data Strategy

**Tier 1 — Landlord self-submission (primary, sustainable)**
- Landlords submit listings via a form on the platform (no auth required in MVP — email verification only)
- Admin reviews and approves before publishing (email-based queue, no admin UI in MVP)
- Landlord retains control: can update or remove their listing via a tokenized link emailed at submission
- Launch outreach: contact Brooklyn landlords identified via NYC STR Registry and HPD data as a cold outreach list

**Tier 2 — Admin-seeded listings (immediate, for launch day)**
- Operator manually enters 50–100 real Brooklyn furnished listings sourced by browsing Furnished Finder as a human (reading, not automated — legally clean)
- This seeds the map with real data on day one while self-submission ramp-up occurs
- Estimated time: 1–2 person-days for 100 listings

**Tier 3 — NYC STR Registry (supplemental enrichment)**
- NYC Local Law 18 (effective Sept 2023) requires registration of all short-term rentals
- The NYC Office of Special Enforcement publishes a **public STR Registration Dataset** at `strr-portal.ose.nyc.gov` — legally queryable government data, no ToS restrictions
- Dataset contains: registration status, address, unit, borough, zip, booking service, listing URL
- Use as an outreach list to contact registered Brooklyn hosts and invite self-submission
- Note: Local Law 18 covers rentals < 30 days; data is supplemental, not the primary inventory

**Future tiers (post-MVP)**
- Direct B2B data agreements with Blueground, Kasa, Landing if volume justifies it
- Property management companies as bulk submitters

#### Required Fields per Listing (Submission Form)

| Field | Required | Notes |
|---|---|---|
| Address | Yes | Geocoded by Nominatim at ingest |
| Unit type | Yes | Studio / 1BR / 2BR |
| Furnished | Yes | Default yes (filter) |
| Available from | Yes | Date picker |
| Available to | Yes | Date picker |
| Monthly price | Yes | All-in or base rent (flag if utilities separate) |
| Utilities included | Yes | Yes / No / Partial |
| Broker fee | Yes | Yes / No |
| Security deposit | Yes | Amount in $ |
| Photos | Yes | Min 3, uploaded to local storage |
| Contact method | Yes | Email (required) + optional phone |
| Landlord name / company | Yes | For admin review |
| Submission token | Auto | Emailed to landlord; used for edit/remove |

---

### 5. Data Sources & Integrations

All data sources are either public government datasets (free, no ToS restrictions on storage) or self-hosted FOSS services. No runtime calls to commercial APIs.

| Data | Source | Delivery | License | Refresh |
|---|---|---|---|---|
| **Listings** | Landlord self-submission form + admin seed | Form → PostGIS (with admin approval) | N/A — operator-owned data | On submission / on admin approval |
| **STR outreach list** | NYC STR Registry (`strr-portal.ose.nyc.gov`) | Downloaded → outreach CSV | NYC Open Data (public) | Quarterly |
| **Base map tiles** | Protomaps / OpenStreetMap | PMTiles file, self-hosted | ODbL (OSM data), MIT (pmtiles library) | Quarterly re-download |
| **Subway stations** | data.ny.gov Socrata (`5f5g-n3cz`) | One-time download → PostGIS; weekly refresh | Open Data | Weekly |
| **Walk-time routing** | OSRM (self-hosted Docker) | Queried at ingest time; results stored in PostGIS | BSD-2-Clause | On new listing approval |
| **Geocoding** | Nominatim (self-hosted Docker) | Queried at ingest time; results stored in PostGIS | GPL-3.0 | On new listing approval |
| **Crime / Safety** | NYC Open Data — NYPD Complaint Data | Downloaded via Socrata API → PostGIS; score pre-computed | Open Data (free) | Quarterly (dataset update cadence) |
| **NTA polygons** | NYC Open Data 2020 NTAs | One-time GeoJSON download → PostGIS | Open Data | Annual (or on DCP update) |

**Eliminated (vs prior versions):**
- Mapbox GL JS, Mapbox Directions API, Mapbox Geocoding API — proprietary, metered
- Apify, Playwright (scraping) — all rental platforms prohibit automated access; scraping is not a viable path
- Geocodio — commercial; replaced by Nominatim
- Supabase, Railway — cloud platforms; replaced by Docker Compose
- Redis — SSPL license (not OSI-approved); replaced by Valkey
- Yelp Fusion — commercial; replaced by OSM Overpass (Phase v2.2)
- MTA legacy CSV — replaced by structured Socrata endpoint

---

### 6. System Architecture

#### 6.1 Technology Stack

**Governing principle:** One application language (TypeScript). One query language (SQL via Drizzle). FOSS licenses only. Self-hosted via Docker Compose.

| Layer | Technology | License | Rationale |
|---|---|---|---|
| **Application language** | TypeScript (Node.js 22 LTS) | MIT | Single language across all application layers. Eliminates context-switching between frontend, API, and ingestion code. |
| **Frontend framework** | Next.js 15 (App Router) | MIT | SSR for SEO on listing pages; API routes handle listing queries and the submission form; no separate Express service needed |
| **Map renderer** | MapLibre GL JS v5.24 | BSD-3-Clause | Drop-in for all required features (GeoJSON, choropleth, clusters, vector tiles); BSD-licensed; backed by AWS and Microsoft |
| **Map tiles** | Protomaps PMTiles (OSM data) | ODbL / MIT | Self-hosted single-file tile archive; no external tile API; HTTP range request served from Next.js |
| **Map style** | Protomaps basemap themes | BSD-3-Clause | Pre-built styles designed for PMTiles; no MapTiler or Mapbox style dependency |
| **CSS framework** | Tailwind CSS | MIT | Utility-first; minimal bundle size; pairs with shadcn/ui |
| **UI components** | shadcn/ui | MIT | Copy-into-repo model; zero runtime dependency; all required components available (Slider, Sheet, Calendar, Carousel, ToggleGroup, Card, Form) |
| **Filter state** | nuqs | MIT | URL-synchronized filter state (price, lines, walk time, dates); shareable links; SSR-readable; Next.js App Router native |
| **UI state** | Zustand | MIT | Ephemeral client state (map viewport, hover, selected property, panel visibility); 1.1 KB |
| **Server state** | TanStack Query | MIT | Listings API fetching, caching, and background refetch; keyed off nuqs filter params |
| **API layer** | Next.js API Routes | MIT | Handles listing queries, filter application, property detail, and listing submission. No separate service for MVP. |
| **Enrichment job** | Node.js script (TypeScript via tsx) | MIT | Triggered on new listing approval; geocodes address via Nominatim, computes walk time via OSRM, assigns NTA safety score, stores results in PostGIS |
| **ORM / query builder** | Drizzle ORM | Apache 2.0 | Best TypeScript + PostGIS balance; spatial predicates via `sql\`\`` template; same package in API routes and enrichment job |
| **Database** | PostgreSQL 17 + PostGIS 3.5 | PostgreSQL License / GPL-2+ | Spatial indexing (GIST) for proximity queries; ST_DWithin, ST_Within, ST_AsGeoJSON |
| **Cache** | Valkey 8 | BSD-3-Clause | FOSS fork of Redis (Redis switched to SSPL March 2024 — not OSI-approved). Wire-compatible: all Redis clients work unchanged |
| **Walk-time routing** | OSRM v26.5 (Docker, pedestrian profile) | BSD-2-Clause | Self-hosted; no per-request cost; sub-10ms query response; NYC OSM extract preprocessed at setup |
| **Geocoding** | Nominatim 4.x (Docker) | GPL-3.0 | Self-hosted; OSM-based; excellent NYC dense-urban address quality |
| **File storage** | Local filesystem (Docker volume) | N/A | Listing photos stored in a mounted volume; served via Next.js `/public` or a dedicated static route |
| **Email** | Nodemailer + local SMTP (Mailpit in dev) | MIT | Submission confirmation and tokenized edit-link emails; no cloud email provider |
| **Containerization** | Docker + Docker Compose | Apache 2.0 | Orchestrates all services (Postgres/PostGIS, Valkey, OSRM, Nominatim, Next.js, enrichment job, Mailpit) |

#### 6.2 Service Topology (Docker Compose)

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Compose                           │
│                                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  Next.js     │   │  PostgreSQL  │   │   Valkey         │ │
│  │  :3100       │──▶│  + PostGIS   │   │   :6380          │ │
│  │  (web + API  │   │  :5433       │   └──────────────────┘ │
│  │  + sub form) │   └──────┬───────┘                        │
│  └──────────────┘          │                                 │
│                             │                                 │
│  ┌──────────────┐   ┌──────▼───────┐   ┌──────────────────┐ │
│  │  Enrichment  │   │    OSRM      │   │   Nominatim      │ │
│  │  job (tsx)   │──▶│  :5000       │   │   :7070          │ │
│  │  (on approve)│──▶│  (pedestrian)│   │   (geocoding)    │ │
│  └──────────────┘   └──────────────┘   └──────────────────┘ │
│                                                               │
│  ┌──────────────┐   ┌──────────────┐                        │
│  │  Mailpit     │   │  File store  │                        │
│  │  :8025 (UI)  │   │  (volume)    │                        │
│  │  (dev SMTP)  │   │  (photos)    │                        │
│  └──────────────┘   └──────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

**Dev ports (conflict-free):**
- Next.js frontend + API: **3100**
- PostgreSQL + PostGIS: **5433**
- Valkey (Redis-compatible): **6380**
- OSRM routing engine: **5000** (internal)
- Nominatim geocoding: **7070** (internal)

#### 6.3 Data Flow (MVP)

```
Landlord submits listing via form
  → Next.js API route: validate fields, store as status=pending, email confirmation
                        + tokenized edit link to landlord
  → Admin receives email notification → reviews → approves via token URL
  → On approval: trigger enrichment job (TypeScript):
      1. Nominatim: address → lat/lon → store in PostGIS
      2. OSRM: lat/lon → walk_time_seconds + route GeoJSON to nearest station
      3. PostGIS ST_Within: assign NTA → safety_score from pre-loaded NYPD data
      4. Set listing status = published
  → PostgreSQL/PostGIS (listings, stations, NTAs, NYPD scores, photos)
  → Next.js API Routes (filtered queries via Drizzle ORM)
  → Next.js Frontend:
      MapLibre GL JS + PMTiles (base map, self-hosted)
      GeoJSON layers (property pins, station markers, NTA choropleth)
      nuqs (URL filter state) + Zustand (viewport state) + TanStack Query (listings data)
```

Safety scores, walk times, and route geometries are **pre-computed on listing approval** and stored in PostGIS. Zero runtime calls to external routing or geocoding services — all computation happens in the enrichment pipeline, triggered once per listing approval.

#### 6.4 Static Data Bootstrap (one-time setup)

Before the ingestion job runs, the following datasets are downloaded and imported once:

| Dataset | Source URL | PostGIS table | Size (approx) |
|---|---|---|---|
| Brooklyn NTA polygons (2020) | `data.cityofnewyork.us/resource/9nt8-h7nd.geojson` | `nta_polygons` | < 1 MB |
| NYPD Complaint Data (Historic) | `data.cityofnewyork.us/resource/qgea-i56i.json` | `nypd_complaints` (aggregated → `nta_safety_scores`) | ~200 MB raw |
| MTA Subway Stations (Brooklyn) | `data.ny.gov/resource/5f5g-n3cz.json?borough=BK` | `subway_stations` | < 1 MB |
| NYC PMTiles base map | Protomaps download (NYC region) | Served as static file | ~2 GB |
| OSRM NYC OSM extract | Geofabrik `new-york-city.osm.pbf` | OSRM pre-processed graph | ~500 MB |
| Nominatim NYC OSM import | Same Geofabrik extract | Nominatim internal DB | ~8 GB |

---

### 7. Core Product Features (Functional Requirements)

#### 7.1 Search & Filtering

- **FR-1.1:** Accept neighborhood name or zip code input; geocode to a bounding box using the self-hosted Nominatim API; fly the map viewport to the result.
- **FR-1.2:** Date range picker: available-from date + duration (30 / 60 / 90 days).
- **FR-1.3:** Budget slider: $1,500–$5,000/mo.
- **FR-1.4:** Subway line filter: A/C, 2/3, F, L, G (multi-select). Filters to listings whose `nearest_station_id` is on a selected line.
- **FR-1.5:** Max walk to subway: toggles for 5 / 10 / 15 minutes. Filters on `walk_time_seconds` column stored in PostGIS.
- **FR-1.6:** Furnished-only filter: on by default.
- **FR-1.7:** All filter state is stored in URL query params (nuqs). Filters survive page refresh; filtered results are shareable via link.

#### 7.2 Interactive Map

- **FR-2.1:** Split-view layout: 60% map (MapLibre GL JS), 40% scrollable property list. Synchronized — hovering a list card highlights the corresponding pin and vice versa.
- **FR-2.2:** Property pins: clustered at low zoom; expand to individual price-labeled pins at high zoom. Clicking a pin opens the property detail panel.
- **FR-2.3:** Subway station markers: rendered from `subway_stations` PostGIS table. Clicking shows station name, line(s), and ADA status.
- **FR-2.4:** Neighborhood safety overlay: NTA-level choropleth from `nta_safety_scores`. Color scale (green → red) with legend. Labeled "Reported Incidents (NYPD, prior 12 months)." Toggle on/off. Non-color indicator (hatch pattern or label) required for WCAG 2.1 AA colorblind compliance.
- **FR-2.5:** Walk-time indicator: clicking a property pin draws the pre-computed route GeoJSON (stored in PostGIS) as a line to the nearest subway station. Walk time in minutes displayed on the property card and detail panel. No runtime routing API call.

#### 7.3 Property Detail Panel

- **FR-3.1:** Display: photo carousel, price/month, available dates, unit type, furnished status, utilities included (yes/no), broker fee (yes/no), deposit amount.
- **FR-3.2:** Transit summary: nearest station name, subway lines, pre-computed walk time in minutes.
- **FR-3.3:** Safety summary: NTA name + safety tier (Low / Medium / High) with data disclaimer.
- **FR-3.4:** Contact/inquiry: "Contact Landlord" button opens email client or redirects to source listing. No in-app messaging.

#### 7.4 Mobile Layout

- **FR-4.1:** On viewports < 768px: full-screen map with a bottom-sheet property list (shadcn/ui `Sheet` component, pull-up drawer pattern).
- **FR-4.2:** Filters collapse to a modal sheet triggered by a "Filter" button.

#### 7.5 Listing Submission (Landlord-Facing)

- **FR-5.1:** A public `/submit` page presents a multi-step form collecting all required listing fields (see §4). No account required.
- **FR-5.2:** Photo upload: minimum 3 images, maximum 20, stored to local Docker volume. Client-side preview before submission.
- **FR-5.3:** On submit: listing saved with `status = pending`; landlord receives a confirmation email containing a tokenized URL for editing or withdrawing the listing.
- **FR-5.4:** Admin receives an email notification with a one-click approve link and a one-click reject link. No admin dashboard UI in MVP.
- **FR-5.5:** On approval: enrichment job runs (Nominatim geocode → OSRM walk time → NTA safety score → PostGIS store); listing `status` set to `published`; landlord receives a "listing is live" email with a link to the listing on the map.
- **FR-5.6:** Landlord can edit or remove their listing at any time via the tokenized link from their confirmation email. Edits that change the address re-trigger the enrichment job.

---

### 8. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| **NFR-1** | Map + property list initial load (P95) | < 2.0s. PMTiles served locally eliminates tile CDN latency. |
| **NFR-2** | Runtime external API cost | **$0.00/session.** All data is pre-computed and stored locally. No per-request API billing. Infrastructure cost is fixed (own hardware or VPS). |
| **NFR-3** | Crime / safety data freshness | Quarterly — matches NYPD YTD dataset update cadence. Re-run bootstrap import on each NYPD update. |
| **NFR-4** | Listing data freshness | Published on admin approval (event-driven). Admin seeds 50–100 listings at launch; landlord self-submissions thereafter. |
| **NFR-5** | Graceful degradation | If Nominatim or OSRM is unavailable, the map renders with listings already in PostGIS; new ingest pauses. Property detail shows pre-computed walk time from DB — no live routing call to fail. |
| **NFR-6** | Subway data freshness | Weekly refresh from data.ny.gov Socrata endpoint (station changes are rare). |
| **NFR-7** | Accessibility | WCAG 2.1 AA. Safety choropleth must use non-color indicators. shadcn/ui components are Radix UI-based — keyboard navigable and screen-reader compatible by default. |
| **NFR-8** | FOSS compliance | Every production dependency must have an OSI-approved open source license. License audit required before each phase launch. |
| **NFR-9** | Self-containment | `docker compose up` must start the full stack from scratch on any Linux or macOS host with Docker installed, after the one-time data bootstrap. |

---

### 9. User Stories & Acceptance Criteria

**Epic: Find a safe furnished apartment near the subway**

> *As a young professional relocating to Brooklyn for 6 weeks, I want to see furnished apartments within a 10-minute walk of an A/C or 2/3 train, in a neighborhood with low reported crime, priced under $3,500/month.*

**Acceptance Criteria:**
1. Applying filters (line: A/C + 2/3, walk: ≤10 min, price: ≤$3,500, duration: 30 days) updates the map and list without page reload. URL reflects the active filters.
2. Each visible property pin shows price; hovering highlights the corresponding list card.
3. Clicking a pin draws the pre-stored route line to the nearest subway station; walk time in minutes is displayed.
4. Safety overlay is visible and togglable; color scale has a legend with a non-color indicator.
5. Clicking "Contact Landlord" opens an email client or redirects to the source listing.

**Epic: Evaluate a specific unit**

> *As a user, I want to see everything relevant about one apartment before deciding whether to reach out.*

**Acceptance Criteria:**
1. Property detail panel shows: photo carousel, price, dates, furnished status, utilities/fees, transit summary, safety tier.
2. All information loads within the panel without navigating away from the map.
3. "Contact Landlord" CTA is prominent and functional.
4. Panel can be dismissed to return to the map without losing filter state.

---

### 10. Subway Line Reference (Brooklyn)

| Line | Key Brooklyn Neighborhoods | Manhattan Destination | Notes |
|---|---|---|---|
| A/C | Bedford-Stuyvesant, Fulton St corridor | Midtown, Lower Manhattan | Express A is fastest |
| 2/3 | Crown Heights, Park Slope, Borough Hall | Midtown, Wall St | Express; very reliable |
| F | Park Slope, Carroll Gardens | Lower Manhattan, Midtown | Slower; serves residential areas |
| L | Williamsburg, Bushwick | 14th St / Union Sq | Key for Williamsburg; no Manhattan express |
| G | Greenpoint, Williamsburg, Park Slope | Queens only | Crosstown; useful for Brooklyn-internal trips |

---

### 11. Phased Rollout Plan

| Phase | Milestone | Features |
|---|---|---|
| **MVP (v1.0)** | Launch Brooklyn | Admin-seeded listings (50–100 hand-entered at launch) + landlord self-submission form, subway layer, safety choropleth, price + line + walk-time filters, property detail panel, direct landlord email inquiry |
| **Feature v2.1** | Enhanced discovery | Isochrone polygon rendering (OSRM time-distance polygons), crime hex-bin heatmap (H3 hexagons from NYPD data), saved searches (adds auth — evaluate SimpleWebAuthn or similar FOSS) |
| **Feature v2.2** | Scam prevention + amenities | Perceptual hash check on listing photos (self-hosted, pHash library), amenities layer from OpenStreetMap Overpass API (replaces Yelp Fusion), listing report/flag feature |
| **v3.0** | Multi-market expansion | Second market (e.g., Chicago or DC); parameterize city-specific OSM extracts, NYPD equivalents, transit GTFS; direct landlord listing submission form |

---

### 12. FOSS License Reference

| Component | License | OSI-Approved |
|---|---|---|
| Next.js 15 | MIT | ✓ |
| TypeScript | Apache 2.0 | ✓ |
| MapLibre GL JS | BSD-3-Clause | ✓ |
| Protomaps PMTiles (library) | MIT | ✓ |
| OSM tile data (ODbL) | Open Database License | ✓ |
| Tailwind CSS | MIT | ✓ |
| shadcn/ui | MIT | ✓ |
| nuqs | MIT | ✓ |
| Zustand | MIT | ✓ |
| TanStack Query | MIT | ✓ |
| Drizzle ORM | Apache 2.0 | ✓ |
| PostgreSQL 17 | PostgreSQL License | ✓ |
| PostGIS 3.5 | GPL-2.0+ | ✓ |
| Valkey 8 | BSD-3-Clause | ✓ |
| OSRM v26.5 | BSD-2-Clause | ✓ |
| Nominatim 4.x | GPL-3.0 | ✓ |
| Nodemailer | MIT | ✓ |
| Mailpit (dev SMTP) | MIT | ✓ |
| Docker Engine | Apache 2.0 | ✓ |
| Docker Compose | Apache 2.0 | ✓ |
| Redis ❌ | SSPL (not OSI) | ✗ — use Valkey |
| Playwright ❌ (removed) | Apache 2.0 | — scraping eliminated from design |

---

### 13. Open Questions

| # | Question | Owner | Priority | Status |
|---|---|---|---|---|
| Q1 | Is scraping Furnished Finder legally permissible? | Product / Legal | ~~Blocker~~ | **CLOSED** — Architecture pivoted to landlord self-submission marketplace. Scraping eliminated from design entirely. No legal exposure. |
| Q2 | Monetization model? | Product | High | **RESOLVED (by architecture)** — Self-submission marketplace enables landlord-side monetization: charge per listing (flat fee), per inquiry lead, or monthly featured placement. No affiliate dependency. |
| Q3 | Inquiry CTA: redirect vs. capture contact info | Product | High | **RESOLVED (by architecture)** — Landlord's email is captured at submission (required field). "Contact Landlord" button opens a mailto: with their email. Direct contact, no redirect to a third-party platform needed. |
| Q4 | NTA polygon dataset | Engineering | Medium | **RESOLVED** — NYC Open Data 2020 NTAs, 45 Brooklyn NTAs, GeoJSON at `data.cityofnewyork.us/resource/9nt8-h7nd.geojson` |
| Q5 | WCAG-compliant colorblind-safe palette for choropleth | Design | Medium | Open |
| Q6 | Route line geometry: pre-compute OSRM GeoJSON in PostGIS vs. real-time query on pin click | Engineering | Low | Open — pre-compute recommended (eliminates runtime OSRM dependency for reads) |
| Q7 | Nominatim resource requirements: full NYC OSM import ~8 GB RAM, several hours | Engineering | Medium | Open — Brooklyn-only import is smaller; confirm host resources before setup |
| Q8 | Email provider for production: Mailpit covers dev. Production needs a local SMTP relay (Postfix in Docker) or a self-hosted MTA. Confirm approach. | Engineering | Low | Open |
