'use client';

import dynamic from 'next/dynamic';
import { useMapStore } from '@/store/map';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { useSearchStore } from '@/store/search';
import { ListingList } from '@/components/listings/ListingList';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { PropertyDetailPanel } from '@/components/listings/PropertyDetailPanel';
import { SearchPanel } from '@/components/search/SearchPanel';

const MapView = dynamic(() => import('./MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <span className="text-muted-foreground text-sm">Loading map…</span>
    </div>
  ),
});

export function MapLayout() {
  const { selectedListing, triggerMapReset } = useMapStore();
  const { activeTab, setActiveTab } = useSearchStore();

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Map — 60% */}
      <div className="relative flex-[3] min-w-0 h-full">
        <MapView />
        <button
          onClick={triggerMapReset}
          title="Reset map to Brooklyn overview"
          className="absolute bottom-8 left-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md hover:bg-accent transition-colors"
        >
          <ArrowCounterClockwise size={14} weight="bold" />
          Reset view
        </button>
      </div>

      {/* Sidebar — 40% */}
      <div className="flex flex-col flex-[2] min-w-[300px] max-w-[480px] h-full border-l border-border overflow-hidden">
        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-border bg-card">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'results'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Results
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'search' ? (
          <SearchPanel />
        ) : selectedListing ? (
          <>
            <FilterPanel />
            <PropertyDetailPanel listing={selectedListing} />
          </>
        ) : (
          <>
            <FilterPanel />
            <ListingList />
          </>
        )}
      </div>
    </div>
  );
}
