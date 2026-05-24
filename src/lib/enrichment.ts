import { db } from './db';
import { listings, subwayStations, ntaPolygons, ntaSafetyScores } from './db/schema';
import { eq, sql } from 'drizzle-orm';

const NOMINATIM_URL =
  process.env.NOMINATIM_URL ?? 'http://localhost:7070';
const OSRM_URL =
  process.env.OSRM_URL ?? 'http://localhost:5000';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface OsrmRouteResponse {
  code: string;
  routes: Array<{
    duration: number;
    distance: number;
    geometry: GeoJSON.LineString;
  }>;
}

async function geocode(address: string): Promise<{ lat: number; lon: number }> {
  const params = new URLSearchParams({
    q: `${address}, Brooklyn, New York`,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  });
  const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const results: NominatimResult[] = await res.json();
  if (!results.length) throw new Error(`No geocoding result for: ${address}`);
  return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
}

async function getWalkRoute(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
): Promise<{ durationSeconds: number; geometry: GeoJSON.LineString }> {
  const coords = `${fromLon},${fromLat};${toLon},${toLat}`;
  const res = await fetch(
    `${OSRM_URL}/route/v1/foot/${coords}?overview=full&geometries=geojson`,
  );
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data: OsrmRouteResponse = await res.json();
  if (data.code !== 'Ok' || !data.routes.length)
    throw new Error('OSRM returned no route');
  return {
    durationSeconds: Math.round(data.routes[0].duration),
    geometry: data.routes[0].geometry,
  };
}

export async function enrichListing(listingId: string): Promise<void> {
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId));

  if (!listing) throw new Error(`Listing not found: ${listingId}`);

  // 1. Geocode address
  const { lat, lon } = await geocode(listing.address);
  const wkt = `POINT(${lon} ${lat})`;

  // 2. Find nearest subway station via PostGIS ST_Distance
  const [nearestStation] = await db
    .select({
      id: subwayStations.id,
      name: subwayStations.name,
      lines: subwayStations.lines,
      lon: subwayStations.lon,
      lat: subwayStations.lat,
    })
    .from(subwayStations)
    .orderBy(
      sql`${subwayStations.geom} <-> ST_SetSRID(ST_GeomFromText(${wkt}), 4326)`,
    )
    .limit(1);

  if (!nearestStation) throw new Error('No subway stations in database');

  // 3. Compute walk route via OSRM
  const { durationSeconds, geometry: routeGeometry } = await getWalkRoute(
    lon,
    lat,
    nearestStation.lon,
    nearestStation.lat,
  );

  const routeFeature: GeoJSON.Feature = {
    type: 'Feature',
    geometry: routeGeometry,
    properties: {
      walkTimeSeconds: durationSeconds,
      stationName: nearestStation.name,
    },
  };

  // 4. Assign NTA polygon via ST_Within
  const [nta] = await db
    .select({ id: ntaPolygons.id, ntaName: ntaPolygons.ntaName })
    .from(ntaPolygons)
    .where(
      sql`ST_Within(ST_SetSRID(ST_GeomFromText(${wkt}), 4326), ${ntaPolygons.geom})`,
    )
    .limit(1);

  // 5. Look up safety score
  let safetyScore: number | null = null;
  let safetyTier: 'low' | 'medium' | 'high' | null = null;

  if (nta) {
    const [score] = await db
      .select()
      .from(ntaSafetyScores)
      .where(eq(ntaSafetyScores.ntaId, nta.id))
      .limit(1);
    if (score) {
      safetyScore = score.incidentsPerSqkm;
      safetyTier = score.tier;
    }
  }

  // 6. Persist enrichment results
  await db
    .update(listings)
    .set({
      lat,
      lon,
      geom: sql`ST_SetSRID(ST_GeomFromText(${wkt}), 4326)`,
      nearestStationId: nearestStation.id,
      walkTimeSeconds: durationSeconds,
      routeGeoJson: routeFeature,
      ntaId: nta?.id ?? null,
      safetyScore,
      safetyTier,
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));
}
