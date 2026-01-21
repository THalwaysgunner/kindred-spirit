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
// NOTE: We intentionally do NOT refetch based on “too few jobs”.
// Refetching on small result sets can cause repeated paid scrapes for niche queries.

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
function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s+\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeLastWord(phrase: string): string {
  const parts = phrase.split(' ').filter(Boolean);
  if (parts.length === 0) return phrase;

  const last = parts[parts.length - 1];

  // companies -> company
  if (last.length > 3 && /ies$/.test(last)) {
    parts[parts.length - 1] = last.replace(/ies$/, 'y');
    return parts.join(' ');
  }

  // engineers -> engineer (avoid business -> busines by skipping *ss)
  if (last.length > 3 && /s$/.test(last) && !/ss$/.test(last)) {
    parts[parts.length - 1] = last.replace(/s$/, '');
  }

  return parts.join(' ');
}

function canonicalizeKeywords(raw: string): string {
  let s = normalizeText(raw);

  // Common typo fixes
  s = s.replace(/\bscientis\b/g, 'scientist');
  s = s.replace(/\benginier\b/g, 'engineer');
  s = s.replace(/\bdevoloper\b/g, 'developer');

  // Common abbreviation expansions (keep conservative)
  s = s.replace(/\bsr\b/g, 'senior');
  s = s.replace(/\bjr\b/g, 'junior');
  s = s.replace(/\beng\b/g, 'engineer');
  s = s.replace(/\bdev\b/g, 'developer');
  s = s.replace(/\bmgr\b/g, 'manager');
  s = s.replace(/\bswe\b/g, 'software engineer');
  s = s.replace(/\bml\b/g, 'machine learning');

  s = s.replace(/\s+/g, ' ').trim();
  s = singularizeLastWord(s);
  return s;
}

