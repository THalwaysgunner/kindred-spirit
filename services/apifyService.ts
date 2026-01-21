import { supabase } from './supabaseClient';

export interface JobSearchParams {
  keywords?: string;
  location?: string;
  remote?: string;
  date_posted?: string;
  experienceLevel?: string;
  easy_apply?: string;
  page?: number;
  pageSize?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
  clientFilters?: {
    workTypes?: string[];
    experiences?: string[];
    datePosted?: string;
    easyApply?: boolean;
  };
}

export interface JobSearchResponse {
  jobs: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  fromCache: boolean;
  hasMoreResults: boolean;
  stats?: {
    total: number;
    remote: number;
    easyApply: number;
    recent: number;
  };
}

/**
 * Service to interact with Apify via Edge Function
 */
export const ApifyService = {
  async fetchJobDetails(jobInput: string, type: 'url' | 'id'): Promise<any> {
    const { data, error } = await supabase.functions.invoke('apify', {
      body: { action: 'fetchJobDetails', jobInput, inputType: type }
    });
    if (error) throw error;
    return data;
  },

  async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
    const { data, error } = await supabase.functions.invoke('apify', {
      body: { 
        action: 'searchJobs', 
        params: {
          keywords: params.keywords || '',
          location: params.location || '',
          remote: params.remote || '',
          date_posted: params.date_posted || '',
          experienceLevel: params.experienceLevel || '',
          easy_apply: params.easy_apply || '',
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          forceRefresh: params.forceRefresh || false,
          cacheOnly: params.cacheOnly || false,
          clientFilters: params.clientFilters || null
        }
      }
    });
    if (error) throw error;
    
    // Handle both old format (array) and new format (object with pagination)
    if (Array.isArray(data)) {
      return {
        jobs: data,
        totalCount: data.length,
        page: 1,
        pageSize: data.length,
        totalPages: 1,
        fromCache: false,
        hasMoreResults: false
      };
    }
    
    return data as JobSearchResponse;
  },

  async fetchLinkedInProfile(profileUrl: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('apify', {
      body: { action: 'fetchLinkedInProfile', profileUrl }
    });
    if (error) throw error;
    return data;
  },

  async cleanupExpiredCache(): Promise<{ deleted: number }> {
    const { data, error } = await supabase.functions.invoke('apify', {
      body: { action: 'cleanupExpiredCache' }
    });
    if (error) throw error;
    return data;
  }
};
