// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

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
    
    // Track string state
    if ((char === "'" || char === '"') && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    current += char;
    
    // Semicolon outside string ends statement
    if (char === ';' && !inString) {
      const stmt = current.trim();
      if (stmt.length > 1) {
        statements.push(stmt);
      }
      current = '';
    }
  }
  
  // Handle final statement without semicolon
  const final = current.trim();
  if (final.length > 0 && !final.startsWith('--')) {
    statements.push(final);
  }
  
  return statements;
}

// Convert INSERT statement to Supabase insert format
function parseInsertStatement(stmt: string): { table: string; columns: string[]; values: any[][] } | null {
  // Match: INSERT INTO table_name (col1, col2) VALUES (...), (...);
  const match = stmt.match(/INSERT\s+INTO\s+["`]?(\w+)["`]?\s*\(([^)]+)\)\s*VALUES\s*(.+)/is);
  if (!match) return null;
  
  const table = match[1];
  const columns = match[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
  const valuesSection = match[3];
  
  // Parse each VALUES tuple
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

// Parse values from a single tuple like: 'val1', 123, NULL, 'val2'
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
  
  // String values
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  
  // Numeric values
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

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const jobId = formData.get('jobId') as string | null;

    if (!file) {
      throw new Error('No file uploaded');
    }

    console.log(`[Import] Received file: ${file.name}, size: ${file.size}`);

    // Update job status to processing
    if (jobId) {
      await supabase.from('onet_import_jobs').update({
        status: 'processing',
        started_at: new Date().toISOString(),
        last_message: 'Reading ZIP file...'
      }).eq('id', jobId);
    }

    // Read and unzip
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    await zip.loadAsync(arrayBuffer);

    const sqlFiles = Object.keys(zip.files).filter(name => name.endsWith('.sql') && !zip.files[name].dir);
    console.log(`[Import] Found ${sqlFiles.length} SQL files`);

    if (sqlFiles.length === 0) {
      throw new Error('No .sql files found in ZIP');
    }

    if (jobId) {
      await supabase.from('onet_import_jobs').update({
        files_total: sqlFiles.length,
        last_message: `Found ${sqlFiles.length} SQL files, starting import...`,
        log: [`Found ${sqlFiles.length} SQL files`]
      }).eq('id', jobId);
    }

    let totalTablesCreated = 0;
    let totalRowsInserted = 0;
    let filesProcessed = 0;
    const logs: string[] = [`Starting import of ${sqlFiles.length} files`];

    // Process each SQL file
    for (const fileName of sqlFiles) {
      const startTime = Date.now();
      const fileContent = await zip.files[fileName].async('string');
      const statements = parseStatements(fileContent);
      
      console.log(`[Import] Processing ${fileName}: ${statements.length} statements`);
      logs.push(`\n--- ${fileName} (${statements.length} statements) ---`);

      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          current_file: fileName,
          current_phase: 'parsing',
          statements_total: statements.length,
          statements_done: 0,
          last_message: `Processing ${fileName}...`,
          log: logs
        }).eq('id', jobId);
      }

      let stmtsDone = 0;
      let fileRows = 0;
      let fileTables = 0;

      // Batch CREATE TABLE statements first
      const createStatements = statements.filter(s => s.toUpperCase().trim().startsWith('CREATE TABLE'));
      const insertStatements = statements.filter(s => s.toUpperCase().trim().startsWith('INSERT INTO'));
      const otherStatements = statements.filter(s => 
        !s.toUpperCase().trim().startsWith('CREATE TABLE') && 
        !s.toUpperCase().trim().startsWith('INSERT INTO')
      );

      // Execute CREATE TABLE
      for (const stmt of createStatements) {
        try {
          // Extract table name for logging
          const tableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
          const tableName = tableMatch ? tableMatch[1] : 'unknown';
          
          const { error } = await supabase.rpc('onet_exec', { stmt });
          if (error) {
            // Table might already exist
            if (!error.message?.includes('already exists')) {
              logs.push(`⚠️ CREATE TABLE ${tableName}: ${error.message}`);
            } else {
              logs.push(`⏭️ Table ${tableName} already exists`);
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
          // Silently skip non-critical DDL errors
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
          
          // Convert to objects
          const rows = values.map(row => {
            const obj: Record<string, any> = {};
            columns.forEach((col, i) => {
              obj[col] = row[i] !== undefined ? row[i] : null;
            });
            return obj;
          });

          // Insert in batches
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(table).upsert(batch, { 
              onConflict: 'id',
              ignoreDuplicates: true 
            });
            
            if (error) {
              // Try regular insert if upsert fails
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

        // Update progress every 10 statements
        if (stmtsDone % 10 === 0 && jobId) {
          await supabase.from('onet_import_jobs').update({
            statements_done: stmtsDone,
            rows_inserted: totalRowsInserted,
            tables_created: totalTablesCreated
          }).eq('id', jobId);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logs.push(`✅ ${fileName}: ${fileTables} tables, ${fileRows} rows (${elapsed}s)`);
      filesProcessed++;

      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          files_done: filesProcessed,
          statements_done: stmtsDone,
          rows_inserted: totalRowsInserted,
          tables_created: totalTablesCreated,
          last_message: `Completed ${fileName}`,
          log: logs
        }).eq('id', jobId);
      }
    }

    // Final update
    logs.push(`\n=== IMPORT COMPLETE ===`);
    logs.push(`📊 Files: ${filesProcessed}/${sqlFiles.length}`);
    logs.push(`📋 Tables created: ${totalTablesCreated}`);
    logs.push(`📝 Rows inserted: ${totalRowsInserted}`);

    if (jobId) {
      await supabase.from('onet_import_jobs').update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        last_message: `Import complete! ${totalTablesCreated} tables, ${totalRowsInserted} rows`,
        log: logs
      }).eq('id', jobId);
    }

    return new Response(JSON.stringify({
      success: true,
      filesProcessed,
      tablesCreated: totalTablesCreated,
      rowsInserted: totalRowsInserted,
      logs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Import Error]:', error);

    if (formData?.get('jobId')) {
      await supabase.from('onet_import_jobs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        last_message: `Error: ${error.message}`
      }).eq('id', formData.get('jobId'));
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
