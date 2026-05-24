export type ListingStatus = 'pending' | 'published' | 'rejected' | 'removed';
export type UnitType = 'studio' | '1br' | '2br';
export type UtilitiesIncluded = 'yes' | 'no' | 'partial';
export type SafetyTier = 'low' | 'medium' | 'high';
export type SubwayLine = 'A' | 'C' | 'E' | '2' | '3' | '4' | '5' | 'F' | 'G' | 'L' | 'J' | 'M' | 'N' | 'Q' | 'R' | 'W' | 'B' | 'D';

export interface PublishedListing {
  id: string;
  address: string;
  unitType: UnitType;
  furnished: boolean;
  availableFrom: string;
  availableTo: string;
  pricePerMonth: number;
  utilitiesIncluded: UtilitiesIncluded;
  brokerFee: boolean;
  securityDeposit: number;
  contactEmail: string;
  landlordName: string;
  photos: string[];
  lat: number;
  lon: number;
  nearestStationName: string;
  nearestStationLines: string[];
  walkTimeSeconds: number;
  routeGeoJson: GeoJSON.Feature | null;
  ntaName: string;
  safetyTier: SafetyTier;
  safetyScore: number;
  sqft: number | null;
  sourceUrl: string | null;
  publishedAt: string;
}

export interface SubwayStation {
  id: number;
  stationId: string;
  name: string;
  lines: string[];
  ada: boolean;
  lat: number;
  lon: number;
  borough: string;
}

export interface NtaPolygon {
  id: number;
  ntaCode: string;
  ntaName: string;
  borough: string;
}

export interface NtaSafetyScore {
  ntaId: number;
  incidentCount: number;
  incidentsPerSqkm: number;
  tier: SafetyTier;
  computedAt: string;
}

// 'any' = show all tiers, 'medium' = hide high crime, 'low' = only low crime
export type MaxCrimeTier = 'any' | 'medium' | 'low';

// Filter state shape — drives nuqs URL params
export interface ListingFilters {
  minPrice: number;
  maxPrice: number;
  unitTypes: string[];
  lines: string[];
  maxWalkMinutes: number;
  availableFrom: string | null;
  durationDays: number;
  furnished: boolean;
  maxCrimeTier: MaxCrimeTier;
}

export const DEFAULT_FILTERS: ListingFilters = {
  minPrice: 1500,
  maxPrice: 3500,
  unitTypes: [],
  lines: [],
  maxWalkMinutes: 15,
  availableFrom: null,
  durationDays: 30,
  furnished: true,
  maxCrimeTier: 'any',
};
