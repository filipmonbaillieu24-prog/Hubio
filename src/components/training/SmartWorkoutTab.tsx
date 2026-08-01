import React from 'react';
import {
  Play, MapPin, Sliders, Clock, RefreshCw,
  TrendingUp, Zap, ChevronRight, Heart, Trophy, Brain,
} from 'lucide-react';
import { FitnessProfile } from '../../types/workout';
import { WorkoutType, WorkoutLogEntry } from '../../types/training';
import { Workout } from '../../utils/workouts';
import { SavedLocation } from '../../types/route';
import { planWorkoutInCalendar } from '../../utils/trainingHelpers';

interface SmartWorkoutTabProps {
  // Profile
  profile: FitnessProfile;
  // Computed state from parent
  effectiveType: WorkoutType;
  activeWorkout: Workout;
  duration: number;
  selectedType: WorkoutType | null;
  hrMode: boolean;
  intensityProfile: 'road' | 'gravel' | 'mtb';
  selectedStartLoc: string;
  savedLocations: SavedLocation[];
  // PMC / TSB
  pmcData: { ctl: number; atl: number; tsb: number };
  tsbStatus: { label: string; color: string; emoji: string };
  latestTSB: number;
  overtrainingRisk: 'hoog' | 'matig' | null;
  rpeOverride: WorkoutType | null;
  localAiAdvice: { type: 'rest' | 'recovery'; reason: string; score: number } | null;
  // Week
  trainingProfile: { isFlexible: boolean; daysSinceLast: number | null; activeWeeks: number };
  flexibleRecommendation: { type: WorkoutType; emoji: string; title: string; reason: string };
  streak: number;
  weekPlan: Array<{ day: string; type: WorkoutType | 'rest'; date: string; rideInfo?: { tss: number; distance: number; name: string } }>;
  weekLoadData: { days: Array<{ label: string; tss: number; isToday: boolean; date: string }>; maxTSS: number; weekTSS: number; weekGoal: number };
  tssImpact: { estimatedTSS: number; newATL: number; newCTL: number; newTSB: number; IF: string; normPower: number };
  typeCountWarning: string | null;
  // Phase
  phaseInfo: { daysToEvent: number; weekLabel: string };
  phase: { color: string; emoji: string; label: string };
  // Workout log
  workoutLog: WorkoutLogEntry[];
  // Setters
  setDuration: (d: number) => void;
  setSelectedType: (t: WorkoutType | null) => void;
  setHrMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIntensityProfile: (p: 'road' | 'gravel' | 'mtb') => void;
  setSelectedStartLoc: (s: string) => void;
  setShowRpeModal: (v: boolean) => void;
  setPlanConfirm: (d: string | null) => void;
  planConfirm: string | null;
  // Actions
  handleGenerateRoute: () => void;
  // HR helpers
  lthr: number;
  hrZoneBounds: number[];
  powerPctToHR: (pct: number) => string;
}

