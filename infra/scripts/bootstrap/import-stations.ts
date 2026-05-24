/**
 * Import Brooklyn subway stations from data.ny.gov Socrata endpoint.
 * Run once at bootstrap, then weekly to pick up station changes.
 * Usage: npm run bootstrap:stations
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { subwayStations } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const ENDPOINT =
  'https://data.ny.gov/resource/5f5g-n3cz.json?borough=Bk&$limit=500';

interface SocrataStation {
  complex_id: string;
  stop_name: string;
  daytime_routes: string;
  ada: string;
  latitude: string;
  longitude: string;
}

async function main() {
  console.log('Fetching Brooklyn subway stations from data.ny.gov...');
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const raw: SocrataStation[] = await res.json();
  console.log(`Fetched ${raw.length} stations`);

  const rows = raw
    .filter((s) => s.latitude && s.longitude)
    .map((s) => {
      const lat = Number(s.latitude);
      const lon = Number(s.longitude);
      return {
        stationId: s.complex_id,
        name: s.stop_name,
        lines: s.daytime_routes?.split(' ').filter(Boolean) ?? [],
        ada: s.ada === '1',
        lat,
        lon,
        geom: sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`,
        borough: 'BK',
        complexId: Number(s.complex_id),
      };
    });

  if (!rows.length) throw new Error('No valid station rows to insert');

  await db
    .insert(subwayStations)
    .values(rows as any)
    .onConflictDoUpdate({
      target: subwayStations.stationId,
      set: {
        name: sql`excluded.name`,
        lines: sql`excluded.lines`,
        ada: sql`excluded.ada`,
        lat: sql`excluded.lat`,
        lon: sql`excluded.lon`,
        geom: sql`excluded.geom`,
      },
    });

  console.log(`Upserted ${rows.length} stations`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
