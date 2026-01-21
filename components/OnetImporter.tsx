import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';

interface ImportResult {
  table: string;
  rows: number;
  error?: string;
  skipped?: boolean;
}

export default function OnetImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [currentFile, setCurrentFile] = useState('');
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => 
      f.name.toLowerCase().endsWith('.txt')
    );
    // Sort by file size (smallest first) for faster initial feedback
    selected.sort((a, b) => a.size - b.size);
    setFiles(selected);
    setResults([]);
    setError(null);
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    
    setImporting(true);
    setError(null);
    setResults([]);
    const allResults: ImportResult[] = [];

    // Process ONE file at a time to avoid CPU limits
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);
      setProgress(`Processing ${i + 1}/${files.length}: ${file.name}`);

      try {
        const formData = new FormData();
        formData.append('file0', file);

        const { data, error: fnError } = await supabase.functions.invoke('import-onet-fast', {
          body: formData,
        });

        if (fnError) {
          // Check if it's a timeout/resource error
          if (fnError.message?.includes('WORKER_LIMIT') || fnError.message?.includes('compute resources')) {
            allResults.push({ 
              table: file.name.replace('.txt', '').toLowerCase().replace(/[^a-z0-9]+/g, '_'), 
              rows: 0, 
              error: 'Too large - CPU limit exceeded',
              skipped: true
            });
          } else {
            allResults.push({ 
              table: file.name.replace('.txt', ''), 
              rows: 0, 
              error: fnError.message 
            });
          }
        } else if (data?.results?.[0]) {
          allResults.push(data.results[0]);
        }
      } catch (err: any) {
        allResults.push({ 
          table: file.name.replace('.txt', ''), 
          rows: 0, 
          error: err.message?.substring(0, 50) || 'Unknown error'
        });
      }

      setResults([...allResults]);
    }

    const totalRows = allResults.reduce((sum, r) => sum + r.rows, 0);
    const successCount = allResults.filter(r => !r.error).length;
    const skippedCount = allResults.filter(r => r.skipped).length;
    
    setProgress(`Done! ${successCount} tables, ${totalRows.toLocaleString()} rows${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`);
    setCurrentFile('');
    setImporting(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        O*NET Fast Importer
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4">
        Upload O*NET .txt (TSV) files. Each file becomes a table. Files processed one at a time.
      </p>

      <div className="space-y-4">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
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
          />
        </div>

        {files.length > 0 && !importing && (
          <div className="text-sm text-muted-foreground max-h-32 overflow-auto bg-muted/50 rounded p-2">
            {files.map(f => `${f.name} (${(f.size / 1024).toFixed(0)}KB)`).join(', ')}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={files.length === 0 || importing}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {currentFile || 'Importing...'}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Import {files.length} Files (1 at a time)
            </>
          )}
        </button>

        {progress && (
          <p className="text-sm text-center text-muted-foreground">{progress}</p>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-1 max-h-64 overflow-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                {r.skipped ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                ) : r.error ? (
                  <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                <span className="font-mono truncate">{r.table}</span>
                <span className="text-muted-foreground ml-auto whitespace-nowrap">
                  {r.error ? r.error : `${r.rows.toLocaleString()} rows`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
