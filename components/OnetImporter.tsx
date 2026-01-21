import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';

interface FileChunk {
  tableName: string;
  columns: string[];
  rows: string[][];
  chunkIndex: number;
  totalChunks: number;
  isFirstChunk: boolean;
}

interface ImportResult {
  table: string;
  rows: number;
  totalRows?: number;
  chunksCompleted?: number;
  totalChunks?: number;
  error?: string;
  status: 'pending' | 'importing' | 'success' | 'failed' | 'partial';
}

const ROWS_PER_CHUNK = 40000; // 40k rows per chunk to stay under CPU limit

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

function parseFileIntoChunks(filename: string, content: string): FileChunk[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  const tableName = tableNameFromFilename(filename);
  const headerLine = lines[0];
  const columns = headerLine.split('\t').map(normalizeCol);
  const dataLines = lines.slice(1);

  const chunks: FileChunk[] = [];
  const totalChunks = Math.ceil(dataLines.length / ROWS_PER_CHUNK);

  for (let i = 0; i < dataLines.length; i += ROWS_PER_CHUNK) {
    const chunkRows = dataLines.slice(i, i + ROWS_PER_CHUNK).map(line => {
      const values = line.split('\t');
      // Pad or trim to match column count
      while (values.length < columns.length) values.push('');
      return values.slice(0, columns.length);
    });

    chunks.push({
      tableName,
      columns,
      rows: chunkRows,
      chunkIndex: chunks.length,
      totalChunks,
      isFirstChunk: chunks.length === 0
    });
  }

  return chunks;
}

