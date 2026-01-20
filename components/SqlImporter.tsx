import React, { useState, useRef, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, FileText, Database, Table2, Rows3 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface ImportJob {
  id: string;
  status: string;
  files_total: number;
  files_done: number;
  statements_total: number;
  statements_done: number;
  tables_created: number;
  rows_inserted: number;
  current_file: string | null;
  current_phase: string | null;
  last_message: string | null;
  log: string[];
  started_at: string | null;
  finished_at: string | null;
}

export const SqlImporter: React.FC<{ userId: string }> = ({ userId }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Poll for job updates
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('onet_import_jobs')
        .select('*')
        .eq('id', job.id)
        .single();

      if (data) {
        setJob(data);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [job?.id, job?.status]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [job?.log]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const sqlFiles = Array.from(selected).filter(f => 
      f.name.endsWith('.sql') || f.name.endsWith('.txt')
    );

    if (sqlFiles.length === 0) {
      setError('Please select .sql or .txt files');
      return;
    }

    // Sort by filename (01_, 02_, etc.)
    sqlFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    
    setFiles(sqlFiles);
    setError(null);
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadLabel('Starting...');

    try {
      // Create job record
      const { data: newJob, error: jobError } = await supabase
        .from('onet_import_jobs')
        .insert({
          user_id: userId,
          status: 'queued',
          last_message: 'Uploading files...'
        })
        .select()
        .single();

      if (jobError) throw jobError;
      setJob(newJob);

      // Upload in small batches to avoid backend memory limits when parsing multipart form-data.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const MAX_BATCH_BYTES = 6 * 1024 * 1024; // ~6MB per request (auto-splits)
      const batches: File[][] = [];
      let current: File[] = [];
      let currentBytes = 0;
      for (const f of files) {
        if (current.length > 0 && currentBytes + f.size > MAX_BATCH_BYTES) {
          batches.push(current);
          current = [];
          currentBytes = 0;
        }
        // If a single file is huge, send it alone.
        if (current.length === 0 && f.size > MAX_BATCH_BYTES) {
          batches.push([f]);
          continue;
        }
        current.push(f);
        currentBytes += f.size;
      }
      if (current.length) batches.push(current);

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        setUploadLabel(`Uploading batch ${bi + 1}/${batches.length} (${batch.length} file(s))...`);

        const formData = new FormData();
        formData.append('jobId', newJob.id);
        formData.append('totalFiles', String(files.length));
        formData.append('batchIndex', String(bi));
        formData.append('isLastBatch', String(bi === batches.length - 1));

        batch.forEach((file, index) => {
          formData.append(`file${index}`, file);
        });

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 120000);

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/import-sql-zip`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`
            },
            body: formData,
            signal: controller.signal,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Import failed');
          }
        } finally {
          window.clearTimeout(timeout);
        }
      }

      // Fetch final job state
      const { data: finalJob } = await supabase
        .from('onet_import_jobs')
        .select('*')
        .eq('id', newJob.id)
        .single();

      if (finalJob) {
        setJob(finalJob);
      }

    } catch (err: any) {
      setError(err.message);
      if (job) {
        setJob({ ...job, status: 'failed', last_message: err.message });
      }
    } finally {
      setIsUploading(false);
      setUploadLabel('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'processing': return 'text-blue-500';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Loader2 className="w-5 h-5 text-slate-400" />;
    }
  };

  const progressPercent = job?.files_total 
    ? Math.round((job.files_done / job.files_total) * 100) 
    : 0;

  return (
    <div className="bg-white dark:bg-vexo-card rounded-2xl shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">SQL File Importer</h2>
          <p className="text-sm text-slate-500">Upload multiple .sql files to import in order</p>
        </div>
      </div>

      {/* File Selection */}
      {!job && (
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
          >
            <FileText className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            {files.length > 0 ? (
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{files.length} SQL files selected</p>
                <p className="text-sm text-slate-500 mt-1">
                  {files.slice(0, 3).map(f => f.name).join(', ')}
                  {files.length > 3 && ` +${files.length - 3} more`}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-slate-600 dark:text-slate-300">Click to select SQL files</p>
                <p className="text-sm text-slate-400">Select all your .sql files (01_, 02_, etc.)</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".sql,.txt"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File list preview */}
          {files.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">Files will be processed in this order:</p>
              <div className="space-y-1">
                {files.map((file, i) => (
                  <div key={file.name} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 w-6">{i + 1}.</span>
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="text-slate-700 dark:text-slate-300 truncate">{file.name}</span>
                    <span className="text-slate-400 text-xs ml-auto">{(file.size / 1024).toFixed(1)}KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={files.length === 0 || isUploading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadLabel || `Uploading ${files.length} files...`}
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Import {files.length} SQL Files
              </>
            )}
          </button>
        </div>
      )}

      {/* Progress Display */}
      {job && (
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(job.status)}
              <span className={`font-medium capitalize ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
            {job.current_file && job.status === 'processing' && (
              <span className="text-sm text-slate-500 truncate max-w-[200px]">
                {job.current_file}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {job.files_total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Files: {job.files_done}/{job.files_total}
                </span>
                <span className="text-slate-500">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
              <Table2 className="w-5 h-5 mx-auto text-indigo-500 mb-1" />
              <div className="text-lg font-bold text-slate-900 dark:text-white">{job.tables_created}</div>
              <div className="text-xs text-slate-500">Tables</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
              <Rows3 className="w-5 h-5 mx-auto text-green-500 mb-1" />
              <div className="text-lg font-bold text-slate-900 dark:text-white">{job.rows_inserted.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Rows</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
              <FileText className="w-5 h-5 mx-auto text-amber-500 mb-1" />
              <div className="text-lg font-bold text-slate-900 dark:text-white">{job.files_done}</div>
              <div className="text-xs text-slate-500">Files</div>
            </div>
          </div>

          {/* Last Message */}
          {job.last_message && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
              {job.last_message}
            </div>
          )}

          {/* Log Output */}
          {job.log && job.log.length > 0 && (
            <div 
              ref={logContainerRef}
              className="bg-slate-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs"
            >
              {job.log.map((line, i) => (
                <div 
                  key={i} 
                  className={`${
                    line.includes('✅') ? 'text-green-400' :
                    line.includes('❌') ? 'text-red-400' :
                    line.includes('⚠️') ? 'text-amber-400' :
                    line.includes('===') ? 'text-indigo-400 font-bold' :
                    line.includes('---') ? 'text-blue-400' :
                    'text-slate-300'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Reset Button */}
          {(job.status === 'completed' || job.status === 'failed') && (
            <button
              onClick={() => {
                setJob(null);
                setFiles([]);
              }}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
            >
              Import More Files
            </button>
          )}
        </div>
      )}
    </div>
  );
};
