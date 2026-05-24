/**
 * Shared PostGIS enrichment + DB insert for all scrapers.
 * Deduplicates by sourceUrl — skips if already stored.
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { listings, ntaSafetyScores } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

const token = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 48);

export interface ScrapedListing {
  address: string;
  unitType: 'studio' | '1br' | '2br';
  furnished: boolean;
  availableFrom: string; // YYYY-MM-DD
  availableTo: string;   // YYYY-MM-DD
  pricePerMonth: number;
  utilitiesIncluded: 'yes' | 'no' | 'partial';
  brokerFee: boolean;
  securityDeposit: number;
  photos: string[];
  sourceUrl: string;
  sourceName: string; // e.g. 'Craigslist', 'SpareRoom'
  lat: number;
  lon: number;
  sqft: number | null;
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sixMonthsFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

export function inferUnitType(text: string): 'studio' | '1br' | '2br' {
  const t = text.toLowerCase();
  if (t.includes('studio') || t.includes('0br') || t.includes('0 br')) return 'studio';
  if (t.includes('2br') || t.includes('2 br') || t.includes('2bed') || t.includes('2 bed') || t.includes('two bed')) return '2br';
  return '1br';
}

export async function insertScrapedListing(scraped: ScrapedListing): Promise<boolean> {
  // Deduplication — skip if this source URL is already in the DB
  const existing = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.sourceUrl, scraped.sourceUrl))
    .limit(1);
  if (existing.length > 0) return false;

  // Nearest subway station via PostGIS
  const [stationRow] = await db.execute<{ id: number; walk_seconds: number }>(sql`
    SELECT id,
           ROUND(ST_Distance(geom::geography,
             ST_SetSRID(ST_MakePoint(${scraped.lon}, ${scraped.lat}), 4326)::geography) / 1.4)::int
             AS walk_seconds
    FROM subway_stations
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${scraped.lon}, ${scraped.lat}), 4326)
    LIMIT 1
  `);

  // Containing NTA via PostGIS
  const [ntaRow] = await db.execute<{ id: number }>(sql`
    SELECT id FROM nta_polygons
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(${scraped.lon}, ${scraped.lat}), 4326),
      geom
    )
    LIMIT 1
  `);

  // Safety score for that NTA
  let safetyScore = 0;
  let safetyTier: 'low' | 'medium' | 'high' = 'medium';
  if (ntaRow) {
    const [scoreRow] = await db
      .select({ score: ntaSafetyScores.incidentsPerSqkm, tier: ntaSafetyScores.tier })
      .from(ntaSafetyScores)
      .where(eq(ntaSafetyScores.ntaId, ntaRow.id))
      .limit(1);
    if (scoreRow) {
      safetyScore = scoreRow.score;
      safetyTier = scoreRow.tier as 'low' | 'medium' | 'high';
    }
  }

  const walkSecs = stationRow ? Number(stationRow.walk_seconds) : 480;

  await db.insert(listings).values({
    address: scraped.address,
    unitType: scraped.unitType,
    furnished: scraped.furnished,
    availableFrom: scraped.availableFrom,
    availableTo: scraped.availableTo,
    pricePerMonth: scraped.pricePerMonth,
    utilitiesIncluded: scraped.utilitiesIncluded,
    brokerFee: scraped.brokerFee,
    securityDeposit: scraped.securityDeposit,
    landlordName: `Listed on ${scraped.sourceName}`,
    contactEmail: 'noreply@househunter.local',
    contactPhone: null,
    photos: scraped.photos,
    submissionToken: token(),
    approvalToken: token(),
    status: 'published',
    lat: scraped.lat,
    lon: scraped.lon,
    geom: sql`ST_SetSRID(ST_MakePoint(${scraped.lon}, ${scraped.lat}), 4326)`,
    nearestStationId: stationRow ? Number(stationRow.id) : null,
    walkTimeSeconds: walkSecs,
    ntaId: ntaRow ? Number(ntaRow.id) : null,
    safetyScore,
    safetyTier,
    sqft: scraped.sqft,
    sourceUrl: scraped.sourceUrl,
    publishedAt: new Date(),
  } as any);

  console.log(`  ✓ [${scraped.sourceName}] ${scraped.address} — $${scraped.pricePerMonth}/mo, ${Math.round(walkSecs / 60)}min walk, ${safetyTier} safety`);
  return true;
}
