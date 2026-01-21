import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  Building2,
  Clock,
  Zap,
  Loader2,
  AlertCircle,
  Share2,
  CheckCircle2,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  TrendingUp,
  X,
  Users
} from 'lucide-react';
import { ApifyService } from '../services/apifyService';
import { JobSearchResult, SearchFilters } from '../types';
import { supabase } from '../services/supabaseClient';

interface JobSearchProps {
  onAnalyzeJob: (job: JobSearchResult) => void;
}

interface AutocompleteSuggestion {
  title: string;
  onetCode: string | null;
}

export const JobSearch: React.FC<JobSearchProps> = ({ onAnalyzeJob }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const keywordsInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter bar dropdowns (Row 1 - CLIENT-SIDE ONLY for filtering displayed results)
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'remote' | 'experience' | 'date' | null>(null);
  const filterRemoteRef = useRef<HTMLDivElement>(null);
  const filterExperienceRef = useRef<HTMLDivElement>(null);
  const filterDateRef = useRef<HTMLDivElement>(null);

  // Row 1 client-side filter state (ONLY for filtering displayed results - NOT sent to API)
  const [clientWorkTypes, setClientWorkTypes] = useState<string[]>([]);
  const [clientExperiences, setClientExperiences] = useState<string[]>([]);
  const [clientDatePosted, setClientDatePosted] = useState<string>('');
  const [clientEasyApply, setClientEasyApply] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fromCache, setFromCache] = useState(false);
  const [serverStats, setServerStats] = useState<{ total: number; remote: number; easyApply: number; recent: number } | null>(null);
  const pageSize = 20;

  // Row 2 - Fetch variables (ONLY keywords and location - sent to API)
  const [searchKeywords, setSearchKeywords] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [fetchWorkType, setFetchWorkType] = useState('');
  const [fetchExperienceLevel, setFetchExperienceLevel] = useState('');

  // Raw results from API (before client-side filtering)
  const [rawResults, setRawResults] = useState<JobSearchResult[]>([]);

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('job-autocomplete', {
        body: { query, limit: 8 }
      });

      if (error) throw error;
      
      setSuggestions(data?.suggestions || []);
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Debounce autocomplete requests
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions(searchKeywords);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchKeywords, fetchSuggestions]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    setSearchKeywords(suggestion.title);
    setShowSuggestions(false);
    setSuggestions([]);
    keywordsInputRef.current?.focus();
  };

  // Filter options for display
  const remoteOptions = [
    { value: '', label: 'Work Type' },
    { value: 'remote', label: 'Remote' },
    { value: 'onsite', label: 'On-site' },
    { value: 'hybrid', label: 'Hybrid' },
  ];

  const experienceOptions = [
    { value: '', label: 'Experience' },
    { value: 'internship', label: 'Internship' },
    { value: 'entry', label: 'Entry level' },
    { value: 'associate', label: 'Associate' },
    { value: 'mid_senior', label: 'Mid-Senior' },
    { value: 'director', label: 'Director' },
    { value: 'executive', label: 'Executive' },
  ];

  const datePostedOptions = [
    { value: '', label: 'Any time' },
    { value: 'hour', label: 'Past hour' },
    { value: 'day', label: 'Past 24 hours' },
    { value: 'week', label: 'Past week' },
  ];

  const getOptionLabel = (options: { value: string; label: string }[], value: string) => {
    const found = options.find(o => o.value === value);
    return found?.label ?? options[0]?.label ?? '';
  };

  // Fetch jobs from API - Row 2 variables only (NOT Row 1 filters)
  const handleSearch = async (page: number = 1, forceRefresh: boolean = false) => {
    if (!searchKeywords && !searchLocation) return;

    setLoading(true);
    setError(null);
    if (page === 1) {
      setRawResults([]);
      setResults([]);
      setSelectedJob(null);
    }

    try {
      // ONLY send keywords and location - NO filters
      const searchParams = {
        keywords: searchKeywords,
        location: searchLocation,
        remote: fetchWorkType,
        experienceLevel: fetchExperienceLevel,
        date_posted: '',
        easy_apply: '',
        page,
        pageSize,
        forceRefresh,
        cacheOnly: false
      };

      console.log('[JobSearch] Fetching with params:', {
        keywords: searchKeywords,
        location: searchLocation,
        remote: fetchWorkType,
        experienceLevel: fetchExperienceLevel,
        page,
      });

      const response = await ApifyService.searchJobs(searchParams);
      
      setRawResults(response.jobs);
      setTotalCount(response.totalCount);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
      setFromCache(response.fromCache);
      setServerStats(response.stats || null);
    } catch (err) {
      setError("Failed to fetch jobs. Please try different keywords or try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Apply client-side filters to raw results (Row 1 filters)
  const filteredResults = useMemo(() => {
    let filtered = [...rawResults];

    // Work Type filter
    if (clientWorkTypes.length > 0) {
      filtered = filtered.filter(job => {
        const workType = (job.work_type || '').toLowerCase();
        return clientWorkTypes.some(wt => {
          if (wt === 'remote') return workType.includes('remote');
          if (wt === 'hybrid') return workType.includes('hybrid');
          if (wt === 'onsite') return workType.includes('on-site') || workType.includes('onsite');
          return false;
        });
      });
    }

    // Experience filter (check job title)
    if (clientExperiences.length > 0) {
      filtered = filtered.filter(job => {
        const title = (job.job_title || '').toLowerCase();
        return clientExperiences.some(exp => {
          if (exp === 'internship') return title.includes('intern');
          if (exp === 'entry') return title.includes('entry') || title.includes('junior');
          if (exp === 'associate') return title.includes('associate');
          if (exp === 'mid_senior') return title.includes('senior') || title.includes('lead');
          if (exp === 'director') return title.includes('director') || title.includes('head');
          if (exp === 'executive') return title.includes('executive') || title.includes('vp') || title.includes('chief');
          return false;
        });
      });
    }

    // Date Posted filter
    if (clientDatePosted) {
      const now = Date.now();
      let cutoffMs: number | null = null;
      if (clientDatePosted === 'hour') cutoffMs = now - 60 * 60 * 1000;
      if (clientDatePosted === 'day') cutoffMs = now - 24 * 60 * 60 * 1000;
      if (clientDatePosted === 'week') cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
      
      if (cutoffMs) {
        filtered = filtered.filter(job => {
          const postedAt = job.posted_at ? new Date(job.posted_at).getTime() : 0;
          return postedAt >= cutoffMs!;
        });
      }
    }

    // Easy Apply filter
    if (clientEasyApply) {
      filtered = filtered.filter(job => job.is_easy_apply === true);
    }

    return filtered;
  }, [rawResults, clientWorkTypes, clientExperiences, clientDatePosted, clientEasyApply]);

  // Update displayed results when filters change
  useEffect(() => {
    setResults(filteredResults);
  }, [filteredResults]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      handleSearch(newPage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle autocomplete navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      handleSearch(1);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        keywordsInputRef.current &&
        !keywordsInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stats based on filtered results (client-side)
  const stats = useMemo(() => {
    const total = filteredResults.length;
    const remote = filteredResults.filter(j => (j.work_type || '').toLowerCase().includes('remote')).length;
    const easyApply = filteredResults.filter(j => j.is_easy_apply).length;
    const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = filteredResults.filter(j => {
      const postedAt = j.posted_at ? new Date(j.posted_at).getTime() : 0;
      return postedAt >= recentCutoff;
    }).length;

    return [
      { label: 'Showing', value: total, growth: '', trend: 'up' },
      { label: 'Remote Jobs', value: remote, growth: '', trend: 'up' },
      { label: 'Easy Apply', value: easyApply, growth: '', trend: 'up' },
      { label: 'Posted Today', value: recent, growth: '', trend: 'up' },
    ];
  }, [filteredResults]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;

      // Close filter bar dropdowns
      if (openFilterDropdown) {
        const filterRemoteContains = !!filterRemoteRef.current?.contains(targetNode);
        const filterExpContains = !!filterExperienceRef.current?.contains(targetNode);
        const filterDateContains = !!filterDateRef.current?.contains(targetNode);
        if (!filterRemoteContains && !filterExpContains && !filterDateContains) {
          setOpenFilterDropdown(null);
        }
      }

      if (selectedJob && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest('tr[data-job-row]')) {
          setSelectedJob(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedJob, openFilterDropdown]);

  return (
    <div className="flex relative min-h-screen bg-white dark:bg-[#0D0F16] font-sans transition-colors w-full overflow-x-hidden min-w-[1200px]">
      {/* Main Content */}
      <div className={`flex flex-col w-full transition-all duration-300 ${selectedJob ? 'mr-[600px]' : ''}`}>

        {/* 1. Stat Cards */}
        <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-800/50 gap-px border-b border-slate-200 dark:border-slate-800 w-full min-w-[1200px]">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-[#0D0F16] p-6 flex flex-col h-28 min-h-28 font-sans group">
              <p className="text-xs font-normal text-slate-400 tracking-wider mb-auto">{stat.label}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2 relative -top-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{stat.value}</span>
                  {stat.growth && (
                    <div className={`flex items-center gap-0.5 text-sm font-bold ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      <TrendingUp className="w-4 h-4" />
                      <span>{stat.growth}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Row 1: Filter Bar - CLIENT-SIDE ONLY (filters displayed results) */}
        <div className="flex items-center gap-4 px-8 py-3 border-b border-slate-200 dark:border-slate-800 w-full">
          {/* Work Type Dropdown (multi-select) */}
          <div ref={filterRemoteRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenFilterDropdown(openFilterDropdown === 'remote' ? null : 'remote')}
              className={`px-3 py-1.5 text-xs tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 rounded-md ${
                clientWorkTypes.length > 0 
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="whitespace-nowrap">
                {clientWorkTypes.length === 0 
                  ? 'Work Type' 
                  : clientWorkTypes.length === 1 
                    ? remoteOptions.find(o => o.value === clientWorkTypes[0])?.label 
                    : `${clientWorkTypes.length} selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {openFilterDropdown === 'remote' && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                {remoteOptions.filter(opt => opt.value !== '').map((opt) => {
                  const isSelected = clientWorkTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setClientWorkTypes(clientWorkTypes.filter(v => v !== opt.value));
                        } else {
                          setClientWorkTypes([...clientWorkTypes, opt.value]);
                        }
                      }}
                      className={
                        `w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ` +
                        (isSelected
                          ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20'
                          : 'text-slate-600 dark:text-slate-200 hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-900/20')
                      }
                    >
                      <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${isSelected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-slate-300'}`}>
                        {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Experience Level Dropdown (multi-select) */}
          <div ref={filterExperienceRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenFilterDropdown(openFilterDropdown === 'experience' ? null : 'experience')}
              className={`px-3 py-1.5 text-xs tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 rounded-md ${
                clientExperiences.length > 0 
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="whitespace-nowrap">
                {clientExperiences.length === 0 
                  ? 'Experience' 
                  : clientExperiences.length === 1 
                    ? experienceOptions.find(o => o.value === clientExperiences[0])?.label 
                    : `${clientExperiences.length} selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {openFilterDropdown === 'experience' && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                {experienceOptions.filter(opt => opt.value !== '').map((opt) => {
                  const isSelected = clientExperiences.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setClientExperiences(clientExperiences.filter(v => v !== opt.value));
                        } else {
                          setClientExperiences([...clientExperiences, opt.value]);
                        }
                      }}
                      className={
                        `w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ` +
                        (isSelected
                          ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20'
                          : 'text-slate-600 dark:text-slate-200 hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-900/20')
                      }
                    >
                      <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${isSelected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-slate-300'}`}>
                        {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Posted Dropdown (single-select) */}
          <div ref={filterDateRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenFilterDropdown(openFilterDropdown === 'date' ? null : 'date')}
              className={`px-3 py-1.5 text-xs tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 rounded-md ${
                clientDatePosted 
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{getOptionLabel(datePostedOptions, clientDatePosted)}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {openFilterDropdown === 'date' && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                {datePostedOptions.map((opt) => {
                  const selected = opt.value === clientDatePosted;
                  return (
                    <button
                      key={opt.value || 'empty'}
                      type="button"
                      onClick={() => {
                        setClientDatePosted(opt.value);
                        setOpenFilterDropdown(null);
                      }}
                      className={
                        `w-full text-left px-4 py-2 text-xs transition-colors ` +
                        (selected
                          ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20'
                          : 'text-slate-600 dark:text-slate-200 hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-900/20')
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Easy Apply Toggle */}
          <button
            type="button"
            onClick={() => setClientEasyApply(!clientEasyApply)}
            className={`px-3 py-1.5 text-xs tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 rounded-md ${
              clientEasyApply 
                ? 'bg-[#FF6B00] text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Easy Apply</span>
          </button>

          {/* Clear Filters */}
          {(clientWorkTypes.length > 0 || clientExperiences.length > 0 || clientDatePosted || clientEasyApply) && (
            <button
              type="button"
              onClick={() => {
                setClientWorkTypes([]);
                setClientExperiences([]);
                setClientDatePosted('');
                setClientEasyApply(false);
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Row 2: Search Bar - FETCH VARIABLES ONLY (Keywords + Location) */}
        <div className="flex items-center justify-between px-8 py-5 w-full min-w-[1200px]">
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative group w-80 min-w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <input
                ref={keywordsInputRef}
                type="text"
                placeholder="Search by title, skill, or company"
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchKeywords.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg text-xs tracking-wider outline-none focus:border-slate-300 transition-all placeholder:text-slate-400"
                autoComplete="off"
              />
              {loadingSuggestions && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
              
              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 shadow-2xl z-50 rounded-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.title}-${index}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center gap-2 ${
                        index === selectedSuggestionIndex
                          ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20'
                          : 'text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{suggestion.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative group w-60 min-w-60">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="City, state, or zip code"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg text-xs tracking-wider outline-none focus:border-slate-300 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Row 2 Work Type (sent to API/DB; not connected to Row 1 UI filters) */}
            <div className="relative group w-44 min-w-44">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={fetchWorkType}
                onChange={(e) => setFetchWorkType(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg text-xs tracking-wider outline-none focus:border-slate-300 transition-all text-slate-600 dark:text-slate-200"
              >
                {remoteOptions.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2 Experience Level (sent to API/DB; not connected to Row 1 UI filters) */}
            <div className="relative group w-52 min-w-52">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={fetchExperienceLevel}
                onChange={(e) => setFetchExperienceLevel(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg text-xs tracking-wider outline-none focus:border-slate-300 transition-all text-slate-600 dark:text-slate-200"
              >
                {experienceOptions.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleSearch(1)}
              disabled={loading || (!searchKeywords && !searchLocation)}
              className="px-6 py-2.5 bg-[#FF6B00] hover:bg-[#E55A00] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium tracking-wider transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {/* Results info */}
          {rawResults.length > 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {fromCache ? 'From cache' : 'Fresh results'} • Page {currentPage} of {totalPages}
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto px-8 pb-8">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {loading && rawResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mb-4" />
              <p className="text-sm text-slate-500">Searching for jobs...</p>
            </div>
          ) : results.length === 0 && rawResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">Enter keywords or location to search for jobs</p>
            </div>
          ) : results.length === 0 && rawResults.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">No jobs match your filters. Try adjusting the filters above.</p>
            </div>
          ) : (
            <>
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 font-normal">Company</th>
                    <th className="pb-3 font-normal">Role</th>
                    <th className="pb-3 font-normal">Location</th>
                    <th className="pb-3 font-normal">Type</th>
                    <th className="pb-3 font-normal">Posted</th>
                    <th className="pb-3 font-normal">Salary</th>
                    <th className="pb-3 font-normal">Easy Apply</th>
                    <th className="pb-3 font-normal">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((job, idx) => (
                    <tr
                      key={job.job_url || idx}
                      data-job-row
                      onClick={() => setSelectedJob(job)}
                      className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors ${
                        selectedJob?.job_url === job.job_url ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                      }`}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                            {job.companyLogo ? (
                              <img src={job.companyLogo} alt={job.company} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{job.company || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{job.job_title || 'Unknown'}</span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{job.location || 'Not specified'}</span>
                      </td>
                      <td className="py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          (job.work_type || '').toLowerCase().includes('remote')
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : (job.work_type || '').toLowerCase().includes('hybrid')
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {job.work_type || 'On-site'}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{job.posted_at || 'Unknown'}</span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{job.salary || '-'}</span>
                      </td>
                      <td className="py-4">
                        {job.is_easy_apply ? (
                          <span className="flex items-center gap-1 text-xs text-[#FF6B00]">
                            <Zap className="w-3.5 h-3.5" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-4">
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#FF6B00] hover:text-[#E55A00] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={loading}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[#FF6B00] text-white'
                            : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar - Job Details */}
      {selectedJob && (
        <div
          ref={sidebarRef}
          className="fixed right-0 top-0 h-full w-[600px] bg-white dark:bg-[#0D0F16] border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto z-40"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-[#0D0F16] border-b border-slate-200 dark:border-slate-800 p-6 z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  {selectedJob.companyLogo ? (
                    <img src={selectedJob.companyLogo} alt={selectedJob.company} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedJob.job_title}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedJob.company}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onAnalyzeJob(selectedJob)}
                className="flex-1 px-4 py-2.5 bg-[#FF6B00] hover:bg-[#E55A00] text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Create CV
              </button>
              <button className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Share2 className="w-4 h-4 text-slate-500" />
              </button>
              <a
                href={selectedJob.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </a>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-300">{selectedJob.location || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-300">{selectedJob.work_type || 'On-site'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-300">{selectedJob.posted_at || 'Unknown'}</span>
              </div>
              {selectedJob.salary && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">{selectedJob.salary}</span>
                </div>
              )}
              {selectedJob.applicant_count && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">{selectedJob.applicant_count} applicants</span>
                </div>
              )}
              {selectedJob.is_easy_apply && (
                <div className="flex items-center gap-2 text-sm text-[#FF6B00]">
                  <Zap className="w-4 h-4" />
                  <span>Easy Apply</span>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedJob.description && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Description</h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {selectedJob.description}
                </div>
              </div>
            )}

            {/* Job Insights */}
            {selectedJob.job_insights && selectedJob.job_insights.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Insights</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.job_insights.map((insight: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs"
                    >
                      {insight}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
