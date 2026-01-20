// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Actor IDs
const ACTOR_CRAWLER = 'apify~website-content-crawler';
const ACTOR_LINKEDIN_ID = 'apimaestro~linkedin-job-detail';
const ACTOR_JOB_SEARCH = 'apimaestro~linkedin-jobs-scraper-api';
const ACTOR_LINKEDIN_PROFILE = 'apimaestro~linkedin-profile-detail';

// Cache duration in hours
const CACHE_HOURS = 6;

// Generate a hash for search parameters
function generateSearchHash(params: any): string {
  const normalized = {
    keywords: (params.keywords || '').toLowerCase().trim(),
    location: (params.location || '').toLowerCase().trim(),
    remote: params.remote || '',
    date_posted: params.date_posted || '',
    experienceLevel: params.experienceLevel || '',
    easy_apply: params.easy_apply || '',
  };
  return btoa(JSON.stringify(normalized));
}

async function runActor(actorId: string, inputPayload: any, apiToken: string, returnAllItems = false): Promise<any> {
  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`;

  console.log(`[Apify] Starting actor: ${actorId}`);
  
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputPayload),
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Apify Start Error: ${startRes.status} - ${errText}`);
  }

  const startData = await startRes.json();
  const runId = startData.data.id;
  const defaultDatasetId = startData.data.defaultDatasetId;
  console.log(`[Apify] Run started with ID: ${runId}`);

  // Poll for completion
  const maxRetries = 60;
  let attempt = 0;
  let isComplete = false;

  while (attempt < maxRetries && !isComplete) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    attempt++;

    const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();
    const status = statusData.data.status;

    console.log(`[Apify] Poll #${attempt}: ${status}`);

    if (status === 'SUCCEEDED') {
      isComplete = true;
    } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify Run Failed with status: ${status}`);
    }
  }

  if (!isComplete) {
    throw new Error("Apify scrape timed out.");
  }

  // Fetch results
  console.log('[Apify] Run succeeded. Fetching results...');
  const itemsUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${apiToken}`;
  const itemsRes = await fetch(itemsUrl);
  const items = await itemsRes.json();

  if (returnAllItems) {
    return items;
  }

  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get('APIFY_TOKEN');
    if (!apiToken) {
      throw new Error('APIFY_TOKEN not configured');
    }

    // Initialize Supabase client with service role for cache management
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, jobInput, inputType, params, profileUrl } = await req.json();
    
    let result;

    switch (action) {
      case 'fetchJobDetails': {
        let actorId = ACTOR_CRAWLER;
        let inputPayload: any = {};
        const cleanInput = jobInput.trim();

        if (inputType === 'id') {
          actorId = ACTOR_LINKEDIN_ID;
          let id = cleanInput;
          const idMatch = cleanInput.match(/currentJobId=(\d+)/) || cleanInput.match(/\/view\/(\d+)/);
          if (idMatch) {
            id = idMatch[1];
          }
          inputPayload = { job_id: [id] };
        } else {
          inputPayload = {
            startUrls: [{ url: cleanInput }],
            crawlerType: 'playwright:firefox',
            maxCrawlPages: 1,
            maxCrawlDepth: 0,
            htmlTransformer: 'readableText',
            saveMarkdown: true,
            proxyConfiguration: { useApifyProxy: true }
          };
        }

        result = await runActor(actorId, inputPayload, apiToken);
        break;
      }

      case 'searchJobs': {
        const page = params.page || 1;
        const pageSize = params.pageSize || 20;
        const forceRefresh = params.forceRefresh || false;

        // Generate cache key
        const searchHash = generateSearchHash(params);
        console.log(`[Cache] Search hash: ${searchHash}`);

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const { data: cached, error: cacheError } = await supabase
            .from('job_search_cache')
            .select('*')
            .eq('search_hash', searchHash)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

          if (cached && !cacheError) {
            console.log(`[Cache] HIT - Returning ${cached.total_count} cached jobs`);
            const jobs = cached.jobs as any[];
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedJobs = jobs.slice(startIndex, endIndex);
            
            result = {
              jobs: paginatedJobs,
              totalCount: cached.total_count,
              page,
              pageSize,
              totalPages: Math.ceil(cached.total_count / pageSize),
              fromCache: true
            };
            break;
          }
          console.log('[Cache] MISS - Fetching from Apify');
        } else {
          console.log('[Cache] Force refresh requested');
        }

        // Cache miss or force refresh - call Apify
        const inputPayload = {
          keywords: params.keywords || "engineer",
          location: params.location || "United States",
          page_number: 1,
          remote: params.remote || "",
          date_posted: params.date_posted || "",
          experienceLevel: params.experienceLevel || "",
          easy_apply: params.easy_apply || "",
          limit: 100 // Fetch more jobs for caching
        };

        const allJobs = await runActor(ACTOR_JOB_SEARCH, inputPayload, apiToken, true);
        const jobsArray = Array.isArray(allJobs) ? allJobs : [];
        
        console.log(`[Apify] Fetched ${jobsArray.length} jobs`);

        // Store in cache (upsert)
        const expiresAt = new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000).toISOString();
        
        const { error: upsertError } = await supabase
          .from('job_search_cache')
          .upsert({
            search_hash: searchHash,
            keywords: params.keywords || '',
            location: params.location || '',
            filters: {
              remote: params.remote || '',
              date_posted: params.date_posted || '',
              experienceLevel: params.experienceLevel || '',
              easy_apply: params.easy_apply || ''
            },
            jobs: jobsArray,
            total_count: jobsArray.length,
            expires_at: expiresAt
          }, {
            onConflict: 'search_hash'
          });

        if (upsertError) {
          console.error('[Cache] Failed to store results:', upsertError);
        } else {
          console.log(`[Cache] Stored ${jobsArray.length} jobs, expires at ${expiresAt}`);
        }

        // Return paginated results
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedJobs = jobsArray.slice(startIndex, endIndex);

        result = {
          jobs: paginatedJobs,
          totalCount: jobsArray.length,
          page,
          pageSize,
          totalPages: Math.ceil(jobsArray.length / pageSize),
          fromCache: false
        };
        break;
      }

      case 'fetchLinkedInProfile': {
        const inputPayload = {
          username: profileUrl,
          includeEmail: true
        };
        const items = await runActor(ACTOR_LINKEDIN_PROFILE, inputPayload, apiToken, true);
        result = Array.isArray(items) && items.length > 0 ? items[0] : null;
        break;
      }

      case 'cleanupExpiredCache': {
        // Cleanup expired cache entries
        const { error: deleteError, count } = await supabase
          .from('job_search_cache')
          .delete()
          .lt('expires_at', new Date().toISOString());

        if (deleteError) {
          throw deleteError;
        }
        result = { deleted: count || 0 };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Apify Edge Function Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
