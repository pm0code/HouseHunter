import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subwayStations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db
    .select({
      id: subwayStations.id,
      name: subwayStations.name,
      lines: subwayStations.lines,
      lat: subwayStations.lat,
      lon: subwayStations.lon,
    })
    .from(subwayStations)
    .where(eq(subwayStations.borough, 'BK'));

  const features = rows.map((r) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
    properties: { id: r.id, name: r.name, lines: r.lines },
  }));

  return NextResponse.json(
    { type: 'FeatureCollection', features },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
