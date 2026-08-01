import { Sidebar } from '../Sidebar';
import { MapView } from '../MapView';
import { ElevationChart } from '../ElevationChart';
import { Loader } from '../Loader';
import { AlertTriangle, X } from 'lucide-react';
import { FitnessProfile } from '../../types/workout';
import {
  RoutePoint, RouteType, DirectionBias,
  WindData, GeneratedRoute, RouteOptions, SavedLocation
} from '../../types/route';

export interface RoutePageProps {
  fitnessProfile: FitnessProfile;
  savedLocations: SavedLocation[];
  onSaveLocation: (name: string, lat: number, lng: number) => void;
  onDeleteLocation: (id: string) => void;
  onRenameLocation: (id: string, name: string) => void;
  startPoint: [number, number] | null;
  endPoint: [number, number] | null;
  routes: GeneratedRoute[];
  activeRouteIndex: number;
  routeType: RouteType;
  setRouteType: (type: RouteType) => void;
  isGenerating: boolean;
  error: string | null;
  hoverPoint: RoutePoint | null;
  windData: WindData | null;
  windSlot: string;
  isFetchingWind: boolean;
  maxElevationGain: number;
  setMaxElevationGain: (value: number) => void;
  activeRoutePoints: RoutePoint[];
  onSetLocation: (lat: number, lng: number, type: 'start' | 'end') => void;
  onGenerate: (params: {
    type: RouteType;
    distance: number;
    direction: DirectionBias;
    options: RouteOptions;
  }) => Promise<void>;
  onDownloadGPX: () => Promise<void>;
  onDownloadTCX: () => Promise<void>;
  onMapClick: (lat: number, lng: number) => void;
  onSelectRoute: (index: number) => void;
  setWindSlot: (slot: string) => void;
  onCloseError: () => void;
  onHoverPoint: (point: RoutePoint | null) => void;
  activeWorkout: any | null;
}

export function RoutePage({
  fitnessProfile,
  savedLocations,
  onSaveLocation,
  onDeleteLocation,
  onRenameLocation,
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
  activeRoutePoints,
  onSetLocation,
  onGenerate,
  onDownloadGPX,
  onDownloadTCX,
  onMapClick,
  onSelectRoute,
  setWindSlot,
  onCloseError,
  onHoverPoint,
  activeWorkout,
}: RoutePageProps) {
  return (
    <>
      <Sidebar
        fitnessProfile={fitnessProfile}
        routes={routes}
        activeRouteIndex={activeRouteIndex}
        onSelectRoute={onSelectRoute}
        routeType={routeType}
        setRouteType={setRouteType}
        onGenerate={onGenerate}
        onDownloadGPX={onDownloadGPX}
        onDownloadTCX={onDownloadTCX}
        startPoint={startPoint}
        endPoint={endPoint}
        onSetLocation={onSetLocation}
        isGenerating={isGenerating}
        windData={windData}
        windSlot={windSlot}
        setWindSlot={setWindSlot}
        isFetchingWind={isFetchingWind}
        maxElevationGain={maxElevationGain}
        setMaxElevationGain={setMaxElevationGain}
        savedLocations={savedLocations}
        onSaveLocation={onSaveLocation}
        onDeleteLocation={onDeleteLocation}
        onRenameLocation={onRenameLocation}
      />

      <main className="main-content">
        <div className="map-wrapper">
          <MapView
            startPoint={startPoint}
            endPoint={endPoint}
            routes={routes}
            activeRouteIndex={activeRouteIndex}
            hoverPoint={hoverPoint}
            onMapClick={onMapClick}
            activeWorkout={activeWorkout}
          />
          {activeRoutePoints.length > 0 && (
            <ElevationChart points={activeRoutePoints} onHoverPoint={onHoverPoint} activeWorkout={activeWorkout} />
          )}
        </div>
      </main>

      {isGenerating && <Loader />}

      {error && (
        <div className="error-toast animate-slide-up">
          <AlertTriangle className="error-toast-icon" />
          <div className="error-toast-body">
            <h4>Foutmelding</h4>
            <p>{error}</p>
          </div>
          <button className="error-toast-close" onClick={onCloseError}><X size={16} /></button>
        </div>
      )}
    </>
  );
}
