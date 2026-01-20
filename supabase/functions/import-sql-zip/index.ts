// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Split SQL content into individual statements (handles strings correctly)
function splitStatements(content: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev = content[i - 1];
    
    if ((char === "'" || char === '"') && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    current += char;
    
    if (char === ';' && !inString) {
      const stmt = current.trim();
      if (stmt.length > 1) {
        statements.push(stmt);
      }
      current = '';
    }
  }
  
  const final = current.trim();
  if (final.length > 0 && !final.startsWith('--')) {
    statements.push(final);
  }
  
  return statements;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let jobId: string | null = null;
  const MAX_LOG_LINES = 300;
  const trimLog = (arr: string[]) => (arr.length > MAX_LOG_LINES ? arr.slice(-MAX_LOG_LINES) : arr);
  
  try {
    const formData = await req.formData();
    jobId = formData.get('jobId') as string | null;
    const totalFilesParam = formData.get('totalFiles');
    const totalFiles = totalFilesParam ? Number(totalFilesParam) : 0;
    const batchIndex = Number(formData.get('batchIndex') || 0);
    const isLastBatch = String(formData.get('isLastBatch') || 'false') === 'true';

    if (!jobId) throw new Error('Missing jobId');

    // Collect uploaded files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) throw new Error('No SQL files uploaded');

    // Sort by filename
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Load existing job state
    const { data: existingJob } = await supabase
      .from('onet_import_jobs')
      .select('files_total, files_done, tables_created, rows_inserted, log, started_at')
      .eq('id', jobId)
      .single();

    const jobFilesTotal = totalFiles || existingJob?.files_total || 0;
    const baseFilesDone = existingJob?.files_done || 0;
    let totalTablesCreated = existingJob?.tables_created || 0;
    let totalRowsInserted = existingJob?.rows_inserted || 0;
    let filesProcessed = 0;
    const logs: string[] = Array.isArray(existingJob?.log) ? [...existingJob.log] : [];

    console.log(`[Import] Batch ${batchIndex}: ${files.length} file(s)`);

    logs.push(`\n=== BATCH ${batchIndex} (${files.length} files) ===`);

    await supabase.from('onet_import_jobs').update({
      status: 'processing',
      started_at: existingJob?.started_at || new Date().toISOString(),
      files_total: jobFilesTotal || baseFilesDone + files.length,
      last_message: `Batch ${batchIndex}: processing ${files.length} file(s)...`,
      log: trimLog(logs)
    }).eq('id', jobId);

    // Process each file
    for (const file of files) {
      const fileName = file.name;
      const startTime = Date.now();
      console.log(`[Import] Processing: ${fileName}`);
      logs.push(`--- ${fileName} ---`);

      await supabase.from('onet_import_jobs').update({
        current_file: fileName,
        files_done: baseFilesDone + filesProcessed,
        last_message: `Processing ${fileName}...`,
      }).eq('id', jobId);

      // Read and split into statements
      const content = await file.text();
      const statements = splitStatements(content);
      console.log(`[Import] ${fileName}: ${statements.length} statements`);

      let fileRows = 0;
      let fileTables = 0;
      let fileErrors = 0;

      // Execute each statement via onet_exec (raw SQL, fast!)
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const upperStmt = stmt.toUpperCase().trim();

        try {
          const { error } = await supabase.rpc('onet_exec', { stmt });
          
          if (error) {
            if (error.message?.includes('already exists')) {
              // Table/index exists, skip
            } else if (error.message?.includes('duplicate key')) {
              // Duplicate row, skip
            } else {
              fileErrors++;
              if (fileErrors <= 3) {
                logs.push(`⚠️ ${error.message?.substring(0, 80)}`);
              }
            }
          } else {
            if (upperStmt.startsWith('CREATE TABLE')) {
              fileTables++;
              totalTablesCreated++;
              const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/i);
              logs.push(`✅ Table: ${match?.[1] || 'unknown'}`);
            } else if (upperStmt.startsWith('INSERT INTO')) {
              // Count rows from VALUES - rough estimate
              const valuesMatch = stmt.match(/VALUES\s*(\(.+)/is);
              if (valuesMatch) {
                const rowCount = (valuesMatch[1].match(/\),\s*\(/g) || []).length + 1;
                fileRows += rowCount;
                totalRowsInserted += rowCount;
              } else {
                fileRows++;
                totalRowsInserted++;
              }
            }
          }
        } catch (e: any) {
          fileErrors++;
          if (fileErrors <= 2) {
            logs.push(`❌ ${e.message?.substring(0, 60)}`);
          }
        }

        // Update progress every 50 statements
        if (i > 0 && i % 50 === 0) {
          await supabase.from('onet_import_jobs').update({
            rows_inserted: totalRowsInserted,
            tables_created: totalTablesCreated,
            last_message: `${fileName}: ${i}/${statements.length} statements...`
          }).eq('id', jobId);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logs.push(`✅ ${fileTables} tables, ${fileRows} rows (${elapsed}s)${fileErrors > 0 ? `, ${fileErrors} errors` : ''}`);
      filesProcessed++;

      await supabase.from('onet_import_jobs').update({
        files_done: baseFilesDone + filesProcessed,
        tables_created: totalTablesCreated,
        rows_inserted: totalRowsInserted,
        log: trimLog(logs)
      }).eq('id', jobId);
    }

    const newFilesDone = baseFilesDone + filesProcessed;
    const shouldComplete = isLastBatch || (jobFilesTotal > 0 && newFilesDone >= jobFilesTotal);

    if (shouldComplete) {
      logs.push(`\n=== COMPLETE ===`);
      logs.push(`Files: ${newFilesDone}, Tables: ${totalTablesCreated}, Rows: ${totalRowsInserted}`);

      await supabase.from('onet_import_jobs').update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        files_done: newFilesDone,
        tables_created: totalTablesCreated,
        rows_inserted: totalRowsInserted,
        current_file: null,
        last_message: `Done: ${totalTablesCreated} tables, ${totalRowsInserted} rows`,
        log: trimLog(logs)
      }).eq('id', jobId);

      console.log(`[Import] Complete: ${newFilesDone} files, ${totalTablesCreated} tables, ${totalRowsInserted} rows`);
    } else {
      await supabase.from('onet_import_jobs').update({
        files_done: newFilesDone,
        last_message: `Batch ${batchIndex} done. ${newFilesDone}/${jobFilesTotal} files.`,
        log: trimLog(logs)
      }).eq('id', jobId);
    }

    return new Response(JSON.stringify({
      success: true,
      filesProcessed,
      tablesCreated: totalTablesCreated,
      rowsInserted: totalRowsInserted
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[Import Error]:', err);
    
    if (jobId) {
      await supabase.from('onet_import_jobs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        last_message: `Error: ${err.message}`
      }).eq('id', jobId);
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
