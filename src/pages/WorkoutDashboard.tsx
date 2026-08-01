import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../workout.css';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { deleteRide, saveRide, getAllGear } from '../utils/db';
import { parseFIT, isFITFile } from '../utils/fitParser';
import { autoSaveRideToGDrive } from '../utils/export';
import { parseGPX } from '../utils/gpxParser';
import { computeRide, getWeightForDate } from '../utils/rideMetrics';
import {
  Ride, FitnessProfile, POWER_ZONES, Gear,
} from '../types/workout';
import { generateCoachAdvice } from '../utils/coach';
import HeatmapView from './HeatmapView';
import { ProgressPage } from './ProgressPage';
import { Bike, Brain } from 'lucide-react';

// Import extracted modular components
import { fmtDur } from '../components/workout/ZoneBar';
import { MiniRoutePreview } from '../components/workout/MiniRoutePreview';
import { computePMC, interpretTSB } from '../utils/pmc';
import { analyzeNotesLocally, predictInjuryRisk, predictPacingStrategy, analyzeCardiacDrift } from '../utils/localNeuralNet';
import { DashboardStatsHeader } from '../components/dashboard/DashboardStatsHeader';
import { RideUploadZone } from '../components/dashboard/RideUploadZone';
import { PMCPanel } from '../components/workout/PMCPanel';

// Extracted helpers & modules
import {
  fmtShortDate,
  computeEFTrend,
  buildWeeklyTSS,
  buildMonthlyStats,
  computeGlobalBests
} from '../utils/dashboardHelpers';
import { PRSection } from '../components/dashboard/PRSection';
import { RideListSection } from '../components/dashboard/RideListSection';

type RideSummaryWithBests = Omit<Ride, 'points'>;

interface Props {
  onSelectRide:    (id: string) => void;
  selectedRideId?: string | null;
  compareRideId?:  string | null;
  onCompareRide?:  (id: string) => void;
  rideIsOpen?:     boolean;
  profile:         FitnessProfile;
  onProfileChange: (p: FitnessProfile) => void;
  rides:           RideSummaryWithBests[];
  reloadRides:     () => void;
  globaleFTP:      number;
  onRecalculate:   () => void;
  recalculating:   boolean;
  navSection:      'dashboard' | 'rides' | 'prs' | 'heatmap';
}

type SortKey    = 'date' | 'distance' | 'duration' | 'tss' | 'eftp' | 'elevGain';
type LabelFilter = any;

function TrendBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) return <span className="wd-trend wd-trend--flat">→ Stabiel</span>;
  return value > 0
    ? <span className="wd-trend wd-trend--up">↑ {value.toFixed(1)}%</span>
    : <span className="wd-trend wd-trend--down">↓ {Math.abs(value).toFixed(1)}%</span>;
}

interface ProposedChanges {
  rideName: string;
  ftp?: { current: number; proposed: number };
  lthr?: { current: number; proposed: number };
  maxHR?: { current: number; proposed: number };
}

