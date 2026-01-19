-- 1. PROFILES TABLE
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text,
  phone text,
  linkedin_url text,
  summary text,
  profile_picture_url text,
  headline_role text,
  skills text[] DEFAULT '{}',
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. EDUCATION TABLE
CREATE TABLE public.education (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  institution text NOT NULL,
  degree text,
  field_of_study text,
  year text,
  logo_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own education" ON public.education
  FOR ALL USING (auth.uid() = profile_id);

-- 3. EXPERIENCE TABLE
CREATE TABLE public.experience (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company text NOT NULL,
  role text NOT NULL,
  dates text,
  duration text,
  location text,
  description text,
  logo_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own experience" ON public.experience
  FOR ALL USING (auth.uid() = profile_id);

-- 4. APPLICATIONS TABLE
CREATE TABLE public.applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  job_title text NOT NULL,
  company text NOT NULL,
  job_details jsonb NOT NULL DEFAULT '{}',
  tailored_resume jsonb NOT NULL DEFAULT '{}',
  status text DEFAULT 'Draft',
  match_score int DEFAULT 0,
  notes text,
  description text,
  about_the_role text,
  responsibilities text,
  requirements text,
  nice_to_have text,
  hq_address text,
  posted_on text,
  logo_url text,
  job_resume text,
  location text,
  employment_status text,
  experience_level text,
  job_url text,
  industries text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own applications" ON public.applications
  FOR ALL USING (auth.uid() = profile_id);

-- 5. FUNCTION & TRIGGER FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();