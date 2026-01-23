-- 1. COMPANY OVERVIEW TABLE
CREATE TABLE public.company_overview (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text UNIQUE NOT NULL,
  name text NOT NULL,
  website text,
  rating numeric(3,2),
  headquarters_location text,
  logo text,
  company_size text,
  company_description text,
  industry text,
  ceo_rating numeric(3,2),
  compensation_and_benefits_rating numeric(3,2),
  culture_and_values_rating numeric(3,2),
  diversity_and_inclusion_rating numeric(3,2),
  recommend_to_friend_rating numeric(3,2),
  senior_management_rating numeric(3,2),
  work_life_balance_rating numeric(3,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. COMPANY REVIEWS TABLE
CREATE TABLE public.company_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  job_title text,
  review_id text UNIQUE,
  review_datetime timestamp with time zone,
  summary text,
  pros text,
  cons text,
  rating numeric(3,2),
  employment_status text,
  years_of_employment text,
  location text,
  advice_to_management text,
  business_outlook_rating numeric(3,2),
  career_opportunities_rating numeric(3,2),
  compensation_and_benefits_rating numeric(3,2),
  culture_and_values_rating numeric(3,2),
  recommend_to_friend_rating numeric(3,2),
  senior_management_rating numeric(3,2),
  work_life_balance_rating numeric(3,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. COMPANY SALARIES TABLE
CREATE TABLE public.company_salaries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  location text,
  job_title text,
  job_title_id text,
  salary_currency text DEFAULT 'USD',
  salary_count integer,
  salary_period text DEFAULT 'YEAR',
  min_salary numeric(12,2),
  median_salary numeric(12,2),
  max_salary numeric(12,2),
  min_base_salary numeric(12,2),
  median_base_salary numeric(12,2),
  max_base_salary numeric(12,2),
  min_additional_pay numeric(12,2),
  median_additional_pay numeric(12,2),
  max_additional_pay numeric(12,2),
  min_cash_bonus numeric(12,2),
  median_cash_bonus numeric(12,2),
  max_cash_bonus numeric(12,2),
  min_stock_bonus numeric(12,2),
  median_stock_bonus numeric(12,2),
  max_stock_bonus numeric(12,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. COMPANY INTERVIEWS TABLE
CREATE TABLE public.company_interviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  interview_id text UNIQUE,
  job_title text,
  location text,
  review_datetime timestamp with time zone,
  process_description text,
  difficulty text,
  outcome text,
  experience text,
  questions jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.company_overview ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_interviews ENABLE ROW LEVEL SECURITY;

-- Public read policies (anyone can read company data)
CREATE POLICY "Anyone can read company overview" ON public.company_overview FOR SELECT USING (true);
CREATE POLICY "Anyone can read company reviews" ON public.company_reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can read company salaries" ON public.company_salaries FOR SELECT USING (true);
CREATE POLICY "Anyone can read company interviews" ON public.company_interviews FOR SELECT USING (true);

-- Service role can manage all data
CREATE POLICY "Service role manages company overview" ON public.company_overview FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages company reviews" ON public.company_reviews FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages company salaries" ON public.company_salaries FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages company interviews" ON public.company_interviews FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Create indexes for faster lookups
CREATE INDEX idx_company_overview_company_id ON public.company_overview(company_id);
CREATE INDEX idx_company_reviews_company_id ON public.company_reviews(company_id);
CREATE INDEX idx_company_salaries_company_id ON public.company_salaries(company_id);
CREATE INDEX idx_company_interviews_company_id ON public.company_interviews(company_id);