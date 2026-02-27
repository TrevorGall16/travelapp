import { create } from 'zustand';
import type { Event, EventCategory } from '../types';

interface MapFilters {
  radius: number; // metres — default 5000 (5 km)
  category: EventCategory | null;
}

interface MapState {
  events: Event[];
  filters: MapFilters;
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  removeEvent: (id: string) => void;
  setFilters: (partial: Partial<MapFilters>) => void;
}

export const useMapStore = create<MapState>()((set) => ({
  events: [],
  filters: { radius: 5000, category: null },

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => ({
      // Deduplicate — ignore if we already have this event id
      events: state.events.some((e) => e.id === event.id)
        ? state.events
        : [...state.events, event],
    })),

  updateEvent: (event) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === event.id ? event : e)),
    })),

  removeEvent: (id) =>
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    })),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
}));
