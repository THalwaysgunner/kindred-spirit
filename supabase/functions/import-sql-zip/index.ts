// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ZipWorkFile = {
  zip: any; // JSZip instance
  name: string; // entry name inside that zip
  displayName: string; // friendly name for logs/UI
};

function isZipEntryFile(zip: any, name: string) {
  // JSZip marks directories via `.dir`, but this is not always perfectly consistent across runtimes.
  // Treat trailing '/' as directory as a fallback.
  const entry = zip.files?.[name];
  if (!entry) return false;
  if (entry.dir === true) return false;
  if (name.endsWith('/')) return false;
  return true;
}

function looksLikeSqlTextFile(name: string) {
  const lower = name.toLowerCase();
  return /\.(sql|txt)(\.gz)?$/.test(lower);
}

function looksLikeZipFile(name: string) {
  return name.toLowerCase().endsWith('.zip');
}

function summarizeExtensions(fileNames: string[]) {
  const counts: Record<string, number> = {};
  for (const n of fileNames) {
    const lower = n.toLowerCase();
    const parts = lower.split('/').pop() || lower;
    const segs = parts.split('.');

    let ext = '(none)';
    if (segs.length >= 3 && segs[segs.length - 1] === 'gz') {
      ext = `${segs[segs.length - 2]}.gz`;
    } else if (segs.length >= 2) {
      ext = segs[segs.length - 1];
    }

    counts[ext] = (counts[ext] || 0) + 1;
  }
  return counts;
}

async function maybeGunzipToString(data: Uint8Array): Promise<string> {
  try {
    // Web-standard API in modern Deno runtimes
    // eslint-disable-next-line no-undef
    if (typeof DecompressionStream !== 'undefined') {
      // eslint-disable-next-line no-undef
      const ds = new DecompressionStream('gzip');
      const stream = new Response(data).body?.pipeThrough(ds);
      if (!stream) return new TextDecoder().decode(data);
      const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
      return new TextDecoder().decode(decompressed);
    }
  } catch (_) {
    // fallthrough
  }

  // Fallback: return best-effort decoded bytes (still useful for debugging)
  return new TextDecoder().decode(data);
}

