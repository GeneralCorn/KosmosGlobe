import { create } from "zustand";
import type {
  Category,
  CountryHeat,
  Filters,
  NewsEvent,
} from "./types";

type StoreState = {
  events: NewsEvent[];
  countryHeat: CountryHeat[];
  selectedSignalId: string | null;
  filters: Filters;
  version: number;
  setEvents: (events: NewsEvent[]) => void;
  setCountryHeat: (heat: CountryHeat[]) => void;
  setSelectedSignal: (id: string | null) => void;
  setFilters: (filters: Filters) => void;
  toggleCategory: (category: Category) => void;
  clearFilters: () => void;
};

export const useStore = create<StoreState>((set, get) => ({
  events: [],
  countryHeat: [],
  selectedSignalId: null,
  filters: { categories: null },
  version: 0,
  setEvents: (events) =>
    set((state) => ({ events, version: state.version + 1 })),
  setCountryHeat: (heat) =>
    set((state) => ({ countryHeat: heat, version: state.version + 1 })),
  setSelectedSignal: (id) => set({ selectedSignalId: id }),
  setFilters: (filters) =>
    set((state) => ({ filters, version: state.version + 1 })),
  toggleCategory: (category) => {
    const current = get().filters.categories ?? [];
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    set((state) => ({
      filters: { categories: next.length === 0 ? null : next },
      version: state.version + 1,
    }));
  },
  clearFilters: () =>
    set((state) => ({
      filters: { categories: null },
      version: state.version + 1,
    })),
}));

export const useVisibleEvents = (): NewsEvent[] =>
  useStore((state) => {
    const cats = state.filters.categories;
    if (!cats || cats.length === 0) {
      return state.events;
    }
    const allowed = new Set(cats);
    return state.events.filter((e) => allowed.has(e.category));
  });

export const useSelectedEvent = (): NewsEvent | null =>
  useStore((state) => {
    if (!state.selectedSignalId) {
      return null;
    }
    return state.events.find((e) => e.id === state.selectedSignalId) ?? null;
  });

export const useCountryHeat = (): CountryHeat[] =>
  useStore((state) => state.countryHeat);

export const useStoreVersion = (): number =>
  useStore((state) => state.version);
