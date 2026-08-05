import React, { useState } from 'react';
import '../workout.css';
import { FitnessProfile, RideSummaryWithBests } from '../types/workout';
import { SavedLocation } from '../types/route';
import { SubTab } from '../types/training';
import { useTrainingState } from '../hooks/useTrainingState';

import { CoachTab } from '../components/training/CoachTab';
import { PeriodizationTab } from '../components/training/PeriodizationTab';


import {
  Brain, Target
} from 'lucide-react';

interface TrainingPageProps {
  profile: FitnessProfile;
  onProfileChange: (p: FitnessProfile) => void;
  rides: RideSummaryWithBests[];
  kratosWorkouts?: any[];
  savedLocations: SavedLocation[];
  onGenerateTrainingsroute: (params: {
    lat: number;
    lng: number;
    durationMinutes: number;
    options: {
      profile: 'road' | 'gravel' | 'mtb';
      workoutType: 'recovery' | 'endurance' | 'sweetspot' | 'threshold';
    };
  }) => void;
  onActiveWorkoutChange: (workout: any | null) => void;
}

export const TrainingPage: React.FC<TrainingPageProps> = ({
  profile,
  onProfileChange,
  rides,
  kratosWorkouts = [],
  savedLocations,
  onGenerateTrainingsroute,
  onActiveWorkoutChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('coach');

  const state = useTrainingState(profile, rides, kratosWorkouts);

  const navItems = [
    { key: 'coach',         icon: <Brain size={13} />,    label: 'AI Coach' },
    { key: 'periodization', icon: <Target size={13} />,   label: 'Periodisering' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', padding: '24px 32px', boxSizing: 'border-box' }}>
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
              background: activeSubTab === item.key ? 'rgba(203, 213, 225, 0.1)' : 'transparent',
              color: activeSubTab === item.key ? '#cbd5e1' : '#94a3b8',
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
        {activeSubTab === 'coach' && (
          <CoachTab 
            rides={rides} 
            profile={profile} 
            onProfileChange={onProfileChange} 
            onActiveWorkoutChange={onActiveWorkoutChange}
            onGenerateTrainingsroute={onGenerateTrainingsroute}
            savedLocations={savedLocations}
          />
        )}

        {activeSubTab === 'periodization' && (
          <PeriodizationTab
            rides={rides}
            eventName={state.eventName}
            eventDate={state.eventDate}
            setEventName={state.setEventName}
            setEventDate={state.setEventDate}
            phaseInfo={state.phaseInfo}
            phase={state.phase}
            ridesByDay={state.ridesByDay}
            pmcData={state.pmcData}
          />
        )}
      </div>
    </div>
  );
};
