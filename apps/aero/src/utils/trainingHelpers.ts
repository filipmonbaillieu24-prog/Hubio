import { Workout } from '../utils/workouts';
import { CustomBlock, zoneColors, CAL_KEY } from '../types/training';
import { PlannedWorkoutItem } from '../utils/pmc';

// ─── Custom Workout Builder Helper ───────────────────────────────────────────

export function customToWorkout(blocks: CustomBlock[], title: string): Workout {
  return {
    title: title || 'Aangepaste Workout',
    description: 'Aangepast via de interval builder.',
    type: 'sweetspot',
    blocks: blocks.map(b => ({
      name: b.name,
      duration: b.durationMin * 60,
      powerPct: b.powerPct / 100,
      zone: b.zone,
      color: zoneColors[b.zone - 1],
    })),
  };
}

// ─── Calendar Planning Helper ─────────────────────────────────────────────────

export function planWorkoutInCalendar(workout: Workout, dateStr: string, durationMin: number) {
  try {
    const existing: PlannedWorkoutItem[] = JSON.parse(localStorage.getItem(CAL_KEY) ?? '[]');
    const tssMap: Record<string, number> = {
      recovery: 0.4, endurance: 0.8, sweetspot: 1.1, threshold: 1.25, vo2max: 1.4,
    };
    const tssPerMin = tssMap[workout.type] ?? 1.0;
    const newItem: PlannedWorkoutItem = {
      id: 'planned_' + Date.now(),
      date: dateStr,
      title: workout.title,
      type: workout.type as any,
      durationMinutes: durationMin,
      plannedTSS: Math.round(durationMin * tssPerMin),
      notes: workout.description,
    };
    localStorage.setItem(CAL_KEY, JSON.stringify([...existing, newItem]));
  } catch { /* ignore */ }
}