async function readZipEntryAsText(zip: any, name: string): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.gz')) {
    const bytes = await zip.files[name].async('uint8array');
    return await maybeGunzipToString(bytes);
  }
  return await zip.files[name].async('string');
}

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

  let jobId: string | null = null;
  let debugLog: string[] = [];
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    jobId = formData.get('jobId') as string | null;

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

    // Read file bytes - use stream to avoid arrayBuffer issues in Deno edge runtime
    let zipBytes: Uint8Array;
    try {
      // Method 1: Try reading via stream (most reliable in Deno)
      const chunks: Uint8Array[] = [];
      const reader = file.stream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      zipBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        zipBytes.set(chunk, offset);
        offset += chunk.length;
      }
      console.log(`[Import] Read ${zipBytes.length} bytes via stream`);
    } catch (streamErr) {
      // Method 2: Fallback to arrayBuffer
      console.log(`[Import] Stream read failed, trying arrayBuffer: ${streamErr}`);
      const ab = await file.arrayBuffer();
      zipBytes = new Uint8Array(ab);
      console.log(`[Import] Read ${zipBytes.length} bytes via arrayBuffer`);
    }

    // Validate we got real data
    if (zipBytes.length < 100) {
      throw new Error(`File read produced only ${zipBytes.length} bytes - upload may be corrupted`);
    }

    // Check for ZIP magic bytes (PK\x03\x04)
    const magic = zipBytes.slice(0, 4);
    const isZipMagic = magic[0] === 0x50 && magic[1] === 0x4B && magic[2] === 0x03 && magic[3] === 0x04;
    console.log(`[Import] ZIP magic bytes: ${Array.from(magic).map(b => b.toString(16).padStart(2, '0')).join(' ')} (valid: ${isZipMagic})`);
    
    if (!isZipMagic) {
      throw new Error(`File does not appear to be a valid ZIP (magic: ${Array.from(magic.slice(0, 4)).map(b => b.toString(16)).join(' ')})`);
    }

    const zip = new JSZip();
    await zip.loadAsync(zipBytes);

    const allEntries = Object.keys(zip.files);
    const topLevelFiles = allEntries.filter((n) => isZipEntryFile(zip, n));
    const extSummary = summarizeExtensions(topLevelFiles);

    debugLog = [
      `--- ZIP INSPECTION ---`,
      `Entries: ${allEntries.length} (${topLevelFiles.length} files)`,
      `Extensions: ${Object.entries(extSummary)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ') || '(none)'}`,
      `Sample: ${topLevelFiles.slice(0, 15).join(', ') || '(no files found)'}`,
    ];

    console.log(`[Import] ${debugLog.join(' | ')}`);

    // Find SQL-like files (supports .sql/.txt and .sql.gz/.txt.gz)
    let workFiles: ZipWorkFile[] = topLevelFiles
      .filter(looksLikeSqlTextFile)
      .map((name) => ({ zip, name, displayName: name }));

    // If none found, try looking inside nested .zip files (some providers ship zip-in-zip)
    if (workFiles.length === 0) {
      const innerZips = topLevelFiles.filter(looksLikeZipFile).slice(0, 3);
      if (innerZips.length > 0) {
        console.log(`[Import] No SQL files at root; probing nested ZIP(s): ${innerZips.join(', ')}`);
      }

      for (const innerName of innerZips) {
        try {
          const innerBuf = await zip.files[innerName].async('arraybuffer');
          const innerZip = new JSZip();
          await innerZip.loadAsync(innerBuf);

          const innerEntries = Object.keys(innerZip.files).filter((n) => isZipEntryFile(innerZip, n));
          const innerSql = innerEntries.filter(looksLikeSqlTextFile);
          console.log(`[Import] Nested ZIP ${innerName}: ${innerEntries.length} files, ${innerSql.length} sql/txt`);

          if (innerSql.length > 0) {
            workFiles = innerSql.map((name) => ({
              zip: innerZip,
              name,
              displayName: `${innerName}::${name}`,
            }));
            debugLog.push(`Nested ZIP used: ${innerName} (${innerSql.length} SQL/TXT)`);
            break;
          }
        } catch (e: any) {
          console.log(`[Import] Failed probing nested ZIP ${innerName}: ${e?.message || e}`);
        }
      }
    }

    console.log(`[Import] Found ${workFiles.length} SQL/TXT(/GZ) file(s)`);
    if (workFiles.length > 0) {
      console.log(`[Import] Work files: ${workFiles.slice(0, 10).map(f => f.displayName).join(', ')}${workFiles.length > 10 ? '...' : ''}`);
    }

    if (workFiles.length === 0) {
      const msg = `No .sql/.txt (or .gz) files found in ZIP. ${debugLog.join(' | ')}`;
      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          last_message: `Error: No SQL files found (see log)`,
          log: [...debugLog, '❌ No SQL/TXT files detected.']
        }).eq('id', jobId);
      }
      throw new Error(msg);
    }

    if (jobId) {
      await supabase.from('onet_import_jobs').update({
        files_total: workFiles.length,
        last_message: `Found ${workFiles.length} SQL files, starting import...`,
        log: [...debugLog, `Found ${workFiles.length} SQL file(s)`]
      }).eq('id', jobId);
    }

    let totalTablesCreated = 0;
    let totalRowsInserted = 0;
    let filesProcessed = 0;
    const logs: string[] = [...debugLog, `Starting import of ${workFiles.length} files`];

    // Process each SQL file
    for (const wf of workFiles) {
      const startTime = Date.now();
      const fileContent = await readZipEntryAsText(wf.zip, wf.name);
      const statements = parseStatements(fileContent);
      
      console.log(`[Import] Processing ${wf.displayName}: ${statements.length} statements`);
      logs.push(`\n--- ${wf.displayName} (${statements.length} statements) ---`);

      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          current_file: wf.displayName,
          current_phase: 'parsing',
          statements_total: statements.length,
          statements_done: 0,
          last_message: `Processing ${wf.displayName}...`,
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
      logs.push(`✅ ${wf.displayName}: ${fileTables} tables, ${fileRows} rows (${elapsed}s)`);
      filesProcessed++;

      if (jobId) {
        await supabase.from('onet_import_jobs').update({
          files_done: filesProcessed,
          statements_done: stmtsDone,
          rows_inserted: totalRowsInserted,
          tables_created: totalTablesCreated,
          last_message: `Completed ${wf.displayName}`,
          log: logs
        }).eq('id', jobId);
      }
    }

    // Final update
    logs.push(`\n=== IMPORT COMPLETE ===`);
    logs.push(`📊 Files: ${filesProcessed}/${workFiles.length}`);
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

    if (jobId) {
      await supabase.from('onet_import_jobs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        last_message: `Error: ${error.message}`
      }).eq('id', jobId);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
