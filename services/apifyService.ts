import { supabase } from './supabaseClient';

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

  async searchJobs(params: any): Promise<any[]> {
    const { data, error } = await supabase.functions.invoke('apify', {
      body: { action: 'searchJobs', params }
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async fetchLinkedInProfile(profileUrl: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('apify', {
      body: { action: 'fetchLinkedInProfile', profileUrl }
    });
    if (error) throw error;
    return data;
  }
};
