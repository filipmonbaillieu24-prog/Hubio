import React, { useState } from 'react';
import '../workout.css';
import { FitnessProfile } from '../types/workout';
import { GearPage } from './GearPage';
import { ProfilePanel } from '../components/workout/ProfilePanel';
import { Bike, UserCog, Link2, Brain } from 'lucide-react';
import { AISettingsPanel } from '../components/workout/AISettingsPanel';

interface SettingsPageProps {
  profile: FitnessProfile;
  onProfileChange: (p: FitnessProfile) => void;
  globaleFTP?: number;
  onRecalculate: () => void;
  recalculating: boolean;
}

type SubTab = 'gear' | 'zones' | 'connections' | 'ai';

export const SettingsPage: React.FC<SettingsPageProps> = ({
  profile,
  onProfileChange,
  globaleFTP,
  onRecalculate,
  recalculating,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('gear');

  const navItems = [
    { key: 'gear',        icon: <Bike size={13} />, label: 'Mijn Gear' },
    { key: 'zones',       icon: <UserCog size={13} />, label: 'Profiel & Zones' },
    { key: 'connections', icon: <Link2 size={13} />, label: 'Koppelingen' },
    { key: 'ai',          icon: <Brain size={13} />, label: 'AI Assistent' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', padding: '16px 24px' }}>
      {/* Sub-Tab Navigation */}
      <div style={{
        display: 'flex', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.04)', width: 'fit-content', margin: 0
      }}>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveSubTab(item.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: activeSubTab === item.key ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
              color: activeSubTab === item.key ? '#00e5ff' : '#94a3b8',
              transition: 'all 0.15s', fontFamily: 'inherit'
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeSubTab === 'gear' && (
          <GearPage profile={profile} />
        )}

        {activeSubTab === 'zones' && (
          <div className="wd-main-single">
            <div className="wd-coach-header" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>👤 Profiel & Zones</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Beheer je fysiologische grenzen, trainingszones en persoonsgegevens.</p>
            </div>
            <ProfilePanel
              profile={profile}
              onChange={onProfileChange}
              globaleFTP={globaleFTP}
              onRecalculate={onRecalculate}
              recalculating={recalculating}
              subSection="zones"
            />
          </div>
        )}

        {activeSubTab === 'connections' && (
          <div className="wd-main-single">
            <div className="wd-coach-header" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>🔌 Koppelingen & Integraties</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Configureer bestandslocaties en automatische clouddiensten.</p>
            </div>
            <ProfilePanel
              profile={profile}
              onChange={onProfileChange}
              globaleFTP={globaleFTP}
              onRecalculate={onRecalculate}
              recalculating={recalculating}
              subSection="connections"
            />
          </div>
        )}

        {activeSubTab === 'ai' && (
          <div className="wd-main-single">
            <div className="wd-coach-header" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>🧠 AI Assistent Instellingen</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Configureer je lokale of externe AI-coach.</p>
            </div>
            <AISettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
};
