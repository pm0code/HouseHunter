# HouseHunter.ps1
# =============================================================================
# One-shot setup and launch script for HouseHunter.
#
# Usage:
#   .\HouseHunter.ps1                 Normal launch (idempotent)
#   .\HouseHunter.ps1 -SkipScrape    Skip the scraper prompt
#   .\HouseHunter.ps1 -Prod          Production build + server
#   .\HouseHunter.ps1 -Reset         Wipe Docker volumes and start fresh
#   .\HouseHunter.ps1 -SkipBrowser   Don't open the browser automatically
# =============================================================================

param(
    [switch]$SkipScrape,
    [switch]$Prod,
    [switch]$Reset,
    [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$ComposeFile = "$ProjectRoot\infra\docker-compose.yml"
$ProjectName = "househunter"
$AppPort     = 3100
$AppUrl      = "http://localhost:$AppPort"
$DB_USER     = "househunter"
$DB_NAME     = "househunter"

# =============================================================================
# Output helpers
# =============================================================================

function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "    _  _                     _  _             _             " -ForegroundColor Cyan
    Write-Host "   | || | ___  _  _ ___ ___ | || | _  _ _ _ | |_  ___  _ _ " -ForegroundColor Cyan
    Write-Host "   | __ |/ _ \| || (_-</ -_)| __ || || | ' \|  _|/ -_)| '_|" -ForegroundColor Cyan
    Write-Host "   |_||_|\___/ \_,_/__/\___||_||_| \_,_|_||_|\__|\___||_|  " -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Brooklyn Short-Term Rental Discovery Platform" -ForegroundColor DarkGray
    Write-Host "   $AppUrl" -ForegroundColor DarkGray
    Write-Host ""
}

function Write-Section([string]$title) {
    $line = "-" * (54 - $title.Length)
    Write-Host ""
    Write-Host "  [ $title ] $line" -ForegroundColor White
}

function Write-Step([string]$msg)  { Write-Host "    > $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)    { Write-Host "    + $msg" -ForegroundColor Green }
function Write-Warn([string]$msg)  { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg) {
    Write-Host ""
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# =============================================================================
# Docker / DB helpers
# =============================================================================

function Invoke-Compose {
    param([string]$Args)
    $cmd = "docker compose -f `"$ComposeFile`" -p $ProjectName $Args"
    Invoke-Expression $cmd
    return $LASTEXITCODE
}

function Invoke-ComposeQuiet {
    param([string]$Args)
    $cmd = "docker compose -f `"$ComposeFile`" -p $ProjectName $Args"
    Invoke-Expression $cmd 2>&1 | Out-Null
    return $LASTEXITCODE
}

function Invoke-DB([string]$query) {
    $result = docker compose -f "$ComposeFile" -p $ProjectName `
        exec -T postgres psql -U $DB_USER -d $DB_NAME -tAc $query 2>$null
    return ($result -join '').Trim()
}

function Wait-ForPostgres {
    Write-Step "Waiting for PostgreSQL to be ready..."
    for ($i = 0; $i -lt 30; $i++) {
        $rc = (docker compose -f "$ComposeFile" -p $ProjectName `
            exec -T postgres pg_isready -U $DB_USER -q 2>$null; $LASTEXITCODE)
        if ($rc -eq 0) { return }
        Start-Sleep -Seconds 2
    }
    Write-Fail "PostgreSQL did not become ready within 60 seconds. Check: docker compose logs postgres"
}

function Wait-ForValkey {
    for ($i = 0; $i -lt 10; $i++) {
        $ping = docker compose -f "$ComposeFile" -p $ProjectName `
            exec -T valkey valkey-cli ping 2>$null
        if ($ping -match 'PONG') { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

# =============================================================================
# Run any Python helper scripts found in infra/scripts/
# =============================================================================

function Invoke-PythonHelpers {
    $scripts = Get-ChildItem "$ProjectRoot\infra\scripts\*.py" -ErrorAction SilentlyContinue
    if ($scripts.Count -eq 0) { return }

    Write-Section "Python Helpers"
    $hasPython = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
    if (-not $hasPython) {
        Write-Warn "Python not found — skipping $($scripts.Count) helper script(s)."
        return
    }
    foreach ($script in $scripts) {
        Write-Step "Running $($script.Name)..."
        try {
            & python $script.FullName
            if ($LASTEXITCODE -eq 0) { Write-OK "$($script.Name) complete" }
            else { Write-Warn "$($script.Name) exited with code $LASTEXITCODE" }
        } catch {
            Write-Warn "$($script.Name) failed: $_"
        }
    }
}

# =============================================================================
# MAIN
# =============================================================================

Write-Banner

# ---------------------------------------------------------------------------
# Section 1: Prerequisites
# ---------------------------------------------------------------------------
Write-Section "Prerequisites"

# Docker installed?
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker is not installed or not in PATH.`n     Install Docker Desktop: https://www.docker.com/products/docker-desktop"
}
$dockerVer = docker --version 2>&1
Write-OK "Docker: $dockerVer"

# Docker daemon running?
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker daemon is not running. Start Docker Desktop and try again."
}
Write-OK "Docker daemon running"

# Node.js >= 18?
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js is not installed. Download v18 LTS: https://nodejs.org"
}
$nodeVer = node --version 2>&1
$nodeMajor = [int]($nodeVer -replace 'v(\d+)\..*', '$1')
if ($nodeMajor -lt 18) {
    Write-Fail "Node.js $nodeVer found but v18+ is required. Download: https://nodejs.org"
}
Write-OK "Node.js: $nodeVer"

