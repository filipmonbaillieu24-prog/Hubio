import React, { useMemo, useState } from 'react';
import './CoachPanel.css';
import { RideSummaryWithBests, FitnessProfile } from '../../types/workout';
import { generateCoachAdvice } from '../../utils/coach';
import { computePMC, interpretTSB } from '../../utils/pmc';
import { Brain, Sparkles, CheckCircle2, Sliders, Coffee, Flame, Droplets } from 'lucide-react';
import { calculateFuel } from '../../utils/fueling';
import { TrainingGoal } from '../../types/workout';
import { AICoachChatWidget } from './AICoachChatWidget';

interface CoachPanelProps {
  rides: RideSummaryWithBests[];
  profile: FitnessProfile;
  onProfileChange: (p: FitnessProfile) => void;
}

type FilterCategory = 'all' | 'training' | 'herstel' | 'doel' | 'waarschuwing';

export const CoachPanel: React.FC<CoachPanelProps> = ({ rides, profile, onProfileChange }) => {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  
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
        <Brain size={32} strokeWidth={1.5} style={{ color: '#00e5ff', marginBottom: 12 }} />
        <p style={{ margin: 0 }}>Upload minimaal 2 ritten met hartslag- of vermogensgegevens om gepersonaliseerd AI-trainingsadvies te genereren.</p>
      </div>
    );
  }

  const handleGoalChange = (newGoal: TrainingGoal) => {
    onProfileChange({ ...profile, trainingGoal: newGoal });
  };

  return (
    <div className="wd-coach-panel animate-slide-up">
      {/* 0. Doel-selectie widget */}
      <div className="wd-section-card wd-goal-selector">
        <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#00e5ff', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <span className="wd-coach-metric-tag" style={{ borderLeft: '2px solid #00e5ff' }}>
              Fitheid (CTL): <strong style={{ color: '#00e5ff', fontSize: 12 }}>{Math.round(pmcStatus.latest.ctl)}</strong>
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

      {/* ─── INTERACTIEVE AI COACH CHAT WIDGET ─── */}
      <AICoachChatWidget profile={profile} rides={rides} />

      {/* 1.5 Dynamisch Wekelijks Trainingsplan */}
      <div className="wd-section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: '#a29bfe', letterSpacing: '1px' }}>Aanbevolen trainingsplan</span>
            <h4 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>{weeklyPlan.title}</h4>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#cbd5e1' }}>Richtlijn: <strong style={{ color: '#00e5ff' }}>~{weeklyPlan.hours} uur/week</strong></span>
            <span style={{ color: '#64748b' }}>|</span>
            <span style={{ color: '#cbd5e1' }}>TSS doel: <strong style={{ color: '#ff7675' }}>{weeklyPlan.tss}</strong></span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 14px' }}>{weeklyPlan.description}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weeklyPlan.workouts.map((w, idx) => (
            <div key={idx} className="wd-plan-workout-item">
              <span style={{ color: '#00e5ff', fontWeight: 900, fontSize: 14 }}>✓</span>
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
                    <Sparkles size={11} strokeWidth={1.6} style={{ color: '#00e5ff', marginRight: 4 }} />
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
          <Coffee size={16} strokeWidth={1.6} style={{ color: '#00e5ff' }} /> Brandstof & Voeding Planner (Toekomstige Ritten)
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
                style={{ width: '100%', accentColor: '#00e5ff', background: 'rgba(255,255,255,0.05)' }}
              />
            </div>
          </div>
          
          {/* Results Card */}
          <div className="wd-fuel-calc-results" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#00e5ff', letterSpacing: '0.8px' }}>Voedingsadvies & Brandstofplan</span>
            
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
                <strong style={{ fontSize: 14, color: '#00e5ff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Droplets size={13} style={{ color: '#00e5ff' }} /> {(calculatorFuel.totalFluid / 1000).toFixed(1)}L
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
