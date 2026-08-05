import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './utils/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { ZenithHubPage } from './pages/hub/ZenithHubPage';
import { PilotPanel } from './pages/hub/PilotPanel';
import { ProfilePage } from './pages/hub/ProfilePage';
import { computePMC } from './utils/pmc';
import './App.css';

function App() {
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hub' | 'cyclopilot' | 'profile' | 'vigor' | 'kratos' | 'fuel'>('hub');
  const [rides, setRides] = useState<{ date: number; tss: number }[]>([]);
  const [fitnessProfile, setFitnessProfile] = useState<any>({ name: 'Atleet' });

  const pendingWeight = useRef<number | null>(null);
  const pendingRawBytes = useRef<number[] | null>(null);
  const pendingMetrics = useRef<any | null>(null);

  // Memoized Vigor URL containing auth hashes
  const vigorUrl = useMemo(() => {
    if (!session) return '';
    const token = session.access_token;
    const refresh = session.refresh_token;
    const isDev = import.meta.env.DEV;
    return isDev
      ? `http://localhost:1440/#access_token=${token}&refresh_token=${refresh}`
      : `${window.location.origin}/vigor/index.html#access_token=${token}&refresh_token=${refresh}`;
  }, [session]);

  // Memoized Kratos URL containing auth hashes
  const kratosUrl = useMemo(() => {
    if (!session) return '';
    const token = session.access_token;
    const refresh = session.refresh_token;
    const isDev = import.meta.env.DEV;
    return isDev
      ? `http://localhost:1450/#access_token=${token}&refresh_token=${refresh}`
      : `${window.location.origin}/kratos/index.html#access_token=${token}&refresh_token=${refresh}`;
  }, [session]);

  // Memoized Fuel URL containing auth hashes
  const fuelUrl = useMemo(() => {
    if (!session) return '';
    const token = session.access_token;
    const refresh = session.refresh_token;
    const isDev = import.meta.env.DEV;
    return isDev
      ? `http://localhost:1460/#access_token=${token}&refresh_token=${refresh}`
      : `${window.location.origin}/fuel/index.html#access_token=${token}&refresh_token=${refresh}`;
  }, [session]);

  // Listen for native Tauri BLE weight and metrics events and forward to Vigor iframe
  useEffect(() => {
    let unlistenWeight: (() => void) | null = null;
    let unlistenMetrics: (() => void) | null = null;

    async function setupTauriListener() {
      if ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__) {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          unlistenWeight = await listen('native-weight-received', (event: any) => {
            const payload = event.payload as { weight: number, raw_bytes?: number[] };
            console.log("Hub received native weight from Tauri Rust:", payload.weight);
            
            pendingWeight.current = payload.weight;
            pendingRawBytes.current = payload.raw_bytes ?? null;
            
            // Switch to Vigor app if not already active
            setActiveTab('vigor');
            
            // Send to iframe (with timeout in case the iframe is already mounted and active)
            setTimeout(() => {
              const iframe = document.getElementById('vigor-iframe') as HTMLIFrameElement;
              if (iframe && iframe.contentWindow) {
                console.log("Sending weight immediately to iframe:", payload.weight);
                iframe.contentWindow.postMessage({ 
                  type: 'native-weight-received', 
                  weight: payload.weight,
                  raw_bytes: payload.raw_bytes 
                }, '*');
              }
            }, 300);
          });

          unlistenMetrics = await listen('native-metrics-received', (event: any) => {
            const payload = event.payload as { body_fat: number, water: number, impedance: number };
            console.log("Hub received native metrics from Tauri Rust:", payload);
            
            pendingMetrics.current = payload;
            
            setTimeout(() => {
              const iframe = document.getElementById('vigor-iframe') as HTMLIFrameElement;
              if (iframe && iframe.contentWindow) {
                console.log("Sending metrics immediately to iframe:", payload);
                iframe.contentWindow.postMessage({ type: 'native-metrics-received', payload }, '*');
              }
            }, 300);
          });
        } catch (err) {
          console.error("Failed to setup Tauri native BLE listener in Hub:", err);
        }
      }
    }

    setupTauriListener();

    return () => {
      if (unlistenWeight) unlistenWeight();
      if (unlistenMetrics) unlistenMetrics();
    };
  }, []);

  // Handle close-app and ready postMessages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'close-app') {
        setActiveTab('hub');
      } else if (event.data?.type === 'vigor-dashboard-ready') {
        console.log("Hub received ready notification from Vigor iframe");
        const iframe = document.getElementById('vigor-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          if (pendingWeight.current !== null) {
            console.log("Sending pending weight to ready iframe:", pendingWeight.current);
            iframe.contentWindow.postMessage({ 
              type: 'native-weight-received', 
              weight: pendingWeight.current,
              raw_bytes: pendingRawBytes.current
            }, '*');
            pendingWeight.current = null;
            pendingRawBytes.current = null;
          }
          if (pendingMetrics.current !== null) {
            console.log("Sending pending metrics to ready iframe:", pendingMetrics.current);
            iframe.contentWindow.postMessage({ type: 'native-metrics-received', payload: pendingMetrics.current }, '*');
            pendingMetrics.current = null;
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Central profile loader from public.profiles table
  const loadFitnessProfile = useCallback(async (userId: string, userMetadata: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setFitnessProfile({
          name: data.name || 'Atleet',
          gender: data.gender,
          birthDate: data.birth_date,
          height: data.height_cm,
          weight: data.weight_kg,
          ftp: data.ftp_watts || 220,
          lthr: data.lthr_bpm || 165,
          trainingGoal: data.training_goal || 'general'
        });
      } else {
        const initialName = userMetadata?.name || 'Atleet';
        const defaultProfile = {
          id: userId,
          name: initialName,
          training_goal: 'general',
          ftp_watts: 220,
          lthr_bpm: 165
        };
        await supabase.from('profiles').insert(defaultProfile);
        setFitnessProfile({
          name: defaultProfile.name,
          trainingGoal: 'general',
          ftp: 220,
          lthr: 165
        });
      }
    } catch (e) {
      console.error("Error loading profile from profiles table:", e);
      const profile = userMetadata?.fitness_profile || {};
      const name = userMetadata?.name || profile.name || 'Atleet';
      setFitnessProfile({ ...profile, name });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
      if (session?.user) {
        loadFitnessProfile(session.user.id, session.user.user_metadata);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadFitnessProfile(session.user.id, session.user.user_metadata);
      } else {
        setRides([]);
        setFitnessProfile({ name: 'Atleet' });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadFitnessProfile]);

  const fetchRides = useCallback(async () => {
    if (!session) return;
    try {
      const { data } = await supabase
        .from('rides')
        .select('date, metadata')
        .order('date', { ascending: true });
      
      if (data) {
        const tssList = data.map((r: any) => {
          let meta = r.metadata;
          if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { meta = {}; }
          }
          return {
            date: Number(r.date),
            tss: Number(meta?.tss ?? meta?.hrTSS ?? 0)
          };
        });
        setRides(tssList);
      }
    } catch (err) {
      console.error('Kon ritten niet laden voor PMC:', err);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchRides();
    }
  }, [fetchRides, session]);

  // Supabase Realtime channel to orchestrate background MLP training cycles
  useEffect(() => {
    if (!session?.user) return;
    const userId = session.user.id;

    // Load background trainer dynamically to keep start bundle lightweight
    const triggerTraining = async () => {
      const { runBackgroundTraining } = await import('./utils/backgroundTrainer');
      await runBackgroundTraining(supabase, userId);
    };

    // Trigger initial train run on load
    triggerTraining();

    const channel = supabase
      .channel('hub-db-ml-trigger')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides', filter: `user_id=eq.${userId}` }, () => {
        triggerTraining();
        fetchRides();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vigor_weight', filter: `user_id=eq.${userId}` }, () => {
        triggerTraining();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vigor_sleep', filter: `user_id=eq.${userId}` }, () => {
        triggerTraining();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vigor_steps', filter: `user_id=eq.${userId}` }, () => {
        triggerTraining();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kratos_workouts', filter: `user_id=eq.${userId}` }, () => {
        triggerTraining();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchRides]);

  const fitnessMetrics = useMemo(() => {
    if (rides.length === 0) return { ctl: 0, atl: 0, tsb: 0 };
    const points = computePMC(rides);
    const last = points[points.length - 1];
    return {
      ctl: last ? Math.round(last.ctl) : 0,
      atl: last ? Math.round(last.atl) : 0,
      tsb: last ? Math.round(last.tsb) : 0,
    };
  }, [rides]);

  const onOpenApp = async (appKey: 'cyclo' | 'cyclopilot' | 'vigor' | 'indigogym' | 'fuel') => {
    if (appKey === 'cyclo') {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      const refresh = currentSession?.refresh_token;
      const isDev = import.meta.env.DEV;

      const aeroUrl = isDev
        ? `http://localhost:1430/#access_token=${token}&refresh_token=${refresh}`
        : `${window.location.origin}/aero/index.html`;

      window.location.href = aeroUrl;
    } else if (appKey === 'cyclopilot') {
      setActiveTab('cyclopilot');
    } else if (appKey === 'vigor') {
      setActiveTab('vigor');
    } else if (appKey === 'indigogym') {
      setActiveTab('kratos');
    } else if (appKey === 'fuel') {
      setActiveTab('fuel');
    }
  };

  const handleSaveProfile = async (updatedProfile: any) => {
    if (!session?.user) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        name: updatedProfile.name,
        gender: updatedProfile.gender || null,
        birth_date: updatedProfile.birthDate || null,
        height_cm: updatedProfile.height || null,
        weight_kg: updatedProfile.weight || null,
        ftp_watts: updatedProfile.ftp || 220,
        lthr_bpm: updatedProfile.lthr || 165,
        training_goal: updatedProfile.trainingGoal || 'general',
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    await supabase.auth.updateUser({
      data: {
        name: updatedProfile.name || undefined
      }
    });

    setFitnessProfile(updatedProfile);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (sessionLoading) {
    return (
      <div className="zh-hub-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
          Zenith laden...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const userName = fitnessProfile?.name || session?.user?.user_metadata?.name || 'Atleet';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#09090b', overflow: 'hidden' }}>
      {activeTab === 'hub' && (
        <ZenithHubPage
          fitnessProfile={fitnessProfile}
          fitnessMetrics={fitnessMetrics}
          onOpenApp={onOpenApp}
          onOpenProfile={() => setActiveTab('profile')}
          onLogout={handleLogout}
          userId={session.user.id}
        />
      )}
      {activeTab === 'cyclopilot' && (
        <PilotPanel
          userName={userName}
          onBack={() => setActiveTab('hub')}
        />
      )}
      {activeTab === 'profile' && (
        <ProfilePage
          initialProfile={fitnessProfile}
          userId={session.user.id}
          onBack={() => setActiveTab('hub')}
          onSave={handleSaveProfile}
        />
      )}
      {activeTab === 'vigor' && (
        <div style={{ width: '100%', height: '100vh', background: '#09090b', position: 'relative' }}>
          <iframe
            id="vigor-iframe"
            src={vigorUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Zenith Vigor"
            allow="bluetooth"
          />
        </div>
      )}
      {activeTab === 'kratos' && (
        <div style={{ width: '100%', height: '100vh', background: '#09090b', position: 'relative' }}>
          <iframe
            id="kratos-iframe"
            src={kratosUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Zenith Kratos"
          />
        </div>
      )}
      {activeTab === 'fuel' && (
        <div style={{ width: '100%', height: '100vh', background: '#09090b', position: 'relative' }}>
          <iframe
            id="fuel-iframe"
            src={fuelUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Zenith Fuel"
          />
        </div>
      )}
    </div>
  );
}

export default App;
