
import React, { useState } from 'react';
import { Search, MapPin, Briefcase, Filter, ArrowRight, Building2, Clock, Globe, Zap, Loader2, AlertCircle, Bookmark, Share2, CheckCircle2, MoreHorizontal, FileText } from 'lucide-react';
import { ApifyService } from '../services/apifyService';
import { JobSearchResult, SearchFilters } from '../types';

interface JobSearchProps {
  onAnalyzeJob: (job: JobSearchResult) => void;
}

export const JobSearch: React.FC<JobSearchProps> = ({ onAnalyzeJob }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [filters, setFilters] = useState<SearchFilters>({
    keywords: '',
    location: '',
    date_posted: '',
    experienceLevel: '',
    remote: '',
    easy_apply: ''
  });

  const handleSearch = async () => {
    if (!filters.keywords && !filters.location) return;
    
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedJob(null);

    try {
      const jobs = await ApifyService.searchJobs(filters);
      setResults(jobs);
      if (jobs.length > 0) {
        setSelectedJob(jobs[0]);
      }
    } catch (err) {
      setError("Failed to fetch jobs. Please try different keywords or try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="h-full flex flex-col bg-[#F3F2EF] dark:bg-vexo-bg overflow-hidden relative">
      
      {/* Top Search Bar */}
      <div className="bg-white dark:bg-vexo-card border-b border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0 z-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3">
          
          {/* Inputs Group */}
          <div className="flex-1 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search by title, skill, or company"
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-md text-sm transition-all outline-none dark:text-white"
                value={filters.keywords}
                onChange={(e) => setFilters({...filters, keywords: e.target.value})}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="City, state, or zip code"
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-md text-sm transition-all outline-none dark:text-white"
                value={filters.location}
                onChange={(e) => setFilters({...filters, location: e.target.value})}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <button 
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-[#0A66C2] hover:bg-[#004182] text-white font-bold rounded-full text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Filter Chips */}
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <select 
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-50 hover:border-slate-900 transition-colors cursor-pointer outline-none appearance-none"
            value={filters.date_posted}
            onChange={(e) => setFilters({...filters, date_posted: e.target.value})}
          >
            <option value="">Date Posted</option>
            <option value="day">Past 24 hours</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
          </select>

          <select 
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-50 hover:border-slate-900 transition-colors cursor-pointer outline-none appearance-none"
            value={filters.experienceLevel}
            onChange={(e) => setFilters({...filters, experienceLevel: e.target.value})}
          >
            <option value="">Experience Level</option>
            <option value="internship">Internship</option>
            <option value="entry">Entry level</option>
            <option value="associate">Associate</option>
            <option value="mid_senior">Mid-Senior level</option>
            <option value="director">Director</option>
          </select>

          <select 
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-50 hover:border-slate-900 transition-colors cursor-pointer outline-none appearance-none"
            value={filters.remote}
            onChange={(e) => setFilters({...filters, remote: e.target.value})}
          >
            <option value="">Remote</option>
            <option value="onsite">On-site</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>

           <select 
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-50 hover:border-slate-900 transition-colors cursor-pointer outline-none appearance-none"
            value={filters.easy_apply}
            onChange={(e) => setFilters({...filters, easy_apply: e.target.value})}
          >
            <option value="">Easy Apply</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 overflow-hidden relative">
        {loading && results.length === 0 && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm">
             <div className="flex flex-col items-center gap-3">
               <Loader2 className="w-10 h-10 text-[#0A66C2] animate-spin" />
               <p className="text-slate-600 dark:text-slate-300 font-medium">Scanning LinkedIn...</p>
             </div>
          </div>
        )}

        {results.length === 0 && !loading && !error && (
           <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Briefcase className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No jobs found yet</p>
              <p className="text-sm">Try searching for keywords like "Frontend" in "New York"</p>
           </div>
        )}

        {error && (
           <div className="h-full flex flex-col items-center justify-center text-red-500">
              <AlertCircle className="w-12 h-12 mb-2" />
              <p>{error}</p>
           </div>
        )}

        {results.length > 0 && (
          <div className="h-full max-w-7xl mx-auto flex">
            
            {/* Left Column: List */}
            <div className="w-full md:w-[45%] lg:w-[40%] h-full overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-vexo-card pb-20">
               <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  {results.length} results found
               </div>
               
               {results.map((job, idx) => (
                 <div 
                   key={idx}
                   onClick={() => setSelectedJob(job)}
                   className={`p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-colors group relative
                     ${selectedJob?.job_url === job.job_url 
                        ? 'bg-[#EBF4FE] dark:bg-[#1C324A]' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                     }
                   `}
                 >
                    {/* Blue bar for selected */}
                    {selectedJob?.job_url === job.job_url && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0A66C2]"></div>
                    )}

                    <div className="flex gap-3">
                       <div className="w-12 h-12 bg-slate-100 rounded-sm flex items-center justify-center shrink-0 overflow-hidden">
                          {job.companyLogo ? (
                             <img src={job.companyLogo} alt="" className="w-full h-full object-contain" />
                          ) : (
                             <Building2 className="w-6 h-6 text-slate-400" />
                          )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="text-[#0A66C2] font-semibold text-base leading-tight mb-1 group-hover:underline truncate">
                            {job.job_title}
                          </h3>
                          <div className="text-slate-900 dark:text-white text-sm mb-0.5 truncate">{job.company}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-sm mb-1 truncate">
                             {job.location} {job.work_type ? `(${job.work_type})` : ''}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                             {job.posted_at && (
                               <span className="text-green-700 dark:text-green-400 font-medium">
                                 {job.posted_at}
                               </span>
                             )}
                             {job.is_promoted && (
                               <span className="text-slate-400">Promoted</span>
                             )}
                             {job.is_easy_apply && (
                                <span className="flex items-center gap-0.5 text-[#0A66C2] font-bold">
                                  <img src="https://static.licdn.com/aero-v1/sc/h/kh6i06k21lo064v304e29780" className="w-3 h-3" alt="" />
                                  Easy Apply
                                </span>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
               ))}
            </div>

            {/* Right Column: Details */}
            <div className="hidden md:block flex-1 h-full overflow-y-auto bg-white dark:bg-vexo-card pb-20">
               {selectedJob ? (
                 <div className="animate-in fade-in duration-300">
                    
                    {/* Details Header */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                       <div className="flex items-start justify-between mb-4">
                           {/* Job Title & Meta */}
                           <div>
                              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                                {selectedJob.job_title}
                              </h1>
                              
                              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-900 dark:text-white mb-4">
                                  <span className="font-medium hover:underline cursor-pointer flex items-center gap-1">
                                    {selectedJob.company}
                                    {selectedJob.is_verified && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500 dark:text-slate-400">{selectedJob.location}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-green-600 dark:text-green-400">{selectedJob.posted_at}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {selectedJob.applicant_count ? `${selectedJob.applicant_count} applicants` : 'Be the first to apply'}
                                  </span>
                              </div>

                              {/* Promoted Label */}
                              {selectedJob.is_promoted && (
                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-4">
                                   <Briefcase className="w-3 h-3" />
                                   <span>Promoted by hirer</span>
                                </div>
                              )}

                              {/* Chips: Remote, Full-time, etc */}
                              <div className="flex flex-wrap gap-2 mb-6">
                                  {selectedJob.work_type && (
                                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md">
                                       <Briefcase className="w-3 h-3 mr-1" />
                                       {selectedJob.work_type}
                                    </span>
                                  )}
                                  {selectedJob.salary && (
                                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md">
                                       <Zap className="w-3 h-3 mr-1 text-orange-500" />
                                       {selectedJob.salary}
                                    </span>
                                  )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-3">
                                 {/* Primary Action - CREATE CV */}
                                 <button 
                                    onClick={() => onAnalyzeJob(selectedJob)}
                                    className="px-6 py-2 bg-[#0A66C2] hover:bg-[#004182] text-white font-bold rounded-full flex items-center gap-2 transition-colors shadow-sm"
                                 >
                                    <FileText className="w-4 h-4" />
                                    Create CV
                                 </button>
                                 
                                 <button className="px-6 py-2 border border-[#0A66C2] text-[#0A66C2] font-bold rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                   Save
                                 </button>
                                 
                                 <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <Share2 className="w-5 h-5" />
                                 </button>
                              </div>

                           </div>

                           {/* Logo Right */}
                           <div className="hidden lg:block w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center">
                              {selectedJob.companyLogo ? (
                                 <img src={selectedJob.companyLogo} alt={selectedJob.company} className="w-12 h-12 object-contain" />
                              ) : (
                                 <Building2 className="w-8 h-8 text-slate-400" />
                              )}
                           </div>
                       </div>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="p-6">
                       
                       {/* About the job */}
                       <div className="mb-8">
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">About the job</h2>
                          <div className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {selectedJob.description}
                          </div>
                       </div>

                       {/* Insights (if any) */}
                       {selectedJob.job_insights && selectedJob.job_insights.length > 0 && (
                          <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                             <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm">Job Insights</h3>
                             <ul className="space-y-2">
                               {selectedJob.job_insights.map((insight, i) => (
                                 <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                                   <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></div>
                                   {insight}
                                 </li>
                               ))}
                             </ul>
                          </div>
                       )}

                       {/* About Company */}
                       <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                          <h3 className="font-bold text-slate-900 dark:text-white mb-4">About the company</h3>
                          <div className="flex items-center gap-4 mb-4">
                             <div className="w-12 h-12 bg-white border border-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                <Building2 className="w-6 h-6 text-slate-400" />
                             </div>
                             <div>
                                <div className="font-bold text-slate-900 dark:text-white">{selectedJob.company}</div>
                                {selectedJob.applicant_count > 0 && (
                                   <div className="text-xs text-slate-500">{selectedJob.applicant_count} current applicants</div>
                                )}
                             </div>
                             {selectedJob.company_url && (
                                <a 
                                  href={selectedJob.company_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="ml-auto text-[#0A66C2] font-bold text-sm hover:underline flex items-center gap-1"
                                >
                                  Follow <ArrowRight className="w-4 h-4" />
                                </a>
                             )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                             {selectedJob.company} is hiring for this position. Click follow to get updates on future roles.
                          </p>
                       </div>

                    </div>
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-vexo-bg">
                    <div className="w-20 h-20 bg-white dark:bg-vexo-card rounded-full flex items-center justify-center mb-4 shadow-sm">
                       <ArrowRight className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="font-medium text-lg">Select a job to view details</p>
                    <p className="text-sm opacity-60">Click on any job from the list on the left</p>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
