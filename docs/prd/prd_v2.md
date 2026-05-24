# Product Requirements Document — v2
## Project: Brooklyn Short-Term Rental Discovery Platform
**Version:** 2.0  
**Date:** 2026-05-23  
**Status:** MVP Scope Locked

---

### 1. Executive Summary

A map-centric web application that helps users find furnished short-term rentals (1–2 months) in Brooklyn, NY. The platform layers subway proximity, neighborhood safety signals, and pricing onto an interactive map, eliminating the need to cross-reference multiple sites manually.

MVP is intentionally scoped to a single borough (Brooklyn) and a single inventory source before expanding.

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
- Walk time to subway (straight-line + Mapbox Directions estimate)
- Inquiry handoff (email or external link — no in-app booking)

**Explicitly out of scope for MVP:**
- Other boroughs or cities
- Isochrone polygon rendering (deferred to v2.1)
- Crime hex-bin heatmap (deferred to v2.1; safety score used instead)
- Amenities layer (cafes, gyms — deferred to v2.2)
- In-app booking / payment
- Scam prevention module (deferred to v2.2)
- Native mobile app

---

### 4. Listing Inventory Strategy

**Primary source: Furnished Finder**  
The dominant US platform for 30–90 day furnished rentals (~300K+ listings). No official public API exists. Integration approach:

1. **Phase 1 (MVP):** Licensed data extraction via Apify scraper (structured JSON output). Acceptable for MVP scale.
2. **Phase 2:** Pursue direct partnership or data licensing agreement with Furnished Finder as volume grows.

**Secondary / future sources (post-MVP):**
- Blueground Partner Network (API-based; enterprise partnership required)
- Kasa, Landing (contact for B2B data agreements)
- Direct landlord submissions (self-serve listing form, Phase 3)

**Critical data fields required per listing:**
- Address (geocodable)
- Unit type (studio / 1BR)
- Furnished: yes/no (filter to furnished only)
- Available from / to dates
- Monthly price (all-in or base rent — flag if utilities separate)
- Broker fee: yes/no
- Security deposit amount
- Photos (minimum 3)
- Contact method (email, external link, or phone)

---

### 5. Third-Party Data Integrations

| Data Type | Source | Format | Notes |
|---|---|---|---|
| **Listings** | Furnished Finder (via Apify) | JSON | Licensed extraction; refresh every 6 hours |
| **Subway Stations** | MTA GTFS Static Feed (free) | CSV / GTFS | `web.mta.info/developers/data/nyct/subway/Stations.csv` — includes lat/lon, line, ADA status |
| **Walking Directions** | Mapbox Directions API | GeoJSON | 100K free req/mo; used for walk time to nearest station |
| **Geocoding** | Mapbox Geocoding API | JSON | Convert listing addresses to lat/lon |
| **Crime / Safety** | NYC Open Data — NYPD Complaint Data | JSON (Socrata API) | Free, filterable by borough; updated monthly. Used to compute neighborhood-level safety score at ingest, not real-time |
| **Map Tiles** | Mapbox GL JS | Vector tiles | Base map rendering |

**What we are NOT using:**
- Crimeometer / SpotCrime (cost, limited Brooklyn coverage — NYC Open Data is superior)
- Yelp Fusion (deferred to amenities layer, Phase 2.2)
- Google Places (deferred)
- MTA Real-Time GTFS-RT feeds (overkill for static walk-distance use case)

---

### 6. System Architecture

#### 6.1 Stack Decisions

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js (App Router) + Mapbox GL JS | SSR for SEO on listing pages; Mapbox for map rendering |
| **Backend** | Node.js (single service, not microservices) | Sufficient for MVP scale; avoid premature complexity |
| **Database** | PostgreSQL + PostGIS | Spatial indexing for proximity queries; industry standard |
| **Cache** | Redis | Geohash-keyed cache for crime scores and subway distances |
| **Ingestion** | Scheduled Node.js job | Pulls Furnished Finder data every 6 hours, geocodes, stores |

No Rust, C#, or AI/ML components in MVP. These are deferred until actual bottlenecks are observed.

#### 6.2 Data Flow (MVP)

```
Furnished Finder (Apify) 
  → Ingestion Job (geocode + enrich + safety score)
  → PostgreSQL/PostGIS
  → REST API
  → Next.js Frontend + Mapbox GL JS
```

Safety scores are **pre-computed at ingestion** from NYPD data (neighborhood polygon intersect), not computed on request. This keeps map load fast without real-time crime API calls.

---

### 7. Core Product Features (Functional Requirements)

#### 7.1 Search & Filtering

- **FR-1.1:** Accept neighborhood or zip code input; geocode to bounding box (Mapbox Geocoding API).
- **FR-1.2:** Date range picker: available-from date + duration (30 / 60 / 90 days).
- **FR-1.3:** Budget slider: $1,500–$5,000/mo (Brooklyn furnished 1BR range).
- **FR-1.4:** Subway line filter: A/C, 2/3, F, L, G (multi-select). Filters to listings within walking distance of selected lines.
- **FR-1.5:** Max walk to subway: toggles for 5 / 10 / 15 minutes.
- **FR-1.6:** Furnished-only filter: on by default, can be turned off.

#### 7.2 Interactive Map

- **FR-2.1:** Split-view layout: 60% map (Mapbox), 40% scrollable property list. Synchronized — hovering a list card highlights the corresponding pin.
- **FR-2.2:** Property pins: show price on hover. Clicking opens property detail panel.
- **FR-2.3:** Subway station markers: rendered from MTA GTFS data. Clicking a station shows line(s) and ADA status.
- **FR-2.4:** Neighborhood safety overlay: choropleth shading at NTA (Neighborhood Tabulation Area) level. Color scale from green (lower incident rate) to red (higher). Toggle on/off. Label clearly as "Reported Incidents (NYPD, prior 12 months)" to avoid misleading users.
- **FR-2.5:** Walk-time indicator: selecting a property pin draws a line to the nearest subway station and displays walk time in minutes (Mapbox Directions API).

