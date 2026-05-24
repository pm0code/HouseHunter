import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings, subwayStations, ntaPolygons } from '@/lib/db/schema';
import { valkey, CACHE_TTL } from '@/lib/valkey';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cacheKey = `listing:${id}`;

  const cached = await valkey.get(cacheKey).catch(() => null);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  const [row] = await db
    .select({
      listing: listings,
      stationName: subwayStations.name,
      stationLines: subwayStations.lines,
      ntaName: ntaPolygons.ntaName,
    })
    .from(listings)
    .leftJoin(subwayStations, eq(listings.nearestStationId, subwayStations.id))
    .leftJoin(ntaPolygons, eq(listings.ntaId, ntaPolygons.id))
    .where(eq(listings.id, id))
    .limit(1);

  if (!row || row.listing.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = {
    ...row.listing,
    nearestStationName: row.stationName,
    nearestStationLines: row.stationLines,
    ntaName: row.ntaName,
  };

  await valkey
    .setex(cacheKey, CACHE_TTL.listingDetail, JSON.stringify(result))
    .catch(() => {});

  return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });
}
