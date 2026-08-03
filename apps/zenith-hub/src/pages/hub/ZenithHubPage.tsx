import React from 'react';
import { User } from 'lucide-react';
import './ZenithHub.css';

interface ZenithHubPageProps {
  fitnessProfile: any;
  fitnessMetrics: { ctl: number; atl: number; tsb: number };
  onOpenApp: (appKey: 'cyclo' | 'cyclopilot' | 'vigor') => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const ZenithHubPage: React.FC<ZenithHubPageProps> = ({
  fitnessProfile,
  fitnessMetrics,
  onOpenApp,
  onOpenProfile,
  onLogout,
}) => {
  const ctl = Math.round(fitnessMetrics.ctl);
  const atl = Math.round(fitnessMetrics.atl);
  const tsb = Math.round(fitnessMetrics.tsb);

  const apps = [
    {
      key: 'cyclo',
      title: 'Aero',
      subtitle: 'Desktop & Web Analytics',
      desc: 'Het hart van uw fysiologische data-analyse. Krijg inzicht in uw PMC-grafieken, training stress en PRs.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Aero',
      enabled: true
    },
    {
      key: 'cyclopilot',
      title: 'Pilot',
      subtitle: 'Android Audio Companion',
      desc: 'Uw in-ear coach voor op de fiets. Real-time audio cues, geoptimaliseerd op wind en hellingen. Werkt volledig offline.',
      status: 'Mobiel Verbonden',
      statusColor: '#cbd5e1',
      actionText: 'Open Pilot',
      enabled: true
    },
    {
      key: 'vigor',
      title: 'Vigor',
      subtitle: 'Health & Vitality Tracker',
      desc: 'Beheer uw gewicht via Bluetooth weegschaalkoppeling, volg uw slaappatronen en stappen om uw algemene fitheid te optimaliseren.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Vigor',
      enabled: true
    },
    {
      key: 'indigo',
      title: 'Strider',
      subtitle: 'Running Companion',
      desc: 'Ecosysteem-extensie voor hardlopers. Geïntegreerde VO2Max loopschatting en real-time cadans-coaching.',
      status: 'Binnenkort',
      statusColor: '#64748b',
      actionText: 'Installeren',
      enabled: false
    },
    {
      key: 'indigogym',
      title: 'Kratos',
      subtitle: 'Strength & Conditioning',
      desc: 'Kracht- en weerstandstraining met dynamische fysiologische hersteltijden gebaseerd op uw cardiovasculaire stress.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Kratos',
      enabled: true
    },
    {
      key: 'recigo',
      title: 'Fuel',
      subtitle: 'Macro & Recipe Planner',
      desc: 'Nutritionele macroplanner en receptenbibliotheek, volledig afgestemd op de fysiologische energiebehoefte van uw ritten.',
      status: 'Binnenkort',
      statusColor: '#64748b',
      actionText: 'Installeren',
      enabled: false
    }
  ];

  return (
    <div className="zh-hub-container">
      {/* Background radial glow */}
      <div className="zh-hub-glow" />

      {/* Header section */}
      <header className="zh-hub-header animate-slide-down">
        <div>
          <h1 className="zh-hub-title" style={{ fontSize: 24 }}>ZENITH</h1>
          <p className="zh-hub-subtitle">Gecentraliseerd Fysiologisch Ecosysteem</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div 
            className="zh-user-badge"
            onClick={onOpenProfile}
            title="Profiel bewerken"
            style={{ 
              cursor: 'pointer', 
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 8 
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
          >
            <User size={13} style={{ color: '#94a3b8' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>Ingelogd als:</span>
              <strong style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>{fitnessProfile.name ?? 'Atleet'}</strong>
            </div>
          </div>
          <button
            onClick={onOpenProfile}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: 800,
              padding: '8px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: 'inherit',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
          >
            Profiel
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '10px',
              color: '#ff7675',
              fontSize: '11px',
              fontWeight: 800,
              padding: '8px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: 'inherit',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
          >
            Uitloggen
          </button>
        </div>
      </header>

      {/* Fitness State Summary */}
      <section className="zh-stats-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="zh-stats-card">
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '1px' }}>
              Ecosysteem Fysiologische Status
            </h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            Al uw Zenith-extensies delen dezelfde Supabase-database. Uw conditie en trainingsgeschiedenis zijn direct gesynchroniseerd.
          </p>
          <div className="zh-stats-grid">
            <div className="zh-stat-item">
              <span className="zh-stat-label">Fitheid (CTL)</span>
              <strong className="zh-stat-value" style={{ color: '#cbd5e1' }}>{ctl}</strong>
            </div>
            <div className="zh-stat-item">
              <span className="zh-stat-label">Vermoeidheid (ATL)</span>
              <strong className="zh-stat-value" style={{ color: '#ff7675' }}>{atl}</strong>
            </div>
            <div className="zh-stat-item">
              <span className="zh-stat-label">Vorm (TSB)</span>
              <strong className="zh-stat-value" style={{ color: tsb >= 0 ? '#39ff14' : '#eccc68' }}>{tsb >= 0 ? `+${tsb}` : tsb}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* App Grid */}
      <section className="zh-apps-section animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px 4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Ecosysteem Applicaties & Extensies
        </h2>
        <div className="zh-apps-grid">
          {apps.map(app => (
            <div key={app.key} className={`zh-app-card ${!app.enabled ? 'disabled' : ''}`}>
              <div className="zh-app-card-header">
                <span className="zh-app-subtitle">{app.subtitle}</span>
                <span 
                  className="zh-app-status-badge" 
                  style={{ 
                    color: app.statusColor, 
                    background: app.statusColor + '10', 
                    border: `1px solid ${app.statusColor}22` 
                  }}
                >
                  <span className="zh-status-dot" style={{ background: app.statusColor }} />
                  {app.status}
                </span>
              </div>
              <div className="zh-app-card-body" style={{ flex: 1 }}>
                <h3 className="zh-app-title" style={{ fontSize: 16, marginBottom: 8 }}>{app.title}</h3>
                <p className="zh-app-desc" style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>{app.desc}</p>
              </div>
              <div className="zh-app-card-footer" style={{ marginTop: 20 }}>
                {app.enabled ? (
                  <button 
                    onClick={() => onOpenApp(app.key as any)}
                    className="zh-app-btn"
                    style={{ background: 'linear-gradient(135deg, #cbd5e1 0%, #6c5ce7 100%)', boxShadow: '0 4px 12px rgba(203, 213, 225, 0.1)' }}
                  >
                    {app.actionText}
                  </button>
                ) : (
                  <button disabled className="zh-app-btn-disabled">
                    Binnenkort beschikbaar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
