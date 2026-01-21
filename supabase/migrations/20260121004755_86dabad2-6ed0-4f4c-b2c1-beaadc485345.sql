-- Remove the onet_exec function that allowed table creation via uploads
DROP FUNCTION IF EXISTS public.onet_exec(text);

-- Remove the import jobs tracking table if it exists
DROP TABLE IF EXISTS public.onet_import_jobs CASCADE;