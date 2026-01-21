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
  const [easyApplyFilter, setEasyApplyFilter] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const keywordsInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter bar dropdowns (for filtering loaded results - multi-select)
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'remote' | 'experience' | 'date' | null>(null);
  const filterRemoteRef = useRef<HTMLDivElement>(null);
  const filterExperienceRef = useRef<HTMLDivElement>(null);
  const filterDateRef = useRef<HTMLDivElement>(null);

  // Search toolbar dropdowns (for API params - single select)
  const [openSearchDropdown, setOpenSearchDropdown] = useState<'remote' | 'experience' | null>(null);
  const searchRemoteRef = useRef<HTMLDivElement>(null);
  const searchExperienceRef = useRef<HTMLDivElement>(null);

  // Multi-select filter state (client-side filters)
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [selectedExperiences, setSelectedExperiences] = useState<string[]>([]);
  const [selectedDatePosted, setSelectedDatePosted] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fromCache, setFromCache] = useState(false);
  const pageSize = 20;

  const [filters, setFilters] = useState<SearchFilters>({
    keywords: '',
    location: '',
    date_posted: '',
    experienceLevel: '',
    remote: '',
    easy_apply: ''
  });

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
      fetchSuggestions(filters.keywords);
    }, 200);

    return () => clearTimeout(timer);
  }, [filters.keywords, fetchSuggestions]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    setFilters({ ...filters, keywords: suggestion.title });
    setShowSuggestions(false);
    setSuggestions([]);
    keywordsInputRef.current?.focus();
  };

  // Client-side filter options (all applied after fetching)

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

  // Client-side filter options (applied after fetching)
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

  const handleSearch = async (page: number = 1, forceRefresh: boolean = false) => {
    if (!filters.keywords && !filters.location) return;

    setLoading(true);
    setError(null);
    if (page === 1) {
      setResults([]);
      setSelectedJob(null);
    }

    try {
      // The upstream search API only supports single values for these params.
      // If multiple are selected, we fetch broader results and rely on client-side filtering.
      const apiRemote = selectedWorkTypes.length === 1 ? selectedWorkTypes[0] : '';
      const apiExperienceLevel = selectedExperiences.length === 1 ? selectedExperiences[0] : '';

      // Always send empty easy_apply to API - we filter client-side only
      // This ensures we get ALL jobs from the API, not just easy apply ones
      const searchParams = {
        keywords: filters.keywords,
        location: filters.location,
        remote: apiRemote,
        experienceLevel: apiExperienceLevel,
        date_posted: '',
        easy_apply: '', // Never filter by easy_apply at API level - client-side only
        page,
        pageSize,
        forceRefresh
      };

      console.log('[JobSearch] Sending to API:', searchParams);

      const response = await ApifyService.searchJobs(searchParams);
      
      setResults(response.jobs);
      setTotalCount(response.totalCount);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
      setFromCache(response.fromCache);
      
      if (response.jobs.length > 0 && page === 1) {
        setSelectedJob(response.jobs[0]);
      }
    } catch (err) {
      setError("Failed to fetch jobs. Please try different keywords or try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  // Filter results based on client-side filters (multi-select work types, experiences, date, easy apply)
  const filteredResults = useMemo(() => {
    return results.filter(job => {
      // Work type filter (multi-select)
      if (selectedWorkTypes.length > 0) {
        const workType = job.work_type?.toLowerCase() || '';
        const matchesAny = selectedWorkTypes.some(filter => {
          if (filter === 'remote') return workType.includes('remote');
          if (filter === 'onsite') return workType.includes('on-site') || workType.includes('onsite');
          if (filter === 'hybrid') return workType.includes('hybrid');
          return false;
        });
        if (!matchesAny) return false;
      }

      // Experience level filter (multi-select)
      if (selectedExperiences.length > 0) {
        const title = job.job_title?.toLowerCase() || '';
        const matchesAny = selectedExperiences.some(filter => {
          if (filter === 'internship') return title.includes('intern');
          if (filter === 'entry') return title.includes('entry') || title.includes('junior');
          if (filter === 'associate') return title.includes('associate');
          if (filter === 'mid_senior') return title.includes('senior') || title.includes('lead');
          if (filter === 'director') return title.includes('director') || title.includes('head');
          if (filter === 'executive') return title.includes('executive') || title.includes('vp') || title.includes('chief');
          return false;
        });
        if (!matchesAny) return false;
      }

      // Date filter (single select)
      if (selectedDatePosted) {
        const postedAt = job.posted_at?.toLowerCase() || '';
        if (selectedDatePosted === 'hour' && !postedAt.includes('minute')) return false;
        if (selectedDatePosted === 'day' && !postedAt.includes('hour') && !postedAt.includes('minute')) return false;
        if (selectedDatePosted === 'week' && postedAt.includes('month')) return false;
      }

      // Easy Apply filter
      if (easyApplyFilter && !job.is_easy_apply) return false;

      return true;
    });
  }, [results, selectedWorkTypes, selectedExperiences, selectedDatePosted, easyApplyFilter]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = results.length;
    const remote = results.filter(j => j.work_type?.toLowerCase().includes('remote')).length;
    const easyApply = results.filter(j => j.is_easy_apply).length;
    const recent = results.filter(j => j.posted_at?.toLowerCase().includes('hour') || j.posted_at?.toLowerCase().includes('minute')).length;

    return [
      { label: 'Total Results', value: total, growth: '', trend: 'up' },
      { label: 'Remote Jobs', value: remote, growth: '', trend: 'up' },
      { label: 'Easy Apply', value: easyApply, growth: '', trend: 'up' },
      { label: 'Posted Today', value: recent, growth: '', trend: 'up' },
    ];
  }, [results]);

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

      // Close search toolbar dropdowns
      if (openSearchDropdown) {
        const searchRemoteContains = !!searchRemoteRef.current?.contains(targetNode);
        const searchExpContains = !!searchExperienceRef.current?.contains(targetNode);
        if (!searchRemoteContains && !searchExpContains) {
          setOpenSearchDropdown(null);
        }
      }

      if (selectedJob && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        // Don't close if clicking on a table row
        const target = event.target as HTMLElement;
        if (!target.closest('tr[data-job-row]')) {
          setSelectedJob(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedJob, openFilterDropdown, openSearchDropdown]);

  return (
    <div className="flex relative min-h-screen bg-white dark:bg-[#0D0F16] font-sans transition-colors w-full overflow-x-hidden min-w-[1200px]">
      {/* Main Content */}
      <div className={`flex flex-col w-full transition-all duration-300 ${selectedJob ? 'mr-[600px]' : ''}`}>

        {/* 1. Stat Cards - Same as ApplicationsList */}
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

        {/* 2. Filter Bar - Dropdowns for filtering results (MULTI-SELECT) */}
        <div className="flex items-center gap-4 px-8 py-3 border-b border-slate-200 dark:border-slate-800 w-full">
          {/* Work Type Dropdown (multi-select) */}
          <div ref={filterRemoteRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenFilterDropdown(openFilterDropdown === 'remote' ? null : 'remote')}
              className={`px-3 py-1.5 text-xs tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 rounded-md ${
                selectedWorkTypes.length > 0 
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="whitespace-nowrap">
                {selectedWorkTypes.length === 0 
                  ? 'Work Type' 
                  : selectedWorkTypes.length === 1 
                    ? remoteOptions.find(o => o.value === selectedWorkTypes[0])?.label 
                    : `${selectedWorkTypes.length} selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {openFilterDropdown === 'remote' && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                {remoteOptions.filter(opt => opt.value !== '').map((opt) => {
                  const isSelected = selectedWorkTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedWorkTypes(selectedWorkTypes.filter(v => v !== opt.value));
                        } else {
                          setSelectedWorkTypes([...selectedWorkTypes, opt.value]);
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
                selectedExperiences.length > 0 
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="whitespace-nowrap">
                {selectedExperiences.length === 0 
                  ? 'Experience' 
                  : selectedExperiences.length === 1 
                    ? experienceOptions.find(o => o.value === selectedExperiences[0])?.label 
                    : `${selectedExperiences.length} selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {openFilterDropdown === 'experience' && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                {experienceOptions.filter(opt => opt.value !== '').map((opt) => {
                  const isSelected = selectedExperiences.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedExperiences(selectedExperiences.filter(v => v !== opt.value));
                        } else {
                          setSelectedExperiences([...selectedExperiences, opt.value]);
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
                selectedDatePosted 
                  ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{getOptionLabel(datePostedOptions, selectedDatePosted)}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            {openFilterDropdown === 'date' && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                {datePostedOptions.map((opt) => {
                  const selected = opt.value === selectedDatePosted;
                  return (
                    <button
                      key={opt.value || 'empty'}
                      type="button"
                      onClick={() => {
                        setSelectedDatePosted(opt.value);
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
            onClick={() => setEasyApplyFilter(!easyApplyFilter)}
            className={`px-3 py-1.5 text-xs tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 rounded-md ${
              easyApplyFilter 
                ? 'bg-[#FF6B00] text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Easy Apply</span>
          </button>

          {/* Clear Filters */}
          {(selectedWorkTypes.length > 0 || selectedExperiences.length > 0 || selectedDatePosted || easyApplyFilter) && (
            <button
              type="button"
              onClick={() => {
                setSelectedWorkTypes([]);
                setSelectedExperiences([]);
                setSelectedDatePosted('');
                setEasyApplyFilter(false);
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* 3. Search Toolbar Row - API parameters */}
        <div className="flex items-center justify-between px-8 py-5 w-full min-w-[1200px]">
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative group w-80 min-w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <input
                ref={keywordsInputRef}
                type="text"
                placeholder="Search by title, skill, or company"
                value={filters.keywords}
                onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                onKeyDown={handleKeyDown}
                onFocus={() => filters.keywords.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
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
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg text-xs tracking-wider outline-none focus:border-slate-300 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* API Search Filters - single select for search params */}
            <div ref={searchRemoteRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenSearchDropdown(openSearchDropdown === 'remote' ? null : 'remote')}
                className="w-36 min-w-36 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex items-center justify-between"
              >
                <span className="whitespace-nowrap">
                  {selectedWorkTypes.length === 0
                    ? getOptionLabel(remoteOptions, '')
                    : selectedWorkTypes.length === 1
                      ? remoteOptions.find(o => o.value === selectedWorkTypes[0])?.label
                      : `${selectedWorkTypes.length} selected`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {openSearchDropdown === 'remote' && (
                <div className="absolute top-full mt-1 w-36 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                  {remoteOptions.filter(opt => opt.value !== '').map((opt) => {
                    const selected = selectedWorkTypes.includes(opt.value);
                    return (
                      <button
                        key={opt.value || 'empty'}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setSelectedWorkTypes(selectedWorkTypes.filter(v => v !== opt.value));
                          } else {
                            setSelectedWorkTypes([...selectedWorkTypes, opt.value]);
                          }
                        }}
                        className={
                          `w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ` +
                          (selected
                            ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20'
                            : 'text-slate-600 dark:text-slate-200 hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-900/20')
                        }
                      >
                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${selected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-slate-300'}`}>
                          {selected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={searchExperienceRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenSearchDropdown(openSearchDropdown === 'experience' ? null : 'experience')}
                className="w-36 min-w-36 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex items-center justify-between"
              >
                <span className="whitespace-nowrap">
                  {selectedExperiences.length === 0
                    ? getOptionLabel(experienceOptions, '')
                    : selectedExperiences.length === 1
                      ? experienceOptions.find(o => o.value === selectedExperiences[0])?.label
                      : `${selectedExperiences.length} selected`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {openSearchDropdown === 'experience' && (
                <div className="absolute top-full mt-1 w-36 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                  {experienceOptions.filter(opt => opt.value !== '').map((opt) => {
                    const selected = selectedExperiences.includes(opt.value);
                    return (
                      <button
                        key={opt.value || 'empty'}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setSelectedExperiences(selectedExperiences.filter(v => v !== opt.value));
                          } else {
                            setSelectedExperiences([...selectedExperiences, opt.value]);
                          }
                        }}
                        className={
                          `w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ` +
                          (selected
                            ? 'bg-orange-50 text-[#FF6B00] dark:bg-orange-900/20'
                            : 'text-slate-600 dark:text-slate-200 hover:bg-orange-50 hover:text-[#FF6B00] dark:hover:bg-orange-900/20')
                        }
                      >
                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${selected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-slate-300'}`}>
                          {selected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => handleSearch(1)}
              disabled={loading}
              className="px-5 py-2.5 min-w-32 bg-vexo-orange text-white hover:bg-[#e56a42] text-xs tracking-wider rounded-md flex items-center justify-center gap-2 transition-all shadow-sm shadow-orange-500/20 ml-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 stroke-[3]" />}
              Search Jobs
            </button>
          </div>
        </div>

        {/* 4. Jobs Table */}
        <div className="flex-1 w-full overflow-x-auto no-scrollbar">
          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-[#FF6B00] animate-spin mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">Scanning LinkedIn...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <AlertCircle className="w-12 h-12 mb-2" />
              <p>{error}</p>
            </div>
          )}

          {results.length === 0 && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Briefcase className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No jobs found yet</p>
              <p className="text-sm">Try searching for keywords like "Frontend" in "New York"</p>
            </div>
          )}

          {filteredResults.length > 0 && (
            <table className="w-full text-left text-sm border-collapse min-w-[1300px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-8">Company</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Role</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Location</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Type</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Posted</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Salary</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4 text-center">Easy Apply</th>
                  <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4 text-center">Link</th>
                  <th className="py-4 w-12 pr-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredResults.map((job, idx) => (
                  <tr
                    key={idx}
                    data-job-row
                    onClick={() => setSelectedJob(job)}
                    className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${selectedJob?.job_url === job.job_url ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                  >
                    {/* Company */}
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                          {job.companyLogo ? (
                            <img src={job.companyLogo} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Building2 className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-[#FF6B00] transition-colors flex items-center gap-1">
                            {job.company}
                            {job.is_verified && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                          </span>
                          {job.applicant_count > 0 && (
                            <span className="text-xs text-slate-400">{job.applicant_count} applicants</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-5 px-4">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{job.job_title}</span>
                    </td>

                    {/* Location */}
                    <td className="py-5 px-4">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{job.location || '-'}</span>
                    </td>

                    {/* Type */}
                    <td className="py-5 px-4">
                      {job.work_type ? (
                        <span className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-md">
                          {job.work_type}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Posted */}
                    <td className="py-5 px-4">
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">{job.posted_at || '-'}</span>
                    </td>

                    {/* Salary */}
                    <td className="py-5 px-4">
                      {job.salary ? (
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{job.salary}</span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Easy Apply */}
                    <td className="py-5 px-4 text-center">
                      {job.is_easy_apply ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#FF6B00] font-bold">
                          <Zap className="w-3 h-3" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Link */}
                    <td className="py-5 px-4 text-center">
                      {job.job_url && (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[#FF6B00] hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-5 pr-8">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAnalyzeJob(job);
                        }}
                        className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-[#FF6B00] text-white text-xs font-medium rounded-md hover:bg-[#E66000] transition-all flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Create CV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between px-8 py-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount} jobs
                </span>
                {fromCache && (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs font-medium">
                    Cached
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
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
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[#FF6B00] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Job Details */}
      {selectedJob && (
        <div
          ref={sidebarRef}
          className="fixed top-0 right-0 w-[600px] h-full bg-white dark:bg-[#0D0F16] border-l border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col z-40 animate-in slide-in-from-right-5 duration-300"
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                {selectedJob.companyLogo ? (
                  <img src={selectedJob.companyLogo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{selectedJob.job_title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {selectedJob.company}
                  {selectedJob.is_verified && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                </p>
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
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => onAnalyzeJob(selectedJob)}
              className="flex-1 px-4 py-2.5 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm shadow-orange-500/20"
            >
              <FileText className="w-4 h-4" />
              Create CV
            </button>
            <button className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Save
            </button>
            <button className="p-2.5 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Job Meta */}
          <div className="grid grid-cols-2 gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-300">{selectedJob.location || 'Not specified'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-300">{selectedJob.work_type || 'Not specified'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-green-600 dark:text-green-400">{selectedJob.posted_at || 'Recently'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {selectedJob.applicant_count ? `${selectedJob.applicant_count} applicants` : 'Be first to apply'}
              </span>
            </div>
            {selectedJob.salary && (
              <div className="flex items-center gap-2 col-span-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{selectedJob.salary}</span>
              </div>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* About the job */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">About the job</h3>
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedJob.description || 'No description available.'}
              </div>
            </div>

            {/* Job Insights */}
            {selectedJob.job_insights && selectedJob.job_insights.length > 0 && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm">Job Insights</h3>
                <ul className="space-y-2">
                  {selectedJob.job_insights.map((insight, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#FF6B00] shrink-0"></div>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* About Company */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm">About the company</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg flex items-center justify-center shrink-0">
                  {selectedJob.companyLogo ? (
                    <img src={selectedJob.companyLogo} alt="" className="w-8 h-8 object-contain" />
                  ) : (
                    <Building2 className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{selectedJob.company}</div>
                  {selectedJob.applicant_count > 0 && (
                    <div className="text-xs text-slate-500">{selectedJob.applicant_count} current applicants</div>
                  )}
                </div>
                {selectedJob.company_url && (
                  <a
                    href={selectedJob.company_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#FF6B00] font-bold text-xs hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {selectedJob.company} is hiring for this position. Click view to learn more about the company.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
