import { useState, useEffect, useMemo, useCallback } from 'react';

import { FitnessProfile } from './types/workout';
import { useSavedLocations } from './hooks/useSavedLocations';
import { useRoutePlanner } from './hooks/useRoutePlanner';
import { Activity, Brain, Compass, Settings, LayoutDashboard, Bike, Map as MapIcon, Trophy, Calendar as CalendarIcon } from 'lucide-react';
import { AppTitlebar } from './components/layout/AppTitlebar';
import { RoutePage } from './components/route/RoutePage';

import { getAllRideSummaries, getAllRidesFull, saveRide, getAllGear } from './utils/db';

import { computePMC, interpretTSB } from './utils/pmc';
import { RideSummaryWithBests } from './types/workout';
import { computeRide, getWeightForDate, estimateGlobalFTP } from './utils/rideMetrics';
import WorkoutDashboard from './pages/WorkoutDashboard';
import RidePage from './pages/RidePage';
import { TrainingPage } from './pages/TrainingPage';
import { SettingsPage } from './pages/SettingsPage';
import { CalendarPage } from './pages/CalendarPage';
import { ZenithHubPage } from './pages/hub/ZenithHubPage';
import { PilotPanel } from './pages/hub/PilotPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette, CommandItem } from './components/CommandPalette';
import { calibrateSummaryModels, calibrateFullModels } from './utils/localNeuralNet';
import { supabase } from './utils/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { planWorkoutInCalendar } from './utils/trainingHelpers';
import './index.css';


