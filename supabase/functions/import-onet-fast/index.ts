// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  try {
    const formData = await req.formData();
    
    // Get chunk metadata
    const tableName = formData.get('tableName') as string;
    const columnsJson = formData.get('columns') as string;
    const isFirstChunk = formData.get('isFirstChunk') === 'true';
    const chunkIndex = parseInt(formData.get('chunkIndex') as string || '0');
    const totalChunks = parseInt(formData.get('totalChunks') as string || '1');
    const rowsData = formData.get('rows') as string;

    if (!tableName || !columnsJson || !rowsData) {
      return new Response(JSON.stringify({ error: 'Missing required fields: tableName, columns, rows' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const columns: string[] = JSON.parse(columnsJson);
    const rows: string[][] = JSON.parse(rowsData);

    console.log(`[Import] ${tableName} chunk ${chunkIndex + 1}/${totalChunks}: ${rows.length} rows, isFirst=${isFirstChunk}`);

    // First chunk: Drop and create table
    if (isFirstChunk) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      const colDefs = columns.map(c => `"${c}" TEXT`).join(', ');
      await sql.unsafe(`CREATE TABLE "${tableName}" (${colDefs})`);
      console.log(`[Import] Created table ${tableName}`);
    }

    // Bulk insert in batches of 2000 rows
    const BATCH_SIZE = 2000;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const valueRows: string[] = [];

      for (const row of batch) {
        const escaped = row.map(escapeValue);
        valueRows.push(`(${escaped.join(', ')})`);
      }

      if (valueRows.length > 0) {
        const colList = columns.map(c => `"${c}"`).join(', ');
        const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES ${valueRows.join(', ')}`;
        await sql.unsafe(insertSql);
        totalInserted += valueRows.length;
      }

      if (totalInserted % 10000 < BATCH_SIZE) {
        console.log(`[Import] ${tableName}: ${totalInserted}/${rows.length} rows`);
      }
    }

    await sql.end();

    console.log(`[Import] ✅ ${tableName} chunk ${chunkIndex + 1}: ${totalInserted} rows inserted`);

    return new Response(JSON.stringify({
      success: true,
      table: tableName,
      chunkIndex,
      totalChunks,
      rowsInserted: totalInserted
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
