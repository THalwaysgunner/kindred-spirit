// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function tableNameFromFilename(filename: string): string {
  let base = filename.replace(/\.txt$/i, '').toLowerCase().trim();
  base = base.replace(/[^a-z0-9]+/g, '_');
  base = base.replace(/_+/g, '_').replace(/^_|_$/g, '');
  return base || 'unknown_table';
}

function normalizeCol(col: string): string {
  let c = col.trim().replace(/\ufeff/g, '');
  c = c.replace(/[^\w]+/g, '_');
  c = c.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!c) c = 'col';
  if (/^\d/.test(c)) c = `c_${c}`;
  return c.toLowerCase();
}

function escapeValue(val: string): string {
  if (val === '' || val === null || val === undefined) return 'NULL';
  // Escape single quotes by doubling them
  return `'${val.replace(/'/g, "''")}'`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const sql = postgres(dbUrl, { max: 1 });
  const results: { table: string; rows: number; error?: string }[] = [];

  try {
    const formData = await req.formData();
    const files: File[] = [];
    
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.name.toLowerCase().endsWith('.txt')) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'No .txt files uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sort files alphabetically
    files.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[Import] Processing ${files.length} files`);

    for (const file of files) {
      const tableName = tableNameFromFilename(file.name);
      const startTime = Date.now();
      
      try {
        const content = await file.text();
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
          results.push({ table: tableName, rows: 0, error: 'Empty file' });
          continue;
        }

        // Parse header (TSV)
        const headerLine = lines[0];
        const rawCols = headerLine.split('\t');
        const cols = rawCols.map(normalizeCol);
        
        console.log(`[Import] ${file.name} -> ${tableName}: ${cols.length} cols, ${lines.length - 1} rows`);

        // Drop and create table
        await sql.unsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        
        const colDefs = cols.map(c => `"${c}" TEXT`).join(', ');
        await sql.unsafe(`CREATE TABLE "${tableName}" (${colDefs})`);

        // Bulk insert in batches of 2000 rows
        const BATCH_SIZE = 2000;
        const dataLines = lines.slice(1);
        let totalInserted = 0;

        for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
          const batch = dataLines.slice(i, i + BATCH_SIZE);
          const valueRows: string[] = [];

          for (const line of batch) {
            const values = line.split('\t');
            // Pad or trim to match column count
            while (values.length < cols.length) values.push('');
            const escaped = values.slice(0, cols.length).map(escapeValue);
            valueRows.push(`(${escaped.join(', ')})`);
          }

          if (valueRows.length > 0) {
            const colList = cols.map(c => `"${c}"`).join(', ');
            const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES ${valueRows.join(', ')}`;
            await sql.unsafe(insertSql);
            totalInserted += valueRows.length;
          }

          // Log progress every 10k rows
          if (totalInserted % 10000 < BATCH_SIZE) {
            console.log(`[Import] ${tableName}: ${totalInserted}/${dataLines.length} rows`);
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Import] ✅ ${tableName}: ${totalInserted} rows in ${elapsed}s`);
        results.push({ table: tableName, rows: totalInserted });

      } catch (err: any) {
        console.error(`[Import] ❌ ${tableName}: ${err.message}`);
        results.push({ table: tableName, rows: 0, error: err.message?.substring(0, 100) });
      }
    }

    await sql.end();

    const totalRows = results.reduce((sum, r) => sum + r.rows, 0);
    const successCount = results.filter(r => !r.error).length;

    return new Response(JSON.stringify({
      success: true,
      filesProcessed: files.length,
      tablesCreated: successCount,
      totalRows,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[Import Error]:', err);
    await sql.end();
    
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
