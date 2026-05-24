'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowCounterClockwise,
  MagnifyingGlass,
  ListBullets,
  Sliders,
  X,
} from '@phosphor-icons/react';
import { useMapStore } from '@/store/map';
import { useSearchStore } from '@/store/search';
import { ListingList } from '@/components/listings/ListingList';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { PropertyDetailPanel } from '@/components/listings/PropertyDetailPanel';
import { SearchPanel } from '@/components/search/SearchPanel';
import type { PublishedListing } from '@/types';

function SafetyLegend() {
  return (
    <div
      role="note"
      aria-label="Safety overlay legend"
      className="flex flex-col gap-1 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs shadow-md"
    >
      <p className="font-semibold text-foreground mb-0.5">Reported Incidents</p>
      {[
        { color: 'bg-green-500', label: 'Low', desc: 'Below avg.' },
        { color: 'bg-amber-500', label: 'Med', desc: 'Average' },
        { color: 'bg-red-500',   label: 'High', desc: 'Above avg.' },
      ].map(({ color, label, desc }) => (
        <div key={label} className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} aria-hidden />
          <span className="font-medium w-7">{label}</span>
          <span className="text-muted-foreground">{desc}</span>
        </div>
      ))}
      <p className="text-muted-foreground/70 mt-0.5 leading-tight">
        NYPD data · prior 12 mo.
      </p>
    </div>
  );
}

// ── Desktop sidebar content ────────────────────────────────────────────────────
function TabContent({
  activeTab,
  selectedListing,
}: {
  activeTab: 'search' | 'results';
  selectedListing: PublishedListing | null;
}) {
  if (activeTab === 'search') return <SearchPanel />;
  if (selectedListing) return <><FilterPanel /><PropertyDetailPanel listing={selectedListing} /></>;
  return <><FilterPanel /><ListingList /></>;
}

// ── Mobile sheet content (FilterPanel excluded — surfaced via FilterModal) ────
function MobileTabContent({
  activeTab,
  selectedListing,
}: {
  activeTab: 'search' | 'results';
  selectedListing: PublishedListing | null;
}) {
  if (activeTab === 'search') return <SearchPanel />;
  if (selectedListing) return <PropertyDetailPanel listing={selectedListing} />;
  return <ListingList />;
}

// ── Mobile main bottom sheet (FR-4.1) ─────────────────────────────────────────
function MobileSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`md:hidden absolute left-0 right-0 z-30 flex flex-col bottom-14
        bg-card rounded-t-2xl border-t border-x border-border shadow-2xl
        transition-transform duration-300 ease-out will-change-transform
        ${open ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ height: 'calc(82dvh - 3.5rem)' }}
      role="complementary"
      aria-label="Property panel"
    >
      <button
        onClick={onClose}
        aria-label="Collapse panel"
        className="flex items-center justify-center py-2.5 shrink-0"
      >
        <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
      </button>
      <div className="flex flex-col flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── Filter modal (FR-4.2) ──────────────────────────────────────────────────────
function FilterModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(onClose, [onClose]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  return (
    <>
      {open && (
        <div
          className="md:hidden absolute inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`md:hidden absolute left-0 right-0 bottom-14 z-50 flex flex-col
          bg-card rounded-t-2xl border-t border-x border-border shadow-2xl
          transition-transform duration-300 ease-out will-change-transform
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '60dvh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm">Filters</span>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close filters"
            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FilterPanel />
        </div>
      </div>
    </>
  );
}

// ── Mobile bottom nav ──────────────────────────────────────────────────────────
function MobileNav({
  activeTab,
  sheetOpen,
  onTab,
  onFilter,
}: {
  activeTab: 'search' | 'results';
  sheetOpen: boolean;
  onTab: (tab: 'search' | 'results') => void;
  onFilter: () => void;
}) {
  return (
    <div className="md:hidden absolute bottom-0 left-0 right-0 z-40 h-14 flex border-t border-border bg-card/95 backdrop-blur-md">
      {([
        { tab: 'search',  Icon: MagnifyingGlass, label: 'Search'  },
        { tab: 'results', Icon: ListBullets,      label: 'Results' },
      ] as const).map(({ tab, Icon, label }) => {
        const active = sheetOpen && activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onTab(tab)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors
              ${active ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Icon size={18} weight={active ? 'fill' : 'regular'} />
            {label}
          </button>
        );
      })}
      <button
        onClick={onFilter}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Sliders size={18} />
        Filter
      </button>
    </div>
  );
}

const MapView = dynamic(() => import('./MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <span className="text-muted-foreground text-sm">Loading map…</span>
    </div>
  ),
});

export function MapLayout() {
  const {
    selectedListing,
    triggerMapReset,
    safetyOverlayVisible,
    filterPanelOpen,
    setFilterPanelOpen,
  } = useMapStore();
  const { activeTab, setActiveTab } = useSearchStore();

  const [sheetOpen, setSheetOpen] = useState(false);

  // Auto-open Results sheet on mobile when a pin is selected
  useEffect(() => {
    if (!selectedListing) return;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setSheetOpen(true);
      setActiveTab('results');
    }
  }, [selectedListing, setActiveTab]);

  function handleMobileTab(tab: 'search' | 'results') {
    if (sheetOpen && activeTab === tab) {
      setSheetOpen(false);
    } else {
      setActiveTab(tab);
      setSheetOpen(true);
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* Map column — full width on mobile, 60% on desktop */}
      <div className="relative flex-1 md:flex-[3] min-w-0 h-full">
        <MapView />

        {/* Reset button — above mobile nav bar */}
        <button
          onClick={triggerMapReset}
          title="Reset map to Brooklyn overview"
          className="absolute bottom-16 md:bottom-8 left-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md hover:bg-accent transition-colors"
        >
          <ArrowCounterClockwise size={14} weight="bold" />
          Reset view
        </button>

        {/* Safety legend — above mobile nav bar */}
        {safetyOverlayVisible && (
          <div className="absolute bottom-16 md:bottom-8 right-3 z-10">
            <SafetyLegend />
          </div>
        )}

        {/* Mobile UI — hidden on desktop via md:hidden inside each component */}
        <MobileNav
          activeTab={activeTab}
          sheetOpen={sheetOpen}
          onTab={handleMobileTab}
          onFilter={() => setFilterPanelOpen(true)}
        />
        <MobileSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <MobileTabContent activeTab={activeTab} selectedListing={selectedListing} />
        </MobileSheet>
        <FilterModal open={filterPanelOpen} onClose={() => setFilterPanelOpen(false)} />
      </div>

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex flex-col flex-[2] min-w-[300px] max-w-[480px] h-full border-l border-border overflow-hidden">
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

        {/* Desktop tab content */}
        <TabContent activeTab={activeTab} selectedListing={selectedListing} />
      </div>
    </div>
  );
}
