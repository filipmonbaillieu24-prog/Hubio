import React, { useState } from 'react';
import { X, Moon, Footprints, Scale } from 'lucide-react';

interface ManualLogModalProps {
  onClose: () => void;
  onSave: (type: 'weight' | 'sleep' | 'steps', payload: any) => Promise<void>;
}

export const ManualLogModal: React.FC<ManualLogModalProps> = ({
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'sleep' | 'weight'>('steps');
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Steps state
  const [stepsCount, setStepsCount] = useState<number>(10000);

  // Sleep state
  const [sleepHours, setSleepHours] = useState<number>(8);
  const [sleepMinutes, setSleepMinutes] = useState<number>(0);
  const [sleepQuality, setSleepQuality] = useState<number>(80);

  // Weight state
  const [weightKg, setWeightKg] = useState<number>(75.0);
  const [bodyFat, setBodyFat] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedAt = new Date(date).toISOString();
      if (activeTab === 'steps') {
        await onSave('steps', {
          step_count: stepsCount,
          logged_at: loggedAt,
        });
      } else if (activeTab === 'sleep') {
        const totalMinutes = sleepHours * 60 + sleepMinutes;
        await onSave('sleep', {
          duration_minutes: totalMinutes,
          quality_score: sleepQuality,
          logged_at: loggedAt,
        });
      } else if (activeTab === 'weight') {
        await onSave('weight', {
          weight: weightKg,
          body_fat: bodyFat ? parseFloat(bodyFat) : null,
          logged_at: loggedAt,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fout bij opslaan meting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-slide-up" style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Handmatig Loggen</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Headers */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          background: 'rgba(255,255,255,0.02)', 
          border: '1px solid rgba(255,255,255,0.05)', 
          padding: '6px', 
          borderRadius: '14px', 
          marginBottom: '24px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('steps')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid ' + (activeTab === 'steps' ? 'rgba(203, 213, 225, 0.25)' : 'transparent'),
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'steps' ? 'rgba(203, 213, 225, 0.08)' : 'transparent',
              color: activeTab === 'steps' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Footprints size={14} style={{ color: activeTab === 'steps' ? '#cbd5e1' : 'inherit' }} /> Stappen
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sleep')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid ' + (activeTab === 'sleep' ? 'rgba(203, 213, 225, 0.25)' : 'transparent'),
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'sleep' ? 'rgba(203, 213, 225, 0.08)' : 'transparent',
              color: activeTab === 'sleep' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Moon size={14} style={{ color: activeTab === 'sleep' ? '#cbd5e1' : 'inherit' }} /> Slaap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('weight')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid ' + (activeTab === 'weight' ? 'rgba(203, 213, 225, 0.25)' : 'transparent'),
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'weight' ? 'rgba(203, 213, 225, 0.08)' : 'transparent',
              color: activeTab === 'weight' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Scale size={14} style={{ color: activeTab === 'weight' ? '#cbd5e1' : 'inherit' }} /> Gewicht
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Shared Date field */}
          <div className="form-group">
            <label className="form-label">Datum</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Steps Form */}
          {activeTab === 'steps' && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Aantal Stappen</label>
              <input
                type="number"
                className="form-input"
                value={stepsCount}
                onChange={(e) => setStepsCount(parseInt(e.target.value) || 0)}
                min="0"
                required
              />
            </div>
          )}

          {/* Sleep Form */}
          {activeTab === 'sleep' && (
            <div className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Duur (Uren)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(parseInt(e.target.value) || 0)}
                    min="0"
                    max="24"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duur (Minuten)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={sleepMinutes}
                    onChange={(e) => setSleepMinutes(parseInt(e.target.value) || 0)}
                    min="0"
                    max="59"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label">Slaapkwaliteit Score</label>
                  <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 700 }}>{sleepQuality}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={sleepQuality}
                  onChange={(e) => setSleepQuality(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: '#cbd5e1' }}
                />
              </div>
            </div>
          )}

          {/* Weight Form */}
          {activeTab === 'weight' && (
            <div className="animate-fade-in">
              <div className="form-group">
                <label className="form-label">Gewicht (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  min="30"
                  max="300"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vetpercentage % (Optioneel)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={bodyFat}
                  placeholder="Bijv. 14.5"
                  onChange={(e) => setBodyFat(e.target.value)}
                  min="2"
                  max="60"
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Annuleren
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Opslaan...' : 'Meting Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
