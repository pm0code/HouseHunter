'use client';

import { useEffect, useMemo } from 'react';
import { Footprints, Train, Shield, ShieldCheck, ShieldWarning } from '@phosphor-icons/react';
import { useMapStore } from '@/store/map';
import { useSearchStore, type Priority } from '@/store/search';
import { useListings } from '@/hooks/useListings';
import { useListingFilters } from '@/hooks/useListingFilters';
import type { PublishedListing } from '@/types';

const TIER_SCORE: Record<string, number> = { low: 0, medium: 1, high: 2 };

function sortByPriorities(listings: PublishedListing[], priorities: Priority[]) {
  if (!priorities.length) return listings;
  return [...listings].sort((a, b) => {
    for (const p of priorities) {
      let diff = 0;
      if (p === 'subway') diff = (a.walkTimeSeconds ?? 999) - (b.walkTimeSeconds ?? 999);
      else if (p === 'safety') diff = (TIER_SCORE[a.safetyTier] ?? 1) - (TIER_SCORE[b.safetyTier] ?? 1);
      else if (p === 'price') diff = a.pricePerMonth - b.pricePerMonth;
      // 'amenities' has no data yet — skip
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

function filterByNeighborhood(listings: PublishedListing[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return listings;
  return listings.filter(
    (l) =>
      l.address.toLowerCase().includes(q) ||
      l.ntaName.toLowerCase().includes(q),
  );
}

function formatPrice(n: number) {
  return `$${n.toLocaleString()}/mo`;
}

function walkLabel(s: number) {
  return `${Math.round(s / 60)} min walk`;
}

function ListingCard({ listing, rank }: { listing: PublishedListing; rank: number }) {
  const { hoveredListingId, setHoveredListingId, setSelectedListing } = useMapStore();
  const isHovered = hoveredListingId === listing.id;

  return (
    <button
      className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
        isHovered ? 'bg-accent' : 'hover:bg-muted/50'
      }`}
      onMouseEnter={() => setHoveredListingId(listing.id)}
      onMouseLeave={() => setHoveredListingId(null)}
      onClick={() => setSelectedListing(listing)}
    >
      {listing.photos[0] && (
        <img
          src={listing.photos[0].startsWith('http') ? listing.photos[0] : `/uploads/${listing.photos[0]}`}
          alt={listing.address}
          className="w-full h-36 object-cover rounded-md mb-2"
        />
      )}
      <div className="flex items-start gap-2.5">
        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm truncate leading-tight">{listing.address}</p>
            <p className="font-bold text-sm shrink-0 text-primary">{formatPrice(listing.pricePerMonth)}</p>
          </div>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {listing.unitType}
            {listing.sqft ? ` · ${listing.sqft.toLocaleString()} sqft` : ''}
            {' · '}
            {listing.utilitiesIncluded === 'yes' ? 'Utilities incl.' : 'Utilities extra'}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Footprints size={12} weight="duotone" className="shrink-0" />
            <span>{walkLabel(listing.walkTimeSeconds)}</span>
            {listing.nearestStationName && (
              <>
                <Train size={12} weight="duotone" className="shrink-0 ml-0.5" />
                <span className="truncate">{listing.nearestStationName}</span>
              </>
            )}
            {(() => {
              const tier = listing.safetyTier;
              const Icon = tier === 'low' ? ShieldCheck : tier === 'medium' ? Shield : ShieldWarning;
              const color = tier === 'low' ? 'text-green-400' : tier === 'medium' ? 'text-amber-400' : 'text-red-400';
              const label = tier === 'low' ? 'Low' : tier === 'medium' ? 'Med' : 'High';
              return (
                <span className={`ml-auto font-medium shrink-0 flex items-center gap-0.5 ${color}`}>
                  <Icon size={12} weight="fill" />
                  {label} crime
                </span>
              );
            })()}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ListingList() {
  const [filters] = useListingFilters();
  const { data: raw, isLoading, isError } = useListings(filters);
  const { priorities, neighborhood, setRankedListingIds } = useSearchStore();

  const listings = useMemo(() => {
    if (!raw) return [];
    const geo = filterByNeighborhood(raw, neighborhood);
    return sortByPriorities(geo, priorities);
  }, [raw, neighborhood, priorities]);

  useEffect(() => {
    setRankedListingIds(listings.map((l) => l.id));
  }, [listings, setRankedListingIds]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        Failed to load listings.
      </div>
    );
  }

  if (!listings.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
        <span>No listings match your criteria.</span>
        {neighborhood && (
          <span className="text-xs">Try a broader neighborhood or clear the location filter.</span>
        )}
      </div>
    );
  }

  const sortLabel = priorities[0]
    ? { subway: 'subway proximity', safety: 'safety', price: 'price', amenities: 'amenities' }[priorities[0]]
    : 'price';

  return (
    <div className="flex-1 overflow-y-auto">
      <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
        {listings.length} listing{listings.length !== 1 ? 's' : ''} · sorted by {sortLabel}
      </p>
      {listings.map((l, i) => (
        <ListingCard key={l.id} listing={l} rank={i + 1} />
      ))}
    </div>
  );
}