#### 7.3 Property Detail Panel

- **FR-3.1:** Display: photos (carousel), price/month, available dates, unit type, furnished status, utilities included (yes/no), broker fee (yes/no), deposit amount.
- **FR-3.2:** Transit summary: nearest station name, subway lines, walk time.
- **FR-3.3:** Safety summary: NTA-level safety tier (Low / Medium / High incident rate) with disclaimer.
- **FR-3.4:** Contact/inquiry: "Contact Landlord" button — opens email or redirects to source listing. No in-app messaging in MVP.

#### 7.4 Mobile Layout

- **FR-4.1:** On viewports < 768px, collapse split-view to full-screen map with a bottom-sheet property list (pull-up drawer).
- **FR-4.2:** Filters collapse to a modal sheet triggered by a "Filter" button.

---

### 8. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| **NFR-1** | Map + property list initial load (P95) | < 2.0s (relaxed from 1.2s; achievable without isochrones) |
| **NFR-2** | API cost per session (geocode + directions + tiles) | < $0.08 (Mapbox Directions: ~$0.004/req at 100K free; geocode included) |
| **NFR-3** | Crime / safety data freshness | Recomputed on NYPD data refresh (YTD dataset updates quarterly; Historic dataset annually) |
| **NFR-4** | Listing data freshness | Ingested every 6 hours |
| **NFR-5** | Graceful degradation | If Mapbox API or Directions call fails, map renders without walk-time line; property card shows "Walk time unavailable" |
| **NFR-6** | Subway data freshness | GTFS static feed refreshed weekly (station changes are rare) |
| **NFR-7** | Accessibility | WCAG 2.1 AA — map layers must have non-color indicators (patterns or labels) for colorblind users |

---

### 9. User Stories & Acceptance Criteria

**Epic: Find a safe furnished apartment near the subway**

> *As a young professional relocating to Brooklyn for 6 weeks, I want to see furnished apartments within a 10-minute walk of an A/C or 2/3 train, in a neighborhood with low reported crime, priced under $3,500/month.*

**Acceptance Criteria:**
1. Applying filters (line: A/C + 2/3, walk: ≤10 min, price: ≤$3,500, duration: 30 days) updates the map and list without page reload.
2. Each visible property pin shows price; hovering highlights the corresponding list card.
3. Clicking a pin draws a line to the nearest subway station with walk time displayed.
4. Safety overlay is visible and togglable; color scale has a legend.
5. Clicking "Contact Landlord" opens an email client or redirects to the source listing.

**Epic: Evaluate a specific unit**

> *As a user, I want to see everything relevant about one apartment before deciding whether to reach out.*

**Acceptance Criteria:**
1. Property detail panel shows: photo carousel, price, dates, furnished status, utilities/fees, transit summary, safety tier.
2. All information loads within the panel without navigating away from the map.
3. "Contact Landlord" CTA is prominent and functional.

---

### 10. Subway Line Reference (Brooklyn)

Lines relevant to Brooklyn short-term renters commuting to Manhattan:

| Line | Key Brooklyn Neighborhoods | Manhattan Destination | Notes |
|---|---|---|---|
| A/C | Bedford-Stuyvesant, Fulton St corridor | Midtown, Lower Manhattan | Express A is fastest |
| 2/3 | Crown Heights, Park Slope, Borough Hall | Midtown, Wall St | Express; very reliable |
| F | Park Slope, Carroll Gardens, Red Hook (via bus) | Lower Manhattan, Midtown | Slower but serves residential areas |
| L | Williamsburg, Bushwick | 14th St / Union Sq | Key for Williamsburg; no Manhattan express |
| G | Greenpoint, Williamsburg, Park Slope | Queens only (no Manhattan direct) | Crosstown; useful for Brooklyn-internal trips |

---

### 11. Phased Rollout Plan

| Phase | Milestone | Features |
|---|---|---|
| **MVP (v1.0)** | Launch Brooklyn | Furnished Finder listings, subway layer, safety choropleth, price + line + walk-time filters, property detail panel, inquiry handoff |
| **v2.1** | Enhance discovery | Isochrone polygon rendering, crime hex-bin heatmap (replacing choropleth), saved searches (requires auth) |
| **v2.2** | Scam prevention + amenities | Reverse-image check on listing photos, amenities layer (cafes, gyms, groceries via Yelp Fusion), listing report/flag feature |
| **v3.0** | Multi-market expansion | Ingest second market (e.g., Chicago or DC); parameterize city-specific data sources (crime API, transit GTFS); direct landlord listing submission |

---

### 12. Open Questions (To Resolve Before Build)

| # | Question | Owner | Priority |
|---|---|---|---|
| Q1 | Is Apify-based Furnished Finder extraction legally permissible under their ToS? Legal review needed before launch. | Product / Legal | **Blocker** |
| Q2 | What is the monetization model? (Lead-gen fee per inquiry, landlord subscription, affiliate?) | Product | High |
| Q3 | Does the inquiry CTA redirect to Furnished Finder listing, or do we capture contact info directly? Affects ToS and data model. | Product | High |
| Q4 | Which NTA polygon dataset defines neighborhood boundaries for the safety choropleth? (NYC Planning NTA shapefile is standard.) | Engineering | Medium |
| Q5 | WCAG audit: what colorblind-safe palette for safety choropleth? | Design | Medium |
