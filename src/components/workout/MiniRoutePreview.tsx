import React from 'react';
import { RidePoint } from '../../types/workout';

interface MiniRoutePreviewProps {
  points: RidePoint[];
}

export const MiniRoutePreview: React.FC<MiniRoutePreviewProps> = ({ points }) => {
  const gpsPoints = points.filter(p => p.lat != null && p.lng != null);

  if (gpsPoints.length < 5) {
    // Fallback: toon een watt- of hartslaggrafiek als SVG
    const hrOrPowerPoints = points.map(p => p.power ?? p.hr ?? 0);
    if (hrOrPowerPoints.length === 0) return null;

    const maxVal = Math.max(...hrOrPowerPoints, 1);
    const minVal = Math.min(...hrOrPowerPoints, 0);
    const w = 240;
    const h = 100;
    const pathData = hrOrPowerPoints
      .map((val, idx) => {
        const x = (idx / (hrOrPowerPoints.length - 1 || 1)) * w;
        const y = h - ((val - minVal) / (maxVal - minVal || 1)) * h;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', opacity: 0.85 }}>
        <path
          d={pathData}
          fill="none"
          stroke="url(#fallbackGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="fallbackGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#6c5ce7" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  const lats = gpsPoints.map(p => p.lat!);
  const lngs = gpsPoints.map(p => p.lng!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const w = 240;
  const h = 120;
  const padding = 12;

  const scaleX = (lng: number) => padding + ((lng - minLng) / (maxLng - minLng || 1)) * (w - 2 * padding);
  const scaleY = (lat: number) => padding + (1 - (lat - minLat) / (maxLat - minLat || 1)) * (h - 2 * padding);

  const pathData = gpsPoints
    .map((p, idx) => {
      const x = scaleX(p.lng!).toFixed(1);
      const y = scaleY(p.lat!).toFixed(1);
      return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <path
        d={pathData}
        fill="none"
        stroke="url(#routeGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(165, 180, 252, 0.45))' }}
      />
      <circle cx={scaleX(lngs[0])} cy={scaleY(lats[0])} r="4" fill="#00b894" stroke="#fff" strokeWidth="1.5" />
      <circle cx={scaleX(lngs[lngs.length - 1])} cy={scaleY(lats[lats.length - 1])} r="4" fill="#d63031" stroke="#fff" strokeWidth="1.5" />

      <defs>
        <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="50%" stopColor="#00b894" />
          <stop offset="100%" stopColor="#a29bfe" />
        </linearGradient>
      </defs>
    </svg>
  );
};
