import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Ride, Gear } from '../types/workout';

// ─── Schema ───────────────────────────────────────────────────────────────────

interface CycloDB extends DBSchema {
  rides: {
    key:     string;
    value:   Ride;
    indexes: { byDate: number };
  };
  gear: {
    key:     string;
    value:   Gear;
  };
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let _db: IDBPDatabase<CycloDB> | null = null;

async function getDB(): Promise<IDBPDatabase<CycloDB>> {
  if (_db) return _db;
  _db = await openDB<CycloDB>('cyclo-workouts', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('rides', { keyPath: 'id' });
        store.createIndex('byDate', 'date');
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('gear')) {
          db.createObjectStore('gear', { keyPath: 'id' });
        }
      }
    },
  });
  return _db;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function saveRide(ride: Ride): Promise<void> {
  const db = await getDB();
  await db.put('rides', ride);
}

export async function getRide(id: string): Promise<Ride | undefined> {
  const db = await getDB();
  return db.get('rides', id);
}

/** Returns ride summaries (no GPS points) sorted newest first.
 * bestEfforts and bestSpeedEfforts ARE included for dashboard PRs. */
export async function getAllRideSummaries(): Promise<(Omit<Ride, 'points'>)[]> {
  const db    = await getDB();
  const rides = await db.getAllFromIndex('rides', 'byDate');
  return rides.reverse().map(({ points: _p, ...rest }) => rest);
}

export async function getAllRides(): Promise<Ride[]> {
  const db = await getDB();
  const rides = await db.getAllFromIndex('rides', 'byDate');
  return rides.reverse();
}

export async function deleteRide(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('rides', id);
}

export async function getAllRidesFull(): Promise<Ride[]> {
  const db = await getDB();
  return db.getAll('rides');
}

export async function rideExists(id: string): Promise<boolean> {
  const db = await getDB();
  const key = await db.getKey('rides', id);
  return key !== undefined;
}

/** Patch metadata (notes, label, weather) on an existing ride without recomputing. */
export async function updateRideMeta(
  id: string,
  patch: Partial<Pick<import('../types/workout').Ride, 'notes' | 'label' | 'weather' | 'gearId' | 'rpe' | 'aiAnalysis'>>
): Promise<void> {
  const db   = await getDB();
  const ride = await db.get('rides', id);
  if (!ride) return;
  await db.put('rides', { ...ride, ...patch });
}

// ─── Gear Tracker API ─────────────────────────────────────────────────────────

export async function saveGear(gear: Gear): Promise<void> {
  const db = await getDB();
  await db.put('gear', gear);
}

export async function getGear(id: string): Promise<Gear | undefined> {
  const db = await getDB();
  return db.get('gear', id);
}

export async function getAllGear(): Promise<Gear[]> {
  const db = await getDB();
  const gears = await db.getAll('gear');
  const rides = await db.getAll('rides');

  // Recalculate distance for each gear and its components based on associated rides
  return gears.map(g => {
    // Filter rides associated with this gear
    const gearRides = rides.filter(r => r.gearId === g.id);
    const totalDist = gearRides.reduce((sum, r) => sum + r.distance, 0);

    const updatedComponents = g.components.map(c => {
      // Find history dates to sum up only rides after the last reset (installedAt timestamp)
      const installTime = c.installedAt || 0;
      const compRides = gearRides.filter(r => r.date >= installTime);
      const compDist = compRides.reduce((sum, r) => sum + r.distance, 0);
      return { ...c, distance: compDist };
    });

    return {
      ...g,
      distance: totalDist,
      components: updatedComponents
    };
  });
}

export async function deleteGear(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('gear', id);
}
