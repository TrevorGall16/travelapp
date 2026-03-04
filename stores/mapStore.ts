import { create } from 'zustand';
import type { Event, EventCategory } from '../types';

interface MapFilters {
  radius: number; // metres — default 5000 (5 km)
  category: EventCategory | null;
}

interface MapState {
  events: Event[];
  filters: MapFilters;
  /** Monotonic counter — incremented on every event mutation to force supercluster rebuild. */
  mapKey: number;
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  removeEvent: (id: string) => void;
  setFilters: (partial: Partial<MapFilters>) => void;
}

export const useMapStore = create<MapState>()((set) => ({
  events: [],
  filters: { radius: 5000, category: null },
  mapKey: 0,

  setEvents: (events) => set((state) => ({ events, mapKey: state.mapKey + 1 })),

  addEvent: (event) =>
    set((state) => {
      if (state.events.some((e) => e.id === event.id)) return state;
      return { events: [...state.events, event], mapKey: state.mapKey + 1 };
    }),

  updateEvent: (event) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === event.id ? event : e)),
      mapKey: state.mapKey + 1,
    })),

  removeEvent: (id) =>
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      mapKey: state.mapKey + 1,
    })),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
}));
