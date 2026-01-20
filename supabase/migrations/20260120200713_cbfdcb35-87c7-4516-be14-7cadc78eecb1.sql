-- Create job search cache table for storing and sharing job results across users
CREATE TABLE public.job_search_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  search_hash text NOT NULL UNIQUE,
  keywords text,
  location text,
  filters jsonb DEFAULT '{}'::jsonb,
  jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_count int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + interval '6 hours') NOT NULL
);

-- Index for fast lookups by search hash
CREATE INDEX idx_job_search_cache_hash ON public.job_search_cache(search_hash);

-- Index for cleanup of expired entries
CREATE INDEX idx_job_search_cache_expires ON public.job_search_cache(expires_at);

-- Allow public read access (no auth needed for cached job searches)
ALTER TABLE public.job_search_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached results
CREATE POLICY "Anyone can read cached job searches"
ON public.job_search_cache
FOR SELECT
USING (true);

-- Only service role can insert/update/delete (edge function uses service role)
CREATE POLICY "Service role can manage cache"
ON public.job_search_cache
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');