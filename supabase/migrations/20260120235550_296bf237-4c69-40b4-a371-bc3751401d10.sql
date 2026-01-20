-- Drop only O*NET/importer-related tables (keep core app tables)
DROP TABLE IF EXISTS public.onet_import_jobs CASCADE;
DROP TABLE IF EXISTS public.occupation_level_metadata CASCADE;
DROP TABLE IF EXISTS public.occupation_data CASCADE;
DROP TABLE IF EXISTS public.ete_categories CASCADE;
DROP TABLE IF EXISTS public.level_scale_anchors CASCADE;
DROP TABLE IF EXISTS public.scales_reference CASCADE;
DROP TABLE IF EXISTS public.job_zone_reference CASCADE;
DROP TABLE IF EXISTS public.content_model_reference CASCADE;