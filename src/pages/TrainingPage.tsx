import React, { useState } from 'react';
import '../workout.css';
import { FitnessProfile, RideSummaryWithBests } from '../types/workout';
import { SavedLocation } from '../types/route';
import { SubTab } from '../types/training';
import { useTrainingState } from '../hooks/useTrainingState';

import { CoachTab } from '../components/training/CoachTab';
import { SmartWorkoutTab } from '../components/training/SmartWorkoutTab';
import { WorkoutBuilderTab } from '../components/training/WorkoutBuilderTab';
import { PeriodizationTab } from '../components/training/PeriodizationTab';
import { ProgressPage } from './ProgressPage';
import { planWorkoutInCalendar } from '../utils/trainingHelpers';

import {
  Brain, Award, Sliders, Target, Activity
} from 'lucide-react';

interface TrainingPageProps {
  profile: FitnessProfile;
  onProfileChange: (p: FitnessProfile) => void;
  rides: RideSummaryWithBests[];
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
  savedLocations,
  onGenerateTrainingsroute,
  onActiveWorkoutChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('coach');

  const state = useTrainingState(profile, rides);

  const handleGenerateRoute = () => {
    let lat = 51.0, lng = 4.5;
    if (state.selectedStartLoc === 'default' && savedLocations.length > 0) {
      lat = savedLocations[0].lat;
      lng = savedLocations[0].lng;
    } else {
      const loc = savedLocations.find(l => l.id === state.selectedStartLoc);
      if (loc) { lat = loc.lat; lng = loc.lng; }
    }
    onActiveWorkoutChange(state.activeWorkout);
    const routeWType = (['recovery','endurance','sweetspot','threshold'].includes(state.effectiveType) ? state.effectiveType : 'threshold') as 'recovery'|'endurance'|'sweetspot'|'threshold';
    onGenerateTrainingsroute({
      lat,
      lng,
      durationMinutes: state.duration,
      options: { profile: state.intensityProfile, workoutType: routeWType }
    });
  };

  const navItems = [
    { key: 'coach',         icon: <Brain size={13} />,    label: 'AI Coach' },
    { key: 'smart',         icon: <Award size={13} />,    label: 'Slimme Trainingen' },
    { key: 'builder',       icon: <Sliders size={13} />,  label: 'Interval Builder' },
    { key: 'periodization', icon: <Target size={13} />,   label: 'Periodisering' },
    { key: 'profile',       icon: <Activity size={13} />, label: 'Fysiologisch Profiel' },
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
              background: activeSubTab === item.key ? 'rgba(165, 180, 252, 0.1)' : 'transparent',
              color: activeSubTab === item.key ? '#a5b4fc' : '#94a3b8',
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
          <CoachTab rides={rides} profile={profile} onProfileChange={onProfileChange} />
        )}

        {activeSubTab === 'smart' && (
          <SmartWorkoutTab
            {...state}
            savedLocations={savedLocations}
            handleGenerateRoute={handleGenerateRoute}
            profile={profile}
          />
        )}

        {activeSubTab === 'builder' && (
          <WorkoutBuilderTab
            profile={profile}
            customBlocks={state.customBlocks}
            customTitle={state.customTitle}
            customTotalMin={state.customTotalMin}
            customWorkout={state.customWorkout}
            buildPlanned={state.buildPlanned}
            addCustomBlock={state.addCustomBlock}
            updateBlock={state.updateBlock}
            removeBlock={state.removeBlock}
            setCustomTitle={state.setCustomTitle}
            planWorkoutInCalendar={planWorkoutInCalendar}
            setBuildPlanned={state.setBuildPlanned}
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

        {activeSubTab === 'profile' && (
          <ProgressPage profile={profile} rides={rides} />
        )}
      </div>
    </div>
  );
};
