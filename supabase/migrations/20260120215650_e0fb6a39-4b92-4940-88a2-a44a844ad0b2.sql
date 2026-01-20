-- O*NET Database Tables (Batch 1 of 10 files)

-- 1. content_model_reference (no FK)
CREATE TABLE public.content_model_reference (
  element_id VARCHAR(20) NOT NULL PRIMARY KEY,
  element_name VARCHAR(150) NOT NULL,
  description VARCHAR(1500) NOT NULL
);

-- 2. job_zone_reference (no FK)
CREATE TABLE public.job_zone_reference (
  job_zone SMALLINT NOT NULL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  experience VARCHAR(300) NOT NULL,
  education VARCHAR(500) NOT NULL,
  job_training VARCHAR(300) NOT NULL,
  examples VARCHAR(500) NOT NULL,
  svp_range VARCHAR(25) NOT NULL
);

-- 3. occupation_data (no FK)
CREATE TABLE public.occupation_data (
  onetsoc_code CHAR(10) NOT NULL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description VARCHAR(1000) NOT NULL
);

-- 4. scales_reference (no FK)
CREATE TABLE public.scales_reference (
  scale_id VARCHAR(3) NOT NULL PRIMARY KEY,
  scale_name VARCHAR(50) NOT NULL,
  minimum SMALLINT NOT NULL,
  maximum SMALLINT NOT NULL
);

-- 5. ete_categories (FK to content_model_reference, scales_reference)
CREATE TABLE public.ete_categories (
  element_id VARCHAR(20) NOT NULL,
  scale_id VARCHAR(3) NOT NULL,
  category SMALLINT NOT NULL,
  category_description VARCHAR(1000) NOT NULL,
  PRIMARY KEY (element_id, scale_id, category),
  FOREIGN KEY (element_id) REFERENCES public.content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES public.scales_reference(scale_id)
);

-- 6. level_scale_anchors (FK to content_model_reference, scales_reference)
CREATE TABLE public.level_scale_anchors (
  element_id VARCHAR(20) NOT NULL,
  scale_id VARCHAR(3) NOT NULL,
  anchor_value SMALLINT NOT NULL,
  anchor_description VARCHAR(1000) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES public.content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES public.scales_reference(scale_id)
);

-- 7. occupation_level_metadata (FK to occupation_data)
CREATE TABLE public.occupation_level_metadata (
  onetsoc_code CHAR(10) NOT NULL,
  item VARCHAR(150) NOT NULL,
  response VARCHAR(75),
  n SMALLINT,
  percent DECIMAL(4,1),
  date_updated DATE NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES public.occupation_data(onetsoc_code)
);

-- 8. survey_booklet_locations (FK to content_model_reference, scales_reference)
CREATE TABLE public.survey_booklet_locations (
  element_id VARCHAR(20) NOT NULL,
  scale_id VARCHAR(3) NOT NULL,
  survey_item_number VARCHAR(5) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES public.content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES public.scales_reference(scale_id)
);

-- 9. task_categories (FK to scales_reference)
CREATE TABLE public.task_categories (
  scale_id VARCHAR(3) NOT NULL,
  category SMALLINT NOT NULL,
  category_description VARCHAR(1000) NOT NULL,
  PRIMARY KEY (scale_id, category),
  FOREIGN KEY (scale_id) REFERENCES public.scales_reference(scale_id)
);

-- 10. work_context_categories (FK to content_model_reference, scales_reference)
CREATE TABLE public.work_context_categories (
  element_id VARCHAR(20) NOT NULL,
  scale_id VARCHAR(3) NOT NULL,
  category SMALLINT NOT NULL,
  category_description VARCHAR(1000) NOT NULL,
  PRIMARY KEY (element_id, scale_id, category),
  FOREIGN KEY (element_id) REFERENCES public.content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES public.scales_reference(scale_id)
);

-- Allow public read access (reference data)
ALTER TABLE public.content_model_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_zone_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupation_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scales_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ete_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_scale_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupation_level_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_booklet_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_context_categories ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "onet_content_read" ON public.content_model_reference FOR SELECT USING (true);
CREATE POLICY "onet_jobzone_read" ON public.job_zone_reference FOR SELECT USING (true);
CREATE POLICY "onet_occupation_read" ON public.occupation_data FOR SELECT USING (true);
CREATE POLICY "onet_scales_read" ON public.scales_reference FOR SELECT USING (true);
CREATE POLICY "onet_ete_read" ON public.ete_categories FOR SELECT USING (true);
CREATE POLICY "onet_anchors_read" ON public.level_scale_anchors FOR SELECT USING (true);
CREATE POLICY "onet_metadata_read" ON public.occupation_level_metadata FOR SELECT USING (true);
CREATE POLICY "onet_survey_read" ON public.survey_booklet_locations FOR SELECT USING (true);
CREATE POLICY "onet_task_read" ON public.task_categories FOR SELECT USING (true);
CREATE POLICY "onet_context_read" ON public.work_context_categories FOR SELECT USING (true);

-- Service role ALL policies
CREATE POLICY "onet_content_admin" ON public.content_model_reference FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_jobzone_admin" ON public.job_zone_reference FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_occupation_admin" ON public.occupation_data FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_scales_admin" ON public.scales_reference FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_ete_admin" ON public.ete_categories FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_anchors_admin" ON public.level_scale_anchors FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_metadata_admin" ON public.occupation_level_metadata FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_survey_admin" ON public.survey_booklet_locations FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_task_admin" ON public.task_categories FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "onet_context_admin" ON public.work_context_categories FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');