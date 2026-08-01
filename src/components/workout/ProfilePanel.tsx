import React, { useState } from 'react';
import './ProfilePanel.css';
import { Zap, Lightbulb, RefreshCw, RotateCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FitnessProfile } from '../../types/workout';
import { estimatedMaxHR, estimateVO2max, cyclingCategory } from '../../utils/rideMetrics';
import { classifyVO2max } from '../../utils/benchmarks';
import {
  GDRIVE_PATH_KEY, GDRIVE_ROUTES_AUTO_KEY, GDRIVE_RIDES_AUTO_KEY,
  GDRIVE_ROUTES_FOLDER, GDRIVE_RIDES_FOLDER, gdriveSubPath
} from '../../utils/export';

export interface ProfilePanelProps {
  profile: FitnessProfile;
  onChange: (p: FitnessProfile) => void;
  globaleFTP?: number;
  onRecalculate: () => void;
  recalculating: boolean;
  subSection?: 'zones' | 'connections';
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  profile,
  onChange,
  globaleFTP,
  onRecalculate,
  recalculating,
  subSection
}) => {
  const set = (key: keyof FitnessProfile, val: any) =>
    onChange({ ...profile, [key]: val === '' ? undefined : val });

  // Google Drive sync instellingen (localStorage)
  const [gdrivePath, setGdrivePath] = useState(
    () => localStorage.getItem(GDRIVE_PATH_KEY) ?? ''
  );
  const [gdriveRoutesAuto, setGdriveRoutesAuto] = useState(
    () => localStorage.getItem(GDRIVE_ROUTES_AUTO_KEY) === 'true'
  );
  const [gdriveRidesAuto, setGdriveRidesAuto] = useState(
    () => localStorage.getItem(GDRIVE_RIDES_AUTO_KEY) === 'true'
  );
  const handleGdrivePath = async (val: string) => {
    setGdrivePath(val);
    const trimmed = val.trim();
    if (trimmed) {
      localStorage.setItem(GDRIVE_PATH_KEY, trimmed);
      // Maak direct de submappen aan in de achtergrond zodat de gebruiker ziet dat het werkt
      try {
        const routesFolder = gdriveSubPath(trimmed, GDRIVE_ROUTES_FOLDER);
        const ridesFolder  = gdriveSubPath(trimmed, GDRIVE_RIDES_FOLDER);
        await invoke('ensure_dir', { path: routesFolder });
        await invoke('ensure_dir', { path: ridesFolder });
      } catch (err) {
        console.error('Kon mappen niet aanmaken:', err);
      }
    } else {
      localStorage.removeItem(GDRIVE_PATH_KEY);
    }
  };
  const handleGdriveRoutesAuto = (v: boolean) => {
    setGdriveRoutesAuto(v);
    localStorage.setItem(GDRIVE_ROUTES_AUTO_KEY, String(v));
  };
  const handleGdriveRidesAuto = (v: boolean) => {
    setGdriveRidesAuto(v);
    localStorage.setItem(GDRIVE_RIDES_AUTO_KEY, String(v));
  };

  const age      = profile.birthDate
    ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : undefined;
  const estMaxHR = profile.maxHR ?? (age ? estimatedMaxHR(age) : undefined);
  const bmi      = profile.weight && profile.height
    ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1) : null;
  const vo2max   = (globaleFTP ?? profile.ftp) && profile.weight
    ? estimateVO2max(globaleFTP ?? profile.ftp!, profile.weight) : null;
  const vo2cat   = vo2max && age && profile.gender && profile.gender !== 'other'
    ? classifyVO2max(vo2max, age, profile.gender) : null;
  const cat5min  = globaleFTP && profile.weight ? cyclingCategory(globaleFTP / profile.weight) : null;

  const activeFTP = profile.ftp ?? globaleFTP ?? 250;
  const activeLTHR = profile.lthr ?? (estMaxHR ? Math.round(estMaxHR * 0.9) : 160);

  const zonesPower = [
    { label: 'Z1 - Herstel', range: `< ${Math.round(activeFTP * 0.55)} W`, desc: 'Herstelritjes', color: '#74b9ff' },
    { label: 'Z2 - Duurvermogen', range: `${Math.round(activeFTP * 0.55)} - ${Math.round(activeFTP * 0.75)} W`, desc: 'Vetverbranding', color: '#00b894' },
    { label: 'Z3 - Tempo', range: `${Math.round(activeFTP * 0.76)} - ${Math.round(activeFTP * 0.90)} W`, desc: 'Aerobe basis', color: '#fdcb6e' },
    { label: 'Z4 - Drempel', range: `${Math.round(activeFTP * 0.91)} - ${Math.round(activeFTP * 1.05)} W`, desc: 'Lactaatdrempel', color: '#e17055' },
    { label: 'Z5 - VO2max', range: `${Math.round(activeFTP * 1.06)} - ${Math.round(activeFTP * 1.20)} W`, desc: 'Zuurstofopname', color: '#d63031' },
    { label: 'Z6 - Anaerobe cap.', range: `${Math.round(activeFTP * 1.21)} - ${Math.round(activeFTP * 1.50)} W`, desc: 'Korte inspanning', color: '#a29bfe' },
    { label: 'Z7 - Neuromusculair', range: `> ${Math.round(activeFTP * 1.50)} W`, desc: 'Sprint & explosie', color: '#e84393' }
  ];

  const zonesHR = [
    { label: 'Z1 - Herstel', range: `< ${Math.round(activeLTHR * 0.81)} bpm`, desc: 'Lichte inspanning', color: '#74b9ff' },
    { label: 'Z2 - Duurvermogen', range: `${Math.round(activeLTHR * 0.81)} - ${Math.round(activeLTHR * 0.89)} bpm`, desc: 'Basis conditie', color: '#00b894' },
    { label: 'Z3 - Tempo', range: `${Math.round(activeLTHR * 0.90)} - ${Math.round(activeLTHR * 0.93)} bpm`, desc: 'Stevig tempo', color: '#fdcb6e' },
    { label: 'Z4 - Drempel', range: `${Math.round(activeLTHR * 0.94)} - ${Math.round(activeLTHR * 0.99)} bpm`, desc: 'Zware ademhaling', color: '#e17055' },
    { label: 'Z5 - VO2max', range: `>= ${Math.round(activeLTHR * 1.00)} bpm`, desc: 'Maximale inspanning', color: '#d63031' }
  ];

  return (
    <div className="wd-profile-panel">
      {subSection !== 'connections' && (
        <>
        <div className="wd-profile-grid">
          <div className="wd-profile-section">
            <div className="wd-profile-section__title">Persoonlijk</div>
            <div className="wd-profile-row"><label>Naam</label>
            <input type="text" placeholder="Naam" value={profile.name ?? ''}
              onChange={e => set('name', e.target.value || undefined)} /></div>
          <div className="wd-profile-row"><label>Geslacht</label>
            <select className="wd-profile-select" value={profile.gender ?? ''}
              onChange={e => set('gender', e.target.value || undefined)}>
              <option value="">Niet opgegeven</option>
              <option value="male">Man</option>
              <option value="female">Vrouw</option>
              <option value="other">Anders</option>
            </select></div>
          <div className="wd-profile-row"><label>Geboortedatum</label>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="date" style={{ width:140, textAlign:'left' }}
                max={new Date().toISOString().split('T')[0]}
                value={profile.birthDate ?? ''}
                onChange={e => set('birthDate', e.target.value || undefined)} />
              {age != null && <span style={{ fontSize:11, color:'#94a3b8' }}>{age}j</span>}
            </div></div>
          <div className="wd-profile-row"><label>Lengte <span>cm</span></label>
            <input type="number" min={140} max={220} placeholder="—"
              value={profile.height ?? ''}
              onChange={e => set('height', e.target.value ? +e.target.value : undefined)} /></div>
          <div className="wd-profile-row"><label>Gewicht <span>kg</span></label>
            <input type="number" min={40} max={200} placeholder="—"
              value={profile.weight ?? ''}
              onChange={e => set('weight', e.target.value ? +e.target.value : undefined)} /></div>

          {/* Gewichtslog beheer */}
          <div style={{ marginTop:14, borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:12 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#aaa', display:'block', marginBottom:6 }}>Gewichtsverloop over tijd</span>
            
            {/* Lijst van eerdere metingen */}
            {profile.weightHistory && profile.weightHistory.length > 0 && (
              <div style={{ maxHeight: 110, overflowY: 'auto', marginBottom: 8, background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: 6 }}>
                {[...profile.weightHistory].sort((a,b) => b.date.localeCompare(a.date)).map((entry, idx) => (
                  <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, padding:'3px 4px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color:'#888' }}>{entry.date}</span>
                    <strong style={{ color:'#00e5ff' }}>{entry.weight} kg</strong>
                    <button 
                      style={{ background:'none', border:'none', color:'#ff7675', cursor:'pointer', padding:'0 4px', fontSize:12 }}
                      title="Verwijder meting"
                      onClick={() => {
                        const nextHistory = (profile.weightHistory ?? []).filter(h => h.date !== entry.date);
                        onChange({ ...profile, weightHistory: nextHistory });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulier om nieuwe meting toe te voegen */}
            <div style={{ display:'flex', gap:4 }}>
              <input 
                type="date" 
                id="newWeightDate"
                defaultValue={new Date().toISOString().slice(0, 10)}
                style={{ width:120, fontSize:10, padding:'4px 6px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:4, color:'#fff' }} 
              />
              <input 
                type="number" 
                id="newWeightVal"
                placeholder="kg"
                style={{ width:60, fontSize:10, padding:'4px 6px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:4, color:'#fff' }} 
              />
              <button 
                style={{ 
                  background:'rgba(0,229,255,0.12)', 
                  border:'1px solid rgba(0,229,255,0.25)', 
                  color:'#00e5ff', 
                  fontSize:10, 
                  fontWeight:600, 
                  borderRadius:4, 
                  padding:'0 8px', 
                  cursor:'pointer' 
                }}
                onClick={() => {
                  const dateInput = document.getElementById('newWeightDate') as HTMLInputElement;
                  const valInput = document.getElementById('newWeightVal') as HTMLInputElement;
                  if (dateInput && valInput && valInput.value) {
                    const date = dateInput.value;
                    const weight = parseFloat(valInput.value);
                    const history = profile.weightHistory ?? [];
                    // Vervang entry met dezelfde datum of voeg toe
                    const filtered = history.filter(h => h.date !== date);
                    const nextHistory = [...filtered, { date, weight }].sort((a,b) => a.date.localeCompare(b.date));
                    
                    // Update ook het hoofdgewicht als dit de meest recente meting is
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isMostRecent = nextHistory[nextHistory.length - 1].date === date || date >= todayStr;

                    onChange({ 
                      ...profile, 
                      weightHistory: nextHistory,
                      weight: isMostRecent ? weight : profile.weight
                    });
                    valInput.value = '';
                  }
                }}
              >
                + Voeg toe
              </button>
            </div>
          </div>
        </div>
        <div className="wd-profile-section">
          <div className="wd-profile-section__title">Trainingszones <span>(leeg = auto)</span></div>
          <div className="wd-profile-row"><label>FTP <span>W</span></label>
            <input type="number" min={50} max={600} placeholder="Auto"
              value={profile.ftp ?? ''}
              onChange={e => set('ftp', e.target.value ? +e.target.value : undefined)} /></div>
          <div className="wd-profile-row"><label>Max HR <span>bpm</span></label>
            <input type="number" min={120} max={220} placeholder={estMaxHR ? `~${estMaxHR}` : 'Auto'}
              value={profile.maxHR ?? ''}
              onChange={e => set('maxHR', e.target.value ? +e.target.value : undefined)} /></div>
          <div className="wd-profile-row"><label>LTHR <span>bpm</span></label>
            <input type="number" min={100} max={220} placeholder={estMaxHR ? `~${Math.round(estMaxHR * 0.9)}` : 'Auto'}
              value={profile.lthr ?? ''}
              onChange={e => set('lthr', e.target.value ? +e.target.value : undefined)} /></div>
          {(bmi || estMaxHR || vo2max || cat5min) && (
            <div className="wd-profile-derived">
              <div className="wd-profile-derived__title">Geschatte waarden</div>
              {estMaxHR && <div className="wd-profile-derived__row"><span>Max HR (Tanaka)</span><strong>{estMaxHR} bpm</strong></div>}
              {bmi && <div className="wd-profile-derived__row"><span>BMI</span>
                <strong style={{ color: +bmi < 18.5 ? '#74b9ff' : +bmi < 25 ? '#55efc4' : +bmi < 30 ? '#fdcb6e' : '#ff7675' }}>{bmi}</strong></div>}
              {vo2max && <div className="wd-profile-derived__row"><span>VO₂max</span>
                <strong style={{ color: vo2cat?.color ?? '#a29bfe' }}>{vo2max} {vo2cat && `· ${vo2cat.emoji} ${vo2cat.category}`}</strong></div>}
              {cat5min && <div className="wd-profile-derived__row"><span>Rijderscategorie</span>
                <strong style={{ color: cat5min.color }}>{cat5min.label}</strong></div>}
            </div>
          )}
        </div>
      </div>

      {/* Trainingszones Calculator */}
      <div className="wd-profile-section wd-profile-section--wide" style={{ marginTop: 14 }}>
        <div className="wd-profile-section__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={13} style={{ color: '#00e5ff' }} />
          Jouw Gepersonaliseerde Trainingszones
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 10 }}>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#a29bfe', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚡ Vermogenszones (Coggan)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {zonesPower.map(z => (
                <div key={z.label} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, padding: '6px 10px', fontSize: 11, gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: z.color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${z.color}` }} />
                  <strong style={{ color: '#f8fafc', flex: '1 0 100px', textAlign: 'left' }}>{z.label}</strong>
                  <span style={{ color: z.color, fontWeight: 600, flex: '0 0 100px', textAlign: 'right' }}>{z.range}</span>
                  <span style={{ color: '#64748b', fontSize: 10, flex: '1 0 120px', textAlign: 'right' }}>{z.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#ff7675', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              ❤️ Hartslagzones (LTHR)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {zonesHR.map(z => (
                <div key={z.label} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, padding: '6px 10px', fontSize: 11, gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: z.color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${z.color}` }} />
                  <strong style={{ color: '#f8fafc', flex: '1 0 100px', textAlign: 'left' }}>{z.label}</strong>
                  <span style={{ color: z.color, fontWeight: 600, flex: '0 0 100px', textAlign: 'right' }}>{z.range}</span>
                  <span style={{ color: '#64748b', fontSize: 10, flex: '1 0 120px', textAlign: 'right' }}>{z.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )}

      {/* Google Drive sync */}
      {subSection !== 'zones' && (
        <div className="wd-profile-section wd-profile-section--wide">
          <div className="wd-profile-section__title" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5ff"
              strokeWidth="2" style={{ display:'inline', flexShrink:0 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Google Drive synchronisatie
          </div>

          <p style={{ fontSize:11, color:'#94a3b8', marginBottom:8, lineHeight:1.5 }}>
            Stel de root-map in. Zenith maakt automatisch twee submappen aan.
          </p>

          {/* Root pad */}
          <div className="wd-profile-row wd-profile-row--wide" style={{ marginBottom:6 }}>
            <label>Root-map</label>
            <div style={{ display:'flex', gap:6, flex:1 }}>
              <input
                type="text"
                placeholder={`bv. C:\\Users\\${profile.name ?? 'jij'}\\Google Drive\\My Drive\\Zenith`}
                value={gdrivePath}
                onChange={e => handleGdrivePath(e.target.value)}
                style={{ flex:1 }}
              />
              {gdrivePath.trim() && (
                <span style={{ color:'#39ff14', fontSize:14, alignSelf:'center' }}>✓</span>
              )}
            </div>
          </div>

          {/* Mapstructuur preview */}
          {gdrivePath.trim() && (
            <div style={{ fontSize:11, marginBottom:10, lineHeight:2, background:'rgba(0,229,255,0.04)',
              border:'1px solid rgba(0,229,255,0.1)', borderRadius:8, padding:'8px 12px' }}>
              <div style={{ color:'#666' }}>&#128193; {gdrivePath.replace(/[/\\]+$/, '')}</div>
              <div style={{ paddingLeft:16, color:'#00e5ff' }}>&#128193; {GDRIVE_ROUTES_FOLDER}</div>
              <div style={{ paddingLeft:16, color:'#39ff14' }}>&#128193; {GDRIVE_RIDES_FOLDER}</div>
            </div>
          )}

          {/* Auto-sync toggles */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color: gdrivePath ? '#aaa' : '#555' }}>
              <input type="checkbox" checked={gdriveRoutesAuto}
                disabled={!gdrivePath.trim()}
                onChange={e => handleGdriveRoutesAuto(e.target.checked)}
                style={{ accentColor:'#00e5ff', width:14, height:14 }} />
              <span>
                <strong style={{ color: gdriveRoutesAuto && gdrivePath ? '#00e5ff' : undefined }}>Routes</strong>
                {' '}— auto-export gegenereerde routes naar
                <code style={{ fontSize:10, marginLeft:4, color:'#00e5ff' }}>{GDRIVE_ROUTES_FOLDER}/</code>
              </span>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color: gdrivePath ? '#aaa' : '#555' }}>
              <input type="checkbox" checked={gdriveRidesAuto}
                disabled={!gdrivePath.trim()}
                onChange={e => handleGdriveRidesAuto(e.target.checked)}
                style={{ accentColor:'#39ff14', width:14, height:14 }} />
              <span>
                <strong style={{ color: gdriveRidesAuto && gdrivePath ? '#39ff14' : undefined }}>Ritten</strong>
                {' '}— auto-export geïmporteerde ritten naar
                <code style={{ fontSize:10, marginLeft:4, color:'#39ff14' }}>{GDRIVE_RIDES_FOLDER}/</code>
              </span>
            </label>
          </div>
        </div>
      )}

      {subSection !== 'connections' && (
        <div className="wd-profile-actions">
          <p className="wd-profile-note">
            <Lightbulb size={12} style={{ display:'inline', verticalAlign:'middle', marginRight: 4, color:'#fdcb6e' }} />
            Geslacht verbetert hrTSS. Leeftijd schat maxHR. Gewicht geeft W/kg en calorieën.
          </p>
          <button className="wd-recalc-btn" onClick={onRecalculate} disabled={recalculating}>
            {recalculating
              ? <><RefreshCw size={13} className="spin" /> Berekenen…</>
              : <><RotateCcw size={13} /> Herbereken alle ritten</>
            }
          </button>
        </div>
      )}
    </div>
  );
};
