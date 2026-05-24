'use client';

import { Footprints, Train, Shield, Armchair, ShieldCheck } from '@phosphor-icons/react';
import { useListingFilters } from '@/hooks/useListingFilters';
import { useMapStore } from '@/store/map';

const SUBWAY_LINES = ['A', 'C', '2', '3', '4', '5', 'B', 'D', 'F', 'G', 'J', 'L', 'M', 'N', 'Q', 'R', 'W'] as const;
const WALK_OPTIONS = [5, 10, 15] as const;

export function FilterPanel() {
  const [filters, setFilters] = useListingFilters();
  const { safetyOverlayVisible, toggleSafetyOverlay, subwayMarkersVisible, toggleSubwayMarkers } =
    useMapStore();

  function toggleLine(line: string) {
    setFilters((prev) => ({
      lines: prev.lines.includes(line)
        ? prev.lines.filter((l) => l !== line)
        : [...prev.lines, line],
    }));
  }

  return (
    <div className="border-b border-border bg-card shrink-0">
      {/* Map layer toggles */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60">
        <span className="text-xs text-muted-foreground font-medium mr-1">Map:</span>
        <button
          onClick={toggleSafetyOverlay}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            safetyOverlayVisible
              ? 'bg-orange-500/15 border-orange-500 text-orange-600'
              : 'border-input hover:bg-muted text-muted-foreground'
          }`}
        >
          <ShieldCheck size={12} weight={safetyOverlayVisible ? 'fill' : 'regular'} />
          Safety
        </button>
        <button
          onClick={toggleSubwayMarkers}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            subwayMarkersVisible
              ? 'bg-blue-500/15 border-blue-500 text-blue-600'
              : 'border-input hover:bg-muted text-muted-foreground'
          }`}
        >
          <Train size={12} weight={subwayMarkersVisible ? 'fill' : 'regular'} />
          Subway
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Walk time */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-16 shrink-0 flex items-center gap-1"><Footprints size={12} weight="duotone" />Walk:</span>
          <div className="flex gap-1.5">
            {WALK_OPTIONS.map((mins) => {
              const active = filters.maxWalkMinutes === mins;
              return (
                <button
                  key={mins}
                  onClick={() => setFilters({ maxWalkMinutes: mins })}
                  aria-pressed={active}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                  }`}
                >
                  ≤{mins}m
                </button>
              );
            })}
          </div>
        </div>

        {/* Crime level */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-16 shrink-0 flex items-center gap-1"><Shield size={12} weight="duotone" />Crime:</span>
          <div className="flex gap-1.5">
            {([['any', 'Any'], ['medium', '≤ Med'], ['low', 'Low only']] as const).map(([value, label]) => {
              const active = filters.maxCrimeTier === value;
              return (
                <button
                  key={value}
                  onClick={() => setFilters({ maxCrimeTier: value })}
                  aria-pressed={active}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subway lines */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-16 shrink-0 flex items-center gap-1"><Train size={12} weight="duotone" />Lines:</span>
          <div className="flex flex-wrap gap-1">
            {SUBWAY_LINES.map((line) => {
              const active = filters.lines.includes(line);
              return (
                <button
                  key={line}
                  onClick={() => toggleLine(line)}
                  aria-pressed={active}
                  className={`w-6 h-6 rounded-full border text-xs font-bold transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                  }`}
                >
                  {line}
                </button>
              );
            })}
          </div>
        </div>

        {/* Furnished toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0 flex items-center gap-1"><Armchair size={12} weight="duotone" />Furn.:</span>
          <button
            onClick={() => setFilters({ furnished: !filters.furnished })}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              filters.furnished ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
            }`}
          >
            {filters.furnished ? 'Yes' : 'Any'}
          </button>
        </div>
      </div>
    </div>
  );
}
