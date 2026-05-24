'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DotsSixVertical,
  Train,
  ShieldCheck,
  Storefront,
  CurrencyDollar,
  MagnifyingGlass,
  FloppyDisk,
  Check,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useSearchStore, PRIORITY_LABELS, type Priority } from '@/store/search';
import { useListingFilters } from '@/hooks/useListingFilters';
import { DEFAULT_FILTERS } from '@/types';

const PRIORITY_ICONS: Record<Priority, PhosphorIcon> = {
  subway:    Train,
  safety:    ShieldCheck,
  amenities: Storefront,
  price:     CurrencyDollar,
};

const UNIT_TYPES = [
  { value: '', label: 'Any' },
  { value: 'studio', label: 'Studio' },
  { value: '1br', label: '1 BR' },
  { value: '2br', label: '2 BR' },
] as const;

const FURNISHED_OPTIONS = [
  { value: null, label: 'Any' },
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
] as const;

const BROOKLYN_NEIGHBORHOODS = [
  'Bay Ridge', 'Bed-Stuy', 'Bensonhurst', 'Bergen Beach', 'Boerum Hill',
  'Borough Park', 'Brighton Beach', 'Brooklyn Heights', 'Brownsville', 'Bushwick',
  'Canarsie', 'Carroll Gardens', 'Clinton Hill', 'Cobble Hill', 'Coney Island',
  'Crown Heights', 'DUMBO', 'Ditmas Park', 'Downtown Brooklyn', 'East Flatbush',
  'East New York', 'Flatbush', 'Flatlands', 'Fort Greene', 'Gowanus',
  'Gravesend', 'Greenpoint', 'Greenwood', 'Kensington', 'Manhattan Beach',
  'Marine Park', 'Midwood', 'Mill Basin', 'Navy Yard', 'Park Slope',
  'Prospect Heights', 'Prospect Lefferts Gardens', 'Red Hook', 'Sea Gate',
  'Sheepshead Bay', 'Sunset Park', 'Williamsburg', 'Windsor Terrace',
];

