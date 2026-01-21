import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';

interface ImportResult {
  table: string;
  rows: number;
  error?: string;
}

export default function OnetImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => 
      f.name.toLowerCase().endsWith('.txt')
    );
    setFiles(selected);
    setResults([]);
    setError(null);
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    
    setImporting(true);
    setProgress(`Uploading ${files.length} files...`);
    setError(null);
    setResults([]);

    try {
      // Send files in batches of 5 to avoid timeout
      const BATCH_SIZE = 5;
      const allResults: ImportResult[] = [];

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        setProgress(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)} (${batch.map(f => f.name).join(', ')})`);

        const formData = new FormData();
        batch.forEach((file, idx) => {
          formData.append(`file${idx}`, file);
        });

        const { data, error: fnError } = await supabase.functions.invoke('import-onet-fast', {
          body: formData,
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data?.results) {
          allResults.push(...data.results);
        }
      }

      setResults(allResults);
      const totalRows = allResults.reduce((sum, r) => sum + r.rows, 0);
      const successCount = allResults.filter(r => !r.error).length;
      setProgress(`Done! ${successCount}/${allResults.length} tables, ${totalRows.toLocaleString()} total rows`);

    } catch (err: any) {
      setError(err.message || 'Import failed');
      setProgress('');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        O*NET Fast Importer
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4">
        Upload O*NET .txt (TSV) files. Each file becomes a table in the database.
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

        {files.length > 0 && (
          <div className="text-sm text-muted-foreground max-h-32 overflow-auto bg-muted/50 rounded p-2">
            {files.map(f => f.name).join(', ')}
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
              Importing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Import {files.length} Files
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
                {r.error ? (
                  <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                <span className="font-mono">{r.table}</span>
                <span className="text-muted-foreground">
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
