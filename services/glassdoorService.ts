
const API_KEY = ''; // Set via environment variable VITE_RAPIDAPI_KEY
const API_HOST = 'real-time-glassdoor-data.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;

const HEADERS = {
  'x-rapidapi-key': API_KEY,
  'x-rapidapi-host': API_HOST
};

export const GlassdoorService = {

  /**
   * Helper: Map specific titles to broader Glassdoor categories
   */
  getJobCategory(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('engineer') || t.includes('developer') || t.includes('programmer') || t.includes('coder')) return 'ENGINEERING';
    if (t.includes('sales') || t.includes('account executive') || t.includes('sdr') || t.includes('bdr')) return 'SALES';
    if (t.includes('product') || t.includes('manager') || t.includes('owner')) return 'PRODUCT_AND_PROJECT_MANAGEMENT';
    if (t.includes('design') || t.includes('ux') || t.includes('ui') || t.includes('creative')) return 'ARTS_AND_DESIGN';
    if (t.includes('marketing') || t.includes('seo') || t.includes('content')) return 'MARKETING';
    if (t.includes('hr') || t.includes('human resources') || t.includes('recruiter')) return 'HUMAN_RESOURCES';
    if (t.includes('analyst') || t.includes('data')) return 'INFORMATION_TECHNOLOGY';
    return 'OTHER';
  },

  /**
   * Search for a company to get its ID
   */
  async searchCompany(query: string): Promise<any> {
    try {
      const url = `${BASE_URL}/company-search?query=${encodeURIComponent(query)}&limit=1&domain=www.glassdoor.com`;
      const response = await fetch(url, { headers: HEADERS });
      const json = await response.json();

      if (json.data && json.data.length > 0) {
        return json.data[0];
      }
      return null;
    } catch (error) {
      console.error("Glassdoor Search Error:", error);
      return null;
    }
  },

  /**
   * Get Company Overview
   */
  async getOverview(companyId: string): Promise<any> {
    try {
      const url = `${BASE_URL}/company-overview?company_id=${companyId}&domain=www.glassdoor.com`;
      const response = await fetch(url, { headers: HEADERS });
      const json = await response.json();
      return json.data;
    } catch (error) {
      console.error("Glassdoor Overview Error:", error);
      return null;
    }
  },

  /**
   * Get Company Reviews (Fetch 2 pages to get ~20-40 results)
   */
  async getReviews(companyId: string, page: number = 1, keyword?: string): Promise<any> {
    try {
      // Helper to fetch a single page
      const fetchPage = async (p: number) => {
        let url = `${BASE_URL}/company-reviews?company_id=${companyId}&page=${p}&sort=POPULAR&language=en&domain=www.glassdoor.com`;
        if (keyword) url += `&query=${encodeURIComponent(keyword)}`;
        const res = await fetch(url, { headers: HEADERS });
        return res.json();
      };

      // Fetch Page 1 and Page 2 in parallel
      const [data1, data2] = await Promise.all([fetchPage(page), fetchPage(page + 1)]);

      // Merge results
      const combinedReviews = [...(data1.data?.reviews || []), ...(data2.data?.reviews || [])];

      return {
        ...data1.data,
        reviews: combinedReviews
      };
    } catch (error) {
      console.error("Glassdoor Reviews Error:", error);
      return null;
    }
  },

  /**
   * Get Interviews (Fetch 2 pages)
   */
  async getInterviews(companyId: string, page: number = 1, jobTitle?: string, location?: string): Promise<any> {
    try {
      const fetchPage = async (p: number) => {
        let url = `${BASE_URL}/company-interviews?company_id=${companyId}&page=${p}&sort=POPULAR&domain=www.glassdoor.com`;
        if (jobTitle && jobTitle.length > 2) url += `&job_title=${encodeURIComponent(jobTitle)}`;
        if (location && location.length > 2) url += `&location=${encodeURIComponent(location)}`;
        const res = await fetch(url, { headers: HEADERS });
        return res.json();
      };

      const [data1, data2] = await Promise.all([fetchPage(page), fetchPage(page + 1)]);

      const combinedInterviews = [...(data1.data?.interviews || []), ...(data2.data?.interviews || [])];

      return {
        ...data1.data,
        interviews: combinedInterviews
      };
    } catch (error) {
      console.error("Glassdoor Interviews Error:", error);
      return null;
    }
  },

  /**
   * Get Salaries
   * Now supports filtering by specific categories provided by the user.
   */
  async getSalaries(companyId: string, category?: string, location?: string): Promise<any> {
    try {
      // Glassdoor API salary endpoint often treats 'job_title' as a keyword search. 
      // Passing the category name (e.g., "ENGINEERING") usually filters effectively.

      const fetchPage = async (p: number) => {
        let url = `${BASE_URL}/company-salaries-v2?company_id=${companyId}&page=${p}&sort=MOST_SALARIES&domain=www.glassdoor.com`;

        if (category && category !== 'ALL') {
          // We pass category as job_title keyword because the API often groups by title matching
          url += `&job_title=${encodeURIComponent(category)}`;
        }

        // Location needs to be handled if supported by endpoint, otherwise we rely on smart defaults
        if (location) {
          url += `&location_type=CITY`; // Try to force city match
          // Note: This API endpoint is tricky with location names directly in params sometimes, 
          // but we will try to append if the query param exists in docs (often it's implicitly handled or requires ID)
        }

        const res = await fetch(url, { headers: HEADERS });
        return res.json();
      };

      // Fetch 3 pages to ensure we get ~30-50 salaries
      const [data1, data2, data3] = await Promise.all([fetchPage(1), fetchPage(2), fetchPage(3)]);

      const combinedSalaries = [
        ...(data1.data?.salaries || []),
        ...(data2.data?.salaries || []),
        ...(data3.data?.salaries || [])
      ];

      // De-duplicate by job title id if possible, otherwise just return list
      return {
        salaries: combinedSalaries
      };
    } catch (error) {
      console.error("Glassdoor Salaries Error:", error);
      return null;
    }
  },

  /**
   * Get Specific Salary Estimation for User's Role (Single estimate)
   */
  async getSalaryEstimate(jobTitle: string, location: string): Promise<any> {
    try {
      const url = `${BASE_URL}/salary-estimation?job_title=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}&domain=www.glassdoor.com`;
      const response = await fetch(url, { headers: HEADERS });
      const json = await response.json();
      return json.data;
    } catch (error) {
      console.error("Glassdoor Estimation Error:", error);
      return null;
    }
  }
};