const WorkoutDashboard: React.FC<Props> = ({
  onSelectRide,
  selectedRideId,
  compareRideId,
  onCompareRide,
  profile,
  onProfileChange,
  rides,
  reloadRides,
  globaleFTP,
  onRecalculate,
  recalculating,
  navSection
}) => {
  const [loading]                           = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [uploadMsg,      setUploadMsg]      = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);
  const [sortKey,        setSortKey]        = useState<SortKey>('date');
  const [search,         setSearch]         = useState('');
  const [labelFilter,    setLabelFilter]    = useState<LabelFilter>('all');
  const [dragOver,       setDragOver]       = useState(false);
  const [timeRange, setTimeRange] = useState<30 | 90 | 365 | 'all'>('all');
  const [latestRideFull, setLatestRideFull] = useState<Ride | null>(null);
  const [activeProposal, setActiveProposal] = useState<ProposedChanges | null>(null);
  const [activePrSubTab, setActivePrSubTab] = useState<'records' | 'passport'>('records');

  const [gears, setGears] = useState<Gear[]>([]);
  useEffect(() => {
    getAllGear().then(setGears);
  }, [rides]);

  // Filter rides based on selected time range for dashboard stats & charts
  const filteredRides = useMemo(() => {
    if (timeRange === 'all') return rides;
    const cutoff = Date.now() - timeRange * 24 * 3600 * 1000;
    return rides.filter(r => r.date >= cutoff);
  }, [rides, timeRange]);

  // Load the full points array for the very latest ride to render map/power preview
  useEffect(() => {
    if (rides.length > 0) {
      const last = rides[0];
      import('../utils/db').then(m => m.getRide(last.id)).then(full => {
        if (full) setLatestRideFull(full);
      });
    } else {
      setLatestRideFull(null);
    }
  }, [rides]);

  const selectedRide = selectedRideId ?? null;
  const reload = reloadRides;

  const profileAge = profile.birthDate
    ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : undefined;

  const sortedRides = useMemo(() => {
    const filtered = rides.filter(r => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (labelFilter !== 'all' && r.label !== labelFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'distance':  return b.distance  - a.distance;
        case 'duration':  return b.duration  - a.duration;
        case 'tss':       return (b.tss ?? b.hrTSS ?? 0) - (a.tss ?? a.hrTSS ?? 0);
        case 'eftp':      return (b.eFTP ?? 0) - (a.eFTP ?? 0);
        case 'elevGain':  return b.elevGain  - a.elevGain;
        default:          return b.date - a.date;
      }
    });
  }, [rides, sortKey, search, labelFilter]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = sortedRides;
        if (list.length === 0) return;
        const cur = list.findIndex(r => r.id === selectedRide);
        let next: number;
        if (cur === -1) {
          next = e.key === 'ArrowDown' ? 0 : list.length - 1;
        } else {
          next = e.key === 'ArrowDown'
            ? Math.min(cur + 1, list.length - 1)
            : Math.max(cur - 1, 0);
        }
        onSelectRide(list[next].id);
      }
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sortedRides, selectedRide, onSelectRide]);

  // Aggregates
  const totalDist    = filteredRides.reduce((s, r) => s + r.distance, 0);
  const totalElev    = filteredRides.reduce((s, r) => s + r.elevGain, 0);
  const totalDur     = filteredRides.reduce((s, r) => s + r.duration, 0);
  const totalCal     = filteredRides.reduce((s, r) => s + (r.calories ?? 0), 0);

  const efTrend      = computeEFTrend(filteredRides);
  const hasAnyPower  = filteredRides.some(r => r.hasPower);

  // Chart data
  const eFTPData = [...filteredRides].filter(r => r.eFTP).reverse().map(r => ({ date: fmtShortDate(r.date), eFTP: r.eFTP ?? null }));
  const tssData  = buildWeeklyTSS(filteredRides);
  const efData   = [...filteredRides].filter(r => r.efficiencyFactor != null).slice(0, 20).reverse()
    .map(r => ({ date: fmtShortDate(r.date), ef: r.efficiencyFactor }));
  const monthData  = buildMonthlyStats(filteredRides);
  const cadData    = [...filteredRides].filter(r => r.avgCadence && r.avgCadence > 0).slice(0, 20).reverse()
    .map(r => ({ date: fmtShortDate(r.date), rpm: r.avgCadence }));

  // PMC
  const pmcPoints = useMemo(() => {
    const tssList = rides
      .filter(r => (r.tss ?? r.hrTSS) != null)
      .map(r => ({ date: r.date, tss: (r.tss ?? r.hrTSS)! }));
    return computePMC(tssList);
  }, [rides]);

  const latestPMC = pmcPoints[pmcPoints.length - 1] ?? { ctl: 0, atl: 0, tsb: 0 };
  const tsbStatus = interpretTSB(latestPMC.tsb);
  const advice    = useMemo(() => generateCoachAdvice(rides as any[], profile as any, latestPMC), [rides, profile, latestPMC]);

  // Zone totals
  const globalZonePower = filteredRides.reduce<number[]>((acc, r) => {
    if (!r.powerZoneTime) return acc;
    return r.powerZoneTime.map((t, i) => (acc[i] ?? 0) + t);
  }, []);

  // PRs
  const globalPowerBests = computeGlobalBests(filteredRides, 'bestEfforts');
  const globalSpeedBests = computeGlobalBests(filteredRides, 'bestSpeedEfforts');

  // Last-90-day bests
  const cutoff90         = Date.now() - 90 * 24 * 3600 * 1000;
  const rides90          = rides.filter(r => r.date >= cutoff90);
  const last90PowerBests = computeGlobalBests(rides90, 'bestEfforts');
  const last90SpeedBests = computeGlobalBests(rides90, 'bestSpeedEfforts');

  // Season comparison
  const seasonData = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;
    const months   = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
    return months.map((m, idx) => {
      const thisKm = rides.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === thisYear && d.getMonth() === idx;
      }).reduce((s, r) => s + r.distance, 0);
      const lastKm = rides.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === lastYear && d.getMonth() === idx;
      }).reduce((s, r) => s + r.distance, 0);
      return { month: m, thisYear: Math.round(thisKm), lastYear: Math.round(lastKm) };
    }).slice(0, new Date().getMonth() + 1);
  }, [rides]);

  // File handling
  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true);
    setUploadMsg(null);
    let ok = 0, fail = 0;
    let pendingProposal: ProposedChanges | null = null;

    for (const file of Array.from(files)) {
      try {
        const buf = await file.arrayBuffer();
        let points;
        if (isFITFile(file.name, buf)) { points = await parseFIT(buf); }
        else { points = parseGPX(new TextDecoder().decode(buf)); }
        const id   = `ride_${file.name}_${Date.now()}`;
        const name = file.name.replace(/\.(fit|gpx|tcx)$/i, '');
        const rideDate = points[0]?.time ?? Date.now();
        const weightForRide = getWeightForDate(profile, rideDate);

        const currentFTP = profile.ftp ?? globaleFTP ?? 220;
        const currentLTHR = profile.lthr ?? 160;
        const currentMaxHR = profile.maxHR ?? 190;

        const ride = computeRide(id, name, points, {
          ftp: currentFTP, lthr: currentLTHR, maxHR: currentMaxHR,
          gender: profile.gender, age: profileAge, weight: weightForRide,
        });
        await saveRide(ride);
        await autoSaveRideToGDrive(points, name);
        ok++;

        // Collect proposed improvements
        const proposedFTP = (ride.eFTP && ride.eFTP > currentFTP) ? ride.eFTP : undefined;
        const proposedMaxHR = (ride.maxHR && ride.maxHR > currentMaxHR) ? ride.maxHR : undefined;

        const driftResult = analyzeCardiacDrift(
          ride.firstHalfPower ?? 0,
          ride.secondHalfPower ?? 0,
          ride.firstHalfHR ?? 0,
          ride.secondHalfHR ?? 0,
          ride.duration,
          currentLTHR
        );
        const proposedLTHR = driftResult.proposeTuning ? driftResult.proposedLthr : undefined;

        if (proposedFTP || proposedLTHR || proposedMaxHR) {
          pendingProposal = {
            rideName: name,
            ftp: proposedFTP ? { current: currentFTP, proposed: proposedFTP } : undefined,
            lthr: proposedLTHR ? { current: currentLTHR, proposed: proposedLTHR } : undefined,
            maxHR: proposedMaxHR ? { current: currentMaxHR, proposed: proposedMaxHR } : undefined,
          };
        }
      } catch (e) { console.error(e); fail++; }
    }
    setUploadMsg(fail === 0 ? `✓ ${ok} rit${ok !== 1 ? 'ten' : ''} geïmporteerd` : `${ok} geïmporteerd, ${fail} mislukt`);
    setUploading(false);

    if (pendingProposal) {
      setActiveProposal(pendingProposal);
    }

    reload();
  }, [profile, profileAge, reload, globaleFTP]);

  const handleDelete = async (id: string) => {
    if (!confirm('Rit verwijderen?')) return;
    setDeleting(id);
    await deleteRide(id);
    await reload();
    setDeleting(null);
  };

  const renderMain = () => {
    if (rides.length === 0 && !loading) return (
      <div className="wd-empty-state">
        <div className="wd-empty-icon"><Bike size={52} color="#00e5ff" strokeWidth={1.5} /></div>
        <h2>Nog geen ritten</h2>
        <p>Sleep FIT, GPX of TCX bestanden in het zijpaneel<br />of gebruik de knop hieronder om te beginnen.</p>
      </div>
    );

     switch (navSection) {
      case 'dashboard': {
        const latestRide = rides[0];
        const getLatestRideAISummary = (r: RideSummaryWithBests) => {
          const isZwaar = (r.tss ?? r.hrTSS ?? 0) > 150;
          const labelStr = r.label ? `een ${r.label.toLowerCase()}` : 'een fietstraining';
          return `Je laatste rit was ${labelStr} van ${r.distance.toFixed(0)} km met ${r.elevGain}m hoogtemeters. ${isZwaar ? 'Dit was een zware belasting voor je lichaam - zorg voor voldoende herstel!' : 'Dit was een uitstekende actieve training.'}`;
        };

        const latestRideNotes = rides[0]?.notes ?? '';
        const notesSentiment = analyzeNotesLocally(latestRideNotes);
        const injuryRisk = predictInjuryRisk(
          latestPMC.ctl,
          latestPMC.atl,
          latestPMC.tsb,
          notesSentiment.fatigue,
          notesSentiment.illness
        );
        const pacing = predictPacingStrategy(rides);

        const aerobicDecouplingTrend = (() => {
          const eightWeeksAgo = Date.now() - 56 * 24 * 3600 * 1000;
          const recentRides = rides.filter(r => r.date >= eightWeeksAgo && r.firstHalfPower && r.secondHalfPower && r.firstHalfHR && r.secondHalfHR);
          if (recentRides.length === 0) return null;
          
          const drifts = recentRides.map(r => {
            const p1 = r.firstHalfPower! / r.firstHalfHR!;
            const p2 = r.secondHalfPower! / r.secondHalfHR!;
            return p1 > 0 ? ((p1 - p2) / p1) * 100 : 0;
          });
          const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
          return parseFloat(avgDrift.toFixed(1));
        })();

        return (
          <div className="wd-main-grid animate-slide-up">
            {/* 1. Live Fitness & Form Status Header */}
            <DashboardStatsHeader
              profileName={profile.name}
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              latestPMC={latestPMC}
              tsbStatus={tsbStatus}
            />

            {/* AI Coach & Insights Panel */}
            <div className="wd-dashboard-row wd-dashboard-row--full" style={{ marginBottom: 16 }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.04), rgba(108, 92, 231, 0.02))',
                border: '1px solid rgba(0,229,255,0.08)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px' }}>
                  <Brain size={18} color="#00e5ff" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Offline AI Analysestudio</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  {/* Column 1: Coach Advice */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Smart Coach Trainingsadvies</span>
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                      {advice[0]?.body ?? 'Nog geen ritten geanalyseerd. Upload ritten om gepersonaliseerd AI-advies te ontvangen.'}
                    </p>
                  </div>

                  {/* Column 2: Pacing Tip */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tempo & Pacing Assistent</span>
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                      {pacing.tip}
                    </p>
                  </div>

                  {/* Column 3: Injury & Overtraining Risk */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Blessure- & Overtrainingsrisico</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 2 }}>
                      <span style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: injuryRisk > 0.6 ? '#ff7675' : injuryRisk > 0.4 ? '#fdcb6e' : '#00b894'
                      }}>
                        {Math.round(injuryRisk * 100)}%
                      </span>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${injuryRisk * 100}%`,
                          background: injuryRisk > 0.6 ? '#ff7675' : injuryRisk > 0.4 ? '#fdcb6e' : '#00b894',
                          borderRadius: 3
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                      {injuryRisk > 0.6
                        ? "⚠️ Kritiek risico! We adviseren dringend om een rustdag te nemen."
                        : injuryRisk > 0.4
                          ? "⚡ Verhoogd risico. Houd de intensiteit laag."
                          : "💚 Veilig trainingsniveau. Je lichaam is klaar voor inspanning."
                      }
                    </span>
                  </div>

                  {/* Column 4: Aerobic Decoupling Trend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aerobe Uithoudingsvermogen (drift-trend)</span>
                    {aerobicDecouplingTrend !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: aerobicDecouplingTrend < 5 ? '#00b894' : '#fdcb6e' }}>
                          Drift: {aerobicDecouplingTrend}%
                        </span>
                        <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                          {aerobicDecouplingTrend < 4.0
                            ? "💚 Uitstekend duurvermogen. Je aerobe basis is zeer stabiel."
                            : aerobicDecouplingTrend < 8.0
                              ? "⚡ Matig uithoudingsvermogen. Lichte hartslagdrift."
                              : "⚠️ Verbeterpunt. Plan meer rustige Zone 2 ritten."
                          }
                        </span>
                      </div>
                    ) : (
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                        Nog onvoldoende ritdata (afgelopen 8 weken) om decoupling trend te meten.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard stats cards grid */}
            <div className="wd-dashboard-grid">
              <div className="wd-dashboard-card">
                <span className="wd-dashboard-card__label">Afstand</span>
                <span className="wd-dashboard-card__value">{totalDist.toFixed(0)} km</span>
              </div>
              <div className="wd-dashboard-card">
                <span className="wd-dashboard-card__label">Tijd</span>
                <span className="wd-dashboard-card__value">{Math.round(totalDur / 3600)} uur</span>
              </div>
              <div className="wd-dashboard-card">
                <span className="wd-dashboard-card__label">Hoogtemeters</span>
                <span className="wd-dashboard-card__value">{totalElev.toFixed(0)} m</span>
              </div>
              <div className="wd-dashboard-card">
                <span className="wd-dashboard-card__label">Calorieën</span>
                <span className="wd-dashboard-card__value">{totalCal > 0 ? `${totalCal.toLocaleString()} kcal` : '--'}</span>
              </div>
            </div>

            {/* 2. PMC Fitness Trend Grafiek & Laatste Rit Details */}
            <div className="wd-dashboard-row" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '16px' }}>
              <PMCPanel rides={rides} timeRange={timeRange === 'all' ? 90 : timeRange} />

              {/* Laatste rit paneel */}
              <div className="wd-section-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">🏆 Laatste Rit Details</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{fmtShortDate(latestRide.date)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', margin: '0 0 4px' }}>{latestRide.name}</h3>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>{getLatestRideAISummary(latestRide)}</p>
                  </div>
                  
                  {/* Grid stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Afstand</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#00e5ff' }}>{latestRide.distance.toFixed(1)} km</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Gem. Vermogen</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fdcb6e' }}>{latestRide.hasPower ? `${latestRide.avgPower} W` : '--'}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>TSS Belasting</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ff7675' }}>{latestRide.tss ?? latestRide.hrTSS ?? '--'}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Snelheid</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#39ff14' }}>{latestRide.avgSpeed?.toFixed(1)} km/h</div>
                    </div>
                  </div>

                  {/* Route & Kaart Preview */}
                  {latestRideFull && (
                    <div style={{ flex: 1, minHeight: 110, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
                      <MiniRoutePreview points={latestRideFull.points} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Wekelijkse TSS, Intensiteitverdeling en Trend Analysis */}
            <div className="wd-dashboard-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
              <div className="wd-section-card">
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">📈 Wekelijkse TSS Belasting</span>
                </div>
                {tssData.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 11, color: '#555' }}>Niet genoeg data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={165}>
                    <AreaChart data={tssData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTss" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff7675" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#ff7675" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ background: '#111318', border: 'none', borderRadius: 8, fontSize: 11 }} />
                      <Area type="monotone" dataKey="tss" stroke="#ff7675" strokeWidth={2} fillOpacity={1} fill="url(#colorTss)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Intensiteit verdeling */}
              <div className="wd-section-card">
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">⚡ Trainingszones (Vermogen)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', height: '100%', paddingBottom: 10 }}>
                  {globalZonePower.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, fontSize: 11, color: '#555' }}>Geen vermogensdata</div>
                  ) : (
                    globalZonePower.map((time, idx) => {
                      const total = globalZonePower.reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? (time / total) * 100 : 0;
                      const zone = POWER_ZONES[idx];
                      return zone ? (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700 }}>
                            <span style={{ color: '#cbd5e1' }}>{zone.name}</span>
                            <span style={{ color: zone.color }}>{pct.toFixed(0)}% ({fmtDur(time)})</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: zone.color, borderRadius: 2 }} />
                          </div>
                        </div>
                      ) : null;
                    })
                  )}
                </div>
              </div>

              {/* EF / Cardiac Efficiency Trend Analysis */}
              <div className="wd-section-card">
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">🫀 Aerobe Efficiëntietrend (EF)</span>
                  {efTrend && <TrendBadge value={efTrend.trend} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    Efficiëntiefactor (EF) is de verhouding tussen genormaliseerd vermogen en gemiddelde hartslag.
                    Stijgende EF geeft een verbeterde aerobe conditie aan.
                  </p>
                  {efData.length < 3 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110, fontSize: 11, color: '#555' }}>Niet genoeg hartslag/vermogensdata</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={110}>
                      <AreaChart data={efData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: '#111318', border: 'none', borderRadius: 8, fontSize: 10 }} />
                        <Area type="monotone" dataKey="ef" stroke="#00e5ff" strokeWidth={2} fillOpacity={1} fill="url(#colorEf)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Maandelijkse Statistieken, Cadans Analyse en Seizoensvergelijking */}
            <div className="wd-dashboard-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '16px' }}>
              
              {/* Maandelijkse stats */}
              <div className="wd-section-card">
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">📅 Maandelijkse Statistieken</span>
                </div>
                {monthData.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 11, color: '#555' }}>Geen data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={monthData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ background: '#111318', border: 'none', borderRadius: 8, fontSize: 10 }}
                        formatter={(v: any) => [`${Math.round(v)} km`, 'Afstand']}
                      />
                      <Bar dataKey="distance" fill="rgba(0, 229, 255, 0.4)">
                        {monthData.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={index === monthData.length - 1 ? '#00e5ff' : 'rgba(0, 229, 255, 0.4)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Cadans analyse */}
              <div className="wd-section-card">
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">🔄 Cadans Stabiliteit</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    Grafiek toont je gemiddelde trapfrequentie per rit. Optimale cadans ligt tussen 85–95 RPM.
                  </p>
                  {cadData.length < 3 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110, fontSize: 11, color: '#555' }}>Niet genoeg cadansdata</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={110}>
                      <AreaChart data={cadData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#39ff14" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#39ff14" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} domain={[60, 110]} />
                        <Tooltip contentStyle={{ background: '#111318', border: 'none', borderRadius: 8, fontSize: 10 }} />
                        <Area type="monotone" dataKey="rpm" stroke="#39ff14" strokeWidth={2} fillOpacity={1} fill="url(#colorCad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Seizoensvergelijking */}
              <div className="wd-section-card">
                <div className="wd-section-card__head">
                  <span className="wd-section-card__title">📅 Vergelijking t.o.v. Vorig Jaar (Afstand)</span>
                </div>
                {seasonData.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 11, color: '#555' }}>Geen data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={seasonData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ background: '#111318', border: 'none', borderRadius: 8, fontSize: 10 }}
                        formatter={(v: any, name: any) => [`${v} km`, name === 'thisYear' ? String(new Date().getFullYear()) : String(new Date().getFullYear() - 1)]}
                      />
                      <Bar dataKey="lastYear"  fill="rgba(255,255,255,0.12)" radius={[2,2,0,0]} />
                      <Bar dataKey="thisYear"  fill="rgba(0,229,255,0.65)"   radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'prs': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', padding: '16px 24px', boxSizing: 'border-box' }}>
            <div style={{
              display: 'flex', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.04)', width: 'fit-content', margin: 0
            }}>
              <button
                onClick={() => setActivePrSubTab('records')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: activePrSubTab === 'records' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                  color: activePrSubTab === 'records' ? '#00e5ff' : '#94a3b8',
                  transition: 'all 0.15s', fontFamily: 'inherit'
                }}
              >
                🏆 PR Record Boek
              </button>
              <button
                onClick={() => setActivePrSubTab('passport')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: activePrSubTab === 'passport' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                  color: activePrSubTab === 'passport' ? '#00e5ff' : '#94a3b8',
                  transition: 'all 0.15s', fontFamily: 'inherit'
                }}
              >
                📊 Fysiologisch Paspoort
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              {activePrSubTab === 'records' ? (
                <PRSection
                  profile={profile}
                  globaleFTP={globaleFTP}
                  globalPowerBests={globalPowerBests}
                  last90PowerBests={last90PowerBests}
                  globalSpeedBests={globalSpeedBests}
                  last90SpeedBests={last90SpeedBests}
                  hasAnyPower={hasAnyPower}
                  eFTPData={eFTPData}
                  rides={rides}
                />
              ) : (
                <ProgressPage profile={profile} rides={rides} />
              )}
            </div>
          </div>
        );
      }

      case 'rides': {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '22px', alignItems: 'start', width: '100%' }}>
            <RideListSection
              search={search}
              setSearch={setSearch}
              sortKey={sortKey}
              setSortKey={setSortKey}
              labelFilter={labelFilter}
              setLabelFilter={setLabelFilter}
              sortedRides={sortedRides}
              gears={gears}
              globalPowerBests={globalPowerBests}
              globalSpeedBests={globalSpeedBests}
              selectedRideId={selectedRideId}
              compareRideId={compareRideId}
              onSelectRide={onSelectRide}
              onCompareRide={onCompareRide}
              handleDelete={handleDelete}
              deleting={deleting}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RideUploadZone
                uploading={uploading}
                uploadMsg={uploadMsg}
                ridesCount={rides.length}
                onHandleFiles={handleFiles}
              />
            </div>
          </div>
        );
      }

      case 'heatmap': return (
        <div className="wd-main-single" style={{ maxWidth: '100%' }}>
          <HeatmapView />
        </div>
      );
    }
  };

  return (
    <div
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, position: 'relative', width: '100%' }}
      data-drag-over={dragOver}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
    >
      {dragOver && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 229, 255, 0.08)',
          border: '2px dashed #00e5ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          borderRadius: 16
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Sleep bestanden hierheen om te importeren (FIT / GPX)
          </span>
        </div>
      )}

      {/* Dynamic page content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        {renderMain()}
      </div>

      {/* Fitness Profile Tuning Proposal Modal */}
      {activeProposal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.75)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'rgba(23, 23, 27, 0.9)',
            border: '1px solid rgba(0, 229, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 229, 255, 0.05)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            color: '#f8fafc',
            boxSizing: 'border-box'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(0, 229, 255, 0.1)',
                padding: '8px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Brain size={24} color="#00e5ff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
                  🎉 AI Fitheidsverbetering Gevonden!
                </h3>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Analyse van rit: <strong>{activeProposal.rideName}</strong>
                </span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              Je laatste activiteit toont betere fysiologische waarden. Wil je je atleetprofiel en hartslag-/vermogenszones direct bijwerken?
            </p>

            {/* Proposals List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeProposal.ftp && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>Drempelvermogen (FTP)</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Berekend op basis van ritpieken</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 12, color: '#64748b', textDecoration: 'line-through' }}>{activeProposal.ftp.current} W</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e5ff' }}>{activeProposal.ftp.proposed} W</span>
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#4ade80',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      +{activeProposal.ftp.proposed - activeProposal.ftp.current} W
                    </span>
                  </div>
                </div>
              )}

              {activeProposal.lthr && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>Drempelhartslag (LTHR)</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Cardiale drift & decoupling analyse</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 12, color: '#64748b', textDecoration: 'line-through' }}>{activeProposal.lthr.current} bpm</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e5ff' }}>{activeProposal.lthr.proposed} bpm</span>
                    <span style={{
                      background: activeProposal.lthr.proposed > activeProposal.lthr.current ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: activeProposal.lthr.proposed > activeProposal.lthr.current ? '#4ade80' : '#f87171',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      {activeProposal.lthr.proposed > activeProposal.lthr.current ? '+' : ''}{activeProposal.lthr.proposed - activeProposal.lthr.current} bpm
                    </span>
                  </div>
                </div>
              )}

              {activeProposal.maxHR && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>Maximale Hartslag (Max HR)</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Nieuwe hartslagpiek geregistreerd</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 12, color: '#64748b', textDecoration: 'line-through' }}>{activeProposal.maxHR.current} bpm</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e5ff' }}>{activeProposal.maxHR.proposed} bpm</span>
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#4ade80',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      +{activeProposal.maxHR.proposed - activeProposal.maxHR.current} bpm
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  const updatedProfile = { ...profile };
                  if (activeProposal.ftp) updatedProfile.ftp = activeProposal.ftp.proposed;
                  if (activeProposal.lthr) updatedProfile.lthr = activeProposal.lthr.proposed;
                  if (activeProposal.maxHR) updatedProfile.maxHR = activeProposal.maxHR.proposed;
                  onProfileChange(updatedProfile);
                  setActiveProposal(null);
                  onRecalculate();
                }}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #00e5ff, #6c5ce7)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '12px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 0 12px rgba(0, 229, 255, 0.15)'
                }}
              >
                Accepteren & zones updaten
              </button>
              <button
                onClick={() => setActiveProposal(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontWeight: 700,
                  fontSize: 11,
                  padding: '12px 18px',
                  cursor: 'pointer'
                }}
              >
                Negeren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recalculating Loader Overlay */}
      {recalculating && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(0, 229, 255, 0.1)',
            borderTop: '3px solid #00e5ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>AI Modellen Kalibreren...</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>Historische ritten analyseren & zones bijwerken</span>
        </div>
      )}
    </div>
  );
};

export default WorkoutDashboard;
