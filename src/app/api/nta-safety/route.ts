import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ntaPolygons, ntaSafetyScores } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db.execute<{
    nta_code: string;
    nta_name: string;
    tier: string;
    incidents_per_sqkm: number;
    geojson: string;
  }>(sql`
    SELECT
      n.nta_code,
      n.nta_name,
      s.tier,
      s.incidents_per_sqkm,
      ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0001)) AS geojson
    FROM nta_polygons n
    LEFT JOIN nta_safety_scores s ON s.nta_id = n.id
    WHERE n.borough = 'Brooklyn'
  `);

  const features = rows.map((r) => ({
    type: 'Feature' as const,
    properties: {
      ntaCode: r.nta_code,
      ntaName: r.nta_name,
      tier: r.tier ?? 'medium',
      incidentsPerSqkm: r.incidents_per_sqkm ?? 0,
    },
    geometry: JSON.parse(r.geojson),
  }));

  return NextResponse.json(
    { type: 'FeatureCollection', features },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