export const SmartWorkoutTab: React.FC<SmartWorkoutTabProps> = ({
  profile, effectiveType, activeWorkout, duration, selectedType, hrMode,
  intensityProfile, selectedStartLoc, savedLocations,
  pmcData, tsbStatus, latestTSB, overtrainingRisk, rpeOverride, localAiAdvice,
  trainingProfile, flexibleRecommendation, streak, weekPlan, weekLoadData, tssImpact,
  typeCountWarning, phaseInfo, phase,
  setDuration, setSelectedType, setHrMode, setIntensityProfile, setSelectedStartLoc,
  setShowRpeModal, setPlanConfirm, planConfirm,
  handleGenerateRoute, lthr, hrZoneBounds, powerPctToHR, workoutLog
}) => {
  return (
    <div className="wd-main-single" style={{ display: 'block', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── STAP 1: HEADER & STATUS ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Slimme Trainingen</h2>
              {phaseInfo.daysToEvent > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: phase.color + '20', color: phase.color, border: `1px solid ${phase.color}40`, textTransform: 'uppercase' }}>
                  {phase.emoji} {phase.label}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Voorstel op basis van TSB + {phaseInfo.daysToEvent > 0 ? `${phase.label} fase` : 'PMC-status'}.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {trainingProfile.isFlexible ? (
              trainingProfile.activeWeeks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: 'rgba(203, 213, 225,0.08)', border: '1px solid rgba(203, 213, 225,0.15)' }}>
                  <Trophy size={12} color="#cbd5e1" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1' }}>{trainingProfile.activeWeeks} actieve weken</span>
                </div>
              )
            ) : (
              streak > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: 'rgba(253,203,110,0.08)', border: '1px solid rgba(253,203,110,0.15)' }}>
                  <Trophy size={12} color="#fdcb6e" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fdcb6e' }}>{streak} dagen streak 🔥</span>
                </div>
              )
            )}
            <button onClick={() => setHrMode(m => !m)} style={{
              padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              background: hrMode ? 'rgba(255,118,117,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${hrMode ? 'rgba(255,118,117,0.3)' : 'rgba(255,255,255,0.07)'}`,
              color: hrMode ? '#ff7675' : '#cbd5e1', fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
            }}>
              <Heart size={12} fill={hrMode ? '#ff7675' : 'none'} /> {hrMode ? 'HR-zones' : 'Vermogen'}
            </button>
          </div>
        </div>

        {/* ── TRAININGSSTATUS PANEEL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Huidige Herstelstatus</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{tsbStatus.emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: tsbStatus.color }}>
                {tsbStatus.label}: {
                  latestTSB > 10 ? 'Optimaal hersteld en fris.' :
                  latestTSB > -10 ? 'Goede balans tussen training en rust.' :
                  latestTSB > -25 ? 'Opbouwperiode — wees alert op vermoeidheid.' :
                  'Rust aangeraden om overtraining te voorkomen.'
                }
              </span>
            </div>
            {overtrainingRisk && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#ff7675', fontSize: 10, fontWeight: 700, marginTop: 2 }}>
                <span>⚠️ Risk: {overtrainingRisk === 'hoog' ? 'Hoog overbelastingsrisico' : 'Matige vermoeidheidsopbouw'} (A:C ratio {(pmcData.atl/pmcData.ctl).toFixed(2)})</span>
              </div>
            )}
            {rpeOverride && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#a29bfe', fontSize: 10, fontWeight: 700 }}>
                <span>Herstel aangeraden n.a.v. je zware vorige training.</span>
              </div>
            )}
            {localAiAdvice && (
              <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, background: 'rgba(203, 213, 225,0.04)', border: '1px solid rgba(203, 213, 225,0.12)', borderRadius: 8, padding: '6px 10px', marginTop: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fysiologische analyse — Notities gescand</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{localAiAdvice.reason}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: '#64748b' }}>FITHEID (CTL)</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#cbd5e1', fontFamily: 'Outfit' }}>{Math.round(pmcData.ctl)}</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', height: 28 }} />
            <div style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: '#64748b' }}>VERMOEIDHEID</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#ff7675', fontFamily: 'Outfit' }}>{Math.round(pmcData.atl)}</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', height: 28 }} />
            <div style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: '#64748b' }}>VORM (TSB)</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: tsbStatus.color, fontFamily: 'Outfit' }}>{latestTSB > 0 ? '+' : ''}{Math.round(latestTSB)}</div>
            </div>
          </div>
        </div>

        {/* ── STAP 2: DE WORKOUT & AANPASSINGEN ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.06)',
          borderTop: `4px solid ${effectiveType === 'recovery' ? '#a29bfe' : effectiveType === 'endurance' ? '#00b894' : effectiveType === 'sweetspot' ? '#fdcb6e' : effectiveType === 'threshold' ? '#ff7675' : '#6c5ce7'}`,
          borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, padding: 20, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Linkerzijde */}
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '1px' }}>Aanbevolen Workout</span>
              <h3 style={{ margin: '4px 0 6px', fontFamily: 'Outfit, sans-serif', fontSize: 19, fontWeight: 800, color: '#f8fafc' }}>{activeWorkout.title}</h3>
              <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0 0 12px', lineHeight: 1.5 }}>{activeWorkout.description}</p>
              {typeCountWarning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(253,203,110,0.08)', border: '1px solid rgba(253,203,110,0.15)', fontSize: 9, fontWeight: 700, color: '#fdcb6e', marginBottom: 12, width: 'fit-content' }}>
                  <span>⚠️ {typeCountWarning}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { label: 'Doel', value: effectiveType === 'recovery' ? 'Herstelrit' : effectiveType === 'endurance' ? 'Vetverbranding' : effectiveType === 'sweetspot' ? 'Aerobe Conditie' : effectiveType === 'threshold' ? 'FTP Drempel' : 'Zuurstofopname', color: '#f8fafc' },
                  { label: 'Afstand', value: `~${Math.round((duration / 60) * (effectiveType === 'recovery' ? 24 : effectiveType === 'endurance' ? 28 : 31))} km`, color: '#cbd5e1' },
                  { label: 'Calorieën', value: `~${Math.round((duration / 60) * (tssImpact.normPower * 3.6 / 4.184))} kcal`, color: '#fdcb6e' },
                  { label: 'Cadans', value: effectiveType === 'recovery' ? '90-100 RPM' : effectiveType === 'vo2max' ? '95-105 RPM' : '85-95 RPM', color: '#39ff14' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8 }}>
                    <div style={{ fontSize: 8, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 1 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rechterzijde */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pas Training Aan</span>
                {(selectedType !== null || duration !== 60) && (
                  <button onClick={() => { setSelectedType(null); setDuration(60); }} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={10} /> Reset
                  </button>
                )}
              </div>

              <div>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Intensiteit / Type</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {([
                    { t: 'recovery', emoji: '💙', label: 'Herstel', color: '#a29bfe' },
                    { t: 'endurance', emoji: '🟢', label: 'Duur', color: '#00b894' },
                    { t: 'sweetspot', emoji: '🟡', label: 'SweetSp', color: '#fdcb6e' },
                    { t: 'threshold', emoji: '🔴', label: 'Drempel', color: '#ff7675' },
                    { t: 'vo2max', emoji: '💜', label: 'VO2Max', color: '#6c5ce7' },
                  ] as const).map(({ t, emoji, label, color }) => {
                    const isSelected = effectiveType === t;
                    return (
                      <button key={t} onClick={() => setSelectedType(t === effectiveType && selectedType !== null ? null : t as WorkoutType)}
                        style={{ padding: '6px 2px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', background: isSelected ? color + '15' : 'rgba(255,255,255,0.01)', border: `1px solid ${isSelected ? color + '40' : 'rgba(255,255,255,0.04)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all 0.15s' }}>
                        <span style={{ fontSize: 12 }}>{emoji}</span>
                        <span style={{ fontSize: 7, fontWeight: 800, color: isSelected ? color : '#64748b' }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                  <Clock size={11} /> Totale Duur
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([45, 60, 75, 90, 120] as const).map(d => (
                    <button key={d} onClick={() => setDuration(d)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', background: duration === d ? 'rgba(203, 213, 225,0.1)' : 'rgba(255,255,255,0.01)', border: `1px solid ${duration === d ? 'rgba(203, 213, 225,0.3)' : 'rgba(255,255,255,0.04)'}`, color: duration === d ? '#cbd5e1' : '#cbd5e1', fontSize: 10, fontWeight: 800, transition: 'all 0.15s' }}>{d}m</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Route instellingen & hoofdacties */}
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <h4 style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase' }}>
                  <MapPin size={11} color="#39ff14" /> Startlocatie
                </h4>
                <select value={selectedStartLoc} onChange={e => setSelectedStartLoc(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#f8fafc', borderRadius: 7, padding: '5px 8px', fontSize: 11, width: '100%', fontFamily: 'inherit' }}>
                  <option value="default" style={{ background: '#09090b' }}>{savedLocations.length > 0 ? savedLocations[0].name : 'Geen locaties'}</option>
                  {savedLocations.slice(1).map(loc => <option key={loc.id} value={loc.id} style={{ background: '#09090b' }}>{loc.name}</option>)}
                </select>
              </div>
              <div>
                <h4 style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase' }}>
                  <Sliders size={11} color="#cbd5e1" /> Ondergrond
                </h4>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['road','gravel','mtb'] as const).map(p => (
                    <button key={p} onClick={() => setIntensityProfile(p)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: intensityProfile === p ? 'rgba(57,255,20,0.08)' : 'rgba(255,255,255,0.01)', border: `1px solid ${intensityProfile === p ? 'rgba(57,255,20,0.25)' : 'rgba(255,255,255,0.05)'}`, color: intensityProfile === p ? '#39ff14' : '#64748b', fontSize: 9, fontWeight: 700 }}>
                      {p === 'road' ? '🛣️' : p === 'gravel' ? '🌿' : '⛰️'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
              <button onClick={handleGenerateRoute} style={{ width: '100%', background: 'linear-gradient(135deg, #cbd5e1 0%, #39ff14 100%)', border: 'none', borderRadius: 8, color: '#09090b', fontSize: 12, fontWeight: 800, padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(203, 213, 225,0.15)', fontFamily: 'inherit' }}>
                <Play size={13} fill="#09090b" /> Genereer Route ({duration} min · {effectiveType})
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button onClick={() => {
                  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                  const d = tomorrow.toISOString().slice(0, 10);
                  planWorkoutInCalendar(activeWorkout, d, duration);
                  setPlanConfirm(d);
                  setTimeout(() => setPlanConfirm(null), 3000);
                }} style={{ padding: '8px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', background: planConfirm ? 'rgba(57,255,20,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${planConfirm ? 'rgba(57,255,20,0.25)' : 'rgba(255,255,255,0.06)'}`, color: planConfirm ? '#39ff14' : '#94a3b8', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {planConfirm ? 'Gepland!' : 'Plan morgen'}
                </button>
                <button onClick={() => setShowRpeModal(true)} style={{ padding: '8px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.15)', color: '#39ff14', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  Rit Voltooid
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── STAP 3: TRAINING DETAILS ── */}
        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ height: 50, display: 'flex', gap: 2, alignItems: 'flex-end', padding: '10px 20px 0', background: 'rgba(0,0,0,0.15)' }}>
            {activeWorkout.blocks.map((block: any, idx: number) => (
              <div key={idx} style={{ flex: block.duration, height: `${block.powerPct * 80}%`, background: block.color, borderRadius: '2px 2px 0 0', opacity: 0.9 }}
                title={`${block.name}: ${Math.round(block.duration / 60)} min`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '8px 20px', background: 'rgba(0,0,0,0.05)', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            {[{ color: '#94a3b8', label: 'Z1 Herstel' }, { color: '#00b894', label: 'Z2 Duur' }, { color: '#fdcb6e', label: 'Z3 Tempo' }, { color: '#ff7675', label: 'Z4 Drempel' }, { color: '#d63031', label: 'Z5 Max' }].map(z => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: z.color }} />
                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>{z.label}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeWorkout.blocks.map((block: any, idx: number) => {
                const watts = profile.ftp ? Math.round(block.powerPct * profile.ftp) : null;
                const hrTarget = powerPctToHR(block.powerPct);
                const mins = Math.floor(block.duration / 60);
                const secs = block.duration % 60;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ width: 5, height: 5, borderRadius: 2, background: block.color }} />
                    <span style={{ flex: 1, fontSize: 11, color: '#f8fafc', fontWeight: 600 }}>{block.name}</span>
                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{mins}:{secs.toString().padStart(2,'0')}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: hrMode ? '#ff7675' : block.color, minWidth: 60, textAlign: 'right' }}>
                      {hrMode ? hrTarget : watts ? `${watts} W` : `${Math.round(block.powerPct * 100)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
            {!profile.ftp && !hrMode && <p style={{ fontSize: 10, color: '#475569', margin: '8px 0 0', fontStyle: 'italic' }}>💡 Stel je FTP in bij Instellingen voor exacte wattages.</p>}
            {hrMode && <p style={{ fontSize: 10, color: '#64748b', margin: '8px 0 0' }}>🫀 LTHR: {lthr} bpm · Zones: {hrZoneBounds.map((b, i) => i < hrZoneBounds.length - 1 ? `Z${i+1}:${b}-${hrZoneBounds[i+1]}` : '').filter(Boolean).join(' · ')}</p>}
          </div>
        </div>

        {/* ── STAP 4: PLANNING, WEEKPLAN & RECENT ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'flex-start' }} className="wd-dashboard-split">
          {/* Weekplan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {trainingProfile.isFlexible ? (
              <div style={{ background: 'linear-gradient(135deg, rgba(203, 213, 225,0.04), rgba(203, 213, 225,0.01))', border: '1px solid rgba(203, 213, 225,0.15)', borderRadius: 12, padding: '16px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>⚡ Flexibel Schema Actief</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Laatste rit</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
                      {trainingProfile.daysSinceLast === 0 ? 'Vandaag' : trainingProfile.daysSinceLast === 1 ? 'Gisteren' : trainingProfile.daysSinceLast !== null ? `${trainingProfile.daysSinceLast}d geleden` : 'Geen data'}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4 }}>{flexibleRecommendation.reason}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>📅 Wekelijks Trainingsplan</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {weekPlan.map((d, i) => {
                    const cols: Record<string,string> = { rest:'#334155', recovery:'#a29bfe', endurance:'#00b894', sweetspot:'#fdcb6e', threshold:'#ff7675', vo2max:'#6c5ce7' };
                    const emojis: Record<string,string> = { rest:'😴', recovery:'💙', endurance:'🟢', sweetspot:'🟡', threshold:'🔴', vo2max:'💜' };
                    const isToday = new Date().toISOString().slice(0,10) === d.date;
                    const isRidden = !!d.rideInfo;
                    const isFuture = d.date > new Date().toISOString().slice(0,10);
                    return (
                      <div key={d.day} style={{ padding: '8px 2px', textAlign: 'center', borderRight: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isRidden ? 'rgba(57,255,20,0.06)' : isToday ? 'rgba(203, 213, 225,0.04)' : 'transparent', cursor: !isRidden && d.type !== 'rest' ? 'pointer' : 'default', opacity: !isFuture && !isRidden && !isToday ? 0.5 : 1 }}
                        onClick={() => !isRidden && d.type !== 'rest' && setSelectedType(d.type as WorkoutType)}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? '#cbd5e1' : '#475569', marginBottom: 4 }}>{d.day}</div>
                        {isRidden ? (
                          <>
                            <div style={{ fontSize: 11, marginBottom: 2 }}>✅</div>
                            <div style={{ fontSize: 8, fontWeight: 700, color: '#39ff14' }}>{d.rideInfo!.distance.toFixed(0)}k</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, marginBottom: 3 }}>{emojis[d.type]}</div>
                            <div style={{ fontSize: 7, fontWeight: 700, color: cols[d.type], textTransform: 'uppercase' }}>{d.type.substring(0,3)}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TSS voortgang */}
            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>📊 Wekelijkse TSS voortgang</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: weekLoadData.weekTSS >= weekLoadData.weekGoal ? '#39ff14' : '#cbd5e1' }}>
                  {weekLoadData.weekTSS} / {weekLoadData.weekGoal} TSS ({Math.round((weekLoadData.weekTSS / Math.max(1, weekLoadData.weekGoal)) * 100)}%)
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${Math.min(100, (weekLoadData.weekTSS / Math.max(1, weekLoadData.weekGoal)) * 100)}%`, background: 'linear-gradient(90deg, #cbd5e1, #39ff14)', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'flex-end', height: 40 }}>
                {weekLoadData.days.map(d => {
                  const pct = Math.min(100, (d.tss / Math.max(1, weekLoadData.maxTSS)) * 100);
                  return (
                    <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 7, fontWeight: 700, color: d.isToday ? '#cbd5e1' : '#64748b', marginBottom: 2 }}>{d.tss > 0 ? d.tss : ''}</div>
                      <div style={{ width: '100%', height: `${Math.max(4, pct)}%`, background: d.isToday ? '#cbd5e1' : d.tss > 0 ? '#00b894' : 'rgba(255,255,255,0.05)', borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: 8, fontWeight: 700, color: d.isToday ? '#cbd5e1' : '#475569', marginTop: 3 }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recente workouts & onboarding */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {workoutLog.length > 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>📋 Recent Voltooide Trainingen</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {workoutLog.slice(0, 3).map(entry => (
                    <div key={entry.id} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: entry.rpe <= 3 ? 'rgba(0,184,148,0.15)' : entry.rpe <= 6 ? 'rgba(253,203,110,0.15)' : 'rgba(255,118,117,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: entry.rpe <= 3 ? '#00b894' : entry.rpe <= 6 ? '#fdcb6e' : '#ff7675', flexShrink: 0 }}>{entry.rpe}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>{entry.workoutType} · {entry.durationMinutes}m</div>
                        {entry.notes && <div style={{ fontSize: 9, color: '#475569' }}>{entry.notes}</div>}
                      </div>
                      <div style={{ fontSize: 9, color: '#334155' }}>{entry.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: 'linear-gradient(135deg, rgba(203, 213, 225, 0.05), rgba(203, 213, 225, 0.015))', border: '1px solid rgba(203, 213, 225, 0.15)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Brain size={13} /> Eerste Rit Loggen
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  Nadat je een route hebt gereden of training hebt gedaan, klik je op "Rit Voltooid" om je inspanning (RPE) op te slaan. De coach past zijn adviezen dan direct aan!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Tips sectie ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 8 }}>
          {[
            { icon: <Zap size={14} />, title: 'Opwarmen', tip: 'Start de eerste 10-15 minuten rustig. Dit voorkomt blessures en spierstijfheid.' },
            { icon: <TrendingUp size={14} />, title: 'Optimale Cadans', tip: 'Streef naar 85-95 RPM. Hogere trapfrequentie ontlast de spieren.' },
            { icon: <ChevronRight size={14} />, title: 'Voeding & Hydratatie', tip: duration >= 90 ? 'Eet 60-90g koolhydraten per uur bij ritten vanaf 90 minuten.' : 'Bij ritten onder 90 minuten volstaat water en eventueel elektrolyten.' },
          ].map((tip, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#cbd5e1' }}>{tip.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tip.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{tip.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
