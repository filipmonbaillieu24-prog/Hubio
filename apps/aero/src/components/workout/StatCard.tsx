import React from 'react';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  color?: string;
  typeClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, sub, color, typeClass }) => (
  <div className={`rp-stat-card${typeClass ? ' ' + typeClass : ''}`} style={{ borderLeftColor: color ?? 'transparent' }}>
    <span className="rp-stat-val" style={{ color }}>{value}{unit && <small> {unit}</small>}</span>
    <span className="rp-stat-label">{label}</span>
    {sub && <span className="rp-stat-sub">{sub}</span>}
  </div>
);
