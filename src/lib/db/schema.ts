import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  date,
  serial,
  customType,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// PostGIS geometry column — raw WKT/WKB roundtrip; spatial ops done via sql`` tags
const geometryPoint = customType<{ data: string }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

const geometryMultiPolygon = customType<{ data: string }>({
  dataType() {
    return 'geometry(MultiPolygon, 4326)';
  },
});

export const subwayStations = pgTable(
  'subway_stations',
  {
    id: serial('id').primaryKey(),
    stationId: text('station_id').notNull().unique(),
    name: text('name').notNull(),
    lines: text('lines').array().notNull().default(sql`'{}'::text[]`),
    ada: boolean('ada').notNull().default(false),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    geom: geometryPoint('geom').notNull(),
    borough: text('borough').notNull(),
    complexId: integer('complex_id'),
  },
  (t) => ({
    geomIdx: index('subway_stations_geom_idx').using('gist', sql`${t.geom}`),
  }),
);

export const ntaPolygons = pgTable(
  'nta_polygons',
  {
    id: serial('id').primaryKey(),
    ntaCode: text('nta_code').notNull().unique(),
    ntaName: text('nta_name').notNull(),
    borough: text('borough').notNull(),
    geom: geometryMultiPolygon('geom').notNull(),
  },
  (t) => ({
    geomIdx: index('nta_polygons_geom_idx').using('gist', sql`${t.geom}`),
  }),
);

export const ntaSafetyScores = pgTable('nta_safety_scores', {
  id: serial('id').primaryKey(),
  ntaId: integer('nta_id')
    .notNull()
    .references(() => ntaPolygons.id)
    .unique(),
  incidentCount: integer('incident_count').notNull(),
  incidentsPerSqkm: doublePrecision('incidents_per_sqkm').notNull(),
  tier: text('tier', { enum: ['low', 'medium', 'high'] }).notNull(),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
});

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: text('status', {
      enum: ['pending', 'published', 'rejected', 'removed'],
    })
      .notNull()
      .default('pending'),
    address: text('address').notNull(),
    unitType: text('unit_type', { enum: ['studio', '1br', '2br'] }).notNull(),
    furnished: boolean('furnished').notNull().default(true),
    availableFrom: date('available_from').notNull(),
    availableTo: date('available_to').notNull(),
    pricePerMonth: integer('price_per_month').notNull(),
    utilitiesIncluded: text('utilities_included', {
      enum: ['yes', 'no', 'partial'],
    }).notNull(),
    brokerFee: boolean('broker_fee').notNull().default(false),
    securityDeposit: integer('security_deposit').notNull().default(0),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone'),
    landlordName: text('landlord_name').notNull(),
    photos: text('photos').array().notNull().default(sql`'{}'::text[]`),
    submissionToken: text('submission_token').notNull().unique(),
    approvalToken: text('approval_token').notNull().unique(),
    // enrichment — set after admin approval
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    geom: geometryPoint('geom'),
    nearestStationId: integer('nearest_station_id').references(
      () => subwayStations.id,
    ),
    walkTimeSeconds: integer('walk_time_seconds'),
    routeGeoJson: jsonb('route_geo_json'),
    ntaId: integer('nta_id').references(() => ntaPolygons.id),
    safetyScore: doublePrecision('safety_score'),
    safetyTier: text('safety_tier', { enum: ['low', 'medium', 'high'] }),
    sqft: integer('sqft'),
    sourceUrl: text('source_url'),
    // timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    publishedAt: timestamp('published_at'),
  },
  (t) => ({
    statusIdx: index('listings_status_idx').on(t.status),
    priceIdx: index('listings_price_idx').on(t.pricePerMonth),
    geomIdx: index('listings_geom_idx').using('gist', sql`${t.geom}`),
  }),
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type SubwayStation = typeof subwayStations.$inferSelect;
export type NtaPolygon = typeof ntaPolygons.$inferSelect;
export type NtaSafetyScore = typeof ntaSafetyScores.$inferSelect;
