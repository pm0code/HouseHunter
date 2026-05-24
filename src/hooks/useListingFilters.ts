'use client';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsBoolean,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { DEFAULT_FILTERS } from '@/types';

const filterParsers = {
  minPrice: parseAsInteger.withDefault(DEFAULT_FILTERS.minPrice),
  maxPrice: parseAsInteger.withDefault(DEFAULT_FILTERS.maxPrice),
  unitTypes: parseAsArrayOf(parseAsString).withDefault(DEFAULT_FILTERS.unitTypes),
  lines: parseAsArrayOf(parseAsString).withDefault(DEFAULT_FILTERS.lines),
  maxWalkMinutes: parseAsInteger.withDefault(DEFAULT_FILTERS.maxWalkMinutes),
  availableFrom: parseAsString,
  durationDays: parseAsInteger.withDefault(DEFAULT_FILTERS.durationDays),
  furnished: parseAsBoolean.withDefault(DEFAULT_FILTERS.furnished),
  maxCrimeTier: parseAsStringLiteral(['any', 'medium', 'low'] as const).withDefault(DEFAULT_FILTERS.maxCrimeTier),
};

export function useListingFilters() {
  return useQueryStates(filterParsers, { shallow: true });
}
