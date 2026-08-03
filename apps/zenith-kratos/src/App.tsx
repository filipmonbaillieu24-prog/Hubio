import { useState, useEffect, useMemo } from 'react';
import { supabase } from './utils/supabaseClient';
import { 
  Dumbbell, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Activity, 
  Heart, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  TrendingUp, 
  Info,
  Calendar,
  Smartphone
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from 'recharts';

// Type Definitions
interface Exercise {
  id: string;
  user_id: string;
  name: string;
  category: 'Quads' | 'Hamstrings' | 'Calves' | 'Chest' | 'Lats' | 'Upper Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Abs';
  notes?: string;
  increment_weight: number;
  increment_per_side: boolean;
  default_rir: number;
  weight_unit: 'kg' | 'lbs';
  deleted: boolean;
}

interface TemplateSet {
  type: 'warmup' | 'working';
  min_reps: number;
  max_reps: number;
  target_rir: number;
}

interface TemplateExercise {
  exercise_id: string;
  sets: TemplateSet[];
}

interface Template {
  id: string;
  user_id: string;
  name: string;
  exercises: TemplateExercise[];
  created_at: string;
}

interface WorkoutLoggedSet {
  type: 'warmup' | 'working';
  weight: number;
  reps: number;
  rir: number;
  rest_seconds?: number;
}

interface WorkoutExerciseLog {
  exercise_id: string;
  sets: WorkoutLoggedSet[];
}

interface Workout {
  id: string;
  user_id: string;
  template_id?: string;
  name: string;
  started_at: string;
  completed_at: string;
  volume: number;
  cardio_stress_factor: number;
  sets: WorkoutExerciseLog[];
  created_at: string;
}

interface PMCPoint {
  date: number;
  ctl: number;
  atl: number;
  tsb: number;
}

export default function App() {
  // Session & Authentication
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'routines' | 'exercises' | 'logs' | 'download'>('dashboard');

  // Database State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  // PMC & AI calculations
  const [currentPMC, setCurrentPMC] = useState<{ ctl: number; atl: number; tsb: number }>({ ctl: 0, atl: 0, tsb: 0 });
  const [aiStressConfig, setAiStressConfig] = useState<{ zScore: number; factor: number; avgAtl: number; stdDevAtl: number }>({ zScore: 0, factor: 1.0, avgAtl: 0, stdDevAtl: 10.0 });

  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [exerciseForm, setExerciseForm] = useState<Partial<Exercise>>({
    name: '',
    category: 'Chest',
    notes: '',
    increment_weight: 2.5,
    increment_per_side: false,
    default_rir: 2,
    weight_unit: 'kg'
  });

  // UI state - Routine Builder
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  // UI state - Dashboard
  const [dashboardMetric, setDashboardMetric] = useState<'volume' | 'sets'>('volume');
  const [selectedExercise1RM, setSelectedExercise1RM] = useState<string>('');

  // 1. Hash-based login handler & regular check
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data, error }) => {
          if (!error && data.session) {
            setSession(data.session);
            window.history.replaceState(null, '', window.location.pathname);
          }
          setLoadingSession(false);
        });
        return;
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load data from Supabase
  const fetchData = async () => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    // Load exercises
    const { data: exData } = await supabase
      .from('kratos_exercises')
      .select('*')
      .eq('user_id', uid)
      .eq('deleted', false);
    if (exData) setExercises(exData);

    // Load templates
    const { data: tempData } = await supabase
      .from('kratos_templates')
      .select('*')
      .eq('user_id', uid);
    if (tempData) setTemplates(tempData);

    // Load workouts
    const { data: woData } = await supabase
      .from('kratos_workouts')
      .select('*')
      .eq('user_id', uid)
      .order('completed_at', { ascending: false });
    if (woData) setWorkouts(woData);

    // Load rides for PMC
    const { data: rideData } = await supabase
      .from('rides')
      .select('date, metadata')
      .eq('user_id', uid)
      .order('date', { ascending: true });
    if (rideData) {
      computeCardioStress(rideData);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // 3. AI Cardio Stress calculations (ATL Z-score)
  const computeCardioStress = (rideData: any[]) => {
    if (rideData.length === 0) return;

    // Parse TSS
    const parsedRides = rideData.map(r => {
      let meta = r.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { meta = {}; }
      }
      return {
        date: Number(r.date),
        tss: Number(meta?.tss ?? meta?.hrTSS ?? 0)
      };
    });

    // Group by Day
    const tssPerDay = new Map<string, number>();
    for (const r of parsedRides) {
      const key = new Date(r.date).toISOString().split('T')[0];
      tssPerDay.set(key, (tssPerDay.get(key) ?? 0) + r.tss);
    }

    // Determine range: first ride to today
    const firstDate = new Date(Math.min(...parsedRides.map(r => r.date)));
    const today = new Date();
    firstDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const K_CTL = 1 - Math.exp(-1 / 42);
    const K_ATL = 1 - Math.exp(-1 / 7);

    const points: PMCPoint[] = [];
    let ctl = 0;
    let atl = 0;
    const cur = new Date(firstDate);

    while (cur <= today) {
      const key = cur.toISOString().split('T')[0];
      const tss = tssPerDay.get(key) ?? 0;
      ctl = ctl + K_CTL * (tss - ctl);
      atl = atl + K_ATL * (tss - atl);

      points.push({
        date: cur.getTime(),
        ctl,
        atl,
        tsb: ctl - atl
      });

      cur.setDate(cur.getDate() + 1);
    }


    // Latest PMC values
    if (points.length > 0) {
      const latest = points[points.length - 1];
      setCurrentPMC({
        ctl: Math.round(latest.ctl),
        atl: Math.round(latest.atl),
        tsb: Math.round(latest.tsb)
      });

      // Calculate baseline: average and std dev of ATL over last 90 days
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const recentPoints = points.filter(p => p.date >= cutoff);
      
      if (recentPoints.length > 0) {
        const atls = recentPoints.map(p => p.atl);
        const avg = atls.reduce((sum, val) => sum + val, 0) / atls.length;
        const variance = atls.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / atls.length;
        const stdDev = Math.max(Math.sqrt(variance), 10.0); // Floor of 10.0 to prevent division by zero

        const zScore = (latest.atl - avg) / stdDev;
        const factor = zScore > 1.0 ? 1.0 + 0.15 * zScore : 1.0;

        setAiStressConfig({
          zScore: Math.round(zScore * 100) / 100,
          factor: Math.round(factor * 100) / 100,
          avgAtl: Math.round(avg),
          stdDevAtl: Math.round(stdDev)
        });
      }
    }
  };

  // Helper for exercise name resolution
  const exerciseMap = useMemo(() => {
    return new Map(exercises.map(e => [e.id, e]));
  }, [exercises]);

  // 4. Exercise Manager Actions
  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !exerciseForm.name) return;

    const payload = {
      name: exerciseForm.name,
      category: exerciseForm.category,
      notes: exerciseForm.notes,
      increment_weight: Number(exerciseForm.increment_weight || 2.5),
      increment_per_side: !!exerciseForm.increment_per_side,
      default_rir: Number(exerciseForm.default_rir || 2),
      weight_unit: exerciseForm.weight_unit || 'kg',
      user_id: session.user.id
    };

    if (editingExercise) {
      // Update
      const { error } = await supabase
        .from('kratos_exercises')
        .update(payload)
        .eq('id', editingExercise.id);
      
      if (!error) {
        setEditingExercise(null);
        setIsExerciseModalOpen(false);
        fetchData();
      }
    } else {
      // Create
      const { error } = await supabase
        .from('kratos_exercises')
        .insert([payload]);
      
      if (!error) {
        setIsExerciseModalOpen(false);
        fetchData();
      }
    }
  };

  const handleEditExerciseClick = (ex: Exercise) => {
    setEditingExercise(ex);
    setExerciseForm(ex);
    setIsExerciseModalOpen(true);
  };

  const handleDeleteExercise = async (id: string) => {
    if (!window.confirm("Weet je zeker dat je deze oefening wilt verwijderen?")) return;
    const { error } = await supabase
      .from('kratos_exercises')
      .update({ deleted: true })
      .eq('id', id);

    if (!error) fetchData();
  };

  // 5. Routine Builder Actions
  const handleSaveTemplate = async () => {
    if (!session?.user?.id || !templateName) return;
    if (templateExercises.length === 0) {
      alert("Voeg ten minste één oefening toe aan het template.");
      return;
    }

    const payload = {
      name: templateName,
      exercises: templateExercises,
      user_id: session.user.id
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from('kratos_templates')
        .update(payload)
        .eq('id', editingTemplate.id);
      
      if (!error) {
        setIsTemplateModalOpen(false);
        setEditingTemplate(null);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('kratos_templates')
        .insert([payload]);
      
      if (!error) {
        setIsTemplateModalOpen(false);
        fetchData();
      }
    }
  };

  const handleEditTemplateClick = (temp: Template) => {
    setEditingTemplate(temp);
    setTemplateName(temp.name);
    setTemplateExercises(temp.exercises);
    setIsTemplateModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("Weet je zeker dat je dit template wilt verwijderen?")) return;
    const { error } = await supabase
      .from('kratos_templates')
      .delete()
      .eq('id', id);

    if (!error) fetchData();
  };

  const addExerciseToTemplate = (exId: string) => {
    // Add exercise with default sets (e.g. 1 warmup, 3 working sets)
    const defaults = exerciseMap.get(exId);
    const defaultRir = defaults?.default_rir ?? 2;
    const newEntry: TemplateExercise = {
      exercise_id: exId,
      sets: [
        { type: 'warmup', min_reps: 10, max_reps: 12, target_rir: 4 },
        { type: 'working', min_reps: 8, max_reps: 10, target_rir: defaultRir },
        { type: 'working', min_reps: 8, max_reps: 10, target_rir: defaultRir },
        { type: 'working', min_reps: 8, max_reps: 10, target_rir: defaultRir }
      ]
    };
    setTemplateExercises([...templateExercises, newEntry]);
    setExerciseSearchQuery('');
  };

  const removeExerciseFromTemplate = (index: number) => {
    const updated = [...templateExercises];
    updated.splice(index, 1);
    setTemplateExercises(updated);
  };

  const addSetToTemplateExercise = (exIndex: number) => {
    const updated = [...templateExercises];
    const sets = updated[exIndex].sets;
    const lastSet = sets[sets.length - 1] || { type: 'working', min_reps: 8, max_reps: 10, target_rir: 2 };
    sets.push({ ...lastSet });
    setTemplateExercises(updated);
  };

  const removeSetFromTemplateExercise = (exIndex: number, setIndex: number) => {
    const updated = [...templateExercises];
    updated[exIndex].sets.splice(setIndex, 1);
    setTemplateExercises(updated);
  };

  const updateTemplateSetField = (exIndex: number, setIndex: number, field: keyof TemplateSet, value: any) => {
    const updated = [...templateExercises];
    updated[exIndex].sets[setIndex] = {
      ...updated[exIndex].sets[setIndex],
      [field]: value
    };
    setTemplateExercises(updated);
  };

  // AI Base Rest Time estimation
  const getAiRestRecommendation = (exId: string) => {
    const ex = exerciseMap.get(exId);
    if (!ex) return '90s';

    // 1. Defaults based on category
    const isCompound = ['Chest', 'Lats', 'Upper Back', 'Quads', 'Hamstrings'].includes(ex.category);
    let baseRest = isCompound ? 120 : 90;

    // 2. Historical performance adaptation
    const exLogs = workouts.map(w => w.sets.find(s => s.exercise_id === exId)).filter(Boolean) as WorkoutExerciseLog[];
    if (exLogs.length >= 2) {
      let totalDropPercentage = 0;
      let countedWorkouts = 0;
      
      for (const log of exLogs) {
        const workingSets = log.sets.filter(s => s.type === 'working');
        if (workingSets.length >= 2) {
          const reps1 = workingSets[0].reps;
          const reps2 = workingSets[1].reps;
          if (reps1 > 0) {
            totalDropPercentage += ((reps1 - reps2) / reps1);
            countedWorkouts++;
          }
        }
      }

      if (countedWorkouts > 0) {
        const avgDrop = totalDropPercentage / countedWorkouts;
        if (avgDrop > 0.20) {
          // Large drop between set 1 and 2, increase rest time
          baseRest += 30;
        }
      }
    }

    return `${baseRest}s`;
  };

  // 6. Analytics & Dashboard Data Calculations
  const dashboardChartsData = useMemo(() => {
    if (workouts.length === 0) return [];

    // Group workouts by week
    // key: "Year - WeekNumber"
    const weeklyMap = new Map<string, { [key: string]: number }>();

    for (const w of workouts) {
      const d = new Date(w.completed_at);
      
      // Calculate ISO week
      const dateVal = new Date(d.getTime());
      dateVal.setHours(0, 0, 0, 0);
      dateVal.setDate(dateVal.getDate() + 3 - (dateVal.getDay() + 6) % 7);
      const week1 = new Date(dateVal.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((dateVal.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      const weekKey = `${dateVal.getFullYear()}-W${weekNum}`;

      const existing = weeklyMap.get(weekKey) ?? {
        Quads: 0, Hamstrings: 0, Calves: 0, Chest: 0, Lats: 0, 'Upper Back': 0, Shoulders: 0, Biceps: 0, Triceps: 0, Abs: 0
      };

      for (const exLog of w.sets) {
        const ex = exerciseMap.get(exLog.exercise_id);
        if (!ex) continue;
        const cat = ex.category;

        if (dashboardMetric === 'volume') {
          // Total Volume Lifted = sum(sets * reps * weight)
          const vol = exLog.sets.reduce((sum, s) => sum + (s.type === 'working' ? (s.weight * s.reps) : 0), 0);
          existing[cat] = (existing[cat] ?? 0) + vol;
        } else {
          // Hard working sets (RIR <= 3)
          const hardSets = exLog.sets.filter(s => s.type === 'working' && s.rir <= 3).length;
          existing[cat] = (existing[cat] ?? 0) + hardSets;
        }
      }

      weeklyMap.set(weekKey, existing);
    }

    // Convert map to Recharts format sorted by key ascending
    return Array.from(weeklyMap.entries())
      .map(([week, metrics]) => ({
        week,
        ...metrics
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8); // Show last 8 weeks
  }, [workouts, exerciseMap, dashboardMetric]);

  // 1RM Calculation & Selection data
  const mainLifts = useMemo(() => {
    // Return top 4 exercises by logged workouts count
    const counts = new Map<string, number>();
    for (const w of workouts) {
      for (const s of w.sets) {
        counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1);
      }
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => id);

    if (sorted.length > 0 && !selectedExercise1RM) {
      setSelectedExercise1RM(sorted[0]);
    }

    return sorted;
  }, [workouts, selectedExercise1RM]);

  // Generate 1RM Sparklines data
  const getSparklineData = (exId: string) => {
    const ex = exerciseMap.get(exId);
    if (!ex) return [];

    const history: { dateStr: string; estimated1RM: number }[] = [];

    // Filter workouts containing this exercise
    const relevantWorkouts = [...workouts].reverse(); // oldest first
    for (const w of relevantWorkouts) {
      const log = w.sets.find(s => s.exercise_id === exId);
      if (log) {
        let maxEst = 0;
        for (const s of log.sets) {
          if (s.type === 'working' && s.reps > 0) {
            const epley1RM = s.weight * (1 + s.reps / 30);
            if (epley1RM > maxEst) maxEst = epley1RM;
          }
        }
        if (maxEst > 0) {
          history.push({
            dateStr: new Date(w.completed_at).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }),
            estimated1RM: Math.round(maxEst * 2) / 2 // round to nearest 0.5
          });
        }
      }
    }
    return history;
  };

  // Detailed 1RM line chart data
  const detailed1RMData = useMemo(() => {
    if (!selectedExercise1RM) return [];
    return getSparklineData(selectedExercise1RM);
  }, [selectedExercise1RM, workouts]);

  // Loading screen
  if (loadingSession) {
    return (
      <div className="kratos-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
          Kratos initialiseren...
        </div>
      </div>
    );
  }

  // Not logged in fallback
  if (!session) {
    return (
      <div className="kratos-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center' }}>
        <Dumbbell size={48} style={{ color: '#39ff14', marginBottom: 20 }} />
        <h1 style={{ fontFamily: 'Outfit', fontWeight: 900, color: '#fff', margin: '0 0 10px' }}>ZENITH KRATOS</h1>
        <p style={{ color: '#94a3b8', fontSize: 13, maxWidth: 360, margin: '0 0 24px', lineHeight: 1.6 }}>
          Log in via het hoofdscherm van Zenith Hub om toegang te krijgen tot de Kratos Strength & Conditioning extensie.
        </p>
      </div>
    );
  }

  return (
    <div className="kratos-container">
      <div className="kratos-background">
        <div className="kratos-glow-radial" />
        <div className="kratos-glow-purple" />
      </div>

      {/* Header */}
      <header className="kratos-header animate-slide-down">
        <div className="kratos-logo-group">
          <h1 className="kratos-logo">
            <Dumbbell size={20} style={{ color: '#39ff14' }} /> KRATOS<span>.</span>
          </h1>
          <p className="kratos-subtitle">Strength & Conditioning</p>
        </div>

        <nav className="kratos-nav">
          <button 
            className={`kratos-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={13} /> Dashboard
          </button>
          <button 
            className={`kratos-nav-btn ${activeTab === 'routines' ? 'active' : ''}`}
            onClick={() => setActiveTab('routines')}
          >
            <Settings size={13} /> Routines
          </button>
          <button 
            className={`kratos-nav-btn ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            <Dumbbell size={13} /> Oefeningen
          </button>
          <button 
            className={`kratos-nav-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText size={13} /> Logboek
          </button>
          <button 
            className={`kratos-nav-btn ${activeTab === 'download' ? 'active' : ''}`}
            onClick={() => setActiveTab('download')}
          >
            <Smartphone size={13} /> Mobiele App
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="kratos-content animate-fade-in">

        {/* ----------------- DASHBOARD TAB ----------------- */}
        {activeTab === 'dashboard' && (
          <div className="animate-slide-up">
            {/* PMC Widget */}
            <section className="kratos-pmc-card">
              <div className="kratos-pmc-metric">
                <span className="kratos-pmc-label">Fitheid (CTL)</span>
                <span className="kratos-pmc-value">{currentPMC.ctl}</span>
              </div>
              <div className="kratos-pmc-metric">
                <span className="kratos-pmc-label">Vermoeidheid (ATL)</span>
                <span className="kratos-pmc-value" style={{ color: '#ff7675' }}>{currentPMC.atl}</span>
              </div>
              <div className="kratos-pmc-metric">
                <span className="kratos-pmc-label">Vorm (TSB)</span>
                <span className="kratos-pmc-value" style={{ color: currentPMC.tsb >= 0 ? '#39ff14' : '#eccc68' }}>
                  {currentPMC.tsb >= 0 ? `+${currentPMC.tsb}` : currentPMC.tsb}
                </span>
              </div>
              <div className="kratos-pmc-ai-box">
                <div className="kratos-pmc-ai-icon">
                  <Activity size={16} />
                </div>
                <div className="kratos-pmc-ai-info">
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: '#fff', letterSpacing: '0.5px' }}>AI Cardio Stress Link</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                    {aiStressConfig.factor > 1.0 
                      ? `Z-Score: +${aiStressConfig.zScore}. Rusttimer is met ${Math.round((aiStressConfig.factor - 1) * 100)}% verlengd.`
                      : 'Herstelstatus is optimaal. Standaard rusttijden van kracht.'}
                  </span>
                </div>
              </div>
            </section>

            {/* Grid for Volume and 1RM */}
            <div className="kratos-dashboard-grid">
              
              {/* Left Column: Weekly Volume Analysis */}
              <div className="kratos-card">
                <div className="kratos-card-header">
                  <h3 className="kratos-card-title">
                    <TrendingUp size={16} style={{ color: '#39ff14' }} /> Wekelijkse Volume Analyse
                  </h3>
                  <div className="kratos-nav" style={{ padding: 2 }}>
                    <button 
                      className={`kratos-nav-btn ${dashboardMetric === 'volume' ? 'active' : ''}`}
                      onClick={() => setDashboardMetric('volume')}
                      style={{ fontSize: 9, padding: '4px 10px' }}
                    >
                      Volume (kg)
                    </button>
                    <button 
                      className={`kratos-nav-btn ${dashboardMetric === 'sets' ? 'active' : ''}`}
                      onClick={() => setDashboardMetric('sets')}
                      style={{ fontSize: 9, padding: '4px 10px' }}
                    >
                      Werksets (RIR ≤ 3)
                    </button>
                  </div>
                </div>

                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <BarChart data={dashboardChartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="week" stroke="#94a3b8" style={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" style={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ background: '#1c1c23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                        labelStyle={{ color: '#fff', fontWeight: 700 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                      <Bar dataKey="Chest" stackId="a" fill="#6c5ce7" />
                      <Bar dataKey="Lats" stackId="a" fill="#00b894" />
                      <Bar dataKey="Upper Back" stackId="a" fill="#0984e3" />
                      <Bar dataKey="Quads" stackId="a" fill="#e17055" />
                      <Bar dataKey="Hamstrings" stackId="a" fill="#fdcb6e" />
                      <Bar dataKey="Shoulders" stackId="a" fill="#ffeaa7" />
                      <Bar dataKey="Biceps" stackId="a" fill="#d63031" />
                      <Bar dataKey="Triceps" stackId="a" fill="#e84393" />
                      <Bar dataKey="Calves" stackId="a" fill="#a29bfe" />
                      <Bar dataKey="Abs" stackId="a" fill="#00cec9" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Column: 1RM Progress */}
              <div className="kratos-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 className="kratos-card-title" style={{ marginBottom: 12 }}>
                  <Heart size={15} style={{ color: '#39ff14' }} /> 1RM Trends (Epley)
                </h3>

                {/* Sparklines */}
                <div className="kratos-sparkline-grid">
                  {mainLifts.map(exId => {
                    const ex = exerciseMap.get(exId);
                    const sparkData = getSparklineData(exId);
                    const latest1RM = sparkData[sparkData.length - 1]?.estimated1RM ?? 0;
                    return (
                      <div key={exId} className="kratos-sparkline-card">
                        <span className="kratos-sparkline-title">{ex?.name}</span>
                        <span className="kratos-sparkline-value">
                          {latest1RM} <span className="kratos-sparkline-unit">{ex?.weight_unit}</span>
                        </span>
                        <div style={{ width: '100%', height: 40 }}>
                          <ResponsiveContainer>
                            <LineChart data={sparkData}>
                              <Line type="monotone" dataKey="estimated1RM" stroke="#39ff14" strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Big detailed line chart */}
                {selectedExercise1RM && (
                  <div style={{ marginTop: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detailweergave</span>
                      <select 
                        className="kratos-select" 
                        value={selectedExercise1RM} 
                        onChange={(e) => setSelectedExercise1RM(e.target.value)}
                        style={{ fontSize: 10, padding: '4px 10px', height: 'auto' }}
                      >
                        {exercises.map(ex => (
                          <option key={ex.id} value={ex.id}>{ex.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ width: '100%', height: 160 }}>
                      <ResponsiveContainer>
                        <LineChart data={detailed1RMData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                          <XAxis dataKey="dateStr" stroke="#64748b" style={{ fontSize: 8 }} />
                          <YAxis stroke="#64748b" style={{ fontSize: 8 }} />
                          <Tooltip contentStyle={{ background: '#1c1c23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 10 }} />
                          <Line type="monotone" dataKey="estimated1RM" stroke="#6c5ce7" strokeWidth={2} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ----------------- ROUTINES TAB ----------------- */}
        {activeTab === 'routines' && (
          <div className="animate-slide-up">
            {!isTemplateModalOpen ? (
              // List View
              <div className="kratos-card">
                <div className="kratos-card-header">
                  <h3 className="kratos-card-title">Templates Bibliotheek</h3>
                  <button 
                    className="kratos-btn kratos-btn-neon"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateName('');
                      setTemplateExercises([]);
                      setIsTemplateModalOpen(true);
                    }}
                  >
                    <Plus size={14} /> Nieuw Template
                  </button>
                </div>

                {templates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
                    Geen routines gevonden. Maak een nieuw template aan om te gebruiken in de sportschool app!
                  </div>
                ) : (
                  <table className="kratos-table">
                    <thead>
                      <tr>
                        <th>Routine Naam</th>
                        <th>Oefeningen</th>
                        <th>Werksets</th>
                        <th style={{ textAlign: 'right' }}>Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(temp => {
                        const totalWorkingSets = temp.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.type === 'working').length, 0);
                        return (
                          <tr key={temp.id}>
                            <td style={{ fontWeight: 700, color: '#fff' }}>{temp.name}</td>
                            <td>
                              {temp.exercises.map(ex => exerciseMap.get(ex.exercise_id)?.name).filter(Boolean).join(', ')}
                            </td>
                            <td>{totalWorkingSets} sets</td>
                            <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button className="kratos-btn kratos-btn-secondary" style={{ padding: '6px 12px', fontSize: 10 }} onClick={() => handleEditTemplateClick(temp)}>
                                <Edit3 size={11} /> Bewerken
                              </button>
                              <button className="kratos-btn kratos-btn-danger" style={{ padding: '6px 12px', fontSize: 10 }} onClick={() => handleDeleteTemplate(temp.id)}>
                                <Trash2 size={11} /> Verwijder
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              // Builder/Edit View
              <div className="kratos-card animate-slide-up">
                <div className="kratos-card-header">
                  <h3 className="kratos-card-title">{editingTemplate ? 'Template bewerken' : 'Nieuw template maken'}</h3>
                  <button className="kratos-btn kratos-btn-secondary" onClick={() => setIsTemplateModalOpen(false)}>
                    <X size={14} /> Annuleren
                  </button>
                </div>

                <div className="kratos-input-group" style={{ marginBottom: 24 }}>
                  <label className="kratos-label">Routine Naam</label>
                  <input 
                    type="text" 
                    className="kratos-input" 
                    value={templateName} 
                    onChange={(e) => setTemplateName(e.target.value)} 
                    placeholder="Bijv. Push B, Leg Day, Fullbody" 
                    style={{ fontSize: 16, padding: '12px 16px' }}
                  />
                </div>

                {/* Add Exercise Finder */}
                <div style={{ position: 'relative', marginBottom: 28 }}>
                  <label className="kratos-label" style={{ marginBottom: 6, display: 'block' }}>Oefening toevoegen</label>
                  <input 
                    type="text" 
                    className="kratos-input" 
                    value={exerciseSearchQuery} 
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    placeholder="Zoek oefening..."
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {exerciseSearchQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1c1c23', border: '1px solid var(--border-solid)', borderRadius: 10, marginTop: 4, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                      {exercises
                        .filter(ex => ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()))
                        .map(ex => (
                          <div 
                            key={ex.id} 
                            onClick={() => addExerciseToTemplate(ex.id)}
                            style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <strong>{ex.name}</strong> <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>({ex.category})</span>
                          </div>
                        ))}
                      {exercises.filter(ex => ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase())).length === 0 && (
                        <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 11 }}>
                          Geen oefeningen gevonden. Maak deze eerst aan in de 'Oefeningen' tab!
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Added Exercises list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                  {templateExercises.map((te, exIndex) => {
                    const ex = exerciseMap.get(te.exercise_id);
                    if (!ex) return null;
                    const aiRest = getAiRestRecommendation(te.exercise_id);
                    return (
                      <div key={exIndex} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div>
                            <strong style={{ fontSize: 14, color: '#fff' }}>{ex.name}</strong>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', marginLeft: 10, background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: 4 }}>
                              {ex.category}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(57, 255, 20, 0.02)', border: '1px dashed rgba(57, 255, 20, 0.1)', padding: '4px 10px', borderRadius: 6 }}>
                              <Info size={12} style={{ color: 'var(--accent-neon)' }} />
                              <span>AI Rusttijd: <strong>{aiRest}</strong></span>
                            </div>
                            <button className="kratos-btn kratos-btn-danger" style={{ padding: 6 }} onClick={() => removeExerciseFromTemplate(exIndex)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Sets Editor Table */}
                        <table className="kratos-table" style={{ marginTop: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 80 }}>Set</th>
                              <th style={{ width: 140 }}>Type</th>
                              <th>Min Reps</th>
                              <th>Max Reps</th>
                              <th>Doel RIR</th>
                              <th style={{ width: 60 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {te.sets.map((set, setIndex) => (
                              <tr key={setIndex}>
                                <td style={{ fontWeight: 800 }}>{setIndex + 1}</td>
                                <td>
                                  <select 
                                    className="kratos-select" 
                                    value={set.type} 
                                    onChange={(e) => updateTemplateSetField(exIndex, setIndex, 'type', e.target.value)}
                                    style={{ padding: '6px 10px', width: '100%', boxSizing: 'border-box' }}
                                  >
                                    <option value="warmup">Warm-up (W)</option>
                                    <option value="working">Werkset</option>
                                  </select>
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    className="kratos-input" 
                                    value={set.min_reps} 
                                    onChange={(e) => updateTemplateSetField(exIndex, setIndex, 'min_reps', Number(e.target.value))}
                                    style={{ padding: '6px 10px', width: 60 }}
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    className="kratos-input" 
                                    value={set.max_reps} 
                                    onChange={(e) => updateTemplateSetField(exIndex, setIndex, 'max_reps', Number(e.target.value))}
                                    style={{ padding: '6px 10px', width: 60 }}
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    className="kratos-input" 
                                    value={set.target_rir} 
                                    onChange={(e) => updateTemplateSetField(exIndex, setIndex, 'target_rir', Number(e.target.value))}
                                    style={{ padding: '6px 10px', width: 60 }}
                                    disabled={set.type === 'warmup'}
                                  />
                                </td>
                                <td>
                                  <button className="kratos-btn kratos-btn-danger" style={{ padding: 4 }} onClick={() => removeSetFromTemplateExercise(exIndex, setIndex)}>
                                    <X size={10} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button className="kratos-btn kratos-btn-secondary" style={{ marginTop: 10, fontSize: 10, padding: '6px 12px' }} onClick={() => addSetToTemplateExercise(exIndex)}>
                          <Plus size={10} /> Set Toevoegen
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="kratos-btn kratos-btn-neon" onClick={handleSaveTemplate} style={{ padding: '12px 28px' }}>
                    <Check size={14} /> Routine Opslaan
                  </button>
                  <button className="kratos-btn kratos-btn-secondary" onClick={() => setIsTemplateModalOpen(false)}>
                    Annuleren
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- EXERCISES TAB ----------------- */}
        {activeTab === 'exercises' && (
          <div className="animate-slide-up">
            {!isExerciseModalOpen ? (
              // List View
              <div className="kratos-card">
                <div className="kratos-card-header">
                  <h3 className="kratos-card-title">Oefeningenbibliotheek</h3>
                  <button 
                    className="kratos-btn kratos-btn-neon"
                    onClick={() => {
                      setEditingExercise(null);
                      setExerciseForm({
                        name: '',
                        category: 'Chest',
                        notes: '',
                        increment_weight: 2.5,
                        increment_per_side: false,
                        default_rir: 2,
                        weight_unit: 'kg'
                      });
                      setIsExerciseModalOpen(true);
                    }}
                  >
                    <Plus size={14} /> Oefening Toevoegen
                  </button>
                </div>

                {exercises.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
                    Geen oefeningen gevonden. Voeg er een toe om te beginnen met het bouwen van routines!
                  </div>
                ) : (
                  <table className="kratos-table">
                    <thead>
                      <tr>
                        <th>Naam</th>
                        <th>Spiergroep</th>
                        <th>Stap (kg/lbs)</th>
                        <th>Eenheid</th>
                        <th>Doel RIR</th>
                        <th>Cues / Notities</th>
                        <th style={{ textAlign: 'right' }}>Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercises.map(ex => (
                        <tr key={ex.id}>
                          <td style={{ fontWeight: 700, color: '#fff' }}>{ex.name}</td>
                          <td>
                            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: 4 }}>{ex.category}</span>
                          </td>
                          <td>+{ex.increment_weight} {ex.increment_per_side ? '(per kant)' : '(totaal)'}</td>
                          <td style={{ textTransform: 'uppercase', fontWeight: 700 }}>{ex.weight_unit}</td>
                          <td>RIR {ex.default_rir}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ex.notes || '-'}
                          </td>
                          <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="kratos-btn kratos-btn-secondary" style={{ padding: '6px 12px', fontSize: 10 }} onClick={() => handleEditExerciseClick(ex)}>
                              <Edit3 size={11} /> Bewerken
                            </button>
                            <button className="kratos-btn kratos-btn-danger" style={{ padding: '6px 12px', fontSize: 10 }} onClick={() => handleDeleteExercise(ex.id)}>
                              <Trash2 size={11} /> Verwijder
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              // Add/Edit Modal Form
              <div className="kratos-card animate-slide-up" style={{ maxWidth: 600, margin: '0 auto' }}>
                <div className="kratos-card-header">
                  <h3 className="kratos-card-title">{editingExercise ? 'Oefening bewerken' : 'Nieuwe oefening toevoegen'}</h3>
                  <button className="kratos-btn kratos-btn-secondary" onClick={() => setIsExerciseModalOpen(false)}>
                    <X size={14} />
                  </button>
                </div>

                <form onSubmit={handleSaveExercise}>
                  <div className="kratos-input-group">
                    <label className="kratos-label">Oefening Naam</label>
                    <input 
                      type="text" 
                      className="kratos-input" 
                      required 
                      value={exerciseForm.name} 
                      onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                      placeholder="Bijv. Bench Press, Squat, Lat Pulldown"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="kratos-input-group">
                      <label className="kratos-label">Spiergroep / Categorie</label>
                      <select 
                        className="kratos-select" 
                        value={exerciseForm.category} 
                        onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value as any })}
                      >
                        <option value="Quads">Quads (Benen)</option>
                        <option value="Hamstrings">Hamstrings (Achterkant Benen)</option>
                        <option value="Calves">Calves (Kuiten)</option>
                        <option value="Chest">Chest (Borst)</option>
                        <option value="Lats">Lats (Zijkant Rug)</option>
                        <option value="Upper Back">Upper Back (Bovenrug)</option>
                        <option value="Shoulders">Shoulders (Schouders)</option>
                        <option value="Biceps">Biceps (Armen)</option>
                        <option value="Triceps">Triceps (Armen)</option>
                        <option value="Abs">Abs (Buikspieren)</option>
                      </select>
                    </div>

                    <div className="kratos-input-group">
                      <label className="kratos-label">Eenheid (kg of lbs)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 38 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: exerciseForm.weight_unit === 'kg' ? '#fff' : 'var(--text-secondary)' }}>KG</span>
                        <label className="kratos-switch">
                          <input 
                            type="checkbox" 
                            checked={exerciseForm.weight_unit === 'lbs'}
                            onChange={(e) => setExerciseForm({ ...exerciseForm, weight_unit: e.target.checked ? 'lbs' : 'kg' })}
                          />
                          <span className="kratos-slider" />
                        </label>
                        <span style={{ fontSize: 11, fontWeight: 700, color: exerciseForm.weight_unit === 'lbs' ? '#fff' : 'var(--text-secondary)' }}>LBS</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="kratos-input-group">
                      <label className="kratos-label">Kleinste Stap (gewicht)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        className="kratos-input" 
                        required 
                        value={exerciseForm.increment_weight} 
                        onChange={(e) => setExerciseForm({ ...exerciseForm, increment_weight: Number(e.target.value) })}
                        placeholder="Bijv. 2.5 of 1.0"
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <input 
                          type="checkbox" 
                          id="increment_per_side"
                          checked={!!exerciseForm.increment_per_side}
                          onChange={(e) => setExerciseForm({ ...exerciseForm, increment_per_side: e.target.checked })}
                          style={{ accentColor: 'var(--accent-neon)' }}
                        />
                        <label htmlFor="increment_per_side" style={{ fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          Stappen zijn per kant
                        </label>
                      </div>
                    </div>

                    <div className="kratos-input-group">
                      <label className="kratos-label">Standaard Doel RIR</label>
                      <input 
                        type="number" 
                        className="kratos-input" 
                        required 
                        value={exerciseForm.default_rir} 
                        onChange={(e) => setExerciseForm({ ...exerciseForm, default_rir: Number(e.target.value) })}
                        placeholder="Bijv. 2"
                      />
                    </div>
                  </div>

                  <div className="kratos-input-group" style={{ marginBottom: 24 }}>
                    <label className="kratos-label">Cues / Vorm Notities</label>
                    <textarea 
                      className="kratos-input" 
                      rows={3} 
                      value={exerciseForm.notes} 
                      onChange={(e) => setExerciseForm({ ...exerciseForm, notes: e.target.value })}
                      placeholder="Bijv. Touch chest en druk explosief omhoog, ellebogen onder 45 graden."
                      style={{ resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="submit" className="kratos-btn kratos-btn-neon">
                      <Check size={14} /> Opslaan
                    </button>
                    <button type="button" className="kratos-btn kratos-btn-secondary" onClick={() => setIsExerciseModalOpen(false)}>
                      Annuleren
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ----------------- MOBILE APP DOWNLOAD TAB ----------------- */}
        {activeTab === 'download' && (
          <div className="animate-slide-up" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="kratos-card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, padding: 32 }}>
              <div>
                <h3 className="kratos-card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, marginBottom: 12 }}>
                  <Smartphone style={{ color: '#39ff14' }} /> Kratos Pilot App
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: '1.6', marginBottom: 20 }}>
                  Kratos Pilot is de mobiele companion app voor krachttraining. Log uw sets, reps en RIR 
                  rechtstreeks vanaf de trainingsvloer. De app functioneert volledig <strong>offline-first</strong> 
                  en synchroniseert uw resultaten automatisch met de cloud zodra u verbinding heeft.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(57, 255, 20, 0.1)', color: '#39ff14', fontSize: 11, fontWeight: 700 }}>1</span>
                    <span><strong>Autoregulatie:</strong> Live aanpassing van uw target reps & gewichten op basis van RIR.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(57, 255, 20, 0.1)', color: '#39ff14', fontSize: 11, fontWeight: 700 }}>2</span>
                    <span><strong>Cardio Stress Factor:</strong> Rest timer schaling berekend uit uw meest recente ritten.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(57, 255, 20, 0.1)', color: '#39ff14', fontSize: 11, fontWeight: 700 }}>3</span>
                    <span><strong>PR-Celebrations:</strong> Epley 1RM schatting PR-meldingen om records te vieren.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <a 
                    href="https://github.com/filipmonbaillieu24-prog/Hubio/raw/main/apk/kratos-pilot-debug.apk"
                    className="kratos-btn kratos-btn-neon"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px' }}
                    download
                  >
                    <Smartphone size={14} /> Download Kratos Pilot APK
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: 32 }}>
                <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', marginBottom: 16 }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=09090b&data=${encodeURIComponent("https://github.com/filipmonbaillieu24-prog/Hubio/raw/main/apk/kratos-pilot-debug.apk")}`} 
                    alt="Kratos Pilot Download QR Code"
                    style={{ width: 160, height: 160, display: 'block' }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                  Scan met uw telefoon om direct te installeren
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* ----------------- LOGBOOK TAB ----------------- */}
        {activeTab === 'logs' && (
          <div className="animate-slide-up">
            <div className="kratos-card">
              <h3 className="kratos-card-title">Training Logboek</h3>

              {workouts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
                  Nog geen voltooide workouts gelogd. Start Kratos Pilot op je Android en log je eerste training!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {workouts.map(w => {
                    const durationMins = Math.round((new Date(w.completed_at).getTime() - new Date(w.started_at).getTime()) / 60000);
                    return (
                      <div key={w.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 12 }}>
                          <div>
                            <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#fff' }}>{w.name}</h4>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {new Date(w.completed_at).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-secondary)' }} />
                              <span>Duur: {durationMins} min</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 16, textAlign: 'right' }}>
                            <div>
                              <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>Totaal Volume</span>
                              <strong style={{ fontSize: 14, color: 'var(--accent-neon)' }}>{w.volume} kg</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>Cardio Herstel</span>
                              <strong style={{ fontSize: 14, color: '#fff' }}>
                                {w.cardio_stress_factor > 1.0 ? `+${Math.round((w.cardio_stress_factor - 1) * 100)}% rust` : 'Normaal'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Exercise Sets breakdown */}
                        <div style={{ display: 'flex', flexFlow: 'row wrap', gap: 16 }}>
                          {w.sets.map((exLog, idx) => {
                            const ex = exerciseMap.get(exLog.exercise_id);
                            if (!ex) return null;
                            return (
                              <div key={idx} style={{ minWidth: 220, background: 'rgba(9,9,11,0.3)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 8, padding: 12 }}>
                                <strong style={{ fontSize: 12, color: '#fff', display: 'block', marginBottom: 6 }}>{ex.name}</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {exLog.sets.map((s, sIdx) => (
                                    <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: s.type === 'warmup' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                      <span>
                                        Set {sIdx + 1} {s.type === 'warmup' && <span style={{ fontSize: 9, opacity: 0.6 }}>(W)</span>}:
                                      </span>
                                      <strong>
                                        {s.weight} {ex.weight_unit} x {s.reps} <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}> (RIR {s.rir})</span>
                                      </strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
