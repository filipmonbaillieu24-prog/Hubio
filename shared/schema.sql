-- ==========================================
-- ZENITH ECOSYSTEM DATABASE SCHEMA (SUPABASE)
-- ==========================================
-- This file defines the tables, relations, constraints, and Row Level Security (RLS)
-- policies for the shared Supabase PostgreSQL database of the Zenith Ecosystem.
-- Both Pilot (mobile) and Aero (desktop) connect to this schema.

-- ------------------------------------------
-- 1. RIDES TABLE
-- Stores summaries and GPS point data of completed cycling rides.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.rides (
  id TEXT PRIMARY KEY,                           -- Unique ride ID (e.g. prefix + timestamp)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Owner reference
  name TEXT NOT NULL,                            -- Name of the ride
  date BIGINT NOT NULL,                          -- Timestamp of the ride in milliseconds
  distance NUMERIC NOT NULL,                     -- Total distance in kilometers
  duration INTEGER NOT NULL,                     -- Total duration in seconds
  elev_gain INTEGER NOT NULL,                    -- Total elevation gain in meters
  avg_speed NUMERIC NOT NULL,                    -- Average speed in km/h
  avg_power INTEGER,                             -- Average power in Watts (null if no power meter)
  avg_hr INTEGER,                                -- Average heart rate in bpm (null if no HR strap)
  has_power BOOLEAN NOT NULL,                    -- True if power data is recorded
  has_hr BOOLEAN NOT NULL,                       -- True if heart rate data is recorded
  has_gps BOOLEAN NOT NULL,                      -- True if GPS coordinate points are recorded
  points JSONB,                                  -- List of RoutePoints (time, lat, lng, ele, distance)
  best_efforts JSONB,                            -- Mapped best power efforts (e.g. 5s, 1m, 5m, 20m)
  best_speed_efforts JSONB,                      -- Mapped best speed efforts
  metadata JSONB                                 -- Miscellaneous properties (gearId, weather, notes)
);

-- Enable RLS for rides
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.rides
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated insert" ON public.rides
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated update" ON public.rides
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated delete" ON public.rides
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ------------------------------------------
-- 2. GEAR TABLE
-- Tracks bikes and equipment components to monitor mileage.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.gear (
  id TEXT PRIMARY KEY,                           -- Unique equipment ID
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Owner reference
  name TEXT NOT NULL,                            -- Name of the bike/gear (e.g. "Trek Madone")
  type TEXT NOT NULL,                            -- Type of gear (e.g. "road", "gravel", "mtb")
  brand TEXT,                                    -- Brand name
  model TEXT,                                    -- Model name
  weight NUMERIC,                                -- Weight of the gear in kilograms
  active BOOLEAN NOT NULL,                       -- True if this gear is currently in use
  components JSONB NOT NULL                      -- List of components (chains, tires, with mileage)
);

-- Enable RLS for gear
ALTER TABLE public.gear ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.gear
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated insert" ON public.gear
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated update" ON public.gear
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated delete" ON public.gear
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ------------------------------------------
-- 3. PLANNED WORKOUTS TABLE
-- Calendar items representing planned workouts (structured steps + routes).
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.planned_workouts (
  id TEXT PRIMARY KEY,                           -- Unique planned item ID
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Owner reference
  date TEXT NOT NULL,                            -- Target date of training (YYYY-MM-DD format)
  title TEXT NOT NULL,                           -- Title of the workout
  type TEXT NOT NULL,                            -- Workout type (recovery, endurance, sweetspot, etc.)
  duration_minutes INTEGER NOT NULL,             -- Planned workout duration in minutes
  planned_tss INTEGER NOT NULL,                  -- Planned Training Stress Score
  notes TEXT,                                    -- Notes / Coach instructions
  steps JSONB,                                   -- Structured workout steps (warmup, intervals, recovery)
  route_id TEXT,                                 -- Reference to public.routes table (nullable)
  created_at TIMESTAMPTZ DEFAULT now(),          -- Auto-generated creation timestamp
  ftp INTEGER,                                   -- FTP of the user at the time of planning
  lthr INTEGER,                                  -- LTHR of the user at the time of planning
  completed_at TIMESTAMPTZ                       -- Timestamp when this planned item was marked completed
);

-- Enable RLS for planned_workouts
ALTER TABLE public.planned_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own planned workouts" ON public.planned_workouts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------
-- 4. ROUTES TABLE
-- Generated and saved training route points for navigations.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.routes (
  id TEXT PRIMARY KEY,                           -- Unique route ID
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Owner reference
  name TEXT NOT NULL,                            -- Name of the route (e.g. "Hilly ride")
  distance NUMERIC NOT NULL,                     -- Total distance in kilometers
  duration NUMERIC NOT NULL,                     -- Estimated duration in seconds
  elev_gain NUMERIC NOT NULL,                    -- Total elevation gain in meters
  points JSONB NOT NULL,                         -- Mapped RoutePoints (lat, lng, ele, distance)
  created_at TIMESTAMPTZ DEFAULT now()           -- Auto-generated creation timestamp
);

-- Enable RLS for routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own routes" ON public.routes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------
-- 5. KRATOS EXERCISES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.kratos_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,                           -- e.g. Quads, Chest, Lats, etc.
  notes TEXT,
  increment_weight NUMERIC NOT NULL DEFAULT 2.5,
  default_rir INTEGER NOT NULL DEFAULT 2,
  weight_unit TEXT NOT NULL DEFAULT 'kg',
  increment_per_side BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for kratos_exercises
ALTER TABLE public.kratos_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exercises" ON public.kratos_exercises
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------
-- 6. KRATOS TEMPLATES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.kratos_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  exercises JSONB NOT NULL,                          -- List of template exercises: [{exercise_id, sets: [{type, min_reps, max_reps, target_rir}]}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for kratos_templates
ALTER TABLE public.kratos_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own templates" ON public.kratos_templates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------
-- 7. KRATOS WORKOUTS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.kratos_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.kratos_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL,
  volume NUMERIC NOT NULL,                           -- Total weight * reps lifted
  cardio_stress_factor NUMERIC NOT NULL DEFAULT 1.0, -- Scale factor computed from Z-score (1.0 = normal, >1.0 = longer rest)
  sets JSONB NOT NULL,                               -- Performed sets detail: [{exercise_id, sets: [{type, weight, reps, rir, rest_seconds}]}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for kratos_workouts
ALTER TABLE public.kratos_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workouts" ON public.kratos_workouts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
