-- Create paired devices table
CREATE TABLE IF NOT EXISTS public.vigor_paired_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_type TEXT NOT NULL,       -- 'scale' | 'ring'
  brand TEXT NOT NULL,             -- 'Neo Health' | 'Colmi'
  model TEXT NOT NULL,             -- 'Onyx SE' | 'R02'
  auto_connect BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_device_model UNIQUE (user_id, device_type, brand, model)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vigor_paired_devices ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can manage their own paired devices" 
ON public.vigor_paired_devices
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
