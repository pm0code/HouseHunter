import { create } from 'zustand';

export type Priority = 'subway' | 'safety' | 'amenities' | 'price';

export const PRIORITY_LABELS: Record<Priority, string> = {
  subway: 'Close to subway',
  safety: 'Safe neighborhood',
  amenities: 'Shops & restaurants nearby',
  price: 'Lowest price',
};


interface SearchState {
  activeTab: 'search' | 'results';
  setActiveTab: (tab: 'search' | 'results') => void;

  neighborhood: string;
  setNeighborhood: (v: string) => void;

  // All 4 priorities, always present — index = rank (0 = most important)
  priorities: Priority[];
  reorderPriorities: (from: number, to: number) => void;

  hasSearched: boolean;
  setHasSearched: (v: boolean) => void;

  setPriorities: (priorities: Priority[]) => void;

  // Ordered listing IDs as shown in the sidebar — used to number map pins
  rankedListingIds: string[];
  setRankedListingIds: (ids: string[]) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  activeTab: 'search',
  setActiveTab: (activeTab) => set({ activeTab }),

  neighborhood: '',
  setNeighborhood: (neighborhood) => set({ neighborhood }),

  priorities: ['subway', 'safety', 'price', 'amenities'],
  reorderPriorities: (from, to) =>
    set((s) => {
      if (from === to) return s;
      const arr = [...s.priorities];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { priorities: arr };
    }),

  setPriorities: (priorities) => set({ priorities }),

  hasSearched: false,
  setHasSearched: (hasSearched) => set({ hasSearched }),

  rankedListingIds: [],
  setRankedListingIds: (rankedListingIds) => set({ rankedListingIds }),
}));
