import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { Brain, Activity, TrendingUp, Mountain } from 'lucide-react';
import PowerDurationCurve from '../PowerDurationCurve';
import { FitnessProfile, SPEED_EFFORT_DURATIONS, RideSummaryWithBests } from '../../types/workout';
import { predictFutureFTP, predictVO2max } from '../../utils/localNeuralNet';
import { CriticalPowerCurve } from '../workout/CriticalPowerCurve';
import { PhenotypeProfile } from '../workout/PhenotypeProfile';
import { PowerProfileTable } from '../workout/PowerProfileTable';
import { ClimbsLeaderboard } from '../workout/ClimbsLeaderboard';
import { EFtpProgression } from '../workout/EFtpProgression';

interface PRSectionProps {
  profile: FitnessProfile;
  globaleFTP: number;
  globalPowerBests: Record<string, number> | null;
  last90PowerBests: Record<string, number> | null;
  globalSpeedBests: Record<string, number> | null;
  last90SpeedBests: Record<string, number> | null;
  hasAnyPower: boolean;
  eFTPData: Array<{ date: string; eFTP: number | null }>;
  rides: RideSummaryWithBests[];
}

export const PRSection: React.FC<PRSectionProps> = ({
  profile,
  globaleFTP,
  globalPowerBests,
  last90PowerBests,
  globalSpeedBests,
  last90SpeedBests,
  hasAnyPower,
  eFTPData,
  rides,
}) => {
  const [activeTab, setActiveTab] = useState<'conditie' | 'vermogen' | 'klims'>('conditie');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {/* Premium Tab Buttons */}
      <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('conditie')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: activeTab === 'conditie' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
            color: activeTab === 'conditie' ? '#00e5ff' : '#94a3b8',
            transition: 'all 0.15s',
            fontFamily: 'inherit'
          }}
        >
          <TrendingUp size={13} />
          Conditietrend
        </button>
        <button
          onClick={() => setActiveTab('vermogen')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: activeTab === 'vermogen' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
            color: activeTab === 'vermogen' ? '#00e5ff' : '#94a3b8',
            transition: 'all 0.15s',
            fontFamily: 'inherit'
          }}
        >
          <Activity size={13} />
          Vermogensprofiel
        </button>
        <button
          onClick={() => setActiveTab('klims')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: activeTab === 'klims' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
            color: activeTab === 'klims' ? '#00e5ff' : '#94a3b8',
            transition: 'all 0.15s',
            fontFamily: 'inherit'
          }}
        >
          <Mountain size={13} />
          Klimklassement
        </button>
      </div>

      {activeTab === 'conditie' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '22px', alignItems: 'start', width: '100%' }}>
          {/* Left: eFTP Predictions */}
          <div>
            {hasAnyPower && eFTPData.length > 2 ? (
              <div className="wd-section-card" style={{ margin: 0 }}>
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">
                    <Brain size={13} style={{ display:'inline', verticalAlign:'middle', marginRight:5, color:'#00e5ff' }} />
                    Offline AI eFTP Prognose (Volgende 8 weken)
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)' }}>
                    Zelflerend MLP Neuraal Netwerk
                  </span>
                </div>
                
                {(() => {
                  const ftpHistory = eFTPData.map((d: any) => d.eFTP).filter((v: number | null): v is number => v !== null);
                  if (ftpHistory.length < 2) return null;

                  const lastFTP = ftpHistory[ftpHistory.length - 1];
                  const currentFtpVal = profile.ftp ?? lastFTP ?? 220;

                  const nowMs = Date.now();
                  const thirtyDaysAgo = nowMs - 30 * 24 * 3600 * 1000;
                  const recentRidesCount = eFTPData.filter(d => new Date(d.date).getTime() >= thirtyDaysAgo).length;
                  const consistency = (recentRidesCount / 30) * 7;
                  const estimatedCTL = Math.max(15, Math.round((recentRidesCount * 70) / 30));
                  const estimatedATL = Math.round(estimatedCTL * 1.1);

                  const targetFTP = predictFutureFTP(currentFtpVal, estimatedCTL, estimatedATL, consistency, estimatedCTL);
                  const ftpDiff = targetFTP - currentFtpVal;
                  
                  const forecastData = eFTPData.map((d: any) => ({
                    label: d.date,
                    eFTP: d.eFTP,
                    voorspelling: null as number | null,
                  }));
                  
                  for (let w = 1; w <= 8; w++) {
                    const progressRatio = w / 8;
                    const curveFactor = Math.sin(progressRatio * Math.PI / 2);
                    const predicted = Math.round(currentFtpVal + ftpDiff * curveFactor);
                    forecastData.push({
                      label: `Week +${w}`,
                      eFTP: null,
                      voorspelling: Math.max(50, Math.min(600, predicted)),
                    });
                  }

                  if (forecastData.length > 8) {
                    const transitionIndex = forecastData.length - 9;
                    forecastData[transitionIndex].voorspelling = forecastData[transitionIndex].eFTP;
                  }

                  const finalPredicted = forecastData[forecastData.length - 1].voorspelling;

                  return (
                    <div>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.4 }}>
                        Ons offline neuraal netwerk voorspelt dat je drempelvermogen (eFTP) over 8 weken stijgt naar 
                        <strong style={{ color: '#00e5ff', marginLeft: 4 }}>
                          {finalPredicted} Watt
                        </strong> (een verandering van {ftpDiff >= 0 ? '+' : ''}{Math.round((ftpDiff / currentFtpVal) * 100)}%), 
                        gebaseerd op je wekelijkse consistentie van <strong>{consistency.toFixed(1)} trainingen/week</strong>.
                      </p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#94a3b8' }} unit="W" />
                          <Tooltip
                            contentStyle={{ background: '#12121e', border: 'none', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: any, name: any) => [
                              `${v} W`,
                              name === 'eFTP' ? 'Gerealiseerd eFTP' : 'Voorspeld eFTP'
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="eFTP"
                            stroke="#6c5ce7"
                            strokeWidth={2}
                            dot={{ fill: '#6c5ce7', r: 3 }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="voorspelling"
                            stroke="#00e5ff"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={{ fill: '#00e5ff', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="wd-section-card" style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
                Onvoldoende vermogensgegevens om een eFTP-prognose te maken. Blijf ritten met wattage uploaden.
              </div>
            )}
          </div>

          {/* Right: AI VO2max & PRs list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* AI VO2max card */}
            {(() => {
              const ftpVal = profile.ftp ?? globaleFTP ?? 220;
              const weightVal = profile.weight ?? 75;
              const estimatedVO2 = predictVO2max(ftpVal * 0.75, 138, 30, weightVal);

              return (
                <div className="wd-section-card" style={{
                  background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.03), rgba(108, 92, 231, 0.01))',
                  border: '1px solid rgba(0, 229, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '16px',
                  margin: 0
                }}>
                  <div className="wd-section-card__head" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <Brain size={14} color="#00e5ff" />
                    <span className="wd-section-card__title" style={{ fontSize: 11 }}>AI VO2max Schatting</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <div style={{ fontSize: '24px', fontWeight: 300, color: '#00e5ff', lineHeight: 1 }}>
                      {estimatedVO2} <span style={{ fontSize: '10px', color: '#64748b' }}>ml/kg/min</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4, marginTop: 4 }}>
                      Dit is een submaximale schatting gebaseerd op je eFTP van {ftpVal}W en gewicht van {weightVal}kg. 
                      {estimatedVO2 > 50 
                        ? " Je conditie is uitstekend (topklasse) voor duursporten!" 
                        : estimatedVO2 > 40 
                          ? " Je conditie is bovengemiddeld. Blijf consistent trainen." 
                          : " Goede basis. Focus op langere duurtrainingen om je longinhoud te vergrozen."}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Speeds PRs card */}
            {globalSpeedBests && (
              <div className="wd-section-card" style={{ margin: 0 }}>
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">🏆 Snelheids PR's</span>
                </div>
                <div className="wd-bests-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {SPEED_EFFORT_DURATIONS.map(({ key, label }) => {
                    const val = (globalSpeedBests as any)[key];
                    return val ? (
                      <div className="wd-best-item" key={key} style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="wd-best-dur" style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>{label}</span>
                        <span className="wd-best-val" style={{ fontSize: '16px', fontWeight: 300, color: 'var(--color-primary, #00e5ff)' }}>{val} km/h</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <EFtpProgression rides={rides} weight={profile.weight} />
        </>
      )}


      {activeTab === 'vermogen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '22px', alignItems: 'start', width: '100%' }}>
          {/* Left: Curves */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <CriticalPowerCurve rides={rides} weight={profile.weight} />
            <PowerDurationCurve
              allTimePower={globalPowerBests ?? {}}
              last90Power={last90PowerBests ?? {}}
              allTimeSpeed={globalSpeedBests ?? {}}
              last90Speed={last90SpeedBests ?? {}}
              ftp={profile.ftp ?? globaleFTP}
              weight={profile.weight}
              hasPower={hasAnyPower}
            />
          </div>

          {/* Right: Coggan profiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <PhenotypeProfile rides={rides} weight={profile.weight} gender={profile.gender === 'female' ? 'female' : 'male'} />
            <PowerProfileTable rides={rides} weight={profile.weight} />
          </div>
        </div>
      )}

      {activeTab === 'klims' && (
        <div style={{ width: '100%' }}>
          <ClimbsLeaderboard rides={rides} />
        </div>
      )}
    </div>
  );
};
