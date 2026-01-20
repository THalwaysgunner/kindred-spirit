// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse SQL statements from file content (handles multiline INSERT)
function parseStatements(content: string): string[] {
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

// Convert INSERT statement to Supabase insert format
function parseInsertStatement(stmt: string): { table: string; columns: string[]; values: any[][] } | null {
  const match = stmt.match(/INSERT\s+INTO\s+["`]?(\w+)["`]?\s*\(([^)]+)\)\s*VALUES\s*(.+)/is);
  if (!match) return null;
  
  const table = match[1];
  const columns = match[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
  const valuesSection = match[3];
  
  const rows: any[][] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < valuesSection.length; i++) {
    const char = valuesSection[i];
    const prev = valuesSection[i - 1];
    
    if ((char === "'" || char === '"') && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    
    current += char;
    
    if (depth === 0 && current.trim().length > 0) {
      const tuple = current.trim();
      if (tuple.startsWith('(') && tuple.endsWith(')')) {
        const inner = tuple.slice(1, -1);
        const values = parseValuesTuple(inner);
        if (values.length > 0) {
          rows.push(values);
        }
      }
      current = '';
    }
  }
  
  return { table, columns, values: rows };
}

function parseValuesTuple(inner: string): any[] {
  const values: any[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    const prev = inner[i - 1];
    
    if ((char === "'" || char === '"') && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (char === ',' && !inString) {
      values.push(parseValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim().length > 0) {
    values.push(parseValue(current.trim()));
  }
  
  return values;
}

function parseValue(val: string): any {
  if (val.toUpperCase() === 'NULL') return null;
  if (val.toUpperCase() === 'TRUE') return true;
  if (val.toUpperCase() === 'FALSE') return false;
  
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  
  const num = Number(val);
  if (!isNaN(num)) return num;
  
  return val;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let jobId: string | null = null;
  const MAX_LOG_LINES = 500;
  const trimLog = (arr: string[]) => (arr.length > MAX_LOG_LINES ? arr.slice(arr.length - MAX_LOG_LINES) : arr);
  
  try {
    const formData = await req.formData();
    jobId = formData.get('jobId') as string | null;
    const totalFilesParam = formData.get('totalFiles');
    const totalFiles = totalFilesParam ? Number(totalFilesParam) : 0;
    const batchIndexParam = formData.get('batchIndex');
    const batchIndex = batchIndexParam ? Number(batchIndexParam) : 0;
    const isLastBatch = String(formData.get('isLastBatch') || 'false') === 'true';

    if (!jobId) {
      throw new Error('Missing jobId');
    }
    
    // Get all uploaded files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      throw new Error('No SQL files uploaded');
    }

    // Sort files by name (01_, 02_, etc.)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Load existing job state so we can increment counts across multiple batch requests.
    const { data: existingJob } = await supabase
      .from('onet_import_jobs')
      .select('files_total, files_done, tables_created, rows_inserted, log, started_at')
      .eq('id', jobId)
      .single();

    const jobFilesTotal = (totalFiles && Number.isFinite(totalFiles)) ? totalFiles : (existingJob?.files_total || 0);
    const baseFilesDone = existingJob?.files_done || 0;
    let totalTablesCreated = existingJob?.tables_created || 0;
    let totalRowsInserted = existingJob?.rows_inserted || 0;
    let filesProcessed = 0;

    const logs: string[] = Array.isArray(existingJob?.log) ? [...existingJob.log] : [];

    console.log(`[Import] Batch ${batchIndex}: received ${files.length} SQL file(s)`);
    console.log(`[Import] Batch ${batchIndex} order: ${files.map(f => f.name).join(', ')}`);

    logs.push(`\n=== BATCH ${batchIndex} ===`);
    logs.push(`Received ${files.length} file(s): ${files.map(f => f.name).join(', ')}`);

    await supabase.from('onet_import_jobs').update({
      status: 'processing',
      started_at: existingJob?.started_at || new Date().toISOString(),
      files_total: jobFilesTotal || existingJob?.files_total || baseFilesDone + files.length,
      last_message: `Processing batch ${batchIndex} (${files.length} file(s))...`,
      log: trimLog(logs)
    }).eq('id', jobId);

    // Process each SQL file in order
    for (const file of files) {
      const fileName = file.name;
      console.log(`[Import] Processing file ${filesProcessed + 1}/${files.length}: ${fileName}`);
      logs.push(`\n=== ${fileName} ===`);

      // Read file content
      const content = await file.text();
      const statements = parseStatements(content);
      
      console.log(`[Import] ${fileName}: ${statements.length} statements, ${content.length} bytes`);
      logs.push(`${statements.length} statements, ${content.length} bytes`);

      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          current_file: fileName,
          files_done: baseFilesDone + filesProcessed,
          statements_total: statements.length,
          statements_done: 0,
          last_message: `Processing ${fileName}...`,
          log: trimLog(logs)
        }).eq('id', jobId);
      }

      let stmtsDone = 0;
      let fileRows = 0;
      let fileTables = 0;

      // Categorize statements
      const createStatements = statements.filter(s => s.toUpperCase().trim().startsWith('CREATE TABLE'));
      const insertStatements = statements.filter(s => s.toUpperCase().trim().startsWith('INSERT INTO'));
      const otherStatements = statements.filter(s => 
        !s.toUpperCase().trim().startsWith('CREATE TABLE') && 
        !s.toUpperCase().trim().startsWith('INSERT INTO')
      );

      // Execute CREATE TABLE
      for (const stmt of createStatements) {
        try {
          const tableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
          const tableName = tableMatch ? tableMatch[1] : 'unknown';
          
          const { error } = await supabase.rpc('onet_exec', { stmt });
          if (error) {
            if (!error.message?.includes('already exists')) {
              logs.push(`⚠️ CREATE TABLE ${tableName}: ${error.message}`);
            } else {
              logs.push(`⏭️ Table ${tableName} exists`);
            }
          } else {
            logs.push(`✅ Created table: ${tableName}`);
            fileTables++;
            totalTablesCreated++;
          }
        } catch (e: any) {
          logs.push(`❌ CREATE error: ${e.message?.substring(0, 100)}`);
        }
        stmtsDone++;
      }

      // Execute other DDL (indexes, constraints)
      for (const stmt of otherStatements) {
        try {
          const { error } = await supabase.rpc('onet_exec', { stmt });
          if (error && !error.message?.includes('already exists')) {
            logs.push(`⚠️ DDL: ${error.message?.substring(0, 80)}`);
          }
        } catch (e: any) {
          // Skip non-critical DDL errors
        }
        stmtsDone++;
      }

      // Batch INSERT statements
      const BATCH_SIZE = 500;
      for (const stmt of insertStatements) {
        try {
          const parsed = parseInsertStatement(stmt);
          if (!parsed || parsed.values.length === 0) {
            stmtsDone++;
            continue;
          }

          const { table, columns, values } = parsed;
          
          const rows = values.map(row => {
            const obj: Record<string, any> = {};
            columns.forEach((col, i) => {
              obj[col] = row[i] !== undefined ? row[i] : null;
            });
            return obj;
          });

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(table).upsert(batch, { 
              onConflict: 'id',
              ignoreDuplicates: true 
            });
            
            if (error) {
              const { error: insertError } = await supabase.from(table).insert(batch);
              if (insertError && !insertError.message?.includes('duplicate')) {
                logs.push(`⚠️ INSERT ${table}: ${insertError.message?.substring(0, 60)}`);
              } else {
                fileRows += batch.length;
              }
            } else {
              fileRows += batch.length;
            }
          }
          
          totalRowsInserted += values.length;
        } catch (e: any) {
          logs.push(`❌ INSERT error: ${e.message?.substring(0, 80)}`);
        }
        stmtsDone++;

        // Update progress periodically
        if (stmtsDone % 10 === 0 && jobId) {
          await supabase.from('onet_import_jobs').update({
            statements_done: stmtsDone,
            rows_inserted: totalRowsInserted,
            tables_created: totalTablesCreated
          }).eq('id', jobId);
        }
      }

      filesProcessed++;
      logs.push(`✅ Done: ${fileTables} tables, ${fileRows} rows`);

      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          files_done: baseFilesDone + filesProcessed,
          tables_created: totalTablesCreated,
          rows_inserted: totalRowsInserted,
          log: trimLog(logs)
        }).eq('id', jobId);
      }
    }

    const newFilesDone = baseFilesDone + filesProcessed;
    const shouldComplete = isLastBatch || (jobFilesTotal > 0 && newFilesDone >= jobFilesTotal);

    if (shouldComplete) {
      logs.push(`\n=== IMPORT COMPLETE ===`);
      logs.push(`Files done: ${newFilesDone}/${jobFilesTotal || newFilesDone}`);
      logs.push(`Tables created: ${totalTablesCreated}`);
      logs.push(`Rows inserted: ${totalRowsInserted}`);

      await supabase.from('onet_import_jobs').update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        files_done: newFilesDone,
        tables_created: totalTablesCreated,
        rows_inserted: totalRowsInserted,
        current_file: null,
        last_message: `Completed: ${totalTablesCreated} tables, ${totalRowsInserted} rows`,
        log: trimLog(logs)
      }).eq('id', jobId);

      console.log(`[Import] Complete: ${newFilesDone} files, ${totalTablesCreated} tables, ${totalRowsInserted} rows`);
    } else {
      await supabase.from('onet_import_jobs').update({
        files_done: newFilesDone,
        tables_created: totalTablesCreated,
        rows_inserted: totalRowsInserted,
        last_message: `Batch ${batchIndex} done. ${newFilesDone}/${jobFilesTotal || '?'} files completed.`,
        log: trimLog(logs)
      }).eq('id', jobId);
      console.log(`[Import] Batch ${batchIndex} done: files_done=${newFilesDone}`);
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
