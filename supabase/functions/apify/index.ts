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

// Config
const JOBS_PER_API_CALL = 100;
const STALE_HOURS = 24; // Consider data stale after 24 hours
const MIN_JOBS_THRESHOLD = 50; // Fetch more if we have less than this

// Parse relative date strings like "2 days ago" into actual timestamps
function parsePostedDate(postedText: string): Date {
  const now = new Date();
  if (!postedText) return now;
  
  const text = postedText.toLowerCase();
  
  const hoursMatch = text.match(/(\d+)\s*hours?\s*ago/);
  if (hoursMatch) {
    return new Date(now.getTime() - parseInt(hoursMatch[1]) * 60 * 60 * 1000);
  }
  
  const daysMatch = text.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    return new Date(now.getTime() - parseInt(daysMatch[1]) * 24 * 60 * 60 * 1000);
  }
  
  const weeksMatch = text.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    return new Date(now.getTime() - parseInt(weeksMatch[1]) * 7 * 24 * 60 * 60 * 1000);
  }
  
  const monthsMatch = text.match(/(\d+)\s*months?\s*ago/);
  if (monthsMatch) {
    return new Date(now.getTime() - parseInt(monthsMatch[1]) * 30 * 24 * 60 * 60 * 1000);
  }
  
  if (text.includes('just now') || text.includes('today')) return now;
  if (text.includes('yesterday')) return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return now;
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

  console.log('[Apify] Run succeeded. Fetching results...');
  const itemsUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${apiToken}`;
  const itemsRes = await fetch(itemsUrl);
  const items = await itemsRes.json();

  if (returnAllItems) {
    return items;
  }

  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

// Get or create search term (no AI - just stores the raw term)
async function getOrCreateSearchTerm(supabase: any, term: string, location: string): Promise<{ searchTerm: string; searchTermId: string }> {
  const normalizedInput = (term || '').toLowerCase().trim();
  const normalizedLocation = (location || '').toLowerCase().trim();

  // Check if we already have this term
  const { data: existingTerm } = await supabase
    .from('search_terms')
    .select('*')
    .eq('raw_term', normalizedInput)
    .eq('location', normalizedLocation)
    .maybeSingle();

  if (existingTerm) {
    // Increment search count
    await supabase
      .from('search_terms')
      .update({ 
        search_count: existingTerm.search_count + 1,
        last_searched_at: new Date().toISOString()
      })
      .eq('id', existingTerm.id);

    return {
      searchTerm: existingTerm.raw_term,
      searchTermId: existingTerm.id
    };
  }

  // Create new term (no AI normalization - just store raw term as-is)
  const { data: newTerm } = await supabase
    .from('search_terms')
    .upsert({
      raw_term: normalizedInput,
      canonical_term: normalizedInput, // Same as raw - no AI transformation
      location: normalizedLocation,
      search_count: 1,
      last_searched_at: new Date().toISOString()
    }, { onConflict: 'raw_term,location' })
    .select()
    .single();

  return {
    searchTerm: normalizedInput,
    searchTermId: newTerm?.id || ''
  };
}

// Store jobs in the database
async function storeJobs(supabase: any, jobs: any[], searchTermId: string): Promise<number> {
  let storedCount = 0;

  for (const job of jobs) {
    if (!job.job_url) continue;

    const postedAt = parsePostedDate(job.posted_time || job.posted_at_text || '');
    const expiresAt = new Date(postedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data: upsertedJob, error } = await supabase
      .from('jobs')
      .upsert({
        job_url: job.job_url,
        job_id: job.job_id || null,
        job_title: job.job_title || job.title || 'Unknown',
        company: job.company || job.company_name || 'Unknown',
        company_url: job.company_url || null,
        location: job.location || null,
        work_type: job.work_type || job.remote || null,
        salary: job.salary || null,
        description: job.description || null,
        requirements: job.requirements || null,
        benefits: job.benefits || [],
        skills: job.skills || [],
        is_easy_apply: job.is_easy_apply || job.easy_apply || false,
        applicant_count: job.applicant_count || null,
        posted_at: postedAt.toISOString(),
        posted_at_text: job.posted_time || job.posted_at_text || null,
        expires_at: expiresAt.toISOString(),
        raw_data: job,
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_url' })
      .select('id')
      .single();

    if (error) {
      console.error(`[Store] Error upserting job: ${error.message}`);
      continue;
    }

    if (upsertedJob && searchTermId) {
      await supabase
        .from('job_search_links')
        .upsert({
          job_id: upsertedJob.id,
          search_term_id: searchTermId
        }, { onConflict: 'job_id,search_term_id' });
      storedCount++;
    }
  }

  return storedCount;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get('APIFY_TOKEN');
    if (!apiToken) {
      throw new Error('APIFY_TOKEN not configured');
    }

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
        const keywords = params.keywords || 'software engineer';
        const location = params.location || 'United States';

        console.log(`[Search] Query: "${keywords}" in "${location}", page ${page}, forceRefresh: ${forceRefresh}`);

        // Step 1: Get or create search term (no AI - uses raw term)
        const { searchTerm, searchTermId } = await getOrCreateSearchTerm(supabase, keywords, location);
        console.log(`[Search] Search term: "${searchTerm}"`);

        // Step 2: Check if we have fresh data
        const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
        
        const { data: searchTermRow } = await supabase
          .from('search_terms')
          .select('*')
          .eq('id', searchTermId)
          .single();

        const isStale = !searchTermRow?.last_fetched_at || searchTermRow.last_fetched_at < staleThreshold;

        // Step 3: Get existing jobs from DB
        const startIndex = (page - 1) * pageSize;

        // Build query for jobs linked to this search term (or similar canonical terms)
        let jobQuery = supabase
          .from('jobs')
          .select(`
            *,
            job_search_links!inner(search_term_id)
          `)
          .gt('expires_at', new Date().toISOString())
          .order('posted_at', { ascending: false });

        // Filter by search term
        if (searchTermId) {
          // Get all search terms with the same raw term (for cache sharing)
          const { data: relatedTerms } = await supabase
            .from('search_terms')
            .select('id')
            .eq('raw_term', searchTerm);

          const termIds = relatedTerms?.map(t => t.id) || [searchTermId];
          jobQuery = jobQuery.in('job_search_links.search_term_id', termIds);
        }

        // Apply filters
        if (params.remote && params.remote !== '') {
          jobQuery = jobQuery.eq('work_type', params.remote);
        }
        if (params.easy_apply === 'true') {
          jobQuery = jobQuery.eq('is_easy_apply', true);
        }

        const { data: existingJobs, error: jobsError } = await jobQuery;
        
        if (jobsError) {
          console.error('[Search] Error fetching jobs:', jobsError);
        }

        let allJobs = existingJobs || [];
        console.log(`[Search] Found ${allJobs.length} jobs in DB`);

        // Step 4: Decide if we need to fetch from API
        const needsApiFetch = forceRefresh || isStale || allJobs.length < MIN_JOBS_THRESHOLD;

        if (needsApiFetch) {
          console.log(`[Search] Fetching from API (stale: ${isStale}, jobs: ${allJobs.length}, force: ${forceRefresh})`);

          const inputPayload = {
            keywords: searchTerm, // Use raw search term - no AI transformation
            location: location,
            page_number: 1,
            remote: params.remote || "",
            date_posted: params.date_posted || "",
            experienceLevel: params.experienceLevel || "",
            easy_apply: params.easy_apply || "",
            limit: JOBS_PER_API_CALL
          };

          try {
            const newJobs = await runActor(ACTOR_JOB_SEARCH, inputPayload, apiToken, true);
            const newJobsArray = Array.isArray(newJobs) ? newJobs : [];
            
            console.log(`[Search] Fetched ${newJobsArray.length} new jobs from API`);

            // Store new jobs
            const storedCount = await storeJobs(supabase, newJobsArray, searchTermId);
            console.log(`[Search] Stored ${storedCount} jobs`);

            // Update last_fetched_at
            await supabase
              .from('search_terms')
              .update({ last_fetched_at: new Date().toISOString() })
              .eq('id', searchTermId);

            // Re-fetch from DB to get deduplicated results
            const { data: updatedJobs } = await supabase
              .from('jobs')
              .select('*')
              .gt('expires_at', new Date().toISOString())
              .order('posted_at', { ascending: false });

            // Filter by search term links
            const { data: linkedJobIds } = await supabase
              .from('job_search_links')
              .select('job_id')
              .in('search_term_id', [searchTermId]);

            const linkedIds = new Set(linkedJobIds?.map(l => l.job_id) || []);
            allJobs = (updatedJobs || []).filter(j => linkedIds.has(j.id));

          } catch (apiError: any) {
            console.error('[Search] API fetch failed:', apiError.message);
            // Continue with existing DB results
          }
        }

        // Step 5: Apply client-side filters and paginate
        let filteredJobs = allJobs;

        // Transform jobs to match expected format
        const transformedJobs = filteredJobs.map(job => ({
          job_url: job.job_url,
          job_id: job.job_id,
          job_title: job.job_title,
          company: job.company,
          company_url: job.company_url,
          location: job.location,
          work_type: job.work_type,
          salary: job.salary,
          description: job.description,
          posted_time: job.posted_at_text,
          is_easy_apply: job.is_easy_apply,
          applicant_count: job.applicant_count,
          // Include raw_data fields for compatibility
          ...(job.raw_data || {})
        }));

        // Paginate
        const paginatedJobs = transformedJobs.slice(startIndex, startIndex + pageSize);
        const totalCount = transformedJobs.length;

        result = {
          jobs: paginatedJobs,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
          fromCache: !needsApiFetch,
          hasMoreResults: totalCount > startIndex + pageSize
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
        // Clean up old cache table
        const { error: deleteError, count } = await supabase
          .from('job_search_cache')
          .delete()
          .lt('expires_at', new Date().toISOString());

        if (deleteError) {
          throw deleteError;
        }

        // Also clean up expired jobs
        const { count: jobsDeleted } = await supabase
          .from('jobs')
          .delete()
          .lt('expires_at', new Date().toISOString());

        result = { deleted: (count || 0) + (jobsDeleted || 0) };
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