async function upsertOrIncrementSearchTerm(
  supabase: any,
  payload: { raw_term: string; canonical_term: string; location: string }
): Promise<any> {
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from('search_terms')
    .select('*')
    .eq('raw_term', payload.raw_term)
    .eq('location', payload.location)
    .maybeSingle();

  if (existing) {
    const nextCount = (existing.search_count || 0) + 1;
    const update: any = {
      search_count: nextCount,
      last_searched_at: nowIso,
    };
    if (!existing.canonical_term || existing.canonical_term !== payload.canonical_term) {
      update.canonical_term = payload.canonical_term;
    }

    const { data: updated, error: updateError } = await supabase
      .from('search_terms')
      .update(update)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('search_terms')
    .upsert(
      {
        raw_term: payload.raw_term,
        canonical_term: payload.canonical_term,
        location: payload.location,
        search_count: 1,
        last_searched_at: nowIso,
      },
      { onConflict: 'raw_term,location' }
    )
    .select()
    .single();

  if (insertError) throw insertError;
  return inserted;
}

// Returns a canonical group for caching: all raw variants that share the same canonical_term.
async function getSearchTermGroup(
  supabase: any,
  term: string,
  location: string
): Promise<{
  rawTerm: string;
  canonicalTerm: string;
  canonicalSearchTermId: string;
  relatedTermIds: string[];
  canonicalLastFetchedAt: string | null;
  normalizedLocation: string;
}> {
  const rawTerm = normalizeText(term);
  const normalizedLocation = normalizeText(location);

  // 1) Compute canonical term (deterministic + conservative)
  const canonicalTerm = canonicalizeKeywords(rawTerm) || rawTerm;

  // 2) Track the raw term → canonical mapping (analytics + learning)
  await upsertOrIncrementSearchTerm(supabase, {
    raw_term: rawTerm,
    canonical_term: canonicalTerm,
    location: normalizedLocation,
  });

  // 3) Ensure a dedicated canonical row exists (we link cached jobs to this ID)
  const canonicalRow = await upsertOrIncrementSearchTerm(supabase, {
    raw_term: canonicalTerm,
    canonical_term: canonicalTerm,
    location: normalizedLocation,
  });

  // 4) Fetch all term IDs that map to the canonical (for backwards compatibility)
  const { data: relatedTerms } = await supabase
    .from('search_terms')
    .select('id')
    .eq('canonical_term', canonicalTerm)
    .eq('location', normalizedLocation);

  const relatedTermIds = Array.from(
    new Set([canonicalRow?.id, ...(relatedTerms || []).map((t: any) => t.id)].filter(Boolean))
  );

  return {
    rawTerm,
    canonicalTerm,
    canonicalSearchTermId: canonicalRow?.id || '',
    relatedTermIds,
    canonicalLastFetchedAt: canonicalRow?.last_fetched_at || null,
    normalizedLocation,
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
        const keywords = (params.keywords || '').trim();
        const location = (params.location || '').trim();

        console.log(`[Search] Query: "${keywords}" in "${location}", page ${page}, forceRefresh: ${forceRefresh}`);

        // Detect search mode: broad (location-only or keyword-only) vs specific (both)
        const hasKeywords = keywords.length > 0;
        const hasLocation = location.length > 0;
        const isBroadSearch = !hasKeywords || !hasLocation;

        const startIndex = (page - 1) * pageSize;
        let allJobs: any[] = [];
        let needsApiFetch = false;
        let canonicalSearchTermId = '';
        let canonicalTerm = '';
        let normalizedLocation = '';
        let relatedTermIds: string[] = [];

        if (isBroadSearch) {
          // ============ SMART AGGREGATION MODE ============
          // Search across ALL cached jobs using direct DB queries
          console.log(`[Search] Broad search mode - aggregating from cache`);

          let broadQuery = supabase
            .from('jobs')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .order('posted_at', { ascending: false });

          // Location-only search: find all jobs matching location
          if (hasLocation && !hasKeywords) {
            const normalizedLoc = normalizeText(location);
            console.log(`[Search] Location-only search: "${normalizedLoc}"`);
            broadQuery = broadQuery.ilike('location', `%${normalizedLoc}%`);
          }

          // Keyword-only search: find jobs matching keyword in title OR via canonical term links
          if (hasKeywords && !hasLocation) {
            const searchCanonical = canonicalizeKeywords(keywords);
            console.log(`[Search] Keyword-only search: "${searchCanonical}"`);
            
            // First try to find jobs via search term links (canonical matching)
            const { data: matchingTerms } = await supabase
              .from('search_terms')
              .select('id')
              .eq('canonical_term', searchCanonical);

            if (matchingTerms && matchingTerms.length > 0) {
              const termIds = matchingTerms.map(t => t.id);
              const { data: linkedJobIds } = await supabase
                .from('job_search_links')
                .select('job_id')
                .in('search_term_id', termIds);

              if (linkedJobIds && linkedJobIds.length > 0) {
                const jobIds = linkedJobIds.map(l => l.job_id);
                broadQuery = broadQuery.in('id', jobIds);
              }
            } else {
              // Fallback: search job titles directly
              broadQuery = broadQuery.ilike('job_title', `%${searchCanonical}%`);
            }
          }

          // Apply additional filters
          if (params.remote && params.remote !== '') {
            broadQuery = broadQuery.ilike('work_type', `%${params.remote}%`);
          }
          if (params.easy_apply === 'true') {
            broadQuery = broadQuery.eq('is_easy_apply', true);
          }

          const { data: broadResults, error: broadError } = await broadQuery.limit(500);

          if (broadError) {
            console.error('[Search] Broad search error:', broadError);
          }

          allJobs = broadResults || [];
          console.log(`[Search] Broad search found ${allJobs.length} jobs from cache`);

          // For broad searches, we don't call API - just return cached results
          needsApiFetch = false;

        } else {
          // ============ SPECIFIC SEARCH MODE ============
          // Both keyword and location provided - use canonical grouping
          
          const termGroup = await getSearchTermGroup(supabase, keywords, location);
          canonicalTerm = termGroup.canonicalTerm;
          canonicalSearchTermId = termGroup.canonicalSearchTermId;
          relatedTermIds = termGroup.relatedTermIds;
          normalizedLocation = termGroup.normalizedLocation;

          console.log(`[Search] Specific search: "${termGroup.rawTerm}" -> "${canonicalTerm}" @ "${normalizedLocation}"`);

          // Check if data is stale
          const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
          const isStale = !termGroup.canonicalLastFetchedAt || termGroup.canonicalLastFetchedAt < staleThreshold;

          // Build query for jobs linked to canonical term group
          let jobQuery = supabase
            .from('jobs')
            .select(`
              *,
              job_search_links!inner(search_term_id)
            `)
            .gt('expires_at', new Date().toISOString())
            .order('posted_at', { ascending: false });

          if (relatedTermIds.length > 0) {
            jobQuery = jobQuery.in('job_search_links.search_term_id', relatedTermIds);
          }

          // Apply filters
          if (params.remote && params.remote !== '') {
            jobQuery = jobQuery.ilike('work_type', `%${params.remote}%`);
          }
          if (params.easy_apply === 'true') {
            jobQuery = jobQuery.eq('is_easy_apply', true);
          }

          const { data: existingJobs, error: jobsError } = await jobQuery;

          if (jobsError) {
            console.error('[Search] Error fetching jobs:', jobsError);
          }

          allJobs = existingJobs || [];
          console.log(`[Search] Found ${allJobs.length} jobs in DB for specific search`);

          // Decide if we need to fetch from API
          needsApiFetch = forceRefresh || isStale;
        }

        // Step 4: Fetch from API if needed (only for specific searches)
        if (needsApiFetch && canonicalSearchTermId) {
          console.log(`[Search] Fetching from API (force: ${forceRefresh})`);


          const inputPayload = {
            // Use canonical keywords for scraping to reduce “typo/plural” misses.
            keywords: canonicalTerm,
            location: normalizedLocation,
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
            const storedCount = await storeJobs(supabase, newJobsArray, canonicalSearchTermId);
            console.log(`[Search] Stored ${storedCount} jobs`);

            // Update last_fetched_at
            await supabase
              .from('search_terms')
              .update({ last_fetched_at: new Date().toISOString() })
              .eq('id', canonicalSearchTermId);

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
              .in('search_term_id', relatedTermIds.length > 0 ? relatedTermIds : [canonicalSearchTermId]);

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
