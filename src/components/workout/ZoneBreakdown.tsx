import React from 'react';
import './ZoneBreakdown.css';
import { fmtDur } from './ZoneBar';

interface ZoneBreakdownProps {
  times: number[];
  zones: { zone: number; name: string; color: string }[];
}

const DetailZoneBar: React.FC<{ times: number[]; zones: { name: string; color: string }[] }> = ({ times, zones }) => {
  const total = times.reduce((s, t) => s + t, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', gap: 1, marginBottom: 12 }}>
      {times.map((t, i) => {
        const pct = (t / total) * 100;
        if (pct < 0.5) return null;
        return <div key={i} style={{ width: `${pct}%`, background: zones[i]?.color }} title={`Z${i+1} ${zones[i]?.name}: ${fmtDur(Math.round(t))}`} />;
      })}
    </div>
  );
};

export const ZoneBreakdown: React.FC<ZoneBreakdownProps> = ({ times, zones }) => {
  const total = times.reduce((s, t) => s + t, 0);
  if (total === 0) return null;
  const data = times.map((t, i) => ({
    name:  `Z${i + 1}`,
    label: zones[i]?.name,
    time:  Math.round(t),
    pct:   Math.round((t / total) * 100),
    color: zones[i]?.color,
  })).filter(d => d.time > 0);

  return (
    <div>
      <DetailZoneBar times={times} zones={zones} />
      <div className="rp-zone-grid">
        {data.map(d => (
          <div key={d.name} className="rp-zone-item">
            <div className="rp-zone-item__dot" style={{ background: d.color }} />
            <div className="rp-zone-item__info">
              <span className="rp-zone-item__name">{d.name} · {d.label}</span>
              <span className="rp-zone-item__time">{fmtDur(d.time)} · {d.pct}%</span>
            </div>
            <div className="rp-zone-item__bar">
              <div style={{ width: `${d.pct}%`, height: '100%', background: d.color, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
