/**
 * Download NYPD complaint data and compute NTA safety scores.
 * Run quarterly after each NYPD dataset update.
 * Usage: npm run bootstrap:nypd
 *
 * Requires: NTA polygons already imported (npm run bootstrap:nta)
 * Requires: NYCOPENDATA_APP_TOKEN in .env.local (free at data.cityofnewyork.us)
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { ntaPolygons, ntaSafetyScores } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

const NYPD_ENDPOINT =
  'https://data.cityofnewyork.us/resource/5uac-w243.json' +
  '?boro_nm=BROOKLYN' +
  `&$where=cmplnt_fr_dt>'${cutoffDate}'` +
  '&$select=latitude,longitude' +
  '&$limit=500000';

interface NypdComplaint {
  latitude: string;
  longitude: string;
}

function assignTiers(scores: number[]): Map<number, 'low' | 'medium' | 'high'> {
  const sorted = [...scores].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)];
  const p66 = sorted[Math.floor(sorted.length * 0.66)];
  const result = new Map<number, 'low' | 'medium' | 'high'>();
  for (const s of scores) {
    result.set(s, s <= p33 ? 'low' : s <= p66 ? 'medium' : 'high');
  }
  return result;
}

async function main() {
  const headers: Record<string, string> = {};
  if (process.env.NYCOPENDATA_APP_TOKEN) {
    headers['X-App-Token'] = process.env.NYCOPENDATA_APP_TOKEN;
  } else {
    console.warn('NYCOPENDATA_APP_TOKEN not set — requests may be rate-limited');
  }

  console.log('Fetching NYPD complaint data...');
  const res = await fetch(NYPD_ENDPOINT, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const complaints: NypdComplaint[] = await res.json();
  const valid = complaints.filter((c) => c.latitude && c.longitude);
  console.log(`${valid.length} complaints with coordinates`);

  const ntas = await db
    .select({ id: ntaPolygons.id })
    .from(ntaPolygons)
    .where(eq(ntaPolygons.borough, 'Brooklyn'));

  console.log(`Computing scores for ${ntas.length} NTAs...`);

  // Cap at 50K to avoid a single enormous VALUES clause
  const sample = valid.slice(0, 50000);

  const countRows: Array<{ nta_id: number; count: string; area_sqkm: string }> =
    await db.execute(sql`
      WITH pts AS (
        SELECT ST_SetSRID(ST_MakePoint(v.lon::float, v.lat::float), 4326) AS geom
        FROM (VALUES
          ${sql.raw(
            sample.map((c) => `(${c.longitude},${c.latitude})`).join(','),
          )}
        ) AS v(lon, lat)
      )
      SELECT
        n.id                                          AS nta_id,
        COUNT(p.geom)                                 AS count,
        ST_Area(n.geom::geography) / 1000000.0        AS area_sqkm
      FROM nta_polygons n
      LEFT JOIN pts p ON ST_Within(p.geom, n.geom)
      WHERE n.borough = 'Brooklyn'
      GROUP BY n.id, n.geom
    `);

  const scores = countRows.map(
    (r) => Number(r.count) / Math.max(Number(r.area_sqkm), 0.01),
  );
  const tierMap = assignTiers(scores);

  for (let i = 0; i < countRows.length; i++) {
    const row = countRows[i];
    const score = scores[i];
    const tier = tierMap.get(score) ?? 'medium';

    await db
      .insert(ntaSafetyScores)
      .values({
        ntaId: row.nta_id,
        incidentCount: Number(row.count),
        incidentsPerSqkm: score,
        tier,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: ntaSafetyScores.ntaId,
        set: {
          incidentCount: sql`excluded.incident_count`,
          incidentsPerSqkm: sql`excluded.incidents_per_sqkm`,
          tier: sql`excluded.tier`,
          computedAt: sql`excluded.computed_at`,
        },
      });
  }

  console.log(`Safety scores written for ${countRows.length} NTAs`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
