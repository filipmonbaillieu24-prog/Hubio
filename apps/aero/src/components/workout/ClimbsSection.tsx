import React, { useMemo, useEffect } from 'react';
import './ClimbsSection.css';
import { Mountain } from 'lucide-react';
import { RidePoint } from '../../types/workout';
import { detectClimbs } from '../../utils/climbDetector';
import { predictClimbTime, trainClimbModel, classifyClimbingStyle } from '../../utils/localNeuralNet';
import { Brain } from 'lucide-react';

interface ClimbsSectionProps {
  points: RidePoint[];
  ftp?: number;
  weight?: number;
}

export const ClimbsSection: React.FC<ClimbsSectionProps> = ({ points, ftp, weight }) => {
  const climbs = useMemo(() => detectClimbs(points), [points]);

  useEffect(() => {
    if (!ftp || !weight || climbs.length === 0) return;
    climbs.forEach(climb => {
      const actualTimeSec = (points[climb.endIndex].time - points[climb.startIndex].time) / 1000;
      if (actualTimeSec > 10) {
        trainClimbModel(climb.lengthMeters, climb.avgGrade, ftp, weight, actualTimeSec);
      }
    });
  }, [climbs, points, ftp, weight]);

  const climbingStyle = useMemo(() => {
    if (climbs.length === 0) return null;
    let sum = 0;
    let count = 0;
    climbs.forEach(climb => {
      for (let i = climb.startIndex; i <= climb.endIndex; i++) {
        const pt = points[i];
        if (pt.cadence && pt.cadence > 0) {
          sum += pt.cadence;
          count++;
        }
      }
    });
    if (count === 0) return null;
    const avgCadence = sum / count;
    return {
      avgCadence: Math.round(avgCadence),
      ...classifyClimbingStyle(avgCadence)
    };
  }, [climbs, points]);

  if (climbs.length === 0) return null;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}m ${sec}s`;
  };

  return (
    <div className="rp-chart-card">
      <div className="wd-chart-card__head" style={{ marginBottom: 10 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Mountain size={16} color="#cbd5e1" />
          Gedetecteerde beklimmingen ({climbs.length})
        </h3>
      </div>

      {climbingStyle && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          background: 'rgba(203, 213, 225, 0.03)',
          border: '1px solid rgba(203, 213, 225, 0.08)',
          borderRadius: 10,
          marginBottom: 12
        }}>
          <Brain size={16} color="#cbd5e1" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#f8fafc' }}>AI Klimstijl: {climbingStyle.style} (gem. {climbingStyle.avgCadence} rpm)</span>
            <p style={{ fontSize: 10, color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>{climbingStyle.desc}</p>
          </div>
        </div>
      )}

      <div className="rp-climb-list">
        {climbs.map((climb, idx) => {
          const catColors: Record<string, string> = {
            'HC': '#ff7675',
            'Cat 1': '#a29bfe',
            'Cat 2': '#00b894',
            'Cat 3': '#fdcb6e',
            'Cat 4': '#74b9ff',
          };
          const color = catColors[climb.category] ?? '#94a3b8';
          const actualTimeSec = (points[climb.endIndex].time - points[climb.startIndex].time) / 1000;
          const predictedSec = predictClimbTime(climb.lengthMeters, climb.avgGrade, ftp ?? 220, weight ?? 75);

          return (
            <div key={idx} className="rp-climb-card" style={{ borderLeftColor: color }}>
              <div style={{ flex: 1 }}>
                <strong className="rp-climb-title">
                  Klim {idx + 1}
                </strong>
                <span className="rp-climb-stats" style={{ display: 'block', marginTop: 2 }}>
                  {climb.lengthMeters >= 1000 ? `${(climb.lengthMeters / 1000).toFixed(1)} km` : `${climb.lengthMeters} m`} ·
                  {' '}{climb.elevGain} hm ·
                  {' '}Gem. {climb.avgGrade}%
                </span>
                <span className="rp-climb-stats" style={{ display: 'block', color: 'var(--text-muted, #94a3b8)', marginTop: 2, fontSize: 10 }}>
                  ⏱️ Tijd: <strong>{fmtTime(actualTimeSec)}</strong> (AI voorspelling: <strong style={{ color: '#cbd5e1' }}>{fmtTime(predictedSec)}</strong>)
                </span>
              </div>
              <span className="rp-climb-badge" style={{ color: color, background: color + '15' }}>
                {climb.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
