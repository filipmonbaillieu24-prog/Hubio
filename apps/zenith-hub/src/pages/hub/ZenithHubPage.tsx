import React, { useState, useEffect, useMemo } from 'react';
import { User, LayoutDashboard, Calendar as CalendarIcon, Boxes, Scale, Moon, Footprints, Dumbbell, Bike, Activity, Heart } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { CalendarPage } from './CalendarPage';
import { predictRecoveryScore } from '../../../../../shared/ml/RecoveryScore';
import './ZenithHub.css';

interface ZenithHubPageProps {
  fitnessProfile: any;
  fitnessMetrics: { ctl: number; atl: number; tsb: number };
  onOpenApp: (appKey: 'cyclo' | 'cyclopilot' | 'vigor' | 'indigogym' | 'fuel') => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  userId: string;
}

export const ZenithHubPage: React.FC<ZenithHubPageProps> = ({
  fitnessProfile,
  fitnessMetrics,
  onOpenApp,
  onOpenProfile,
  onLogout,
  userId,
}) => {
  const ctl = Math.round(fitnessMetrics.ctl);
  const atl = Math.round(fitnessMetrics.atl);
  const tsb = Math.round(fitnessMetrics.tsb);

  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'calendar' | 'apps'>('dashboard');

  // Dashboard Stats States
  const [latestWeight, setLatestWeight] = useState<any | null>(null);
  const [latestSleep, setLatestSleep] = useState<any | null>(null);
  const [todaySteps, setTodaySteps] = useState<number>(0);
  const [weeklyRidesCount, setWeeklyRidesCount] = useState<number>(0);
  const [weeklyRidesDistance, setWeeklyRidesDistance] = useState<number>(0);
  const [weeklyKratosCount, setWeeklyKratosCount] = useState<number>(0);
  const [weeklyGymVolume, setWeeklyGymVolume] = useState<number>(0);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      // 1. Fetch latest weight log
      const { data: wData } = await supabase
        .from('vigor_weight')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(1);
      if (wData && wData.length > 0) {
        setLatestWeight(wData[0]);
      } else {
        setLatestWeight(null);
      }

      // 2. Fetch latest sleep log
      const { data: sData } = await supabase
        .from('vigor_sleep')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(1);
      if (sData && sData.length > 0) {
        setLatestSleep(sData[0]);
      } else {
        setLatestSleep(null);
      }

      // 3. Fetch today's steps log
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { data: stData } = await supabase
        .from('vigor_steps')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', todayStart.toISOString())
        .lte('logged_at', todayEnd.toISOString())
        .limit(1);
      if (stData && stData.length > 0) {
        setTodaySteps(stData[0].steps);
      } else {
        // Try fallback to last log to show something, or 0
        setTodaySteps(0);
      }

      // 4. Calculate start of current week (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);

      // 5. Fetch weekly rides count & distance
      const { data: rData } = await supabase
        .from('rides')
        .select('distance')
        .eq('user_id', userId)
        .gte('date', startOfWeek.getTime());

      if (rData) {
        setWeeklyRidesCount(rData.length);
        const totalDist = rData.reduce((sum, r) => sum + Number(r.distance || 0), 0);
        setWeeklyRidesDistance(totalDist);
      } else {
        setWeeklyRidesCount(0);
        setWeeklyRidesDistance(0);
      }

      // 6. Fetch weekly Kratos workouts count and volume
      const { data: kData } = await supabase
        .from('kratos_workouts')
        .select('id, volume')
        .eq('user_id', userId)
        .gte('completed_at', startOfWeek.toISOString());
      
      if (kData) {
        setWeeklyKratosCount(kData.length);
        const totalVolume = kData.reduce((sum, w) => sum + Number(w.volume || 0), 0);
        setWeeklyGymVolume(totalVolume);
      } else {
        setWeeklyKratosCount(0);
        setWeeklyGymVolume(0);
      }

    } catch (err) {
      console.error('Error loading dashboard statistics:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (userId && activeSubTab === 'dashboard') {
      fetchDashboardData();
    }
  }, [userId, activeSubTab]);

  // Calculate recovery score (CR11)
  const recoveryScore = useMemo(() => {
    const sQual = latestSleep?.quality_score ?? 80;
    const sDur = (latestSleep?.duration_minutes ?? 480) / 60;
    const weightVal = latestWeight?.weight ?? fitnessProfile.weight ?? 75;
    
    return predictRecoveryScore(
      tsb,
      sQual,
      sDur,
      weeklyGymVolume,
      todaySteps,
      0, // calorieBalance default
      weightVal,
      atl
    );
  }, [tsb, latestSleep, latestWeight, fitnessProfile.weight, weeklyGymVolume, todaySteps, atl]);

  const apps = [
    {
      key: 'cyclo',
      title: 'Aero',
      subtitle: 'Desktop & Web Analytics',
      desc: 'Het hart van uw fysiologische data-analyse. Krijg inzicht in uw PMC-grafieken, training stress en PRs.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Aero',
      enabled: true,
      icon: '/assets/icons/aero.png'
    },
    {
      key: 'cyclopilot',
      title: 'Pilot',
      subtitle: 'Android Audio Companion',
      desc: 'Uw in-ear coach voor op de fiets. Real-time audio cues, geoptimaliseerd op wind en hellingen. Werkt volledig offline.',
      status: 'Mobiel Verbonden',
      statusColor: '#cbd5e1',
      actionText: 'Open Pilot',
      enabled: true,
      icon: '/assets/icons/pilot.png'
    },
    {
      key: 'vigor',
      title: 'Vigor',
      subtitle: 'Health & Vitality Tracker',
      desc: 'Beheer uw gewicht via Bluetooth weegschaalkoppeling, volg uw slaappatronen en stappen om uw algemene fitheid te optimaliseren.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Vigor',
      enabled: true,
      icon: '/assets/icons/vigor.png'
    },
    {
      key: 'indigo',
      title: 'Strider',
      subtitle: 'Running Companion',
      desc: 'Ecosysteem-extensie voor hardlopers. Geïntegreerde VO2Max loopschatting en real-time cadans-coaching.',
      status: 'Binnenkort',
      statusColor: '#64748b',
      actionText: 'Installeren',
      enabled: false,
      icon: '/assets/icons/strider.png'
    },
    {
      key: 'indigogym',
      title: 'Kratos',
      subtitle: 'Strength & Conditioning',
      desc: 'Kracht- en weerstandstraining met dynamische fysiologische hersteltijden gebaseerd op uw cardiovasculaire stress.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Kratos',
      enabled: true,
      icon: '/assets/icons/kratos.png'
    },
    {
      key: 'fuel',
      title: 'Fuel',
      subtitle: 'Macro & Recipe Planner',
      desc: 'Nutritionele macroplanner en receptenbibliotheek, volledig afgestemd op de fysiologische energiebehoefte van uw ritten.',
      status: 'Geïnstalleerd',
      statusColor: '#cbd5e1',
      actionText: 'Open Fuel',
      enabled: true,
      icon: '/assets/icons/fuel.png'
    }
  ];

  // Helper for steps goal percentage
  const stepsGoal = Number(fitnessProfile.target_steps || 10000);
  const stepsPercentage = Math.min(100, Math.round((todaySteps / stepsGoal) * 100));

  return (
    <div className="zh-hub-container">
      {/* Background radial glow */}
      <div className="zh-hub-glow" />

      {/* Header section */}
      <header className="zh-hub-header animate-slide-down">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="zh-logo-badge">
            <img 
              src="/assets/logo.png" 
              alt="Zenith Logo" 
              style={{ width: 34, height: 34, objectFit: 'contain' }} 
            />
          </div>
          <div>
            <h1 className="zh-hub-title" style={{ fontSize: 24, lineHeight: 1 }}>ZENITH</h1>
            <p className="zh-hub-subtitle" style={{ marginTop: 4, marginBottom: 0 }}>Gecentraliseerd Fysiologisch Ecosysteem</p>
          </div>
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

      {/* Navigation tabs bar in Vigor-style */}
      <div className="vigor-nav" style={{ 
        display: 'flex', 
        gap: 8, 
        background: 'rgba(255,255,255,0.02)', 
        border: '1px solid rgba(255,255,255,0.05)', 
        padding: '6px', 
        borderRadius: '14px', 
        marginBottom: '24px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
          { id: 'calendar', label: 'Kalender', icon: <CalendarIcon size={16} /> },
          { id: 'apps', label: 'Applicaties', icon: <Boxes size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid ' + (activeSubTab === tab.id ? 'rgba(203, 213, 225, 0.25)' : 'transparent'),
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              background: activeSubTab === tab.id ? 'rgba(203, 213, 225, 0.08)' : 'transparent',
              color: activeSubTab === tab.id ? '#fff' : '#64748b',
              flex: 1
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB VIEW */}
      {activeSubTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
          {/* PMC & Recovery Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
            {/* PMC Card */}
            <div className="zh-stats-card">
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '1px' }}>
                  Fysiologische Belastingsbalans (PMC)
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                Berekend op basis van uw geregistreerde trainingsbelasting uit de gekoppelde Aero & Kratos extensies.
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
                  <strong className="zh-stat-value" style={{ color: tsb >= 0 ? '#cbd5e1' : '#eccc68' }}>{tsb >= 0 ? `+${tsb}` : tsb}</strong>
                </div>
              </div>
            </div>

            {/* Recovery Score Card */}
            <div className="zh-stats-card" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(20, 20, 20, 0.8) 100%)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Heart size={14} style={{ color: '#ff7675' }} /> AI Recovery Score
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                    Real-time herstelscore berekend over slaap, cardiobelasting en krachttraining.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', width: 56, height: 56, borderRadius: '50%' }}>
                  <strong style={{ fontSize: 20, color: '#ff7675', fontWeight: 900 }}>{recoveryScore}%</strong>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <div style={{ height: 6, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${recoveryScore}%`, background: 'linear-gradient(90deg, #ff7675, #ef4444)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 700 }}>
                  {recoveryScore >= 80 ? '🏆 Uitstekend hersteld. Klaar voor intensieve training!' :
                   recoveryScore >= 50 ? '💪 Goed hersteld. Normale belasting is prima.' :
                   '⚠️ Vermoeidheid gedetecteerd. Focus op actieve recuperatie of rust.'}
                </span>
              </div>
            </div>
          </div>

          {/* Sub Grid for health and weekly overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
            {/* Widget 1: Health & Vitality (Vigor) */}
            <div className="zh-stats-card" style={{ display: 'flex', flexDirection: 'column', justifySelf: 'stretch' }}>
              <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.8px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={14} style={{ color: '#cbd5e1' }} /> Gezondheid & Vitaliteit (Vigor)
              </h3>
              
              {loadingDashboard ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, minHeight: 120 }}>
                  Vitaliteit laden...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
                  {/* Weight log */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div>
                      <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Meest Recente Gewicht</span>
                      <strong style={{ fontSize: 18, color: '#f8fafc', fontWeight: 800 }}>
                        {latestWeight ? `${latestWeight.weight} kg` : '--'}
                      </strong>
                    </div>
                    {latestWeight && (
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {new Date(latestWeight.logged_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Sleep log */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Moon size={16} style={{ color: '#a29bfe' }} />
                      <div>
                        <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Slaapkwaliteit</span>
                        <strong style={{ fontSize: 13, color: '#f8fafc' }}>
                          {latestSleep ? `${Math.round(latestSleep.duration_minutes / 60 * 10) / 10} uur` : '--'}
                        </strong>
                      </div>
                    </div>
                    {latestSleep && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 6 }}>
                        Score: {latestSleep.quality_score}/100
                      </span>
                    )}
                  </div>

                  {/* Steps Progress */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Footprints size={16} style={{ color: '#cbd5e1' }} />
                        <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Stappenteller Vandaag</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
                        {todaySteps.toLocaleString()} / {stepsGoal.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${stepsPercentage}%`, background: 'linear-gradient(90deg, #cbd5e1, #ffffff)', borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Widget 2: Weekly training summary statistics */}
            <div className="zh-stats-card" style={{ display: 'flex', flexDirection: 'column', justifySelf: 'stretch' }}>
              <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.8px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} style={{ color: '#cbd5e1' }} /> Wekelijkse Prestaties
              </h3>

              {loadingDashboard ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, minHeight: 120 }}>
                  Prestaties laden...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
                  {/* Aero Cardio summary */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Bike size={18} style={{ color: '#cbd5e1' }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Cardio (Aero)</span>
                    </div>
                    <div>
                      <strong style={{ fontSize: 24, display: 'block', fontWeight: 900, color: '#f8fafc' }}>
                        {weeklyRidesDistance.toFixed(0)} <span style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1' }}>km</span>
                      </strong>
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                        {weeklyRidesCount} {weeklyRidesCount === 1 ? 'fietserit' : 'fietseritten'}
                      </span>
                    </div>
                  </div>

                  {/* Kratos Strength summary */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Dumbbell size={18} style={{ color: '#c084fc' }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Kracht (Kratos)</span>
                    </div>
                    <div>
                      <strong style={{ fontSize: 24, display: 'block', fontWeight: 900, color: '#f8fafc' }}>
                        {weeklyKratosCount} <span style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1' }}>sessies</span>
                      </strong>
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                        Deze week voltooid
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KALENDER TAB VIEW */}
      {activeSubTab === 'calendar' && (
        <CalendarPage userId={userId} userName={fitnessProfile.name ?? 'Atleet'} />
      )}

      {/* APPLICATIES TAB VIEW */}
      {activeSubTab === 'apps' && (
        <section className="zh-apps-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px 4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Ecosysteem Applicaties & Extensies
          </h2>
          <div className="zh-apps-grid">
            {apps.map(app => (
              <div key={app.key} className={`zh-app-card ${!app.enabled ? 'disabled' : ''}`}>
                {/* Background Watermark Icon */}
                <img 
                  src={app.icon} 
                  alt="" 
                  className="zh-app-card-bg-icon" 
                />

                {/* Top Row: Icon and Status */}
                <div className="zh-app-card-top">
                  <div className="zh-app-icon">
                    <img 
                      src={app.icon} 
                      alt={app.title} 
                      style={{ width: 56, height: 56, objectFit: 'contain' }} 
                    />
                  </div>
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

                {/* Meta Block: Title & Subtitle */}
                <div className="zh-app-meta" style={{ marginTop: 18, zIndex: 1 }}>
                  <span className="zh-app-subtitle">{app.subtitle}</span>
                  <h3 className="zh-app-title" style={{ marginTop: 4, marginBottom: 0 }}>{app.title}</h3>
                </div>

                {/* Body Block: Description */}
                <div className="zh-app-card-body" style={{ flex: 1, marginTop: 12, zIndex: 1 }}>
                  <p className="zh-app-desc" style={{ margin: 0 }}>{app.desc}</p>
                </div>

                {/* Footer Block: Button */}
                <div className="zh-app-card-footer" style={{ marginTop: 24, zIndex: 1 }}>
                  {app.enabled ? (
                    <button 
                      onClick={() => onOpenApp(app.key as any)}
                      className="zh-app-btn"
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
      )}
    </div>
  );
};
