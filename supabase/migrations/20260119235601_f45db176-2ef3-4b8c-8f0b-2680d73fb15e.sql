-- Create Skills Table
CREATE TABLE public.skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Security
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own skills" ON public.skills
  FOR ALL USING (auth.uid() = profile_id);

-- Remove skills column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS skills;