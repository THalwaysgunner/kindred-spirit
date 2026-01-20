-- =============================================
-- SMART JOB CACHING SYSTEM - DATABASE SCHEMA
-- =============================================

-- 1. JOBS TABLE - Individual job storage with deduplication
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_url text UNIQUE NOT NULL,
  job_id text,
  job_title text NOT NULL,
  company text NOT NULL,
  company_url text,
  location text,
  work_type text,
  salary text,
  description text,
  requirements text,
  benefits jsonb DEFAULT '[]',
  skills jsonb DEFAULT '[]',
  is_easy_apply boolean DEFAULT false,
  applicant_count integer,
  posted_at timestamp with time zone,
  posted_at_text text,
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'),
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for jobs table
CREATE INDEX idx_jobs_expires_at ON public.jobs(expires_at);
CREATE INDEX idx_jobs_posted_at ON public.jobs(posted_at DESC);
CREATE INDEX idx_jobs_job_title_gin ON public.jobs USING gin(to_tsvector('english', job_title));
CREATE INDEX idx_jobs_location ON public.jobs(location);
CREATE INDEX idx_jobs_work_type ON public.jobs(work_type);
CREATE INDEX idx_jobs_company ON public.jobs(company);
CREATE INDEX idx_jobs_is_easy_apply ON public.jobs(is_easy_apply);

-- RLS for jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jobs" 
ON public.jobs FOR SELECT 
USING (true);

CREATE POLICY "Service role manages jobs" 
ON public.jobs FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. SEARCH_TERMS TABLE - Query normalization and popularity tracking
CREATE TABLE public.search_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_term text NOT NULL,
  canonical_term text NOT NULL,
  location text DEFAULT '',
  filters jsonb DEFAULT '{}',
  search_count integer DEFAULT 1,
  last_searched_at timestamp with time zone DEFAULT now(),
  last_fetched_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(raw_term, location)
);

-- Indexes for search_terms
CREATE INDEX idx_search_terms_count ON public.search_terms(search_count DESC);
CREATE INDEX idx_search_terms_canonical ON public.search_terms(canonical_term);
CREATE INDEX idx_search_terms_last_fetched ON public.search_terms(last_fetched_at);
CREATE INDEX idx_search_terms_last_searched ON public.search_terms(last_searched_at DESC);

-- RLS for search_terms
ALTER TABLE public.search_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read search_terms" 
ON public.search_terms FOR SELECT 
USING (true);

CREATE POLICY "Service role manages search_terms" 
ON public.search_terms FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. JOB_SEARCH_LINKS TABLE - Many-to-many relationship
CREATE TABLE public.job_search_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  search_term_id uuid REFERENCES public.search_terms(id) ON DELETE CASCADE NOT NULL,
  relevance_score integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(job_id, search_term_id)
);

-- Indexes for job_search_links
CREATE INDEX idx_job_search_links_search_term ON public.job_search_links(search_term_id);
CREATE INDEX idx_job_search_links_job ON public.job_search_links(job_id);

-- RLS for job_search_links
ALTER TABLE public.job_search_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read job_search_links" 
ON public.job_search_links FOR SELECT 
USING (true);

CREATE POLICY "Service role manages job_search_links" 
ON public.job_search_links FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. FUNCTION: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for jobs updated_at
CREATE TRIGGER trigger_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_jobs_updated_at();

-- 5. Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: pg_cron is already enabled by default in Supabase