function App() {
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
      if (session?.user) {
        const profile = session.user.user_metadata?.fitness_profile;
        if (profile) setFitnessProfile(profile);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = session.user.user_metadata?.fitness_profile;
        if (profile) setFitnessProfile(profile);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Saved locations (persisted in localStorage)
  const { locations: savedLocations, save: saveLocation, remove: deleteLocation, rename: renameLocation } = useSavedLocations();

  // ── Tab navigation ──────────────────────────────────────────────────────────
  type AppTab = 'hub' | 'cyclopilot' | 'dashboard' | 'rides' | 'calendar' | 'prs' | 'heatmap' | 'route' | 'training' | 'settings';
  const [activeTab,      setActiveTab]      = useState<AppTab>('hub');
  
  // ── Fitness profile (persisted in localStorage) ─────────────────────────────
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile>(() => {
    try {
      const stored = localStorage.getItem('cyclo_fitness_profile');
      return stored ? JSON.parse(stored) : { autoEFTP: true, autoLTHR: true };
    } catch { return { autoEFTP: true, autoLTHR: true }; }
  });

  const handleProfileChange = async (p: FitnessProfile) => {
    setFitnessProfile(p);
    localStorage.setItem('cyclo_fitness_profile', JSON.stringify(p));
    if (session?.user) {
      await supabase.auth.updateUser({
        data: {
          fitness_profile: p,
          name: p.name || undefined
        }
      });
    }
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRide,   setSelectedRide]   = useState<string | null>(null);
  const [compareRideId,  setCompareRideId]  = useState<string | null>(null);
  const [activeWorkout,  setActiveWorkout]  = useState<any | null>(null);

  const {
    startPoint,
    endPoint,
    routes,
    activeRouteIndex,
    routeType,
    setRouteType,
    isGenerating,
    error,
    hoverPoint,
    windData,
    windSlot,
    isFetchingWind,
    maxElevationGain,
    setMaxElevationGain,
    exportMsg,
    activeRoutePoints,
    handleMapClick,
    handleSetLocation,
    handleGenerate,
    handleGenerateTrainingsroute,
    handleDownloadGPX,
    handleDownloadTCX,
    setActiveRouteIndex,
    setWindSlot,
    setError,
    setHoverPoint,
  } = useRoutePlanner(() => setActiveTab('route'));
  
  const handlePlanWorkoutOnRoute = useCallback(async (date: string, route: any) => {
    if (!activeWorkout) return;
    const durationMin = activeWorkout.blocks.reduce((acc: number, b: any) => acc + b.duration, 0) / 60;
    await planWorkoutInCalendar(activeWorkout, date, durationMin, fitnessProfile, route);
    setActiveWorkout(null);
    setActiveTab('training');
  }, [activeWorkout, fitnessProfile]);

  // Rides & fysiologische recalculate state
  const [rides, setRides] = useState<RideSummaryWithBests[]>([]);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [gearWarnings, setGearWarnings] = useState<string[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);


  const fitnessMetrics = useMemo(() => {
    const tssList = rides
      .filter(r => (r.tss ?? r.hrTSS) != null)
      .map(r => ({ date: r.date, tss: (r.tss ?? r.hrTSS)! }));
    if (tssList.length === 0) return { ctl: 0, atl: 0, tsb: 0 };
    const points = computePMC(tssList);
    const last = points[points.length - 1];
    return {
      ctl: last ? Math.round(last.ctl) : 0,
      atl: last ? Math.round(last.atl) : 0,
      tsb: last ? Math.round(last.tsb) : 0,
    };
  }, [rides]);



  // ── Gear onderhoud check bij startup ────────────────────────────────────────
  useEffect(() => {
    const checkGearMaintenance = async () => {
      try {
        const gears = await getAllGear();
        const warnings: string[] = [];
        for (const gear of gears) {
          for (const comp of gear.components) {
            if (!comp.maxDistance || comp.maxDistance <= 0) continue;
            const pct = (comp.distance / comp.maxDistance) * 100;
            if (pct >= 90) {
              warnings.push(`${gear.name}: ${comp.name} (${Math.round(pct)}% van max km bereikt)`);
            }
          }
        }
        if (warnings.length > 0) setGearWarnings(warnings);
      } catch (e) {
        console.error('Gear check failed:', e);
      }
    };
    const timer = setTimeout(checkGearMaintenance, 2500);
    return () => clearTimeout(timer);
  }, []);

  // ── Command palette keyboard shortcut (Ctrl+K / Cmd+K) ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);








  const reloadRides = useCallback(async () => {
    if (!session) return;
    const data = await getAllRideSummaries();
    setRides(data);
    calibrateSummaryModels(data, fitnessProfile.ftp ?? 220, fitnessProfile.weight ?? 75);
  }, [fitnessProfile.ftp, fitnessProfile.weight, session]);

  useEffect(() => {
    if (session) {
      reloadRides();
    }
  }, [reloadRides, session]);

  const profileAge = useMemo(() => {
    if (!fitnessProfile.birthDate) return undefined;
    return Math.floor((Date.now() - new Date(fitnessProfile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
  }, [fitnessProfile.birthDate]);

  const globaleFTP = useMemo(() => estimateGlobalFTP(rides.map(r => r.bestEfforts ?? {})), [rides]);

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    try {
      const allRides = await getAllRidesFull();
      for (const ride of allRides) {
        const rideDate = ride.date ?? Date.now();
        const weightForRide = getWeightForDate(fitnessProfile, rideDate);
        const recomputed = computeRide(ride.id, ride.name, ride.points, {
          ftp: fitnessProfile.ftp ?? globaleFTP,
          lthr: fitnessProfile.lthr,
          maxHR: fitnessProfile.maxHR,
          gender: fitnessProfile.gender,
          age: profileAge,
          weight: weightForRide,
        });
        await saveRide({ ...recomputed, points: ride.points });
      }
      const freshSummaries = await getAllRideSummaries();
      setRides(freshSummaries);
      
      const activeFTP = fitnessProfile.ftp ?? globaleFTP ?? 220;
      const activeWeight = fitnessProfile.weight ?? 75;
      calibrateSummaryModels(freshSummaries, activeFTP, activeWeight);
      calibrateFullModels(freshSummaries, allRides, activeFTP, activeWeight);
    } catch (e) {
      console.error("Fout tijdens herberekenen van ritten:", e);
      alert("Er is een fout opgetreden bij het verwerken van de ritten: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRecalculating(false);
    }
  }, [fitnessProfile, globaleFTP, profileAge]);

  const handleMinimize = async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    }
  };

  const handleMaximize = async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
    }
  };

  const handleClose = async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    }
  };

  // ── Command palette commands ────────────────────────────────────────────
  const paletteCommands = useMemo((): CommandItem[] => [
    { id: 'nav-dashboard', category: 'Navigatie', icon: <LayoutDashboard size={14} />, label: 'Performance Dashboard', description: 'Bekijk je fitness-cockpit en AI analyses', shortcut: '1', action: () => setActiveTab('dashboard') },
    { id: 'nav-rides',     category: 'Navigatie', icon: <Bike size={14} />,            label: 'Mijn Ritten',           description: 'Volledig activiteiten archief',                 shortcut: '2', action: () => setActiveTab('rides') },
    { id: 'nav-calendar',  category: 'Navigatie', icon: <CalendarIcon size={14} />,    label: 'Trainingskalender',     description: 'Plan trainingen en simuleer CTL/ATL/TSB',       shortcut: '3', action: () => setActiveTab('calendar') },
    { id: 'nav-prs',       category: 'Navigatie', icon: <Trophy size={14} />,          label: 'Progressie & PR\'s',    description: 'eFTP trend, VO2max en records',                 shortcut: '4', action: () => setActiveTab('prs') },
    { id: 'nav-heatmap',   category: 'Navigatie', icon: <MapIcon size={14} />,         label: 'Heatmap',               description: 'Geografische rittenkaart',                      shortcut: '5', action: () => setActiveTab('heatmap') },
    { id: 'nav-route',     category: 'Navigatie', icon: <Compass size={14} />,         label: 'Route Planner',         description: 'Genereer en plan fietsroutes',                  shortcut: '6', action: () => setActiveTab('route') },
    { id: 'nav-training',  category: 'Navigatie', icon: <Brain size={14} />,           label: 'Smart Coach',           description: 'AI coach en trainingsschema\'s',                 shortcut: '7', action: () => setActiveTab('training') },
    { id: 'nav-settings',  category: 'Navigatie', icon: <Settings size={14} />,        label: 'Instellingen',          description: 'Profiel en gear beheren',                       shortcut: '8', action: () => setActiveTab('settings') },
    { id: 'action-recalc', category: 'Acties',    icon: <Activity size={14} />,        label: 'Herbereken alle ritten', description: 'Pas gewijzigde FTP/LTHR toe op alle ritten',    action: handleRecalculate },
  ], [handleRecalculate]);

  const navItems = [
    { key: 'dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.6} />, label: 'Dashboard' },
    { key: 'rides',     icon: <Bike            size={16} strokeWidth={1.6} />, label: 'Mijn Ritten' },
    { key: 'calendar',  icon: <CalendarIcon    size={16} strokeWidth={1.6} />, label: 'Kalender' },
    { key: 'prs',       icon: <Trophy          size={16} strokeWidth={1.6} />, label: 'Progressie & PR\'s' },
    { key: 'heatmap',   icon: <MapIcon         size={16} strokeWidth={1.6} />, label: 'Heatmap' },
    { key: 'route',     icon: <Compass         size={16} strokeWidth={1.6} />, label: 'Routeplanner' },
    { key: 'training',  icon: <Brain           size={16} strokeWidth={1.6} />, label: 'Smart Coach' },
    { key: 'settings',  icon: <Settings        size={16} strokeWidth={1.6} />, label: 'Instellingen' },
  ] as const;

  const tsbStatus = interpretTSB(fitnessMetrics.tsb);

  const isDashboardTab = activeTab === 'dashboard' || activeTab === 'rides' || activeTab === 'prs' || activeTab === 'heatmap';

  if (sessionLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: '#09090b' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(203, 213, 225, 0.1)', borderTop: '3px solid #cbd5e1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <AppTitlebar
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
      />

      {/* ── Export toast ── */}
      {exportMsg && (
        <div className={`export-toast ${exportMsg.ok ? 'export-toast--ok' : 'export-toast--err'}`}>
          {exportMsg.text}
        </div>
      )}

      {/* Main Layout containing Sidebar and Viewport - pushed down by 32px for window drag region titlebar */}
      <div className="wd-app" style={{ display: 'flex', flex: 1, minHeight: 0, width: '100vw', paddingTop: '32px' }}>
        {/* Collapsible Left Sidebar */}
        {activeTab !== 'hub' && activeTab !== 'cyclopilot' && (
          <aside className="wd-sidebar" data-collapsed={sidebarCollapsed}>
            <div className="wd-sidebar-logo" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '20px 18px 16px', marginBottom: 10 }}>
              {!sidebarCollapsed ? (
                <>
                  <button 
                    onClick={() => setActiveTab('hub')}
                    style={{ 
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      color: 'var(--text-muted)', 
                      fontSize: '10px', 
                      cursor: 'pointer', 
                      padding: '4px 8px',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  >
                    ← Zenith Hub
                  </button>
                  <span className="wd-sidebar-logo__text" style={{ fontSize: 16, letterSpacing: '1px', fontWeight: 900, color: '#fff', marginTop: 4 }}>AERO</span>
                </>
              ) : (
                <button 
                  onClick={() => setActiveTab('hub')}
                  title="Terug naar Zenith Hub"
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--color-primary)', 
                    fontSize: '14px', 
                    cursor: 'pointer', 
                    width: '100%',
                    textAlign: 'center',
                    fontWeight: 900 
                  }}
                >
                  Z
                </button>
              )}
            </div>

          <nav className="wd-nav">
            {navItems.map(item => (
              <button
                key={item.key}
                className={`wd-nav-item ${activeTab === item.key ? 'wd-nav-item--active' : ''}`}
                onClick={() => {
                  setActiveTab(item.key);
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="wd-nav-icon">{item.icon}</span>
                {!sidebarCollapsed && <span className="wd-nav-label">{item.label}</span>}
              </button>
            ))}
            <button className="wd-nav-collapse-btn" onClick={() => setSidebarCollapsed(v => !v)}>
              {sidebarCollapsed ? '→' : '← Inklappen'}
            </button>
          </nav>

          {/* User & Sync Info at Bottom */}
          {!sidebarCollapsed && (
            <div style={{ padding: '16px 18px', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                <span>Cloud Sync Actief</span>
              </div>
            </div>
          )}
        </aside>
        )}

        {/* Viewport content */}
        <main className="wd-main">
          {/* Topbar Header */}
          {activeTab !== 'hub' && activeTab !== 'cyclopilot' && (
            <header className="wd-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="wd-topbar-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800 }}>
              {activeTab === 'dashboard' && 'PRESTATIE DASHBOARD'}
              {activeTab === 'rides' && 'ACTIVITEITEN ARCHIEF'}
              {activeTab === 'calendar' && 'TRAININGSKALENDER'}
              {activeTab === 'prs' && 'PROGRESSIE & RECORDS'}
              {activeTab === 'heatmap' && 'GEOGRAFISCHE HEATMAP'}
              {activeTab === 'route' && 'ROUTE PLANNER'}
              {activeTab === 'training' && 'SMART COACH TRAINING'}
              {activeTab === 'settings' && 'INSTELLINGEN & GEAR'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {gearWarnings.length > 0 && (
                <div
                  onClick={() => setActiveTab('settings')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(253,203,110,0.1)', border: '1px solid rgba(253,203,110,0.25)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#fdcb6e' }}
                >
                  <span>🔧</span>
                  <span>Onderhoud nodig!</span>
                </div>
              )}

              {rides.length > 0 && (
                <div className="app-tab-bar__status-pill" style={{ margin: 0 }}>
                  <span className="app-tab-bar__status-dot" style={{ backgroundColor: tsbStatus.color }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1' }}>Vorm: {fitnessMetrics.tsb > 0 ? `+${fitnessMetrics.tsb}` : fitnessMetrics.tsb}</span>
                </div>
              )}
            </div>
          </header>
          )}

          {/* Dynamic Content Switching */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
            {/* ── Zenith Ecosystem Hub View ── */}
            {activeTab === 'hub' && (
              <ZenithHubPage 
                fitnessProfile={fitnessProfile}
                fitnessMetrics={fitnessMetrics}
                onOpenApp={(appKey) => {
                  if (appKey === 'cyclo') setActiveTab('dashboard');
                  else if (appKey === 'cyclopilot') setActiveTab('cyclopilot');
                }}
                onLogout={() => supabase.auth.signOut()}
              />
            )}
            
            {/* ── Pilot Control Panel View ── */}
            {activeTab === 'cyclopilot' && (
              <PilotPanel 
                onBack={() => setActiveTab('hub')}
              />
            )}

            {/* ── Analytics & History Views ── */}
            {isDashboardTab && (
              <div className="workout-tab-content" style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
                {!selectedRide ? (
                  <WorkoutDashboard
                    onSelectRide={id => setSelectedRide(id)}
                    selectedRideId={selectedRide}
                    compareRideId={compareRideId}
                    onCompareRide={id => setCompareRideId(prev => prev === id ? null : id)}
                    profile={fitnessProfile}
                    onProfileChange={handleProfileChange}
                    rideIsOpen={!!selectedRide}
                    rides={rides}
                    reloadRides={reloadRides}
                    globaleFTP={globaleFTP ?? 220}
                    onRecalculate={handleRecalculate}
                    recalculating={recalculating}
                    navSection={activeTab as any}
                  />
                ) : (
                  <>
                    {/* Full-screen single ride */}
                    {!compareRideId && (
                      <div className="wd-detail-panel wd-detail-panel--full" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', width: '100%' }}>
                        <ErrorBoundary>
                          <RidePage
                            rideId={selectedRide}
                            onBack={() => setSelectedRide(null)}
                            profile={fitnessProfile}
                            onChange={reloadRides}
                          />
                        </ErrorBoundary>
                      </div>
                    )}

                    {/* Split-screen compare */}
                    {compareRideId && (
                      <div className="wd-compare-split" style={{ flex: 1, display: 'flex', minHeight: 0, height: '100%', width: '100%' }}>
                        <div className="wd-compare-split__pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          <ErrorBoundary>
                            <RidePage
                              rideId={selectedRide}
                              onBack={() => setSelectedRide(null)}
                              profile={fitnessProfile}
                              compareRideId={compareRideId}
                              onChange={reloadRides}
                            />
                          </ErrorBoundary>
                        </div>
                        <div className="wd-compare-split__divider" />
                        <div className="wd-compare-split__pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          <ErrorBoundary>
                            <RidePage
                              rideId={compareRideId}
                              onBack={() => setCompareRideId(null)}
                              profile={fitnessProfile}
                              compareRideId={selectedRide}
                              onChange={reloadRides}
                            />
                          </ErrorBoundary>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Calendar View ── */}
            {activeTab === 'calendar' && (
              <div className="workout-tab-content" style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, height: '100%', width: '100%', overflowY: selectedRide ? 'hidden' : 'auto' }}>
                {!selectedRide ? (
                  <CalendarPage
                    rides={rides}
                    profile={fitnessProfile}
                    onSelectRide={(id) => setSelectedRide(id)}
                  />
                ) : (
                  <div className="wd-detail-panel wd-detail-panel--full" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', width: '100%' }}>
                    <ErrorBoundary>
                      <RidePage
                        rideId={selectedRide}
                        onBack={() => setSelectedRide(null)}
                        profile={fitnessProfile}
                        onChange={reloadRides}
                      />
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            )}

            {/* ── Training View ── */}
            {activeTab === 'training' && (
              <div className="workout-tab-content">
                <TrainingPage
                  profile={fitnessProfile}
                  onProfileChange={handleProfileChange}
                  rides={rides}
                  savedLocations={savedLocations}
                  onGenerateTrainingsroute={handleGenerateTrainingsroute}
                  onActiveWorkoutChange={setActiveWorkout}
                />
              </div>
            )}

            {/* ── Settings View ── */}
            {activeTab === 'settings' && (
              <div className="workout-tab-content">
                <SettingsPage
                  profile={fitnessProfile}
                  onProfileChange={handleProfileChange}
                  globaleFTP={globaleFTP}
                  onRecalculate={handleRecalculate}
                  recalculating={recalculating}
                />
              </div>
            )}

            {/* ── Route Planner View ── */}
            {activeTab === 'route' && (
              <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
                <RoutePage
                  fitnessProfile={fitnessProfile}
                  savedLocations={savedLocations}
                  onSaveLocation={saveLocation}
                  onDeleteLocation={deleteLocation}
                  onRenameLocation={renameLocation}
                  startPoint={startPoint}
                  endPoint={endPoint}
                  routes={routes}
                  activeRouteIndex={activeRouteIndex}
                  routeType={routeType}
                  setRouteType={setRouteType}
                  isGenerating={isGenerating}
                  error={error}
                  hoverPoint={hoverPoint}
                  windData={windData}
                  windSlot={windSlot}
                  isFetchingWind={isFetchingWind}
                  maxElevationGain={maxElevationGain}
                  setMaxElevationGain={setMaxElevationGain}
                  activeRoutePoints={activeRoutePoints}
                  onSetLocation={handleSetLocation}
                  onGenerate={handleGenerate}
                  onDownloadGPX={handleDownloadGPX}
                  onDownloadTCX={handleDownloadTCX}
                  onMapClick={handleMapClick}
                  onSelectRoute={setActiveRouteIndex}
                  setWindSlot={setWindSlot}
                  onCloseError={() => setError(null)}
                  onHoverPoint={setHoverPoint}
                  activeWorkout={activeWorkout}
                  onPlanWorkout={handlePlanWorkoutOnRoute}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={paletteCommands}
      />
    </div>
  );
}

export default App;
