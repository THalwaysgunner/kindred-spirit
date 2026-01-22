// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_HOST = 'real-time-glassdoor-data.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      throw new Error('RAPIDAPI_KEY not configured');
    }

    const headers = {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': API_HOST
    };

    const { action, query, companyId, page, keyword, jobTitle, location, category } = await req.json();

    let result;

    switch (action) {
      case 'searchCompany': {
        const url = `${BASE_URL}/company-search?query=${encodeURIComponent(query)}&limit=1&domain=www.glassdoor.com`;
        const response = await fetch(url, { headers });
        const json = await response.json();
        result = json.data?.[0] || null;
        break;
      }

      case 'getOverview': {
        const url = `${BASE_URL}/company-overview?company_id=${companyId}&domain=www.glassdoor.com`;
        const response = await fetch(url, { headers });
        const json = await response.json();
        result = json.data;
        break;
      }

      case 'getReviews': {
        const fetchPage = async (p: number) => {
          let url = `${BASE_URL}/company-reviews?company_id=${companyId}&page=${p}&sort=POPULAR&language=en&domain=www.glassdoor.com`;
          if (keyword) url += `&query=${encodeURIComponent(keyword)}`;
          const res = await fetch(url, { headers });
          return res.json();
        };
        const pageNum = page || 1;
        const [data1, data2] = await Promise.all([fetchPage(pageNum), fetchPage(pageNum + 1)]);
        const combinedReviews = [...(data1.data?.reviews || []), ...(data2.data?.reviews || [])];
        result = { ...data1.data, reviews: combinedReviews };
        break;
      }

      case 'getInterviews': {
        const fetchPage = async (p: number) => {
          const url = `${BASE_URL}/company-interviews?company_id=${companyId}&page=${p}&sort=POPULAR&job_function=${encodeURIComponent(jobTitle || '')}&location_type=ANY&received_offer_only=false&domain=www.glassdoor.com`;
          const res = await fetch(url, { headers });
          return res.json();
        };
        const pageNum = page || 1;
        const [data1, data2] = await Promise.all([fetchPage(pageNum), fetchPage(pageNum + 1)]);
        const combinedInterviews = [...(data1.data?.interviews || []), ...(data2.data?.interviews || [])];
        result = { ...data1.data, interviews: combinedInterviews };
        break;
      }

      case 'getSalaries': {
        const fetchPage = async (p: number) => {
          let url = `${BASE_URL}/company-salaries-v2?company_id=${companyId}&page=${p}&sort=MOST_SALARIES&domain=www.glassdoor.com`;
          if (category && category !== 'ALL') {
            url += `&job_title=${encodeURIComponent(category)}`;
          }
          if (location) {
            url += `&location_type=CITY`;
          }
          const res = await fetch(url, { headers });
          return res.json();
        };
        const [data1, data2, data3] = await Promise.all([fetchPage(1), fetchPage(2), fetchPage(3)]);
        const combinedSalaries = [
          ...(data1.data?.salaries || []),
          ...(data2.data?.salaries || []),
          ...(data3.data?.salaries || [])
        ];
        result = { salaries: combinedSalaries };
        break;
      }

      case 'getSalaryEstimate': {
        const url = `${BASE_URL}/salary-estimation?job_title=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}&domain=www.glassdoor.com`;
        const response = await fetch(url, { headers });
        const json = await response.json();
        result = json.data;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Glassdoor Edge Function Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
