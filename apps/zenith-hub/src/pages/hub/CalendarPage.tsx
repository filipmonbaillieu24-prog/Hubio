import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import './CalendarPage.css';

interface CalendarPageProps {
  userId: string;
  userName: string;
}

type WorkoutType = 'recovery' | 'endurance' | 'sweetspot' | 'threshold' | 'vo2max';

interface PlannedWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  plannedTSS: number;
  notes?: string;
  steps?: any[];
}

interface CompletedRide {
  id: string;
  name: string;
  date: number; // timestamp
  distance: number;
  duration: number; // seconds
  elevGain: number;
  avgSpeed: number;
  avgPower?: number;
  avgHR?: number;
  hasPower: boolean;
  hasHR: boolean;
  bestEfforts?: Record<string, number>;
  bestSpeedEfforts?: Record<string, number>;
  tss?: number;
}

interface KratosWorkout {
  id: string;
  name: string;
  started_at: string;
  completed_at: string;
  volume: number;
  sets: {
    exercise_id: string;
    sets: {
      type: 'warmup' | 'working' | 'drop';
      weight: number;
      reps: number;
      rir?: number;
    }[];
  }[];
}

type CalendarItem = 
  | { category: 'planned'; dateStr: string; raw: PlannedWorkout }
  | { category: 'ride'; dateStr: string; raw: CompletedRide }
  | { category: 'kratos'; dateStr: string; raw: KratosWorkout };

