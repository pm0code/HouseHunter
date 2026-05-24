import { create } from 'zustand';
import type { PublishedListing } from '@/types';

interface MapViewport {
  longitude: number;
  latitude: number;
  zoom: number;
}

export const BROOKLYN_CENTER: MapViewport = {
  longitude: -73.9496,
  latitude: 40.6501,
  zoom: 12,
};

interface MapState {
  viewport: MapViewport;
  setViewport: (viewport: MapViewport) => void;

  hoveredListingId: string | null;
  setHoveredListingId: (id: string | null) => void;

  selectedListing: PublishedListing | null;
  setSelectedListing: (listing: PublishedListing | null) => void;

  safetyOverlayVisible: boolean;
  toggleSafetyOverlay: () => void;

  subwayMarkersVisible: boolean;
  toggleSubwayMarkers: () => void;

  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;

  mapResetSignal: number;
  triggerMapReset: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: BROOKLYN_CENTER,
  setViewport: (viewport) => set({ viewport }),

  hoveredListingId: null,
  setHoveredListingId: (hoveredListingId) => set({ hoveredListingId }),

  selectedListing: null,
  setSelectedListing: (selectedListing) => set({ selectedListing }),

  safetyOverlayVisible: false,
  toggleSafetyOverlay: () =>
    set((s) => ({ safetyOverlayVisible: !s.safetyOverlayVisible })),

  subwayMarkersVisible: false,
  toggleSubwayMarkers: () =>
    set((s) => ({ subwayMarkersVisible: !s.subwayMarkersVisible })),

  filterPanelOpen: false,
  setFilterPanelOpen: (filterPanelOpen) => set({ filterPanelOpen }),

  mapResetSignal: 0,
  triggerMapReset: () => set((s) => ({ mapResetSignal: s.mapResetSignal + 1 })),
}));