# npm?
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm not found. Reinstall Node.js from https://nodejs.org"
}
Write-OK "npm: v$(npm --version 2>&1)"

# Python (optional)
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-OK "Python: $(python --version 2>&1) (available for helper scripts)"
} else {
    Write-Warn "Python not found — Python helper scripts will be skipped if present."
}

# ---------------------------------------------------------------------------
# Section 2: Environment
# ---------------------------------------------------------------------------
Write-Section "Environment"

Set-Location $ProjectRoot

$envFile    = "$ProjectRoot\.env.local"
$envExample = "$ProjectRoot\.env.example"

if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $envExample)) {
        Write-Fail ".env.example is missing. Cannot create .env.local."
    }
    Copy-Item $envExample $envFile
    Write-OK "Created .env.local from .env.example"
    Write-Warn "Review .env.local — update TOKEN_SECRET and SMTP settings before production use."
} else {
    Write-OK ".env.local present"
}

# ---------------------------------------------------------------------------
# Section 3: Reset (optional)
# ---------------------------------------------------------------------------
if ($Reset) {
    Write-Section "Reset"
    Write-Warn "Removing Docker volumes (database and cache will be wiped)..."
    Invoke-ComposeQuiet "down -v"
    Write-OK "Volumes cleared — fresh start"
}

# ---------------------------------------------------------------------------
# Section 4: Docker services
# ---------------------------------------------------------------------------
Write-Section "Docker Services"

Write-Step "Starting PostgreSQL + Valkey + Mailpit..."
Invoke-ComposeQuiet "up -d"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up failed. Run: docker compose -f infra/docker-compose.yml logs"
}

Wait-ForPostgres
Write-OK "PostgreSQL ready  (localhost:5433)"

if (Wait-ForValkey) { Write-OK "Valkey ready      (localhost:6380)" }
else                { Write-Warn "Valkey not responding — cache will be unavailable." }

Write-OK "Mailpit ready     (http://localhost:8025)"

# ---------------------------------------------------------------------------
# Section 5: Node.js dependencies
# ---------------------------------------------------------------------------
Write-Section "Node.js Dependencies"

$nodeModulesDir = "$ProjectRoot\node_modules"
$packageLock    = "$ProjectRoot\package-lock.json"
$needsInstall   = $true

if (Test-Path $nodeModulesDir) {
    $modTime  = (Get-Item $nodeModulesDir).LastWriteTime
    $lockItem = Get-Item $packageLock -ErrorAction SilentlyContinue
    if ($lockItem -and $modTime -ge $lockItem.LastWriteTime) {
        $needsInstall = $false
        Write-OK "node_modules up to date"
    }
}

if ($needsInstall) {
    Write-Step "Running npm install..."
    npm install --prefer-offline 2>&1 | Where-Object { $_ -notmatch '^npm warn' } | Write-Host
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed." }
    Write-OK "Dependencies installed"
}

# ---------------------------------------------------------------------------
# Section 6: Database schema
# ---------------------------------------------------------------------------
Write-Section "Database Schema"

$tableCheck = Invoke-DB "SELECT to_regclass('public.listings')::text"

if ($tableCheck -ne 'listings') {
    Write-Step "Running database migrations..."
    npm run db:migrate 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "db:migrate failed. Check DATABASE_URL in .env.local." }
    Write-OK "Migrations applied"
} else {
    Write-OK "Schema up to date"
}

# ---------------------------------------------------------------------------
# Section 7: Reference data bootstrap
# ---------------------------------------------------------------------------
Write-Section "Reference Data"