export const CalendarPage: React.FC<CalendarPageProps> = ({ userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [exercisesMap, setExercisesMap] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();


  const getLocalDateString = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}u ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  const formatMonthName = (monthIdx: number) => {
    const months = [
      'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
      'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
    ];
    return months[monthIdx];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Planned Workouts
      const { data: plannedData } = await supabase
        .from('planned_workouts')
        .select('*')
        .eq('user_id', userId);
      
      const mappedPlanned: CalendarItem[] = (plannedData || []).map((p: any) => ({
        category: 'planned',
        dateStr: p.date, // format YYYY-MM-DD
        raw: {
          id: p.id,
          date: p.date,
          title: p.title,
          type: p.type,
          durationMinutes: p.duration_minutes,
          plannedTSS: p.planned_tss,
          notes: p.notes,
          steps: p.steps
        }
      }));

      // 2. Fetch Completed Rides
      const { data: ridesData } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', userId);

      const mappedRides: CalendarItem[] = (ridesData || []).map((r: any) => {
        const rideDate = new Date(Number(r.date));
        const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {};
        return {
          category: 'ride',
          dateStr: getLocalDateString(rideDate),
          raw: {
            id: r.id,
            name: r.name,
            date: Number(r.date),
            distance: Number(r.distance),
            duration: Number(r.duration),
            elevGain: Number(r.elev_gain),
            avgSpeed: Number(r.avg_speed),
            avgPower: r.avg_power ?? undefined,
            avgHR: r.avg_hr ?? undefined,
            hasPower: !!r.has_power,
            hasHR: !!r.has_hr,
            bestEfforts: r.best_efforts ?? undefined,
            bestSpeedEfforts: r.best_speed_efforts ?? undefined,
            tss: meta?.tss ?? meta?.hrTSS ?? undefined
          }
        };
      });

      // 3. Fetch Completed Strength Workouts (Kratos)
      const { data: kratosData } = await supabase
        .from('kratos_workouts')
        .select('*')
        .eq('user_id', userId);

      const mappedKratos: CalendarItem[] = (kratosData || []).map((k: any) => {
        const kDate = new Date(k.completed_at);
        return {
          category: 'kratos',
          dateStr: getLocalDateString(kDate),
          raw: {
            id: k.id,
            name: k.name,
            started_at: k.started_at,
            completed_at: k.completed_at,
            volume: Number(k.volume || 0),
            sets: k.sets || []
          }
        };
      });

      // 4. Fetch Strength Exercises for ID-to-name lookup
      const { data: exercisesData } = await supabase
        .from('kratos_exercises')
        .select('id, name')
        .eq('user_id', userId);

      if (exercisesData) {
        const exMap: Record<string, string> = {};
        exercisesData.forEach((ex: any) => {
          exMap[ex.id] = ex.name;
        });
        setExercisesMap(exMap);
      }

      setItems([...mappedPlanned, ...mappedRides, ...mappedKratos]);
    } catch (err) {
      console.error('Kon kalendergegevens niet ophalen:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Generate calendar grid days
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  // Adjust firstDayIndex to Monday-first (0 = Monday, 6 = Sunday)
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarDays: { date: Date; dateStr: string; outside: boolean }[] = [];

  // Previous month outside days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dVal = daysInPrevMonth - i;
    const date = new Date(currentYear, currentMonth - 1, dVal);
    calendarDays.push({
      date,
      dateStr: getLocalDateString(date),
      outside: true
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentYear, currentMonth, i);
    calendarDays.push({
      date,
      dateStr: getLocalDateString(date),
      outside: false
    });
  }

  // Next month outside days
  const remainingCells = 42 - calendarDays.length; // standard 6-row grid = 42 cells
  for (let i = 1; i <= remainingCells; i++) {
    const date = new Date(currentYear, currentMonth + 1, i);
    calendarDays.push({
      date,
      dateStr: getLocalDateString(date),
      outside: true
    });
  }

  // Map items to dates
  const itemsByDate: Record<string, CalendarItem[]> = {};
  items.forEach(item => {
    if (!itemsByDate[item.dateStr]) {
      itemsByDate[item.dateStr] = [];
    }
    itemsByDate[item.dateStr].push(item);
  });

  const todayStr = getLocalDateString(new Date());

  const getWorkoutColor = (type: WorkoutType) => {
    const colors: Record<WorkoutType, string> = {
      recovery: '#a29bfe',
      endurance: '#cbd5e1',
      sweetspot: '#fdcb6e',
      threshold: '#ff7675',
      vo2max: '#6c5ce7'
    };
    return colors[type] || '#cbd5e1';
  };

  return (
    <div className="zh-calendar-container">
      <div className="zh-calendar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={18} style={{ color: '#cbd5e1' }} />
          <h2 className="zh-calendar-title">
            {formatMonthName(currentMonth)} {currentYear}
          </h2>
        </div>
        <div className="zh-calendar-nav">
          <button className="zh-calendar-btn" onClick={handlePrevMonth}>
            <ChevronLeft size={16} />
          </button>
          <button className="zh-calendar-btn" onClick={() => setCurrentDate(new Date())}>
            Vandaag
          </button>
          <button className="zh-calendar-btn" onClick={handleNextMonth}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="zh-calendar-grid-wrap" style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          Kalendergegevens inladen...
        </div>
      ) : (
        <div className="zh-calendar-grid-wrap">
          <div className="zh-calendar-grid-header">
            {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
              <div key={day} className="zh-calendar-day-label">{day}</div>
            ))}
          </div>
          <div className="zh-calendar-grid">
            {calendarDays.map(({ date, dateStr, outside }) => {
              const dayItems = itemsByDate[dateStr] || [];
              const isToday = dateStr === todayStr;

              return (
                <div 
                  key={dateStr} 
                  className={`zh-calendar-cell ${outside ? 'outside' : ''} ${isToday ? 'today' : ''}`}
                >
                  <span className="zh-calendar-date">{date.getDate()}</span>
                  
                  <div className="zh-calendar-badge-list">
                    {dayItems.map((item, idx) => {
                      if (item.category === 'planned') {
                        return (
                          <div 
                            key={`p-${item.raw.id}-${idx}`}
                            className="zh-workout-badge zh-badge-planned"
                            onClick={() => setSelectedItem(item)}
                          >
                            📅 {item.raw.title} ({item.raw.durationMinutes}m)
                          </div>
                        );
                      } else if (item.category === 'ride') {
                        return (
                          <div 
                            key={`r-${item.raw.id}-${idx}`}
                            className="zh-workout-badge zh-badge-ride"
                            onClick={() => setSelectedItem(item)}
                          >
                            🚴 {item.raw.name} ({item.raw.distance.toFixed(0)}km)
                          </div>
                        );
                      } else {
                        return (
                          <div 
                            key={`k-${item.raw.id}-${idx}`}
                            className="zh-workout-badge zh-badge-kratos"
                            onClick={() => setSelectedItem(item)}
                          >
                            🏋️ {item.raw.name} ({item.raw.volume.toLocaleString()} kg)
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal Overlay */}
      {selectedItem && (
        <div className="zh-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="zh-modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="zh-modal-header">
              <span className="zh-modal-title" style={{ 
                color: selectedItem.category === 'planned' ? '#cbd5e1' : selectedItem.category === 'ride' ? '#96adfc' : '#c084fc'
              }}>
                {selectedItem.category === 'planned' ? 'Geplande Training' : selectedItem.category === 'ride' ? 'Voltooide Rit' : 'Voltooide Krachttraining'}
              </span>
              <button className="zh-modal-close" onClick={() => setSelectedItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="zh-modal-body">
              {/* PLANNED WORKOUT DETAILS */}
              {selectedItem.category === 'planned' && (
                <>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900 }}>{selectedItem.raw.title}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: getWorkoutColor(selectedItem.raw.type), fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: getWorkoutColor(selectedItem.raw.type) }} />
                    {selectedItem.raw.type}
                  </div>

                  <div className="zh-workout-meta-grid">
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Geplande Tijd</span>
                      <span className="zh-workout-meta-value">{selectedItem.raw.durationMinutes} minuten</span>
                    </div>
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Geplande TSS</span>
                      <span className="zh-workout-meta-value">{selectedItem.raw.plannedTSS} TSS</span>
                    </div>
                  </div>

                  {selectedItem.raw.notes && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div className="zh-modal-section-title">Richtlijnen & Coachtips</div>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{selectedItem.raw.notes}</p>
                    </div>
                  )}

                  {selectedItem.raw.steps && selectedItem.raw.steps.length > 0 && (
                    <div>
                      <div className="zh-modal-section-title">Trainingsstappen</div>
                      <ol className="zh-steps-list">
                        {selectedItem.raw.steps.map((step: any, sIdx: number) => (
                          <li key={sIdx}>
                            <strong>{step.duration} min</strong> op <strong>{step.intensity}% FTP</strong> {step.type === 'cooldown' ? '(Warming Down)' : step.type === 'warmup' ? '(Warming Up)' : '(Werkset)'}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}

              {/* COMPLETED RIDE DETAILS */}
              {selectedItem.category === 'ride' && (
                <>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900 }}>{selectedItem.raw.name}</h2>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    Verreden op {new Date(selectedItem.raw.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="zh-workout-meta-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Afstand</span>
                      <span className="zh-workout-meta-value" style={{ color: '#96adfc' }}>{selectedItem.raw.distance.toFixed(1)} km</span>
                    </div>
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Duur</span>
                      <span className="zh-workout-meta-value">{formatDuration(selectedItem.raw.duration)}</span>
                    </div>
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Hoogte</span>
                      <span className="zh-workout-meta-value">{selectedItem.raw.elevGain} m</span>
                    </div>
                  </div>

                  <div className="zh-workout-meta-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div className="zh-workout-meta-item" style={{ padding: '8px 10px' }}>
                      <span className="zh-workout-meta-label" style={{ fontSize: 8 }}>Snelheid</span>
                      <span className="zh-workout-meta-value" style={{ fontSize: 12 }}>{selectedItem.raw.avgSpeed.toFixed(1)} km/u</span>
                    </div>
                    <div className="zh-workout-meta-item" style={{ padding: '8px 10px' }}>
                      <span className="zh-workout-meta-label" style={{ fontSize: 8 }}>Gem. Power</span>
                      <span className="zh-workout-meta-value" style={{ fontSize: 12 }}>{selectedItem.raw.avgPower ? `${selectedItem.raw.avgPower} W` : '--'}</span>
                    </div>
                    <div className="zh-workout-meta-item" style={{ padding: '8px 10px' }}>
                      <span className="zh-workout-meta-label" style={{ fontSize: 8 }}>Gem. HR</span>
                      <span className="zh-workout-meta-value" style={{ fontSize: 12 }}>{selectedItem.raw.avgHR ? `${selectedItem.raw.avgHR} bpm` : '--'}</span>
                    </div>
                    <div className="zh-workout-meta-item" style={{ padding: '8px 10px' }}>
                      <span className="zh-workout-meta-label" style={{ fontSize: 8 }}>Stress (TSS)</span>
                      <span className="zh-workout-meta-value" style={{ fontSize: 12, color: '#ffd32a' }}>{selectedItem.raw.tss ?? '--'}</span>
                    </div>
                  </div>

                  {selectedItem.raw.bestEfforts && Object.keys(selectedItem.raw.bestEfforts).length > 0 && (
                    <div>
                      <div className="zh-modal-section-title">⚡ Kritieke Vermogenswaarden (Peak Power)</div>
                      <table className="zh-best-efforts-table">
                        <thead>
                          <tr>
                            <th>Duur</th>
                            <th>Max Vermogen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedItem.raw.bestEfforts).map(([dur, pow]) => (
                            <tr key={dur}>
                              <td style={{ fontWeight: 800 }}>{dur}</td>
                              <td style={{ color: '#ffd32a', fontWeight: 800 }}>{Math.round(pow)} W</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* COMPLETED KRATOS WORKOUT DETAILS */}
              {selectedItem.category === 'kratos' && (
                <>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900 }}>{selectedItem.raw.name}</h2>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    Voltooid op {new Date(selectedItem.raw.completed_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="zh-workout-meta-grid">
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Totale Volume</span>
                      <span className="zh-workout-meta-value" style={{ color: '#c084fc' }}>{selectedItem.raw.volume.toLocaleString()} kg</span>
                    </div>
                    <div className="zh-workout-meta-item">
                      <span className="zh-workout-meta-label">Trainingsduur</span>
                      <span className="zh-workout-meta-value">
                        {formatDuration(
                          Math.max(0, Math.floor((new Date(selectedItem.raw.completed_at).getTime() - new Date(selectedItem.raw.started_at).getTime()) / 1000))
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="zh-modal-section-title">🏋️ Logboek Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedItem.raw.sets.map((exLog, eIdx) => {
                        const name = exercisesMap[exLog.exercise_id] || 'Oefening';
                        return (
                          <div key={eIdx} className="zh-kratos-exercise-block">
                            <div className="zh-kratos-ex-name">{name}</div>
                            <table className="zh-kratos-sets-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '15%' }}>Set</th>
                                  <th style={{ width: '25%' }}>Type</th>
                                  <th style={{ width: '30%' }}>Gewicht</th>
                                  <th style={{ width: '30%' }}>Reps</th>
                                </tr>
                              </thead>
                              <tbody>
                                {exLog.sets.map((s, sIdx) => (
                                  <tr key={sIdx}>
                                    <td style={{ fontWeight: 800 }}>{sIdx + 1}</td>
                                    <td>
                                      <span className={`zh-kratos-set-type zh-set-${s.type}`}>
                                        {s.type === 'warmup' ? 'Warmup' : s.type === 'working' ? 'Werkset' : 'Drop'}
                                      </span>
                                    </td>
                                    <td><strong>{s.weight} kg</strong></td>
                                    <td><strong>{s.reps} reps</strong> {s.rir !== undefined && s.rir !== null ? `(RIR ${s.rir})` : ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
