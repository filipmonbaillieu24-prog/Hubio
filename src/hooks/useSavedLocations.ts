import { useState, useCallback } from 'react';
import { SavedLocation } from '../types/route';

const STORAGE_KEY = 'cyclo_saved_locations';

function load(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedLocation[]) : [];
  } catch {
    return [];
  }
}

function persist(locations: SavedLocation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

/**
 * Hook that manages saved start locations using localStorage for persistence.
 * Data survives app restarts; no backend required.
 */
export function useSavedLocations() {
  const [locations, setLocations] = useState<SavedLocation[]>(load);

  const save = useCallback((name: string, lat: number, lng: number) => {
    const newLoc: SavedLocation = {
      id: crypto.randomUUID(),
      name: name.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng,
      savedAt: Date.now(),
    };
    setLocations((prev) => {
      const updated = [newLoc, ...prev];
      persist(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setLocations((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  const rename = useCallback((id: string, newName: string) => {
    setLocations((prev) => {
      const updated = prev.map((l) => l.id === id ? { ...l, name: newName.trim() || l.name } : l);
      persist(updated);
      return updated;
    });
  }, []);

  return { locations, save, remove, rename };
}