# Subway stations
$stationCount = [int](Invoke-DB "SELECT COUNT(*) FROM subway_stations" 2>$null)
if ($stationCount -eq 0) {
    Write-Step "Importing Brooklyn subway stations from data.ny.gov..."
    npm run bootstrap:stations 2>&1 | Select-String '(Upserted|Error)' | ForEach-Object { Write-Host "    $_" }
    Write-OK "Subway stations imported"
} else {
    Write-OK "Subway stations: $stationCount records"
}

# NTA neighborhood polygons
$ntaCount = [int](Invoke-DB "SELECT COUNT(*) FROM nta_polygons" 2>$null)
if ($ntaCount -eq 0) {
    Write-Step "Importing Brooklyn NTA neighborhood polygons from NYC Open Data..."
    npm run bootstrap:nta 2>&1 | Select-String '(Upserted|Error)' | ForEach-Object { Write-Host "    $_" }
    Write-OK "NTA polygons imported"
} else {
    Write-OK "NTA polygons: $ntaCount neighborhoods"
}

# NYPD safety scores
$safetyCount = [int](Invoke-DB "SELECT COUNT(*) FROM nta_safety_scores" 2>$null)
if ($safetyCount -eq 0) {
    Write-Step "Computing neighborhood safety scores from NYPD open data (1-3 min)..."
    npm run bootstrap:nypd 2>&1 | Select-String '(Safety scores|Error)' | ForEach-Object { Write-Host "    $_" }
    Write-OK "Safety scores computed"
} else {
    Write-OK "Safety scores: $safetyCount NTA records"
}

# Listings
$listingCount = [int](Invoke-DB "SELECT COUNT(*) FROM listings" 2>$null)
if ($listingCount -eq 0) {
    Write-Warn "No listings in database."
    $ans = Read-Host "    Seed 15 sample listings for demo? [Y/n]"
    if ($ans -ne 'n' -and $ans -ne 'N') {
        Write-Step "Seeding sample listings..."
        npm run bootstrap:seed 2>&1 | Select-String '(OK|Error|Done)' | ForEach-Object { Write-Host "    $_" }
        $listingCount = [int](Invoke-DB "SELECT COUNT(*) FROM listings" 2>$null)
        Write-OK "Sample listings seeded"
    }
} else {
    Write-OK "Listings: $listingCount records"
}

# ---------------------------------------------------------------------------
# Section 8: Python helper scripts (auto-detected)
# ---------------------------------------------------------------------------
Invoke-PythonHelpers

# ---------------------------------------------------------------------------
# Section 9: Live scrapers (optional)
# ---------------------------------------------------------------------------
if (-not $SkipScrape) {
    Write-Section "Live Scrapers"
    Write-Host "    Sources: Craigslist, SpareRoom, CozyCozy" -ForegroundColor DarkGray
    Write-Host "    Current listings in DB: $listingCount" -ForegroundColor DarkGray
    $ans = Read-Host "    Run scrapers now? Takes 3-5 min [y/N]"
    if ($ans -eq 'y' -or $ans -eq 'Y') {
        Write-Step "Scraping live listings..."
        npm run scrape 2>&1 | Where-Object { $_ -match '(\+|Summary|TOTAL|====)' } | ForEach-Object { Write-Host "    $_" }
        $newCount = [int](Invoke-DB "SELECT COUNT(*) FROM listings" 2>$null)
        $added = $newCount - $listingCount
        Write-OK "Scrape complete — added $added listings ($newCount total)"
    } else {
        Write-OK "Skipped. Run 'npm run scrape' any time to refresh listings."
    }
}

# ---------------------------------------------------------------------------
# Section 10: Launch
# ---------------------------------------------------------------------------
Write-Section "Launch"

Write-Host ""
Write-Host "  +-------------------------------------------------+" -ForegroundColor Green
Write-Host "  |                                                 |" -ForegroundColor Green
Write-Host "  |   HouseHunter is starting                      |" -ForegroundColor Green
Write-Host "  |                                                 |" -ForegroundColor Green
Write-Host "  |   App       $AppUrl              |" -ForegroundColor Green
Write-Host "  |   Email UI  http://localhost:8025               |" -ForegroundColor Green
Write-Host "  |   DB        localhost:5433 (househunter)        |" -ForegroundColor Green
Write-Host "  |                                                 |" -ForegroundColor Green
Write-Host "  |   Press Ctrl+C to stop the server              |" -ForegroundColor Green
Write-Host "  +-------------------------------------------------+" -ForegroundColor Green
Write-Host ""

# Open browser 5 seconds after server starts
if (-not $SkipBrowser) {
    $url = $AppUrl
    Start-Job { Start-Sleep 5; Start-Process $using:url } | Out-Null
}

# Production or dev server (blocking — Ctrl+C to quit)
if ($Prod) {
    Write-Step "Building production bundle..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail "Production build failed." }
    npm run start
} else {
    npm run dev
}
