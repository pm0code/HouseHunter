'use client';

import { useQuery } from '@tanstack/react-query';
import type { ListingFilters, PublishedListing } from '@/types';

async function fetchListings(filters: Partial<ListingFilters>): Promise<PublishedListing[]> {
  const params = new URLSearchParams();
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.unitTypes?.length) params.set('unitTypes', filters.unitTypes.join(','));
  if (filters.lines?.length) params.set('lines', filters.lines.join(','));
  if (filters.maxWalkMinutes)
    params.set('maxWalkMinutes', String(filters.maxWalkMinutes));
  if (filters.availableFrom) params.set('availableFrom', filters.availableFrom);
  if (filters.durationDays)
    params.set('durationDays', String(filters.durationDays));
  if (filters.furnished != null)
    params.set('furnished', String(filters.furnished));
  if (filters.maxCrimeTier && filters.maxCrimeTier !== 'any')
    params.set('maxCrimeTier', filters.maxCrimeTier);

  const res = await fetch(`/api/listings?${params}`);
  if (!res.ok) throw new Error('Failed to fetch listings');
  return res.json();
}

export function useListings(filters: Partial<ListingFilters>) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: () => fetchListings(filters),
  });
}
