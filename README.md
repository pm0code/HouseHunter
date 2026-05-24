# HouseHunter

Brooklyn short-term rental discovery platform. Interactive map with PostGIS spatial search, real-time scrapers for Craigslist / SpareRoom / CozyCozy, neighborhood safety overlays from NYPD open data, and subway proximity ranking.

---

## Quick Start

```powershell
.\HouseHunter.ps1
```

That single command checks prerequisites, starts Docker services, bootstraps the database, and opens the app. See [the script section](#househunterps1-setup-script) for flags.

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | 24+ | Must be running before launch |
| [Node.js](https://nodejs.org) | 18 LTS | npm included |
| Git | any | For cloning |

No cloud accounts, no API keys required for basic use. All services run locally in Docker.

---

## Manual Setup (step by step)

### 1. Clone and install

```powershell
git clone https://github.com/pm0code/HouseHunter.git
cd HouseHunter
npm install
```

### 2. Environment file

```powershell
Copy-Item .env.example .env.local
```

The defaults work out-of-the-box for local development. Edit `.env.local` before going to production:

- `TOKEN_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SMTP_*` — replace Mailpit settings with your SMTP relay
- `NYCOPENDATA_APP_TOKEN` — free at [data.cityofnewyork.us](https://data.cityofnewyork.us/profile/app_tokens) — prevents rate-limiting on NYPD import

### 3. Start Docker services

```powershell
npm run docker:up
```

This starts three containers:

| Container | Port | Purpose |
|---|---|---|
| PostgreSQL 17 + PostGIS | 5433 | Primary database |
| Valkey 8 (Redis fork) | 6380 | API response cache |
| Mailpit | 8025 (web) / 1025 (SMTP) | Dev email capture |

### 4. Run database migrations

```powershell
npm run db:migrate
```

Creates all tables and PostGIS spatial indexes.

### 5. Bootstrap reference data

Run these once in order:

```powershell
npm run bootstrap:stations   # Brooklyn subway stations from data.ny.gov
npm run bootstrap:nta        # Neighborhood Tabulation Area polygons from NYC Open Data
npm run bootstrap:nypd       # NYPD complaint data → safety scores per neighborhood
```

`bootstrap:nypd` fetches up to 500,000 complaint records and runs a spatial JOIN to compute incidents-per-km² for each NTA. It takes 1–3 minutes.

### 6. Populate listings

**Option A — real scrapers** (recommended, takes 3–5 minutes):

```powershell
npm run scrape
```

Scrapes Craigslist, SpareRoom, and CozyCozy. Inserts new listings with PostGIS-derived walk times and safety tiers. Already-seen listings are skipped.

**Option B — sample seed data** (15 hand-crafted Brooklyn listings):

```powershell
npm run bootstrap:seed
```

### 7. Start the app

```powershell
npm run dev        # Development (Turbopack, hot reload) — http://localhost:3100
npm run build && npm run start   # Production
```

---

## HouseHunter.ps1 Setup Script

```powershell
# Normal launch (idempotent — safe to run repeatedly)
.\HouseHunter.ps1

# Skip the scraper prompt
.\HouseHunter.ps1 -SkipScrape

# Wipe Docker volumes and start completely fresh
.\HouseHunter.ps1 -Reset

# Production build instead of dev server
.\HouseHunter.ps1 -Prod

# Don't open the browser automatically
.\HouseHunter.ps1 -SkipBrowser
```

The script is idempotent — it checks what's already done and skips those steps. Running it a second time just starts the server.

---

## Architecture

```
Browser
  └── Next.js 16 (App Router, port 3100)
        ├── /                     Map + sidebar UI (MapLibre GL + React)
        ├── /submit               Public listing submission form
        ├── /edit/[token]         Landlord self-edit page
        └── /api/
              ├── listings        GET (filtered) / POST (submit)
              ├── listings/[id]   GET single listing
              ├── nta-safety      GeoJSON safety layer for map overlay
              ├── subway-stations GeoJSON station markers
              ├── approve/[token] Admin approval webhook
              └── reject/[token]  Admin rejection webhook

PostgreSQL 17 + PostGIS 3.5 (port 5433)
  ├── listings          Rental listings with geometry(Point, 4326)
  ├── subway_stations   MTA stations with geometry(Point, 4326)
  ├── nta_polygons      Neighborhood boundaries geometry(MultiPolygon, 4326)
  └── nta_safety_scores Incidents per km² + low/medium/high tier

Valkey 8 (port 6380)   API response cache (listings, NTA GeoJSON)
Mailpit (port 8025)    Captures all outbound email in dev
```

### Key design decisions

- **PostGIS for everything spatial**: nearest station, walk time (distance / 1.4 m/s), NTA containment — all done in the database with GIST indexes.
- **No mapping API fees**: tiles served from Protomaps CDN (OpenStreetMap data, free tier); routing uses OSRM (optional Docker profile).
- **FOSS-only stack**: PostgreSQL, Valkey, Mailpit, OSRM, Nominatim — no paid cloud services.
- **Drizzle ORM**: type-safe schema defined in `src/lib/db/schema.ts`; migrations in `infra/db/migrations/`.

---

## Data Pipeline

```
NYC Open Data ──► bootstrap:stations  ──► subway_stations table
NYC Open Data ──► bootstrap:nta       ──► nta_polygons table
NYPD Open Data ─► bootstrap:nypd      ──► nta_safety_scores table
                                              │
Craigslist ──┐                               │
SpareRoom  ──┼──► npm run scrape ──► listings table ◄── enrich.ts
CozyCozy   ──┘       (dedup by sourceUrl)        (PostGIS joins)
```

Each scraped listing goes through `infra/scripts/scrape/lib/enrich.ts` which:
1. Finds the nearest subway station (`ORDER BY geom <-> point LIMIT 1`)
2. Calculates walk time (`ST_Distance / 1.4 m/s`)
3. Finds the containing NTA (`ST_Within`)
4. Looks up the pre-computed safety tier

---

## Scraper Sources

| Source | Status | Notes |
|---|---|---|
| Craigslist | ✅ Working | ~400 listings; furnished BK apts + sublets |
| SpareRoom | ✅ Working | ~50 listings; short-term furnished rooms |
| CozyCozy | ✅ Working | ~20 listings; vacation-style short-term |
| LeaseBreak | ⚠ 403 | Blocked by server; scraper exists but yields 0 |
| RentHop | ⚠ 403 | Blocked by server; scraper exists but yields 0 |

Re-run scrapers at any time with `npm run scrape` or per-source with `npm run scrape:craigslist`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://househunter:househunter_dev@localhost:5433/househunter` | PostgreSQL connection string |
| `VALKEY_URL` | `redis://localhost:6380` | Valkey/Redis connection |
| `SMTP_HOST` | `localhost` | SMTP server (Mailpit in dev) |
| `SMTP_PORT` | `1025` | SMTP port |
| `SMTP_FROM` | `HouseHunter <noreply@househunter.local>` | From address |
| `ADMIN_EMAIL` | `admin@househunter.local` | Receives new listing notifications |
| `TOKEN_SECRET` | `change-me-in-production` | Signs approval/edit tokens |
| `APP_URL` | `http://localhost:3100` | Used in email links |
| `OSRM_URL` | `http://localhost:5000` | Pedestrian routing (optional) |
| `NOMINATIM_URL` | `http://localhost:7070` | Geocoding (optional) |
| `NYCOPENDATA_APP_TOKEN` | _(empty)_ | Free token to avoid NYPD import rate limits |

---

## All npm Scripts

```powershell
# Dev
npm run dev                  # Start dev server (Turbopack, port 3100)
npm run build                # Production build
npm run start                # Start production server (port 3100)
npm run typecheck            # TypeScript type check (no emit)

# Docker
npm run docker:up            # Start postgres + valkey + mailpit
npm run docker:down          # Stop all containers
npm run docker:up:enrichment # Also start OSRM + Nominatim (optional)

# Database
npm run db:migrate           # Apply pending migrations
npm run db:generate          # Re-generate migrations from schema changes
npm run db:studio            # Open Drizzle Studio (visual DB browser)

# Bootstrap (run once in order)
npm run bootstrap:stations   # Import subway stations
npm run bootstrap:nta        # Import NTA neighborhood polygons
npm run bootstrap:nypd       # Compute safety scores from NYPD data
npm run bootstrap:seed       # Seed 15 sample listings (dev/demo)

# Scrapers
npm run scrape               # Run all scrapers
npm run scrape:craigslist    # Craigslist only
npm run scrape:spareroom     # SpareRoom only
npm run scrape:cozycozy      # CozyCozy only
```

---

## Directory Structure

```
HouseHunter/
├── HouseHunter.ps1              Setup and launch script
├── .env.example                 Environment template
├── .env.local                   Your local config (gitignored)
│
├── src/
│   ├── app/
│   │   ├── page.tsx             Main map page
│   │   ├── submit/page.tsx      Public listing submission
│   │   ├── edit/[token]/        Landlord edit page
│   │   └── api/                 REST API routes
│   ├── components/
│   │   ├── map/                 MapView, MapLayout
│   │   ├── listings/            ListingList, PropertyDetailPanel
│   │   ├── filters/             FilterPanel (walk/crime/lines/furnished)
│   │   └── search/              SearchPanel (priorities, price, type)
│   ├── store/                   Zustand stores (map state, search state)
│   ├── hooks/                   useListings, useListingFilters
│   ├── lib/
│   │   ├── db/                  Drizzle client + schema
│   │   ├── enrichment.ts        PostGIS enrichment logic
│   │   ├── email.ts             Nodemailer wrapper
│   │   └── tokens.ts            Token sign/verify
│   └── types/                   Shared TypeScript types
│
├── infra/
│   ├── docker-compose.yml       All infrastructure services
│   ├── drizzle.config.ts        ORM config
│   ├── db/
│   │   ├── init/                SQL run by Docker on first start
│   │   └── migrations/          Drizzle-generated migration files
│   └── scripts/
│       ├── bootstrap/           One-time data import scripts
│       └── scrape/              Rental listing scrapers
│
└── docs/                        PRDs, handoffs, tech audit
```

---

## Development Notes

### Email

All outbound email is captured by Mailpit in dev mode. View sent emails at **http://localhost:8025**. No real email is ever sent in development.

When a landlord submits a listing, the admin receives an email with approve/reject links. Clicking approve publishes the listing immediately.

### Map

The map uses [MapLibre GL](https://maplibre.org/) with [Protomaps](https://protomaps.com/) vector tiles served from CDN. No API key required. The safety overlay and subway markers are served from the local API (`/api/nta-safety`, `/api/subway-stations`).

### Optional enrichment services

OSRM (pedestrian routing) and Nominatim (geocoding) are available via Docker but require one-time data setup and are not needed for the scraper pipeline. Start them with:

```powershell
npm run docker:up:enrichment
```

See `infra/docker-compose.yml` for configuration details.

### Database access

```powershell
# Drizzle Studio (browser UI)
npm run db:studio

# Direct psql
docker exec -it househunter-postgres-1 psql -U househunter -d househunter
```

---

## Troubleshooting

**"Cannot connect to Docker daemon"**
Start Docker Desktop and wait for it to show "Engine running" in the taskbar.

**"listen EADDRINUSE :::3100"**
Another process is using port 3100. Kill it:
```powershell
Get-NetTCPConnection -LocalPort 3100 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

**Scrapers returning 0 listings**
Craigslist and SpareRoom rate-limit aggressively. Wait 10–15 minutes between runs. CozyCozy is the most reliable for repeated testing.

**NYPD import is slow or fails**
Set `NYCOPENDATA_APP_TOKEN` in `.env.local`. Register free at [data.cityofnewyork.us](https://data.cityofnewyork.us/profile/app_tokens).

**Map tiles not loading**
The Protomaps CDN requires internet access. Font glyph 404 errors in the console are harmless — the map falls back to local rendering automatically.

**"relation does not exist" on startup**
The database migrations haven't run yet. Run `npm run db:migrate`.
