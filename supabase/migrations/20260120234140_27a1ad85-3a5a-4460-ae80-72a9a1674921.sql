-- Drop O*NET data tables to start fresh
DROP TABLE IF EXISTS content_model_reference CASCADE;
DROP TABLE IF EXISTS ete_categories CASCADE;
DROP TABLE IF EXISTS job_zone_reference CASCADE;
DROP TABLE IF EXISTS level_scale_anchors CASCADE;
DROP TABLE IF EXISTS occupation_data CASCADE;
DROP TABLE IF EXISTS scales_reference CASCADE;

-- Clear import job history
TRUNCATE TABLE onet_import_jobs;