const PRICE_STEP = 100;
const PRICE_MIN = 500;
const PRICE_MAX = 8000;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Drag-to-rank priority list ─────────────────────────────────────────────
//
// Uses pointer events (not HTML5 drag API) so it works reliably in all
// browsers. The grip handle captures the pointer; pointermove on window
// computes the insertion slot from the live DOM positions of each row.
//
// Indicator rules (items stay fixed while dragging):
//   dragging UP   (from > to) → blue line BEFORE the target row
//   dragging DOWN (from < to) → blue line AFTER  the target row
//
// Slot-to-index adjustment for downward moves:
//   When moving down, removing `from` shifts everything above up by one, so
//   the visual slot the cursor is over corresponds to (slot − 1) in the
//   original array.
// ──────────────────────────────────────────────────────────────────────────
function PriorityList() {
  const { priorities, reorderPriorities } = useSearchStore();

  // Keep drag state in both a ref (for event callbacks) and state (for render)
  const dragRef = useRef<{ from: number; to: number } | null>(null);
  const [drag, setDragState] = useState<{ from: number; to: number } | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  function syncDrag(d: { from: number; to: number } | null) {
    dragRef.current = d;
    setDragState(d);
  }

  function startDrag(e: React.PointerEvent, from: number) {
    e.preventDefault();
    syncDrag({ from, to: from });

    function computeTo(clientY: number, from: number): number {
      const refs = itemRefs.current;
      let slot = -1; // -1 = cursor is below all items

      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        const { top, height } = el.getBoundingClientRect();
        if (clientY < top + height / 2) {
          slot = i;
          break;
        }
      }

      if (slot === -1) return priorities.length - 1; // after last item
      if (slot > from) return slot - 1;              // dragging down: compensate for gap
      return slot;                                    // dragging up (or same)
    }

    function onMove(ev: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      const to = computeTo(ev.clientY, d.from);
      syncDrag({ from: d.from, to });
    }

    function onUp() {
      const d = dragRef.current;
      if (d && d.from !== d.to) reorderPriorities(d.from, d.to);
      syncDrag(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  return (
    <div className={drag ? 'select-none' : ''}>
      <div className="space-y-1.5">
        {priorities.map((p, index) => {
          const isDraggingThis = drag?.from === index;
          const showBefore = drag !== null && drag.from > drag.to && drag.to === index;
          const showAfter  = drag !== null && drag.from < drag.to && drag.to === index;

          return (
            <div key={p}>
              {showBefore && (
                <div className="h-0.5 rounded-full bg-primary mx-3 mb-1.5 shadow-[0_0_6px_1px] shadow-primary/50" />
              )}

              <div
                ref={(el) => { itemRefs.current[index] = el; }}
                className={[
                  'flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors',
                  isDraggingThis
                    ? 'opacity-35 border-dashed border-primary/40 bg-primary/5'
                    : 'border-border bg-card hover:bg-accent/40',
                ].join(' ')}
              >
                {/* Grip handle — this is the only draggable surface */}
                <div
                  onPointerDown={(e) => startDrag(e, index)}
                  className="shrink-0 touch-none cursor-grab active:cursor-grabbing rounded p-0.5 -ml-0.5 hover:bg-muted"
                  title="Drag to reorder"
                >
                  <DotsSixVertical size={16} className="text-muted-foreground/60" />
                </div>

                {/* Rank badge */}
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {index + 1}
                </span>

                {(() => { const Icon = PRIORITY_ICONS[p]; return <Icon size={16} weight="duotone" className="text-primary shrink-0" />; })()}
                <span className="text-sm font-medium flex-1">{PRIORITY_LABELS[p]}</span>
              </div>

              {showAfter && (
                <div className="h-0.5 rounded-full bg-primary mx-3 mt-1.5 shadow-[0_0_6px_1px] shadow-primary/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRIORITIES_STORAGE_KEY = 'househunter:priorities';

// ── Main panel ─────────────────────────────────────────────────────────────
export function SearchPanel() {
  const {
    neighborhood, setNeighborhood, setActiveTab, setHasSearched,
    priorities, setPriorities,
  } = useSearchStore();
  const [filters, setFilters] = useListingFilters();

  const [savedPriorities, setSavedPriorities] = useState<Priority[] | null>(null);

  // Hydrate priority order from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(PRIORITIES_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Priority[];
      setSavedPriorities(parsed);
      setPriorities(parsed);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSaved =
    savedPriorities !== null &&
    savedPriorities.length === priorities.length &&
    savedPriorities.every((p, i) => p === priorities[i]);

  function handleSavePriorities() {
    localStorage.setItem(PRIORITIES_STORAGE_KEY, JSON.stringify(priorities));
    setSavedPriorities([...priorities]);
  }

  // Raw string values for price inputs — committed/clamped on blur
  const [rawMin, setRawMin] = useState(String(filters.minPrice));
  const [rawMax, setRawMax] = useState(String(filters.maxPrice));

  // Keep raw state in sync if filters change externally (e.g. URL change)
  useEffect(() => setRawMin(String(filters.minPrice)), [filters.minPrice]);
  useEffect(() => setRawMax(String(filters.maxPrice)), [filters.maxPrice]);

  const activeUnitType = filters.unitTypes.length === 1 ? filters.unitTypes[0] : '';

  function setUnitType(value: string) {
    setFilters({ unitTypes: value ? [value] : [] });
  }

  function commitMin() {
    const n = clamp(Number(rawMin) || PRICE_MIN, PRICE_MIN, filters.maxPrice - PRICE_STEP);
    setRawMin(String(n));
    setFilters({ minPrice: n });
  }

  function commitMax() {
    const n = clamp(Number(rawMax) || PRICE_MAX, filters.minPrice + PRICE_STEP, PRICE_MAX);
    setRawMax(String(n));
    setFilters({ maxPrice: n });
  }

  function handleSearch() {
    // Commit any price values the user typed without blurring first
    const min = clamp(Number(rawMin) || PRICE_MIN, PRICE_MIN, PRICE_MAX - PRICE_STEP);
    const max = clamp(Number(rawMax) || PRICE_MAX, min + PRICE_STEP, PRICE_MAX);
    setFilters({ minPrice: min, maxPrice: max });
    setRawMin(String(min));
    setRawMax(String(max));
    setHasSearched(true);
    setActiveTab('results');
  }

  const furnishedValue = filters.furnished === true ? true : filters.furnished === false ? false : null;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
      <div className="px-4 py-4 space-y-5">

        {/* Neighborhood */}
        <div>
          <label className="block text-xs font-semibold mb-1.5">Location / Neighborhood</label>
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="e.g. Park Slope, Williamsburg, DUMBO…"
            list="neighborhoods"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <datalist id="neighborhoods">
            {BROOKLYN_NEIGHBORHOODS.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>

        {/* Property type */}
        <div>
          <p className="text-xs font-semibold mb-1.5">Property type</p>
          <div className="grid grid-cols-4 gap-1.5">
            {UNIT_TYPES.map(({ value, label }) => (
              <button
                key={label}
                onClick={() => setUnitType(value)}
                aria-pressed={activeUnitType === value}
                className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                  activeUnitType === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div>
          <p className="text-xs font-semibold mb-1.5">Price / month</p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
              <input
                type="number"
                value={rawMin}
                onChange={(e) => setRawMin(e.target.value)}
                onBlur={commitMin}
                onKeyDown={(e) => e.key === 'Enter' && commitMin()}
                placeholder={String(PRICE_MIN)}
                className="w-full rounded-md border border-input bg-background pl-6 pr-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Min price"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
              <input
                type="number"
                value={rawMax}
                onChange={(e) => setRawMax(e.target.value)}
                onBlur={commitMax}
                onKeyDown={(e) => e.key === 'Enter' && commitMax()}
                placeholder={String(PRICE_MAX)}
                className="w-full rounded-md border border-input bg-background pl-6 pr-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Max price"
              />
            </div>
          </div>
        </div>

        {/* Priority list */}
        <div>
          <p className="text-xs font-semibold mb-0.5">What matters most?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Grab <DotsSixVertical size={12} className="inline translate-y-[1px]" /> and drag to reorder.
          </p>
          <PriorityList />
          <button
            onClick={handleSavePriorities}
            disabled={isSaved}
            className={`mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors ${
              isSaved
                ? 'text-green-600 dark:text-green-400 cursor-default'
                : 'text-primary hover:opacity-75'
            }`}
          >
            {isSaved ? (
              <><Check size={13} weight="bold" />Order saved</>
            ) : (
              <><FloppyDisk size={13} weight="bold" />Save order</>
            )}
          </button>
        </div>

        {/* Furnished */}
        <div>
          <p className="text-xs font-semibold mb-1.5">Furnished</p>
          <div className="grid grid-cols-3 gap-1.5">
            {FURNISHED_OPTIONS.map(({ value, label }) => (
              <button
                key={label}
                onClick={() =>
                  setFilters({ furnished: value === null ? DEFAULT_FILTERS.furnished : (value as boolean) })
                }
                aria-pressed={furnishedValue === value}
                className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                  furnishedValue === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search button — sticky at bottom */}
      <div className="sticky bottom-0 p-4 bg-card border-t border-border mt-auto">
        <button
          onClick={handleSearch}
          className="w-full rounded-lg bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <MagnifyingGlass size={15} weight="bold" />
          Search Brooklyn
        </button>
      </div>
    </div>
  );
}
