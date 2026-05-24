import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings, subwayStations, ntaPolygons } from '@/lib/db/schema';
import { valkey, CACHE_TTL } from '@/lib/valkey';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import type { PublishedListing } from '@/types';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const minPrice = Number(sp.get('minPrice') ?? 1500);
  const maxPrice = Number(sp.get('maxPrice') ?? 5000);
  const unitTypesParam = sp.get('unitTypes');
  const unitTypes = unitTypesParam ? unitTypesParam.split(',') : [];
  const linesParam = sp.get('lines');
  const lines = linesParam ? linesParam.split(',') : [];
  const maxWalkMinutes = Number(sp.get('maxWalkMinutes') ?? 15);
  const furnished = sp.get('furnished') !== 'false';
  const maxCrimeTier = sp.get('maxCrimeTier') ?? 'any';
  const availableFrom = sp.get('availableFrom'); // YYYY-MM-DD or null
  const durationDays = Number(sp.get('durationDays') ?? 30);

  const cacheKey = `listings:${sp.toString()}`;

  // Serve from Valkey cache if available
  const cached = await valkey.get(cacheKey).catch(() => null);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  const conditions = [
    eq(listings.status, 'published'),
    gte(listings.pricePerMonth, minPrice),
    lte(listings.pricePerMonth, maxPrice),
    lte(listings.walkTimeSeconds, maxWalkMinutes * 60),
  ];

  if (furnished) conditions.push(eq(listings.furnished, true));
  if (unitTypes.length) conditions.push(inArray(listings.unitType, unitTypes as ('studio' | '1br' | '2br')[]));
  if (maxCrimeTier === 'medium') conditions.push(inArray(listings.safetyTier, ['low', 'medium']));
  if (maxCrimeTier === 'low') conditions.push(eq(listings.safetyTier, 'low'));

  // Date filter: listing must be available for the entire requested window
  if (availableFrom) {
    const fromDate = availableFrom; // YYYY-MM-DD
    const toDate = new Date(new Date(availableFrom).getTime() + durationDays * 86400000)
      .toISOString().slice(0, 10);
    conditions.push(lte(listings.availableFrom, fromDate));
    conditions.push(gte(listings.availableTo, toDate));
  }


  const rows = await db
    .select({
      id: listings.id,
      address: listings.address,
      unitType: listings.unitType,
      furnished: listings.furnished,
      availableFrom: listings.availableFrom,
      availableTo: listings.availableTo,
      pricePerMonth: listings.pricePerMonth,
      utilitiesIncluded: listings.utilitiesIncluded,
      brokerFee: listings.brokerFee,
      securityDeposit: listings.securityDeposit,
      contactEmail: listings.contactEmail,
      landlordName: listings.landlordName,
      photos: listings.photos,
      lat: listings.lat,
      lon: listings.lon,
      walkTimeSeconds: listings.walkTimeSeconds,
      routeGeoJson: listings.routeGeoJson,
      safetyScore: listings.safetyScore,
      safetyTier: listings.safetyTier,
      sqft: listings.sqft,
      sourceUrl: listings.sourceUrl,
      publishedAt: listings.publishedAt,
      // joined
      stationName: subwayStations.name,
      stationLines: subwayStations.lines,
      ntaName: ntaPolygons.ntaName,
    })
    .from(listings)
    .leftJoin(subwayStations, eq(listings.nearestStationId, subwayStations.id))
    .leftJoin(ntaPolygons, eq(listings.ntaId, ntaPolygons.id))
    .where(and(...conditions))
    .orderBy(listings.pricePerMonth);

  // Filter by subway line if specified
  const filtered = lines.length
    ? rows.filter((r) =>
        lines.some((line) =>
          line.split('/').some((l) => r.stationLines?.includes(l)),
        ),
      )
    : rows;

  const result: PublishedListing[] = filtered.map((r) => ({
    id: r.id,
    address: r.address,
    unitType: r.unitType as PublishedListing['unitType'],
    furnished: r.furnished,
    availableFrom: r.availableFrom,
    availableTo: r.availableTo,
    pricePerMonth: r.pricePerMonth,
    utilitiesIncluded: r.utilitiesIncluded as PublishedListing['utilitiesIncluded'],
    brokerFee: r.brokerFee,
    securityDeposit: r.securityDeposit,
    contactEmail: r.contactEmail,
    landlordName: r.landlordName,
    photos: r.photos ?? [],
    lat: r.lat!,
    lon: r.lon!,
    nearestStationName: r.stationName ?? '',
    nearestStationLines: r.stationLines ?? [],
    walkTimeSeconds: r.walkTimeSeconds ?? 0,
    routeGeoJson: r.routeGeoJson as GeoJSON.Feature | null,
    ntaName: r.ntaName ?? '',
    safetyTier: (r.safetyTier ?? 'medium') as PublishedListing['safetyTier'],
    safetyScore: r.safetyScore ?? 0,
    sqft: r.sqft ?? null,
    sourceUrl: r.sourceUrl ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? '',
  }));

  await valkey
    .setex(cacheKey, CACHE_TTL.listingsQuery, JSON.stringify(result))
    .catch(() => {});

  return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });
}
