-- Fix: restore user-profile skills table that the app expects
-- 1) Preserve imported O*NET table by renaming it away from `public.skills`
DO $$
BEGIN
  IF to_regclass('public.skills') IS NOT NULL AND to_regclass('public.onet_skills') IS NULL THEN
    ALTER TABLE public.skills RENAME TO onet_skills;
  END IF;
END $$;

-- 2) Recreate the user skills table used by the Profile UI
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3) Security: RLS so each user only sees/edits their own skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own skills" ON public.skills;
CREATE POLICY "Users can manage their own skills"
  ON public.skills
  FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- 4) Performance
CREATE INDEX IF NOT EXISTS idx_skills_profile_id ON public.skills(profile_id);