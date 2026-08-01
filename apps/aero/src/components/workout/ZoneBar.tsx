import React from 'react';
import './ZoneBar.css';

// Formatting helper
export function fmtDur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}

interface ZoneBarProps {
  times: number[];
  zones: { name: string; color: string }[];
}

export const ZoneBar: React.FC<ZoneBarProps> = ({ times, zones }) => {
  const total = times.reduce((s, t) => s + t, 0);
  if (total === 0) return null;
  return (
    <div className="wd-zone-bar">
      {times.map((t, i) => {
        const pct = (t / total) * 100;
        if (pct < 1) return null;
        return (
          <div key={i} className="wd-zone-bar__seg"
            style={{ width: `${pct}%`, background: zones[i]?.color }}
            title={`Z${i + 1} ${zones[i]?.name}: ${fmtDur(Math.round(t))}`}
          />
        );
      })}
    </div>
  );
};

export const ZoneLegend: React.FC<ZoneBarProps> = ({ times, zones }) => {
  const total = times.reduce((s, t) => s + t, 0);
  if (total === 0) return null;
  return (
    <div className="wd-zone-legend">
      {times.map((t, i) => t > 0 ? (
        <div key={i} className="wd-zone-legend__item">
          <span className="wd-zone-legend__dot" style={{ background: zones[i]?.color }} />
          <span className="wd-zone-legend__name">Z{i + 1}</span>
          <span className="wd-zone-legend__time">{fmtDur(Math.round(t))}</span>
          <span className="wd-zone-legend__pct">{((t / total) * 100).toFixed(0)}%</span>
        </div>
      ) : null)}
    </div>
  );
};
