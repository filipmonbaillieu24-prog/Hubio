import React, { useEffect, useState } from 'react';
import { Brain, Heart, Radio, Volume2, Compass, AlertCircle, ChevronLeft } from 'lucide-react';
import { getAllPlannedWorkouts } from '../../utils/db';
import { PlannedWorkoutItem } from '../../utils/pmc';
import './ZenithHub.css';

interface CycloPilotPanelProps {
  onBack: () => void;
}

export const CycloPilotPanel: React.FC<CycloPilotPanelProps> = ({
  onBack,
}) => {
  const [todayWorkout, setTodayWorkout] = useState<PlannedWorkoutItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayWorkout = async () => {
      try {
        const workouts = await getAllPlannedWorkouts();
        // Get today's local date string
        const date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        
        const found = workouts.find(w => w.date === todayStr);
        setTodayWorkout(found || null);
      } catch (e) {
        console.error('Kon geplande workouts niet ophalen:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTodayWorkout();
  }, []);

  const sensors = [
    { name: 'Hartslagmeter (Garmin HRM)', type: 'Heart Rate', status: 'Verbonden', signal: '92%', icon: <Heart size={16} color="#ff7675" /> },
    { name: 'Cadanssensor (Wahoo Cadence)', type: 'Cadence', status: 'Verbonden', signal: '88%', icon: <Radio size={16} color="#55efc4" /> },
    { name: 'Snelheidssensor (Wahoo Speed)', type: 'Speed', status: 'Verbonden', signal: '85%', icon: <Radio size={16} color="#74b9ff" /> },
    { name: 'Vermogensmeter', type: 'Power', status: 'Niet Gekoppeld', signal: '--', icon: <AlertCircle size={16} color="#64748b" /> },
  ];

  const mockCues = [
    { time: '14:02:15', type: 'System', text: 'CycloPilot v0.8.0 opgestart in aanloop/warming-up modus.' },
    { time: '14:05:00', type: 'Pacing', text: 'Hartslag stabiel. Zone 1 warming-up doelen actief.' },
    { time: '14:10:30', type: 'GPS', text: 'Grens geplande route bereikt. Start trainingsprogramma.' },
    { time: '14:10:35', type: 'Coaching', text: 'Start interval 1. Doelsnelheid 28 km/h voor 10 minuten.' },
    { time: '14:14:20', type: 'Wind', text: 'Open vlakte met tegenwind gedetecteerd. Focus op inspanning, negeer lagere snelheid.' },
    { time: '14:16:45', type: 'Heart Rate', text: 'Hartslagdrift gedetecteerd (> 10% decoupling). Verlaag doelsnelheid naar 26 km/h en neem hydratatie.' },
  ];

  return (
    <div className="zh-hub-container">
      {/* Background radial glow */}
      <div className="zh-hub-glow" style={{ background: 'radial-gradient(circle at 80% 20%, rgba(162, 155, 254, 0.15) 0%, transparent 60%)' }} />

      {/* Header */}
      <header className="zh-hub-header animate-slide-down">
        <button onClick={onBack} className="zh-back-btn">
          <ChevronLeft size={16} /> Terug naar Zenith Hub
        </button>
        <div className="zh-user-badge">
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Status:</span>
          <strong style={{ color: '#a29bfe', fontSize: 12 }}>COMPANION VERBONDEN</strong>
        </div>
      </header>

      {/* Title */}
      <div style={{ marginBottom: 24 }} className="animate-slide-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Brain size={24} color="#a29bfe" />
          <h1 className="zh-hub-title" style={{ fontSize: 24 }}>CycloPilot Live</h1>
        </div>
        <p className="zh-hub-subtitle">Real-time beheer- en diagnosescherm voor uw Android in-ear coach.</p>
      </div>

      <div className="zh-pilot-grid animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {/* Left Column: Today's Sync Workout */}
        <div className="zh-pilot-card">
          <h3 className="zh-pilot-card-title">
            <Compass size={16} color="#a29bfe" /> Geplande Training (Supabase Sync)
          </h3>
          {loading ? (
            <p style={{ fontSize: 12, color: '#94a3b8' }}>Laden...</p>
          ) : todayWorkout ? (
            <div>
              <div style={{ background: 'rgba(162,155,254,0.05)', border: '1px solid rgba(162,155,254,0.15)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: '#a29bfe', textTransform: 'uppercase' }}>Vandaag Actief</span>
                <h4 style={{ margin: '2px 0 6px', fontSize: 14, fontWeight: 800, color: '#fff' }}>{todayWorkout.title}</h4>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94a3b8' }}>
                  <span>Duur: <strong style={{ color: '#fff' }}>{todayWorkout.durationMinutes} min</strong></span>
                  <span>|</span>
                  <span>TSS: <strong style={{ color: '#fff' }}>{todayWorkout.plannedTSS}</strong></span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 12px' }}>{todayWorkout.notes}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {todayWorkout.steps?.map((step: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Stap {idx + 1}: {step.type}</span>
                    <span style={{ color: '#94a3b8' }}>{Math.round(step.duration_seconds / 60)} min</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10 }}>
              <AlertCircle size={24} color="#64748b" style={{ marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>Geen training ingepland voor vandaag.</p>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#64748b' }}>Plan een training in via de AI Coach of Kalender tabbladen.</p>
            </div>
          )}
        </div>

        {/* Right Column: Sensor Status & Live Audio Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sensors Card */}
          <div className="zh-pilot-card">
            <h3 className="zh-pilot-card-title">
              <Radio size={16} color="#a29bfe" /> Bluetooth BLE Sensoren
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sensors.map((sensor, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {sensor.icon}
                    <div>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#fff' }}>{sensor.name}</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>{sensor.type}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: 9, 
                      fontWeight: 800, 
                      color: sensor.status === 'Verbonden' ? '#39ff14' : '#64748b',
                      background: sensor.status === 'Verbonden' ? 'rgba(57, 255, 20, 0.05)' : 'rgba(255,255,255,0.02)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: `1px solid ${sensor.status === 'Verbonden' ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255,255,255,0.05)'}`
                    }}>
                      {sensor.status}
                    </span>
                    {sensor.signal !== '--' && <span style={{ display: 'block', fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Signaal: {sensor.signal}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Cues Logs Card */}
          <div className="zh-pilot-card">
            <h3 className="zh-pilot-card-title">
              <Volume2 size={16} color="#a29bfe" /> In-Ear Live Audio Logs (Mock)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
              {mockCues.map((cue, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 8, padding: 8, fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, opacity: 0.7 }}>
                    <span style={{ color: '#a29bfe', fontWeight: 800 }}>[{cue.type.toUpperCase()}]</span>
                    <span>{cue.time}</span>
                  </div>
                  <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.4 }}>{cue.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