export default function OnetImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [results, setResults] = useState<Map<string, ImportResult>>(new Map());
  const [failedChunks, setFailedChunks] = useState<FileChunk[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => 
      f.name.toLowerCase().endsWith('.txt')
    );
    selected.sort((a, b) => a.size - b.size);
    setFiles(selected);
    setResults(new Map());
    setFailedChunks([]);
  };

  const sendChunk = async (chunk: FileChunk): Promise<{ success: boolean; rowsInserted: number; error?: string }> => {
    const formData = new FormData();
    formData.append('tableName', chunk.tableName);
    formData.append('columns', JSON.stringify(chunk.columns));
    formData.append('rows', JSON.stringify(chunk.rows));
    formData.append('isFirstChunk', chunk.isFirstChunk.toString());
    formData.append('chunkIndex', chunk.chunkIndex.toString());
    formData.append('totalChunks', chunk.totalChunks.toString());

    try {
      const { data, error } = await supabase.functions.invoke('import-onet-fast', {
        body: formData,
      });

      if (error) {
        return { success: false, rowsInserted: 0, error: error.message };
      }

      return { success: true, rowsInserted: data?.rowsInserted || chunk.rows.length };
    } catch (err: any) {
      return { success: false, rowsInserted: 0, error: err.message };
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    
    setImporting(true);
    setFailedChunks([]);
    const newResults = new Map<string, ImportResult>();
    const allFailedChunks: FileChunk[] = [];

    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      const tableName = tableNameFromFilename(file.name);
      
      setCurrentStatus(`Reading ${file.name}...`);
      
      // Initialize result for this file
      newResults.set(tableName, {
        table: tableName,
        rows: 0,
        totalRows: 0,
        chunksCompleted: 0,
        totalChunks: 0,
        status: 'importing'
      });
      setResults(new Map(newResults));

      // Parse file into chunks
      const content = await file.text();
      const chunks = parseFileIntoChunks(file.name, content);
      
      if (chunks.length === 0) {
        newResults.set(tableName, {
          table: tableName,
          rows: 0,
          status: 'failed',
          error: 'Empty file'
        });
        setResults(new Map(newResults));
        continue;
      }

      const totalRows = chunks.reduce((sum, c) => sum + c.rows.length, 0);
      newResults.set(tableName, {
        table: tableName,
        rows: 0,
        totalRows,
        chunksCompleted: 0,
        totalChunks: chunks.length,
        status: 'importing'
      });
      setResults(new Map(newResults));

      let rowsInserted = 0;
      let chunksCompleted = 0;
      let hasError = false;

      // Process each chunk
      for (const chunk of chunks) {
        setCurrentStatus(`${tableName}: chunk ${chunk.chunkIndex + 1}/${chunks.length} (${chunk.rows.length} rows)`);

        const result = await sendChunk(chunk);

        if (result.success) {
          rowsInserted += result.rowsInserted;
          chunksCompleted++;
          
          newResults.set(tableName, {
            table: tableName,
            rows: rowsInserted,
            totalRows,
            chunksCompleted,
            totalChunks: chunks.length,
            status: chunksCompleted === chunks.length ? 'success' : 'importing'
          });
        } else {
          hasError = true;
          allFailedChunks.push(chunk);
          
          newResults.set(tableName, {
            table: tableName,
            rows: rowsInserted,
            totalRows,
            chunksCompleted,
            totalChunks: chunks.length,
            status: 'partial',
            error: `Chunk ${chunk.chunkIndex + 1} failed: ${result.error?.substring(0, 50)}`
          });
        }
        
        setResults(new Map(newResults));
      }
    }

    setFailedChunks(allFailedChunks);
    
    const successCount = Array.from(newResults.values()).filter(r => r.status === 'success').length;
    const totalRows = Array.from(newResults.values()).reduce((sum, r) => sum + r.rows, 0);
    
    setCurrentStatus(`Done! ${successCount}/${newResults.size} tables complete, ${totalRows.toLocaleString()} rows total`);
    setImporting(false);
  };

  const handleRetryFailed = async () => {
    if (failedChunks.length === 0) return;

    setImporting(true);
    const newResults = new Map(results);
    const stillFailed: FileChunk[] = [];

    for (const chunk of failedChunks) {
      setCurrentStatus(`Retrying ${chunk.tableName} chunk ${chunk.chunkIndex + 1}...`);
      
      // For retry, never drop table (append only)
      const retryChunk = { ...chunk, isFirstChunk: false };
      const result = await sendChunk(retryChunk);

      const existing = newResults.get(chunk.tableName);
      if (existing) {
        if (result.success) {
          existing.rows += result.rowsInserted;
          existing.chunksCompleted = (existing.chunksCompleted || 0) + 1;
          existing.status = existing.chunksCompleted === existing.totalChunks ? 'success' : 'partial';
          existing.error = undefined;
        } else {
          stillFailed.push(chunk);
        }
        newResults.set(chunk.tableName, { ...existing });
        setResults(new Map(newResults));
      }
    }

    setFailedChunks(stillFailed);
    setCurrentStatus(stillFailed.length === 0 ? 'All retries successful!' : `${stillFailed.length} chunks still failed`);
    setImporting(false);
  };

  const resultsArray = Array.from(results.values());
  const totalRows = resultsArray.reduce((sum, r) => sum + r.rows, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        O*NET Fast Importer
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4">
        Upload O*NET .txt files. Large files are automatically chunked (40k rows each) for reliable import.
      </p>

      <div className="space-y-4">
        <div 
          onClick={() => !importing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            importing ? 'border-muted cursor-not-allowed' : 'border-border cursor-pointer hover:border-primary'
          }`}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {files.length > 0 
              ? `${files.length} files selected` 
              : 'Click to select .txt files'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt"
            onChange={handleFileSelect}
            className="hidden"
            disabled={importing}
          />
        </div>

        {files.length > 0 && !importing && results.size === 0 && (
          <div className="text-sm text-muted-foreground max-h-24 overflow-auto bg-muted/50 rounded p-2">
            {files.map(f => `${f.name} (${(f.size / 1024).toFixed(0)}KB)`).join(', ')}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={files.length === 0 || importing}
            className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import {files.length} Files
              </>
            )}
          </button>

          {failedChunks.length > 0 && !importing && (
            <button
              onClick={handleRetryFailed}
              className="py-3 px-4 bg-yellow-500 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry {failedChunks.length} Failed
            </button>
          )}
        </div>

        {currentStatus && (
          <p className="text-sm text-center text-muted-foreground">{currentStatus}</p>
        )}

        {resultsArray.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground text-center">
              Total: {totalRows.toLocaleString()} rows imported
            </div>
            <div className="space-y-1 max-h-64 overflow-auto">
              {resultsArray.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                  {r.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : r.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  ) : r.status === 'partial' ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  )}
                  <span className="font-mono truncate">{r.table}</span>
                  <span className="text-muted-foreground ml-auto whitespace-nowrap text-xs">
                    {r.status === 'importing' && r.totalChunks && r.totalChunks > 1 
                      ? `${r.chunksCompleted}/${r.totalChunks} chunks`
                      : r.error 
                        ? r.error 
                        : `${r.rows.toLocaleString()}${r.totalRows ? `/${r.totalRows.toLocaleString()}` : ''} rows`
                    }
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
