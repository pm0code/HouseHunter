/**
 * Import Brooklyn NTA polygons from NYC Open Data (2020 vintage).
 * Run once at bootstrap. Re-run when NYC Planning releases updated NTAs.
 * Usage: npm run bootstrap:nta
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { ntaPolygons } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const GEOJSON_URL =
  "https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$where=boroname='Brooklyn'&$limit=100";

interface NtaFeature {
  type: 'Feature';
  geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  properties: {
    nta2020: string;
    ntaname: string;
    boroname: string;
  };
}

interface NtaFeatureCollection {
  type: 'FeatureCollection';
  features: NtaFeature[];
}

async function main() {
  console.log('Fetching Brooklyn NTA polygons from NYC Open Data...');
  const res = await fetch(GEOJSON_URL, {
    headers: process.env.NYCOPENDATA_APP_TOKEN
      ? { 'X-App-Token': process.env.NYCOPENDATA_APP_TOKEN }
      : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const fc: NtaFeatureCollection = await res.json();
  console.log(`Fetched ${fc.features.length} NTA polygons`);

  for (const feature of fc.features) {
    const { nta2020, ntaname, boroname } = feature.properties;
    const geom =
      feature.geometry.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [feature.geometry.coordinates] }
        : feature.geometry;

    const geojsonStr = JSON.stringify(geom);

    await db
      .insert(ntaPolygons)
      .values({
        ntaCode: nta2020,
        ntaName: ntaname,
        borough: boroname,
        geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326)`,
      } as any)
      .onConflictDoUpdate({
        target: ntaPolygons.ntaCode,
        set: {
          ntaName: sql`excluded.nta_name`,
          geom: sql`excluded.geom`,
        },
      });
  }

  console.log(`Upserted ${fc.features.length} NTA polygons`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
