import { create } from 'zustand';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  coordinates: Coordinates | null;
  permissionStatus: PermissionStatus | null;
  /** City name derived from reverse geocoding — used as Realtime subscription filter.
   *  NOTE: A `city` TEXT column must be added to the `events` table in Supabase
   *  so the server can scope CDC subscriptions per city and prevent global data leaks. */
  city: string | null;
  setCoordinates: (coords: Coordinates | null) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  setCity: (city: string | null) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  coordinates: null,
  permissionStatus: null,
  city: null,
  setCoordinates: (coordinates) => set({ coordinates }),
  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
  setCity: (city) => set({ city }),
}));
