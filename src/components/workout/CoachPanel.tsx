import React, { useMemo, useState } from 'react';
import './CoachPanel.css';
import { RideSummaryWithBests, FitnessProfile } from '../../types/workout';
import { generateCoachAdvice } from '../../utils/coach';
import { computePMC, interpretTSB } from '../../utils/pmc';
import { Brain, Sparkles, CheckCircle2, Sliders, Coffee, Flame, Droplets } from 'lucide-react';
import { calculateFuel } from '../../utils/fueling';
import { TrainingGoal } from '../../types/workout';
import { savePlannedWorkout } from '../../utils/db';
import { PlannedWorkoutItem } from '../../utils/pmc';

interface CoachPanelProps {
  rides: RideSummaryWithBests[];
  profile: FitnessProfile;
  onProfileChange: (p: FitnessProfile) => void;
}

type FilterCategory = 'all' | 'training' | 'herstel' | 'doel' | 'waarschuwing';

export const CoachPanel: React.FC<CoachPanelProps> = ({ rides, profile, onProfileChange }) => {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  
  // Daily Workout Generator states
  const [genMinutes, setGenMinutes] = useState(90);
  const [generatedWorkout, setGeneratedWorkout] = useState<PlannedWorkoutItem | null>(null);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  
  // Calculator states
  const [plannedHours, setPlannedHours] = useState(2);
  const [plannedMinutes, setPlannedMinutes] = useState(0);
  const [selectedIntensity, setSelectedIntensity] = useState(2); // Zone 2
  const [plannedTemperature, setPlannedTemperature] = useState(20);

  // Bereken PMC voor gepersonaliseerde begroeting
  const pmcStatus = useMemo(() => {
    const tssList = rides
      .filter(r => (r.tss ?? r.hrTSS) != null)
      .map(r => ({ date: r.date, tss: (r.tss ?? r.hrTSS)! }));
    const points = computePMC(tssList);
    const latest = points[points.length - 1] ?? { ctl: 0, atl: 0, tsb: 0 };
    return {
      latest,
      tsbStatus: interpretTSB(latest.tsb)
    };
  }, [rides]);

  const advice = useMemo(() => generateCoachAdvice(rides as any[], profile as any, pmcStatus.latest), [rides, profile, pmcStatus.latest]);


  // Genereer dynamisch wekelijks trainingsplan op basis van doel en CTL
  const weeklyPlan = useMemo(() => {
    const goal = profile.trainingGoal ?? 'general';
    const ctl = Math.max(10, Math.round(pmcStatus.latest.ctl));
    
    // Basis uren en TSS schalen met fitheid
    let baseHours = 3 + Math.floor(ctl / 15);
    let baseTSS = 150 + Math.floor(ctl * 4);
    
    let planTitle = '';
    let planDesc = '';
    let workoutsList: string[] = [];

    if (goal === 'climbing') {
      planTitle = '⛰️ Klim & Kracht Plan';
      planDesc = `Gericht op het verbeteren van je klimvermogen en krachtuithoudingsvermogen op langere beklimmingen bij een fitheid van CTL: ${ctl}.`;
      workoutsList = [
        `${Math.round(baseHours * 0.5)} uur Zone 2 (Aerobe basis)`,
        `1x Sweet Spot Interval (bv. 2x15 min op 88% FTP met 5 min herstel)`,
        `1x Klimkracht Training (lagere cadans 65-75 rpm in Zone 3/4 op klimmetjes)`
      ];
    } else if (goal === 'speed') {
      planTitle = '⚡ Snelheid & Explosiviteit Plan';
      planDesc = `Ontwikkeld om je anaerobe capaciteit (W') en sprintsnelheid te verhogen bij een fitheid van CTL: ${ctl}.`;
      workoutsList = [
        `${Math.round(baseHours * 0.6)} uur Zone 2 (Actief herstel & Duur)`,
        `1x Anaerobe Intervallen (bv. 5x 30s maximaal met 4 min herstel)`,
        `1x Neuromusculaire sprints (10x 6s maximaal vanuit stilstand)`
      ];
    } else if (goal === 'endurance') {
      planTitle = '🚴 Endurance & Vetverbranding Plan';
      planDesc = `Volledig gefocust op aerobe efficiëntie, cardiovasculaire duur en vetverbranding bij een fitheid van CTL: ${ctl}.`;
      workoutsList = [
        `${Math.round(baseHours * 0.8)} uur Zone 2 (Strikte aerobe duurtraining)`,
        `1x Lange rit (minimaal ${Math.max(2, Math.round(baseHours * 0.4))} uur achter elkaar in Zone 2)`,
        `1x Herstelrit (45 min Zone 1 spin)`
      ];
    } else {
      planTitle = '🍀 Algemene Conditie Plan';
      planDesc = `Een gebalanceerd allround schema voor het stabiel opbouwen van conditie bij een fitheid van CTL: ${ctl}.`;
      workoutsList = [
        `${Math.round(baseHours * 0.6)} uur Zone 2 (Basis conditie)`,
        `1x Tempo rit (bv. 3x8 min in Zone 3 met 3 min herstel)`,
        `1x Variabel trainingsritje met wat korte heuvels of versnellingen`
      ];
    }

    return {
      title: planTitle,
      description: planDesc,
      hours: baseHours,
      tss: baseTSS,
      workouts: workoutsList
    };
  }, [profile.trainingGoal, pmcStatus.latest.ctl]);

  const filteredAdvice = useMemo(() => {
    if (activeFilter === 'all') return advice;
    return advice.filter(a => a.category === activeFilter);
  }, [advice, activeFilter]);

  const calculatorFuel = useMemo(() => {
    const totalSeconds = (plannedHours * 3600) + (plannedMinutes * 60);
    return calculateFuel(
      totalSeconds,
      selectedIntensity,
      profile.weight ?? 75,
      profile.ftp ?? 220,
      plannedTemperature
    );
  }, [plannedHours, plannedMinutes, selectedIntensity, profile.weight, profile.ftp, plannedTemperature]);

  const getGreetingMessage = () => {
    const name = profile.name ?? 'Atleet';
    const tsb = pmcStatus.latest.tsb;
    if (tsb < -20) {
      return `Hallo ${name}. Je lichaam staat momenteel onder aanzienlijke stress (TSB: ${Math.round(tsb)}). Focus vandaag op actief herstel of neem een volledige rustdag.`;
    } else if (tsb > 5) {
      return `Hallo ${name}. Je bent uitgerust en je vorm is uitstekend (TSB: +${Math.round(tsb)}). Vandaag is een perfecte dag voor een intensieve intervaltraining of een lange duurrit!`;
    } else {
      return `Hallo ${name}. Je trainingsopbouw verloopt stabiel en gecontroleerd. Blijf je zones respecteren en volg de onderstaande adviezen om blessures te voorkomen.`;
    }
  };

  if (rides.length < 2) {
    return (
      <div className="wd-section-card" style={{ padding: 24, textAlign: 'center', color: '#cbd5e1' }}>
        <Brain size={32} strokeWidth={1.5} style={{ color: '#a5b4fc', marginBottom: 12 }} />
        <p style={{ margin: 0 }}>Upload minimaal 2 ritten met hartslag- of vermogensgegevens om gepersonaliseerd AI-trainingsadvies te genereren.</p>
      </div>
    );
  }

  const handleGoalChange = (newGoal: TrainingGoal) => {
    onProfileChange({ ...profile, trainingGoal: newGoal });
  };

  const handleGenerateDailyWorkout = () => {
    const goal = profile.trainingGoal ?? 'general';
    const ftp = profile.ftp ?? 220;
    const lthr = profile.lthr ?? 170;
    
    const workout = generateDailyWorkoutHelper(genMinutes, goal, ftp, lthr);
    setGeneratedWorkout(workout);
    setSaveSuccessMsg('');
  };

  const handleSaveGeneratedWorkout = async () => {
    if (!generatedWorkout) return;
    setIsSavingWorkout(true);
    try {
      // Format today's date in local time YYYY-MM-DD
      const date = new Date();
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      
      const workoutToSave: PlannedWorkoutItem = {
        ...generatedWorkout,
        date: todayStr
      };
      
      await savePlannedWorkout(workoutToSave);
      setSaveSuccessMsg('✓ Training succesvol ingepland voor vandaag!');
      setGeneratedWorkout(null);
    } catch (err) {
      console.error('Fout bij opslaan geplande workout:', err);
      setSaveSuccessMsg('✗ Kon training niet opslaan.');
    } finally {
      setIsSavingWorkout(false);
    }
  };

function generateDailyWorkoutHelper(
  minutes: number,
  goal: TrainingGoal,
  ftp: number,
  lthr: number
): PlannedWorkoutItem {
  const steps: any[] = [];
  let title = '';
  let plannedTSS = 0;
  let notes = '';

  const warmupDuration = 10 * 60; // 10 mins
  const cooldownDuration = 10 * 60; // 10 mins
  const totalSeconds = minutes * 60;

  const getPowerRange = (pctMin: number, pctMax: number) => ({
    min: Math.round(ftp * pctMin),
    max: Math.round(ftp * pctMax)
  });
  const getHRRange = (pctMin: number, pctMax: number) => ({
    min: Math.round(lthr * pctMin),
    max: Math.round(lthr * pctMax)
  });

  // Warmup
  const wuPower = getPowerRange(0.50, 0.60);
  const wuHR = getHRRange(0.60, 0.70);
  steps.push({
    index: 0,
    type: 'warmup',
    duration_seconds: warmupDuration,
    target_power_min: wuPower.min,
    target_power_max: wuPower.max,
    target_hr_min: wuHR.min,
    target_hr_max: wuHR.max,
    target_cadence_min: 90,
    target_cadence_max: 98,
    audio_notes: 'Start de warming-up. Laat de benen rustig warmdraaien.'
  });

  const mainDurationSec = totalSeconds - warmupDuration - cooldownDuration;

  if (goal === 'endurance') {
    title = `Duurtraining (${minutes} min)`;
    plannedTSS = Math.round(minutes * 0.60);
    notes = `Rustige Zone 2 vetverbrandingstraining van ${minutes} minuten.`;
    
    const endPower = getPowerRange(0.56, 0.70);
    const endHR = getHRRange(0.65, 0.78);
    steps.push({
      index: 1,
      type: 'work',
      duration_seconds: mainDurationSec,
      target_power_min: endPower.min,
      target_power_max: endPower.max,
      target_hr_min: endHR.min,
      target_hr_max: endHR.max,
      target_cadence_min: 88,
      target_cadence_max: 95,
      audio_notes: `Blijf constant in Zone 2 rijden tussen ${endPower.min} en ${endPower.max} Watt.`
    });
  } else if (goal === 'climbing') {
    title = `Klimmerstraining (${minutes} min)`;
    
    let intervalCount = 2;
    let intervalDuration = 10 * 60; 
    if (minutes >= 90) {
      intervalCount = 3;
      intervalDuration = 12 * 60;
    } else if (minutes >= 120) {
      intervalCount = 4;
      intervalDuration = 15 * 60;
    }
    
    const workPower = getPowerRange(0.85, 0.93); // Sweetspot
    const workHR = getHRRange(0.85, 0.95);
    const recPower = getPowerRange(0.50, 0.55);
    const recHR = getHRRange(0.60, 0.70);
    
    let currentIdx = 1;
    let accumulatedWorkSec = 0;
    
    for (let i = 0; i < intervalCount; i++) {
      steps.push({
        index: currentIdx++,
        type: 'work',
        duration_seconds: intervalDuration,
        target_power_min: workPower.min,
        target_power_max: workPower.max,
        target_hr_min: workHR.min,
        target_hr_max: workHR.max,
        target_cadence_min: 75,
        target_cadence_max: 82,
        audio_notes: `Start sweetspot-klim van ${intervalDuration / 60} minuten op ${workPower.min} Watt.`
      });
      accumulatedWorkSec += intervalDuration;
      
      if (i < intervalCount - 1) {
        steps.push({
          index: currentIdx++,
          type: 'recover',
          duration_seconds: 5 * 60,
          target_power_min: recPower.min,
          target_power_max: recPower.max,
          target_hr_min: recHR.min,
          target_hr_max: recHR.max,
          target_cadence_min: 90,
          target_cadence_max: 95,
          audio_notes: '5 minuten rust. Benen rustig losdraaien.'
        });
        accumulatedWorkSec += 5 * 60;
      }
    }
    
    const remainingSec = mainDurationSec - accumulatedWorkSec;
    if (remainingSec > 60) {
      const endPower = getPowerRange(0.56, 0.70);
      const endHR = getHRRange(0.65, 0.78);
      steps.push({
        index: currentIdx++,
        type: 'work',
        duration_seconds: remainingSec,
        target_power_min: endPower.min,
        target_power_max: endPower.max,
        target_hr_min: endHR.min,
        target_hr_max: endHR.max,
        target_cadence_min: 88,
        target_cadence_max: 95,
        audio_notes: 'Vlak uitfietsen in Zone 2.'
      });
    }
    
    plannedTSS = Math.round(minutes * 0.72);
    notes = `Klimkrachttraining met ${intervalCount} sweetspot blokken.`;
  } else if (goal === 'speed') {
    title = `Sprints & Explosiviteit (${minutes} min)`;
    
    let sprintCount = 6;
    if (minutes >= 90) sprintCount = 8;
    
    const sprintPower = getPowerRange(1.30, 1.60);
    const recPower = getPowerRange(0.50, 0.55);
    const recHR = getHRRange(0.60, 0.70);
    
    let currentIdx = 1;
    let accumulatedWorkSec = 0;
    
    for (let i = 0; i < sprintCount; i++) {
      steps.push({
        index: currentIdx++,
        type: 'work',
        duration_seconds: 30,
        target_power_min: sprintPower.min,
        target_power_max: sprintPower.max,
        target_hr_min: 0,
        target_hr_max: 999,
        target_cadence_min: 100,
        target_cadence_max: 120,
        audio_notes: `Sprint ${i + 1}! 30 seconden voluit op hoge cadans!`
      });
      accumulatedWorkSec += 30;
      
      steps.push({
        index: currentIdx++,
        type: 'recover',
        duration_seconds: 4 * 60 + 30,
        target_power_min: recPower.min,
        target_power_max: recPower.max,
        target_hr_min: recHR.min,
        target_hr_max: recHR.max,
        target_cadence_min: 90,
        target_cadence_max: 95,
        audio_notes: 'Rust en herstel.'
      });
      accumulatedWorkSec += 4 * 60 + 30;
    }
    
    const remainingSec = mainDurationSec - accumulatedWorkSec;
    if (remainingSec > 60) {
      const endPower = getPowerRange(0.56, 0.70);
      const endHR = getHRRange(0.65, 0.78);
      steps.push({
        index: currentIdx++,
        type: 'work',
        duration_seconds: remainingSec,
        target_power_min: endPower.min,
        target_power_max: endPower.max,
        target_hr_min: endHR.min,
        target_hr_max: endHR.max,
        target_cadence_min: 88,
        target_cadence_max: 95,
        audio_notes: 'Rustig Zone 2 uitrijden.'
      });
    }
    
    plannedTSS = Math.round(minutes * 0.68);
    notes = `Snelheidstraining met ${sprintCount} anaerobe sprints.`;
  } else {
    title = `Tempo Conditietraining (${minutes} min)`;
    
    let tempoCount = 2;
    let tempoDuration = 12 * 60;
    if (minutes >= 90) {
      tempoCount = 3;
      tempoDuration = 15 * 60;
    }
    
    const workPower = getPowerRange(0.76, 0.84);
    const workHR = getHRRange(0.80, 0.89);
    const recPower = getPowerRange(0.50, 0.55);
    const recHR = getHRRange(0.60, 0.70);
    
    let currentIdx = 1;
    let accumulatedWorkSec = 0;
    
    for (let i = 0; i < tempoCount; i++) {
      steps.push({
        index: currentIdx++,
        type: 'work',
        duration_seconds: tempoDuration,
        target_power_min: workPower.min,
        target_power_max: workPower.max,
        target_hr_min: workHR.min,
        target_hr_max: workHR.max,
        target_cadence_min: 85,
        target_cadence_max: 92,
        audio_notes: `Start tempoblok ${i + 1} van ${tempoDuration / 60} minuten op ${workPower.min} Watt.`
      });
      accumulatedWorkSec += tempoDuration;
      
      if (i < tempoCount - 1) {
        steps.push({
          index: currentIdx++,
          type: 'recover',
          duration_seconds: 5 * 60,
          target_power_min: recPower.min,
          target_power_max: recPower.max,
          target_hr_min: recHR.min,
          target_hr_max: recHR.max,
          target_cadence_min: 90,
          target_cadence_max: 95,
          audio_notes: '5 minuten herstel.'
        });
        accumulatedWorkSec += 5 * 60;
      }
    }
    
    const remainingSec = mainDurationSec - accumulatedWorkSec;
    if (remainingSec > 60) {
      const endPower = getPowerRange(0.56, 0.70);
      const endHR = getHRRange(0.65, 0.78);
      steps.push({
        index: currentIdx++,
        type: 'work',
        duration_seconds: remainingSec,
        target_power_min: endPower.min,
        target_power_max: endPower.max,
        target_hr_min: endHR.min,
        target_hr_max: endHR.max,
        target_cadence_min: 88,
        target_cadence_max: 95,
        audio_notes: 'Zone 2 basis conditie uitrijden.'
      });
    }
    
    plannedTSS = Math.round(minutes * 0.70);
    notes = `Zone 3 Tempo training met ${tempoCount} blokken.`;
  }

  // Cooldown
  const cdPower = getPowerRange(0.50, 0.55);
  const cdHR = getHRRange(0.60, 0.68);
  steps.push({
    index: steps.length,
    type: 'cooldown',
    duration_seconds: cooldownDuration,
    target_power_min: cdPower.min,
    target_power_max: cdPower.max,
    target_hr_min: cdHR.min,
    target_hr_max: cdHR.max,
    target_cadence_min: 90,
    target_cadence_max: 95,
    audio_notes: 'Cool-down. Rijd rustig uit.'
  });

  return {
    id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date: new Date().toISOString().slice(0, 10),
    title,
    type: goal === 'climbing' ? 'sweetspot' : (goal === 'speed' ? 'vo2max' : (goal === 'endurance' ? 'endurance' : 'custom')),
    durationMinutes: minutes,
    plannedTSS,
    notes,
    steps
  };
}

  return (
    <div className="wd-coach-panel animate-slide-up">
      {/* 0. Doel-selectie widget */}
      <div className="wd-section-card wd-goal-selector">
        <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#a5b4fc', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🎯</span> Selecteer je Trainingsdoel
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {([
            { key: 'general',   label: '🍀 Algemeen',   desc: 'Conditie opbouwen' },
            { key: 'climbing',  label: '⛰️ Klimmen',    desc: 'Kracht & W/kg' },
            { key: 'speed',     label: '⚡ Snelheid',   desc: 'Sprint & Crit' },
            { key: 'endurance', label: '🚴 Endurance',  desc: 'Lange ritten' }
          ] as const).map(goal => {
            const isSelected = (profile.trainingGoal ?? 'general') === goal.key;
            return (
              <button
                key={goal.key}
                onClick={() => handleGoalChange(goal.key)}
                className={`wd-goal-btn ${isSelected ? 'active' : ''}`}
              >
                <span style={{ fontWeight: 800, fontSize: 13, display: 'block' }}>{goal.label}</span>
                <span style={{ fontSize: 9, opacity: 0.8 }}>{goal.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. AI Coach Welcome Header */}
      <div className="wd-coach-hero-banner">
        <div className="wd-coach-hero-avatar">
          <Brain size={34} strokeWidth={1.5} className="wd-coach-brain-glow" />
        </div>
        <div className="wd-coach-hero-content">
          <h3>Jouw AI Training Coach</h3>
          <p>{getGreetingMessage()}</p>
          <div className="wd-coach-hero-metrics">
            <span className="wd-coach-metric-tag" style={{ borderLeft: '2px solid #a5b4fc' }}>
              Fitheid (CTL): <strong style={{ color: '#a5b4fc', fontSize: 12 }}>{Math.round(pmcStatus.latest.ctl)}</strong>
            </span>
            <span className="wd-coach-metric-tag" style={{ borderLeft: '2px solid #ff7675' }}>
              Vermoeidheid (ATL): <strong style={{ color: '#ff7675', fontSize: 12 }}>{Math.round(pmcStatus.latest.atl)}</strong>
            </span>
            <span className="wd-coach-metric-tag" style={{ borderLeft: `2px solid ${pmcStatus.tsbStatus.color}` }}>
              Vorm (TSB): <strong style={{ color: pmcStatus.tsbStatus.color, fontSize: 12 }}>{Math.round(pmcStatus.latest.tsb)}</strong>
              <span style={{ opacity: 0.7, fontSize: 9 }}>({pmcStatus.tsbStatus.label})</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── AI DAGTRAINING GENERATOR WIDGET ─── */}
      <div className="wd-section-card" style={{ background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.05) 0%, rgba(165, 180, 252, 0.02) 100%)', border: '1px solid rgba(108, 92, 231, 0.15)', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 15, fontWeight: 900, color: '#fff', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: '#a5b4fc', filter: 'drop-shadow(0 0 4px rgba(165, 180, 252, 0.5))' }} /> AI Dagtraining Generator
        </h3>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
          Genereer direct een gestructureerde training voor vandaag op basis van uw trainingsdoel, fitheid en beschikbare tijd.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase' }}>Beschikbare Tijd</span>
            <select 
              value={genMinutes} 
              onChange={(e) => {
                setGenMinutes(parseInt(e.target.value));
                setGeneratedWorkout(null);
              }}
              style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
            >
              <option value={45}>45 minuten</option>
              <option value={60}>60 minuten (1 uur)</option>
              <option value={75}>75 minuten (1u 15m)</option>
              <option value={90}>90 minuten (1,5 uur)</option>
              <option value={120}>120 minuten (2 uur)</option>
              <option value={150}>150 minuten (2,5 uur)</option>
              <option value={180}>180 minuten (3 uur)</option>
            </select>
          </div>

          <button 
            onClick={handleGenerateDailyWorkout}
            style={{ 
              marginTop: 18,
              background: 'linear-gradient(135deg, #a5b4fc 0%, #6c5ce7 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              padding: '10px 18px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(165, 180, 252, 0.15)',
              fontFamily: 'inherit',
              transition: 'transform 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
          >
            Genereer Training
          </button>
        </div>

        {saveSuccessMsg && (
          <div style={{ 
            padding: '10px 14px', 
            borderRadius: 8, 
            fontSize: 12, 
            fontWeight: 700,
            background: saveSuccessMsg.startsWith('✓') ? 'rgba(57, 255, 20, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${saveSuccessMsg.startsWith('✓') ? 'rgba(57, 255, 20, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: saveSuccessMsg.startsWith('✓') ? '#39ff14' : '#f87171',
            marginBottom: 16
          }}>
            {saveSuccessMsg} {saveSuccessMsg.startsWith('✓') && (
              <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: '#cbd5e1', marginTop: 4 }}>
                Open de <strong>Routeplanner</strong>-tab om een bijbehorende GPX-route met dynamische snelheidsdoelen te genereren!
              </span>
            )}
          </div>
        )}

        {generatedWorkout && (
          <div className="animate-slide-up" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
              <div>
                <span style={{ fontSize: 9, fontWeight: 900, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.8px' }}>AI Trainingsvoorstel</span>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>{generatedWorkout.title}</h4>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                <span>Duur: <strong style={{ color: '#a5b4fc' }}>{generatedWorkout.durationMinutes} min</strong></span>
                <span style={{ color: '#64748b' }}>|</span>
                <span>TSS: <strong style={{ color: '#ff7675' }}>{generatedWorkout.plannedTSS}</strong></span>
              </div>
            </div>

            <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 12px' }}>{generatedWorkout.notes}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {generatedWorkout.steps?.map((step: any, idx: number) => {
                let badgeColor = '#64748b';
                if (step.type === 'warmup') badgeColor = '#74b9ff';
                else if (step.type === 'work') badgeColor = '#ff7675';
                else if (step.type === 'recover') badgeColor = '#55efc4';
                else if (step.type === 'cooldown') badgeColor = '#a29bfe';

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <span style={{ 
                        fontSize: 8, 
                        fontWeight: 900, 
                        textTransform: 'uppercase', 
                        background: badgeColor + '1a', 
                        color: badgeColor, 
                        border: `1px solid ${badgeColor}33`,
                        padding: '2px 6px',
                        borderRadius: 4,
                        minWidth: 50,
                        textAlign: 'center'
                      }}>
                        {step.type}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>{Math.round(step.duration_seconds / 60)} min</span>
                      <span style={{ color: '#64748b' }}>|</span>
                      <span style={{ color: '#94a3b8' }}>
                        Doel: {step.target_power_min > 0 ? `${step.target_power_min}-${step.target_power_max}W` : 'Maximaal'}
                        {step.target_hr_min > 0 && ` (${step.target_hr_min}-${step.target_hr_max} bpm)`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setGeneratedWorkout(null)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#cbd5e1', fontSize: 11, fontWeight: 700, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Annuleren
              </button>
              <button 
                onClick={handleSaveGeneratedWorkout}
                disabled={isSavingWorkout}
                style={{ background: 'linear-gradient(135deg, #a5b4fc 0%, #39ff14 100%)', border: 'none', borderRadius: 8, color: '#09090b', fontSize: 11, fontWeight: 800, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {isSavingWorkout ? 'Opslaan...' : 'Accepteren & Opslaan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1.5 Dynamisch Wekelijks Trainingsplan */}
      <div className="wd-section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: '#a29bfe', letterSpacing: '1px' }}>Aanbevolen trainingsplan</span>
            <h4 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>{weeklyPlan.title}</h4>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#cbd5e1' }}>Richtlijn: <strong style={{ color: '#a5b4fc' }}>~{weeklyPlan.hours} uur/week</strong></span>
            <span style={{ color: '#64748b' }}>|</span>
            <span style={{ color: '#cbd5e1' }}>TSS doel: <strong style={{ color: '#ff7675' }}>{weeklyPlan.tss}</strong></span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 14px' }}>{weeklyPlan.description}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weeklyPlan.workouts.map((w, idx) => (
            <div key={idx} className="wd-plan-workout-item">
              <span style={{ color: '#a5b4fc', fontWeight: 900, fontSize: 14 }}>✓</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Categorie Filters */}
      <div className="wd-coach-filters">
        {([
          { label: 'Alle Adviezen', value: 'all', count: advice.length },
          { label: 'Training', value: 'training', count: advice.filter(a => a.category === 'training').length },
          { label: 'Herstel', value: 'herstel', count: advice.filter(a => a.category === 'herstel').length },
          { label: 'Mijlpalen & Doelen', value: 'doel', count: advice.filter(a => a.category === 'doel').length },
          { label: 'Waarschuwingen', value: 'waarschuwing', count: advice.filter(a => a.category === 'waarschuwing').length }
        ] as const).map(btn => (
          <button
            key={btn.value}
            className={`wd-coach-filter-btn ${activeFilter === btn.value ? 'active' : ''}`}
            onClick={() => setActiveFilter(btn.value)}
          >
            {btn.label} <span className="wd-coach-filter-badge">{btn.count}</span>
          </button>
        ))}
      </div>

      {/* 3. Advieskaarten Lijst */}
      {filteredAdvice.length === 0 ? (
        <div className="wd-coach-empty-state">
          <CheckCircle2 size={24} strokeWidth={1.5} style={{ color: '#39ff14', marginBottom: 8 }} />
          <p>Geen openstaande adviezen in deze categorie. Goed bezig!</p>
        </div>
      ) : (
        <div className="wd-coach-list">
          {filteredAdvice.map((a, i) => {
            const isUrgent = a.priority === 1;
            return (
              <div 
                key={i} 
                className={`wd-coach-card ${isUrgent ? 'wd-coach-card--urgent' : ''}`} 
                style={{ borderLeftColor: a.color }}
              >
                <div className="wd-coach-card__head">
                  <span className="wd-coach-card__icon">{a.icon}</span>
                  <span className="wd-coach-card__title" style={{ color: a.color }}>{a.title}</span>
                  <span className={`wd-coach-card__cat wd-coach-cat--${a.category}`}>{a.category}</span>
                </div>
                <p className="wd-coach-card__body">{a.body}</p>
                {a.action && (
                  <div className="wd-coach-card__action">
                    <Sparkles size={11} strokeWidth={1.6} style={{ color: '#a5b4fc', marginRight: 4 }} />
                    <span>Actiepunt: <strong>{a.action}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Brandstof Calculator */}
      <div className="wd-fuel-calculator" style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Coffee size={16} strokeWidth={1.6} style={{ color: '#a5b4fc' }} /> Brandstof & Voeding Planner (Toekomstige Ritten)
        </h3>
        
        <div className="wd-fuel-calc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Controls */}
          <div className="wd-fuel-calc-controls" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>Geplande Duur</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={plannedHours} onChange={(e) => setPlannedHours(parseInt(e.target.value))} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                  {[...Array(12).keys()].map(h => <option key={h} value={h} style={{ background: '#09090b' }}>{h} uur</option>)}
                </select>
                <select value={plannedMinutes} onChange={(e) => setPlannedMinutes(parseInt(e.target.value))} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                  {[0, 15, 30, 45].map(m => <option key={m} value={m} style={{ background: '#09090b' }}>{m} min</option>)}
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>Verwachte Intensiteit</label>
              <select value={selectedIntensity} onChange={(e) => setSelectedIntensity(parseInt(e.target.value))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                <option value={1} style={{ background: '#09090b' }}>Zone 1 — Actief Herstel (30g carbs/u)</option>
                <option value={2} style={{ background: '#09090b' }}>Zone 2 — Duurtraining (60g carbs/u)</option>
                <option value={3} style={{ background: '#09090b' }}>Zone 3 — Tempo Training (80g carbs/u)</option>
                <option value={4} style={{ background: '#09090b' }}>Zone 4 — Threshold / FTP (90g carbs/u)</option>
                <option value={5} style={{ background: '#09090b' }}>Zone 5 — VO2Max / Intervallen (100g carbs/u)</option>
              </select>
            </div>
            
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
                <label>Buitentemperatuur</label>
                <span>{plannedTemperature}°C</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={plannedTemperature}
                onChange={(e) => setPlannedTemperature(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#a5b4fc', background: 'rgba(255,255,255,0.05)' }}
              />
            </div>
          </div>
          
          {/* Results Card */}
          <div className="wd-fuel-calc-results" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#a5b4fc', letterSpacing: '0.8px' }}>Voedingsadvies & Brandstofplan</span>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Metabole Energie</span>
                <strong style={{ fontSize: 14, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Flame size={13} style={{ color: '#ff7675' }} /> {calculatorFuel.totalCalories} kcal
                </strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Koolhydraten</span>
                <strong style={{ fontSize: 14, color: '#39ff14', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={13} style={{ color: '#39ff14' }} /> {calculatorFuel.totalCarbs}g
                </strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Vochtbehoefte</span>
                <strong style={{ fontSize: 14, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Droplets size={13} style={{ color: '#a5b4fc' }} /> {(calculatorFuel.totalFluid / 1000).toFixed(1)}L
                </strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Natriumbehoefte</span>
                <strong style={{ fontSize: 14, color: '#ff9f43', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sliders size={13} style={{ color: '#ff9f43' }} /> {calculatorFuel.totalSodium} mg
                </strong>
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 4, paddingTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: 8 }}>Boodschappenlijst voor deze rit:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🍼 Bidons Sportdrank (500ml, 40g carbs):</span>
                  <strong style={{ color: '#f8fafc', fontSize: 12 }}>{calculatorFuel.bottles}x</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🍫 Energierepen (elk 30g carbs):</span>
                  <strong style={{ color: '#f8fafc', fontSize: 12 }}>{calculatorFuel.bars}x</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⚡ Energiegels (elk 30g carbs):</span>
                  <strong style={{ color: '#f8fafc', fontSize: 12 }}>{calculatorFuel.gels}x</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
