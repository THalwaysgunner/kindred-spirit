import { supabase } from './supabaseClient';

export const GlassdoorService = {
  getJobCategory(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('engineer') || t.includes('developer')) return 'ENGINEERING';
    if (t.includes('sales')) return 'SALES';
    if (t.includes('product') || t.includes('manager')) return 'PRODUCT_AND_PROJECT_MANAGEMENT';
    if (t.includes('design') || t.includes('ux')) return 'ARTS_AND_DESIGN';
    if (t.includes('marketing')) return 'MARKETING';
    if (t.includes('hr') || t.includes('recruiter')) return 'HUMAN_RESOURCES';
    if (t.includes('analyst') || t.includes('data')) return 'INFORMATION_TECHNOLOGY';
    return 'OTHER';
  },

  async searchCompany(query: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('glassdoor', {
      body: { action: 'searchCompany', query }
    });
    if (error) throw error;
    return data;
  },

  async getOverview(companyId: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('glassdoor', {
      body: { action: 'getOverview', companyId }
    });
    if (error) throw error;
    return data;
  },

  async getReviews(companyId: string, page?: number, keyword?: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('glassdoor', {
      body: { action: 'getReviews', companyId, page, keyword }
    });
    if (error) throw error;
    return data;
  },

  async getInterviews(companyId: string, page?: number, jobTitle?: string, location?: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('glassdoor', {
      body: { action: 'getInterviews', companyId, page, jobTitle, location }
    });
    if (error) throw error;
    return data;
  },

  async getSalaries(companyId: string, category?: string, location?: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('glassdoor', {
      body: { action: 'getSalaries', companyId, category, location }
    });
    if (error) throw error;
    return data;
  },

  async getSalaryEstimate(jobTitle: string, location: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('glassdoor', {
      body: { action: 'getSalaryEstimate', jobTitle, location }
    });
    if (error) throw error;
    return data;
  }
};
