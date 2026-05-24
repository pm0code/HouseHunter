/**
 * Seed realistic Brooklyn dev listings with PostGIS-derived spatial data.
 * Skips the OSRM/Nominatim enrichment pipeline — coordinates are pre-supplied.
 * Usage: npm run bootstrap:seed
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { listings, subwayStations, ntaPolygons, ntaSafetyScores } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

const token = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 48);

interface SeedListing {
  address: string;
  unitType: 'studio' | '1br' | '2br';
  furnished: boolean;
  availableFrom: string;
  availableTo: string;
  pricePerMonth: number;
  utilitiesIncluded: 'yes' | 'no' | 'partial';
  brokerFee: boolean;
  securityDeposit: number;
  landlordName: string;
  contactEmail: string;
  contactPhone: string;
  lat: number;
  lon: number;
  sqft: number;
  sourceUrl: string | null;
  photos: string[];
}

function gmaps(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', Brooklyn, NY')}`;
}

function photos(seed: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `https://picsum.photos/seed/${seed}${i + 1}/800/500`,
  );
}

const SEED_DATA: SeedListing[] = [
  {
    address: '345 7th Ave, Park Slope, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 2800, utilitiesIncluded: 'partial',
    brokerFee: false, securityDeposit: 2800,
    landlordName: 'Maria Gonzalez', contactEmail: 'maria@dev.local', contactPhone: '718-555-0101',
    lat: 40.6664, lon: -73.9819, sqft: 680,
    sourceUrl: gmaps('345 7th Ave'), photos: photos('parkslope1', 4),
  },
  {
    address: '187 Bedford Ave, Williamsburg, Brooklyn',
    unitType: 'studio', furnished: true,
    availableFrom: '2026-06-15', availableTo: '2026-12-14',
    pricePerMonth: 2200, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 2200,
    landlordName: 'James Park', contactEmail: 'james@dev.local', contactPhone: '718-555-0102',
    lat: 40.7140, lon: -73.9575, sqft: 420,
    sourceUrl: gmaps('187 Bedford Ave'), photos: photos('williamsburg2', 3),
  },
  {
    address: '45 Water St, DUMBO, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-07-01', availableTo: '2026-12-31',
    pricePerMonth: 3500, utilitiesIncluded: 'no',
    brokerFee: true, securityDeposit: 7000,
    landlordName: 'Realty Partners LLC', contactEmail: 'rentals@dev.local', contactPhone: '718-555-0103',
    lat: 40.7034, lon: -73.9888, sqft: 750,
    sourceUrl: gmaps('45 Water St DUMBO'), photos: photos('dumbo3', 5),
  },
  {
    address: '780 Eastern Pkwy, Crown Heights, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 2100, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 2100,
    landlordName: 'David Okafor', contactEmail: 'david@dev.local', contactPhone: '718-555-0104',
    lat: 40.6694, lon: -73.9437, sqft: 610,
    sourceUrl: gmaps('780 Eastern Pkwy'), photos: photos('crownheights4', 3),
  },
  {
    address: '22 Montague St, Brooklyn Heights, Brooklyn',
    unitType: '2br', furnished: true,
    availableFrom: '2026-07-15', availableTo: '2027-01-14',
    pricePerMonth: 4200, utilitiesIncluded: 'partial',
    brokerFee: false, securityDeposit: 4200,
    landlordName: 'Heights Properties', contactEmail: 'heights@dev.local', contactPhone: '718-555-0105',
    lat: 40.6958, lon: -73.9974, sqft: 1050,
    sourceUrl: gmaps('22 Montague St Brooklyn Heights'), photos: photos('bkheights5', 6),
  },
  {
    address: '112 Nassau Ave, Greenpoint, Brooklyn',
    unitType: 'studio', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 1950, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 1950,
    landlordName: 'Anna Kowalski', contactEmail: 'anna@dev.local', contactPhone: '718-555-0106',
    lat: 40.7296, lon: -73.9512, sqft: 380,
    sourceUrl: gmaps('112 Nassau Ave Greenpoint'), photos: photos('greenpoint6', 2),
  },
  {
    address: '67 Irving Ave, Bushwick, Brooklyn',
    unitType: 'studio', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 1750, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 1750,
    landlordName: 'Carlos Rivera', contactEmail: 'carlos@dev.local', contactPhone: '718-555-0107',
    lat: 40.6968, lon: -73.9215, sqft: 350,
    sourceUrl: gmaps('67 Irving Ave Bushwick'), photos: photos('bushwick7', 3),
  },
  {
    address: '185 DeKalb Ave, Fort Greene, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 2650, utilitiesIncluded: 'partial',
    brokerFee: false, securityDeposit: 2650,
    landlordName: 'Sasha Thompson', contactEmail: 'sasha@dev.local', contactPhone: '718-555-0108',
    lat: 40.6903, lon: -73.9740, sqft: 640,
    sourceUrl: gmaps('185 DeKalb Ave Fort Greene'), photos: photos('fortgreene8', 4),
  },
  {
    address: '234 Court St, Cobble Hill, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-07-01', availableTo: '2026-12-31',
    pricePerMonth: 3100, utilitiesIncluded: 'no',
    brokerFee: false, securityDeposit: 6200,
    landlordName: 'Elena Russo', contactEmail: 'elena@dev.local', contactPhone: '718-555-0109',
    lat: 40.6858, lon: -73.9964, sqft: 720,
    sourceUrl: gmaps('234 Court St Cobble Hill'), photos: photos('cobblehill9', 3),
  },
  {
    address: '4503 4th Ave, Sunset Park, Brooklyn',
    unitType: 'studio', furnished: true,
    availableFrom: '2026-06-15', availableTo: '2026-12-14',
    pricePerMonth: 1600, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 1600,
    landlordName: 'Wei Chen', contactEmail: 'wei@dev.local', contactPhone: '718-555-0110',
    lat: 40.6456, lon: -74.0037, sqft: 360,
    sourceUrl: gmaps('4503 4th Ave Sunset Park'), photos: photos('sunsetpark10', 2),
  },
  {
    address: '392 Marcus Garvey Blvd, Bed-Stuy, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 2000, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 2000,
    landlordName: 'Marcus Williams', contactEmail: 'marcus@dev.local', contactPhone: '718-555-0111',
    lat: 40.6872, lon: -73.9398, sqft: 590,
    sourceUrl: gmaps('392 Marcus Garvey Blvd Bed-Stuy'), photos: photos('bedstuy11', 3),
  },
  {
    address: '156 Smith St, Carroll Gardens, Brooklyn',
    unitType: '2br', furnished: true,
    availableFrom: '2026-07-01', availableTo: '2026-12-31',
    pricePerMonth: 3800, utilitiesIncluded: 'partial',
    brokerFee: false, securityDeposit: 3800,
    landlordName: 'Francesca Bianchi', contactEmail: 'francesca@dev.local', contactPhone: '718-555-0112',
    lat: 40.6795, lon: -73.9990, sqft: 920,
    sourceUrl: gmaps('156 Smith St Carroll Gardens'), photos: photos('carrollgardens12', 5),
  },
  {
    address: '421 Vanderbilt Ave, Prospect Heights, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-06-01', availableTo: '2026-11-30',
    pricePerMonth: 2900, utilitiesIncluded: 'partial',
    brokerFee: false, securityDeposit: 2900,
    landlordName: 'Nina Patel', contactEmail: 'nina@dev.local', contactPhone: '718-555-0113',
    lat: 40.6773, lon: -73.9636, sqft: 660,
    sourceUrl: gmaps('421 Vanderbilt Ave Prospect Heights'), photos: photos('prospectheights13', 4),
  },
  {
    address: '256 Prospect Ave, Windsor Terrace, Brooklyn',
    unitType: '1br', furnished: true,
    availableFrom: '2026-07-01', availableTo: '2026-12-31',
    pricePerMonth: 2400, utilitiesIncluded: 'yes',
    brokerFee: false, securityDeposit: 2400,
    landlordName: 'Tom Brady', contactEmail: 'tom@dev.local', contactPhone: '718-555-0114',
    lat: 40.6559, lon: -73.9807, sqft: 630,
    sourceUrl: gmaps('256 Prospect Ave Windsor Terrace'), photos: photos('windsorterrace14', 3),
  },
  {
    address: '88 Atlantic Ave, Boerum Hill, Brooklyn',
    unitType: '2br', furnished: false,
    availableFrom: '2026-06-15', availableTo: '2026-12-14',
    pricePerMonth: 3400, utilitiesIncluded: 'no',
    brokerFee: true, securityDeposit: 6800,
    landlordName: 'Pacific Realty', contactEmail: 'pacific@dev.local', contactPhone: '718-555-0115',
    lat: 40.6896, lon: -73.9876, sqft: 980,
    sourceUrl: gmaps('88 Atlantic Ave Boerum Hill'), photos: photos('boerumhill15', 4),
  },
];

async function main() {
  console.log(`Seeding ${SEED_DATA.length} dev listings...`);

  for (const seed of SEED_DATA) {
    // Find nearest station via PostGIS
    const [stationRow] = await db.execute<{ id: number; walk_seconds: number }>(sql`
      SELECT id,
             ROUND(ST_Distance(geom::geography,
               ST_SetSRID(ST_MakePoint(${seed.lon}, ${seed.lat}), 4326)::geography) / 1.4)::int
               AS walk_seconds
      FROM subway_stations
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${seed.lon}, ${seed.lat}), 4326)
      LIMIT 1
    `);

    // Find containing NTA via PostGIS
    const [ntaRow] = await db.execute<{ id: number }>(sql`
      SELECT id FROM nta_polygons
      WHERE ST_Within(
        ST_SetSRID(ST_MakePoint(${seed.lon}, ${seed.lat}), 4326),
        geom
      )
      LIMIT 1
    `);

    // Get safety score for that NTA
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
      address: seed.address,
      unitType: seed.unitType,
      furnished: seed.furnished,
      availableFrom: seed.availableFrom,
      availableTo: seed.availableTo,
      pricePerMonth: seed.pricePerMonth,
      utilitiesIncluded: seed.utilitiesIncluded,
      brokerFee: seed.brokerFee,
      securityDeposit: seed.securityDeposit,
      contactEmail: seed.contactEmail,
      contactPhone: seed.contactPhone,
      landlordName: seed.landlordName,
      photos: seed.photos,
      submissionToken: token(),
      approvalToken: token(),
      status: 'published',
      lat: seed.lat,
      lon: seed.lon,
      geom: sql`ST_SetSRID(ST_MakePoint(${seed.lon}, ${seed.lat}), 4326)`,
      nearestStationId: stationRow ? Number(stationRow.id) : null,
      walkTimeSeconds: walkSecs,
      ntaId: ntaRow ? Number(ntaRow.id) : null,
      safetyScore,
      safetyTier,
      sqft: seed.sqft,
      sourceUrl: seed.sourceUrl,
      publishedAt: new Date(),
    } as any).onConflictDoNothing();

    console.log(`  ✓ ${seed.address} — $${seed.pricePerMonth}/mo, ${Math.round(walkSecs / 60)}min walk, ${safetyTier} safety`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
