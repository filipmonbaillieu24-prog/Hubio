import React from 'react';
import { Brain, Bike, Activity, Dumbbell, Apple, Sparkles, LayoutGrid } from 'lucide-react';
import './ZenithHub.css';

interface ZenithHubPageProps {
  fitnessProfile: any;
  fitnessMetrics: { ctl: number; atl: number; tsb: number };
  onOpenApp: (appKey: 'cyclo' | 'cyclopilot') => void;
}

export const ZenithHubPage: React.FC<ZenithHubPageProps> = ({
  fitnessProfile,
  fitnessMetrics,
  onOpenApp,
}) => {
  const ctl = Math.round(fitnessMetrics.ctl);
  const atl = Math.round(fitnessMetrics.atl);
  const tsb = Math.round(fitnessMetrics.tsb);

  const apps = [
    {
      key: 'cyclo',
      title: 'Cyclo Studio',
      subtitle: 'Desktop & Web Analytics',
      desc: 'Het hart van uw fysiologische data-analyse. Krijg inzicht in uw PMC-grafieken, training stress en PRs.',
      icon: <Bike size={24} color="#00e5ff" />,
      status: 'Geïnstalleerd',
      statusColor: '#00e5ff',
      actionText: 'Open Studio',
      enabled: true
    },
    {
      key: 'cyclopilot',
      title: 'CycloPilot',
      subtitle: 'Android Audio Companion',
      desc: 'Uw in-ear coach voor op de fiets. Real-time audio cues, geoptimaliseerd op wind en hellingen. Werkt volledig offline.',
      icon: <Brain size={24} color="#a29bfe" />,
      status: 'Mobiel Verbonden',
      statusColor: '#a29bfe',
      actionText: 'Open Dashboard',
      enabled: true
    },
    {
      key: 'indigo',
      title: 'IndiGo Run',
      subtitle: 'Running Companion',
      desc: 'Ecosysteem-extensie voor hardlopers. Geïntegreerde VO2Max loopschatting en real-time cadans-coaching.',
      icon: <Activity size={24} color="#64748b" />,
      status: 'Binnenkort',
      statusColor: '#64748b',
      actionText: 'Installeren',
      enabled: false
    },
    {
      key: 'indigogym',
      title: 'IndigoGym',
      subtitle: 'Strength & Conditioning',
      desc: 'Kracht- en weerstandstraining met dynamische fysiologische hersteltijden gebaseerd op uw cardiovasculaire stress.',
      icon: <Dumbbell size={24} color="#64748b" />,
      status: 'Binnenkort',
      statusColor: '#64748b',
      actionText: 'Installeren',
      enabled: false
    },
    {
      key: 'recigo',
      title: 'ReciGo Nutrition',
      subtitle: 'Macro & Recipe Planner',
      desc: 'Nutritionele macroplanner en receptenbibliotheek, volledig afgestemd op de fysiologische energiebehoefte van uw ritten.',
      icon: <Apple size={24} color="#64748b" />,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="zh-logo-badge">
            <LayoutGrid size={24} color="#00e5ff" />
          </div>
          <div>
            <h1 className="zh-hub-title">ZENITH</h1>
            <p className="zh-hub-subtitle">Gecentraliseerd Fysiologisch Ecosysteem</p>
          </div>
        </div>
        <div className="zh-user-badge">
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Ingelogd als:</span>
          <strong style={{ color: '#fff', fontSize: 12 }}>{fitnessProfile.name ?? 'Atleet'}</strong>
        </div>
      </header>

      {/* Fitness State Summary */}
      <section className="zh-stats-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="zh-stats-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color="#00e5ff" />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '1px' }}>
              Ecosysteem Fysiologische Status
            </h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            Al uw Zenith-extensies delen dezelfde Supabase-database. Uw conditie en trainingsgeschiedenis zijn direct gesynchroniseerd.
          </p>
          <div className="zh-stats-grid">
            <div className="zh-stat-item">
              <span className="zh-stat-label">Fitheid (CTL)</span>
              <strong className="zh-stat-value" style={{ color: '#00e5ff' }}>{ctl}</strong>
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
        <h2 style={{ fontSize: 14, fontWeight: 900, color: '#fff', margin: '0 0 16px 4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Ecosysteem Applicaties & Extensies
        </h2>
        <div className="zh-apps-grid">
          {apps.map(app => (
            <div key={app.key} className={`zh-app-card ${!app.enabled ? 'disabled' : ''}`}>
              <div className="zh-app-card-header">
                <div className="zh-app-icon">{app.icon}</div>
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
              <div className="zh-app-card-body">
                <h3 className="zh-app-title">{app.title}</h3>
                <span className="zh-app-subtitle">{app.subtitle}</span>
                <p className="zh-app-desc">{app.desc}</p>
              </div>
              <div className="zh-app-card-footer">
                {app.enabled ? (
                  <button 
                    onClick={() => onOpenApp(app.key as any)}
                    className="zh-app-btn"
                    style={{ background: `linear-gradient(135deg, ${app.statusColor} 0%, #6c5ce7 100%)`, boxShadow: `0 4px 12px ${app.statusColor}15` }}
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
