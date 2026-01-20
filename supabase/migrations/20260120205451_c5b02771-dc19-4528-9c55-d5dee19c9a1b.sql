-- Add unique constraint on job_url to prevent duplicates
ALTER TABLE public.jobs ADD CONSTRAINT jobs_job_url_unique UNIQUE (job_url);

-- Also add unique constraint on job_search_links to prevent duplicate links
ALTER TABLE public.job_search_links ADD CONSTRAINT job_search_links_unique UNIQUE (job_id, search_term_id);