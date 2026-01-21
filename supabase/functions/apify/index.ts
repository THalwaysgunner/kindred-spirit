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
const MIN_PAGE_SIZE = 20; // Minimum jobs needed, otherwise go to API

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

// Text normalization
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

  if (last.length > 3 && /ies$/.test(last)) {
    parts[parts.length - 1] = last.replace(/ies$/, 'y');
    return parts.join(' ');
  }

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

  // Common abbreviation expansions
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

function buildSearchFilters(remote: string, experienceLevel: string): any {
  const filters: any = {};
  const r = normalizeText(remote);
  const e = normalizeText(experienceLevel);
  if (r) filters.remote = r;
  if (e) filters.experienceLevel = e;
  return filters;
}

function applyWorkTypeFilter(query: any, remote: string): any {
  const r = normalizeText(remote);
  if (!r) return query;

  if (r === 'remote') return query.ilike('work_type', '%remote%');
  if (r === 'hybrid') return query.ilike('work_type', '%hybrid%');
  if (r === 'onsite' || r === 'on-site' || r === 'on site') {
    // Match common variants
    return query.or('work_type.ilike.%on-site%,work_type.ilike.%onsite%,work_type.ilike.%on site%');
  }

  return query;
}

function applyExperienceFilter(query: any, experienceLevel: string): any {
  const e = normalizeText(experienceLevel);
  if (!e) return query;

  // Best-effort DB filtering (we don't store a dedicated experience_level column on jobs)
  if (e === 'internship') return query.ilike('job_title', '%intern%');
  if (e === 'entry') return query.or('job_title.ilike.%entry%,job_title.ilike.%junior%');
  if (e === 'associate') return query.ilike('job_title', '%associate%');
  if (e === 'mid_senior') return query.or('job_title.ilike.%senior%,job_title.ilike.%lead%');
  if (e === 'director') return query.or('job_title.ilike.%director%,job_title.ilike.%head%');
  if (e === 'executive') return query.or('job_title.ilike.%executive%,job_title.ilike.%vp%,job_title.ilike.%chief%');

  return query;
}

// Store jobs in the database
async function storeJobs(supabase: any, jobs: any[], searchTermId: string): Promise<number> {
  let storedCount = 0;

  for (const job of jobs) {
    if (!job.job_url) continue;

    // Prefer absolute timestamps from the provider payload when available.
    // Fall back to parsing relative strings (e.g. "2 days ago").
    const postedAt = (() => {
      const epoch = Number(job.posted_at_epoch ?? job.postedAtEpoch ?? job.posted_epoch);
      if (!Number.isNaN(epoch) && epoch > 0) {
        // Some payloads provide ms, others seconds
        return new Date(epoch > 1_000_000_000_000 ? epoch : epoch * 1000);
      }

      const raw = (job.posted_at ?? job.postedAt ?? job.posted_time ?? job.posted_at_text ?? '').toString();
      if (raw) {
        // Common non-ISO format: "YYYY-MM-DD HH:MM:SS"
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
          const d = new Date(raw.replace(' ', 'T') + 'Z');
          if (!Number.isNaN(d.getTime())) return d;
        }

        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d;
      }

      return parsePostedDate(job.posted_time || job.posted_at_text || '');
    })();

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
        applicant_count: (() => {
          const raw = job.applicant_count;
          if (raw == null) return null;
          if (typeof raw === 'number') return raw;
          // Parse strings like "over 100 applicants", "29 applicants", etc.
          const str = String(raw).toLowerCase();
          if (str.includes('over')) return 100; // "over 100 applicants" → 100
          const match = str.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : null;
        })(),
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

// Get or create search term
async function getOrCreateSearchTerm(
  supabase: any,
  rawTerm: string,
  canonicalTerm: string,
  location: string,
  filters: any
): Promise<string | null> {
  const normalizedLoc = normalizeText(location);
  
  // Try to find existing term
  const { data: existing } = await supabase
    .from('search_terms')
    .select('id, search_count')
    .eq('canonical_term', canonicalTerm)
    .eq('location', normalizedLoc)
    .eq('filters', filters)
    .maybeSingle();

  if (existing) {
    // Increment search count
    const nextCount = (existing.search_count || 0) + 1;
    await supabase
      .from('search_terms')
      .update({ 
        search_count: nextCount,
        last_searched_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    return existing.id;
  }

  // Create new term
  const { data: inserted, error } = await supabase
    .from('search_terms')
    .insert({
      raw_term: rawTerm,
      canonical_term: canonicalTerm,
      location: normalizedLoc,
      filters,
      search_count: 1,
      last_searched_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error('[SearchTerm] Error creating:', error.message);
    return null;
  }

  return inserted?.id || null;
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
        const forceRefresh = !!params.forceRefresh;
        const keywords = (params.keywords || '').trim();
        const location = (params.location || '').trim();
        const remote = (params.remote || '').trim();
        const experienceLevel = (params.experienceLevel || '').trim();

        const nowIso = new Date().toISOString();
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize - 1;

        const hasKeywords = keywords.length > 0;
        const hasLocation = location.length > 0;

        const normalizedKeywords = normalizeText(keywords);
        const canonicalKeywords = canonicalizeKeywords(normalizedKeywords);
        const normalizedLocation = normalizeText(location);
        const filters = buildSearchFilters(remote, experienceLevel);

        console.log(
          `[Search] Query: "${keywords}" (canonical: "${canonicalKeywords}") in "${location}" | remote="${remote}" exp="${experienceLevel}" | page ${page}`
        );

        let fromCache = true;
        let jobsPage: any[] = [];
        let totalCount = 0;

        // Stats source tracking (to compute counts on the full dataset)
        let statsMode: 'linked' | 'direct' | 'api_fallback' = 'direct';
        let statsSearchTermId: string | null = null;
        let statsFallbackJobs: any[] | null = null;

        // ===== PATH 1: WITH KEYWORD =====
        if (hasKeywords) {
          // Step 1: Check exact raw term match in search_terms
          let searchTermId: string | null = null;

          const { data: exactTerm } = await supabase
            .from('search_terms')
            .select('id')
            .eq('raw_term', normalizedKeywords)
            .eq('location', hasLocation ? normalizedLocation : '')
            .eq('filters', filters)
            .maybeSingle();

          if (exactTerm) {
            searchTermId = exactTerm.id;
            console.log(`[Search] Found exact term match: ${searchTermId}`);
          }

          // Step 2: If no exact match, check canonical term
          if (!searchTermId) {
            const { data: canonicalTermData } = await supabase
              .from('search_terms')
              .select('id')
              .eq('canonical_term', canonicalKeywords)
              .eq('location', hasLocation ? normalizedLocation : '')
              .eq('filters', filters)
              .maybeSingle();

            if (canonicalTermData) {
              searchTermId = canonicalTermData.id;
              console.log(`[Search] Found canonical term match: ${searchTermId}`);
            }
          }

          // Query jobs if we have a search term
          if (searchTermId) {
            statsMode = 'linked';
            statsSearchTermId = searchTermId;
            let jobQuery = supabase
              .from('jobs')
              .select('*, job_search_links!inner(search_term_id)', { count: 'exact' })
              .eq('job_search_links.search_term_id', searchTermId)
              .gt('expires_at', nowIso);

            jobQuery = applyWorkTypeFilter(jobQuery, remote);
            jobQuery = applyExperienceFilter(jobQuery, experienceLevel);

            // Apply location filter if provided
            if (hasLocation) {
              jobQuery = jobQuery.ilike('location', `%${normalizedLocation}%`);
            }

            const { data: jobRows, count } = await jobQuery
              .order('posted_at', { ascending: false })
              .range(startIndex, endIndex);

            jobsPage = jobRows || [];
            totalCount = count || 0;
            console.log(`[Search] Found ${totalCount} jobs from cache via search term`);
          }

          // Step 3: If no results OR less than a page, go to API
          if (totalCount < MIN_PAGE_SIZE && page === 1 && !forceRefresh) {
            console.log(`[Search] Not enough results (${totalCount}), fetching from API`);
            fromCache = false;

            // Create or get search term for storing results
            const newTermId = await getOrCreateSearchTerm(
              supabase, 
              normalizedKeywords, 
              canonicalKeywords, 
              hasLocation ? normalizedLocation : '',
              filters
            );

            const inputPayload = {
              keywords: keywords, // Use ORIGINAL keywords for API
              location: location,
              page_number: 1,
              remote: remote || "",
              date_posted: "",
              experienceLevel: experienceLevel || "",
              easy_apply: "",
              limit: JOBS_PER_API_CALL,
            };

            try {
              const newJobs = await runActor(ACTOR_JOB_SEARCH, inputPayload, apiToken, true);
              const newJobsArray = Array.isArray(newJobs) ? newJobs : [];
              console.log(`[Search] Fetched ${newJobsArray.length} jobs from API`);

              if (newTermId) {
                statsMode = 'linked';
                statsSearchTermId = newTermId;
                const storedCount = await storeJobs(supabase, newJobsArray, newTermId);
                console.log(`[Search] Stored ${storedCount} jobs`);

                // Update last_fetched_at
                await supabase
                  .from('search_terms')
                  .update({ last_fetched_at: new Date().toISOString() })
                  .eq('id', newTermId);

                // Re-query after storing
                let refetchQuery = supabase
                  .from('jobs')
                  .select('*, job_search_links!inner(search_term_id)', { count: 'exact' })
                  .eq('job_search_links.search_term_id', newTermId)
                  .gt('expires_at', nowIso);

                refetchQuery = applyWorkTypeFilter(refetchQuery, remote);
                refetchQuery = applyExperienceFilter(refetchQuery, experienceLevel);

                if (hasLocation) {
                  refetchQuery = refetchQuery.ilike('location', `%${normalizedLocation}%`);
                }

                const { data: refetchRows, count: refetchCount } = await refetchQuery
                  .order('posted_at', { ascending: false })
                  .range(startIndex, endIndex);

                jobsPage = refetchRows || [];
                totalCount = refetchCount || 0;
              } else {
                // If we couldn't create a search term, still return API results
                statsMode = 'api_fallback';
                statsFallbackJobs = newJobsArray;
                jobsPage = newJobsArray.slice(startIndex, endIndex + 1);
                totalCount = newJobsArray.length;
              }
            } catch (apiError: any) {
              console.error('[Search] API fetch failed:', apiError.message);
              fromCache = true;
            }
          }
        }
        // ===== PATH 2: WITHOUT KEYWORD (location only) =====
        else {
          // Option 2 (NO keyword): first try cached term; if missing, filter the jobs table directly by the combination.
          const termLocation = hasLocation ? normalizedLocation : '';
          let searchTermId: string | null = null;

          const { data: locationTerm } = await supabase
            .from('search_terms')
            .select('id')
            .eq('raw_term', '')
            .eq('canonical_term', '')
            .eq('location', termLocation)
            .eq('filters', filters)
            .maybeSingle();

          if (locationTerm) {
            searchTermId = locationTerm.id;
            console.log(`[Search] Found no-keyword term match: ${searchTermId}`);
          }

          if (searchTermId) {
            statsMode = 'linked';
            statsSearchTermId = searchTermId;

            let jobQuery = supabase
              .from('jobs')
              .select('*, job_search_links!inner(search_term_id)', { count: 'exact' })
              .eq('job_search_links.search_term_id', searchTermId)
              .gt('expires_at', nowIso);

            jobQuery = applyWorkTypeFilter(jobQuery, remote);
            jobQuery = applyExperienceFilter(jobQuery, experienceLevel);

            if (hasLocation) {
              jobQuery = jobQuery.ilike('location', `%${normalizedLocation}%`);
            }

            const { data: jobRows, count } = await jobQuery
              .order('posted_at', { ascending: false })
              .range(startIndex, endIndex);

            jobsPage = jobRows || [];
            totalCount = count || 0;
            console.log(`[Search] Found ${totalCount} jobs from term cache (no-keyword)`);
          } else {
            // DB filter fallback (this is the behavior you requested)
            statsMode = 'direct';
            statsSearchTermId = null;

            let jobQuery = supabase
              .from('jobs')
              .select('*', { count: 'exact' })
              .gt('expires_at', nowIso);

            jobQuery = applyWorkTypeFilter(jobQuery, remote);
            jobQuery = applyExperienceFilter(jobQuery, experienceLevel);

            if (hasLocation) {
              jobQuery = jobQuery.ilike('location', `%${normalizedLocation}%`);
            }

            const { data: jobRows, count } = await jobQuery
              .order('posted_at', { ascending: false })
              .range(startIndex, endIndex);

            jobsPage = jobRows || [];
            totalCount = count || 0;
            console.log(`[Search] Found ${totalCount} jobs by DB filter fallback (no-keyword)`);
          }

          // If not enough results, go to API
          if (totalCount < MIN_PAGE_SIZE && page === 1 && !forceRefresh) {
            console.log(`[Search] Not enough no-keyword results (${totalCount}), fetching from API`);
            fromCache = false;

            const newTermId = await getOrCreateSearchTerm(
              supabase,
              '',
              '',
              termLocation,
              filters
            );

            const inputPayload = {
              keywords: '',
              location: location, // Use ORIGINAL location for API
              page_number: 1,
              remote: remote || "",
              date_posted: "",
              experienceLevel: experienceLevel || "",
              easy_apply: "",
              limit: JOBS_PER_API_CALL,
            };

            try {
              const newJobs = await runActor(ACTOR_JOB_SEARCH, inputPayload, apiToken, true);
              const newJobsArray = Array.isArray(newJobs) ? newJobs : [];
              console.log(`[Search] Fetched ${newJobsArray.length} jobs from API (no-keyword)`);

              if (newTermId) {
                statsMode = 'linked';
                statsSearchTermId = newTermId;

                const storedCount = await storeJobs(supabase, newJobsArray, newTermId);
                console.log(`[Search] Stored ${storedCount} jobs`);

                await supabase
                  .from('search_terms')
                  .update({ last_fetched_at: new Date().toISOString() })
                  .eq('id', newTermId);

                // Re-query after storing
                let refetchQuery = supabase
                  .from('jobs')
                  .select('*, job_search_links!inner(search_term_id)', { count: 'exact' })
                  .eq('job_search_links.search_term_id', newTermId)
                  .gt('expires_at', nowIso);

                refetchQuery = applyWorkTypeFilter(refetchQuery, remote);
                refetchQuery = applyExperienceFilter(refetchQuery, experienceLevel);

                if (hasLocation) {
                  refetchQuery = refetchQuery.ilike('location', `%${normalizedLocation}%`);
                }

                const { data: refetchRows, count: refetchCount } = await refetchQuery
                  .order('posted_at', { ascending: false })
                  .range(startIndex, endIndex);

                jobsPage = refetchRows || [];
                totalCount = refetchCount || 0;
              } else {
                statsMode = 'api_fallback';
                statsFallbackJobs = newJobsArray;
                jobsPage = newJobsArray.slice(startIndex, endIndex + 1);
                totalCount = newJobsArray.length;
              }
            } catch (apiError: any) {
              console.error('[Search] API fetch failed:', apiError.message);
              fromCache = true;
            }
          }
        }

        // Transform jobs to match expected front-end format
        const transformedJobs = (jobsPage || []).map((job: any) => {
          const raw = job.raw_data || {};

          // Ensure the frontend sees the actual job posted timestamp (not the DB upsert time).
          const rawEpoch = Number(raw.posted_at_epoch ?? raw.postedAtEpoch ?? raw.posted_epoch);
          const postedAtIso = (!Number.isNaN(rawEpoch) && rawEpoch > 0)
            ? new Date(rawEpoch > 1_000_000_000_000 ? rawEpoch : rawEpoch * 1000).toISOString()
            : (job.posted_at || raw.posted_at || null);

          return {
            ...raw,
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
            posted_at: postedAtIso,
            is_easy_apply: job.is_easy_apply,
            applicant_count: job.applicant_count,
          };
        });

        // Stats must reflect the FULL dataset for the Row 2 query (not just the current page)
        const recentCutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        let remoteCount = 0;
        let easyApplyCount = 0;
        let recentCount = 0;

        if (statsMode === 'api_fallback' && Array.isArray(statsFallbackJobs)) {
          remoteCount = statsFallbackJobs.filter((j: any) => (j.work_type || j.remote || '').toLowerCase().includes('remote')).length;
          easyApplyCount = statsFallbackJobs.filter((j: any) => j.is_easy_apply || j.easy_apply).length;
          recentCount = statsFallbackJobs.filter((j: any) => {
            const epoch = Number(j.posted_at_epoch ?? j.postedAtEpoch ?? j.posted_epoch);
            const dt = (!Number.isNaN(epoch) && epoch > 0)
              ? new Date(epoch > 1_000_000_000_000 ? epoch : epoch * 1000)
              : (() => {
                  const raw = (j.posted_at ?? j.postedAt ?? j.posted_time ?? j.posted_at_text ?? '').toString();
                  if (raw) {
                    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
                      const d = new Date(raw.replace(' ', 'T') + 'Z');
                      if (!Number.isNaN(d.getTime())) return d;
                    }
                    const d = new Date(raw);
                    if (!Number.isNaN(d.getTime())) return d;
                  }
                  return parsePostedDate(j.posted_time || j.posted_at_text || '');
                })();
            return dt.toISOString() >= recentCutoffIso;
          }).length;
        } else {
          const makeCountBase = () => {
            if (statsMode === 'linked' && statsSearchTermId) {
              let q = supabase
                .from('jobs')
                .select('id, job_search_links!inner(search_term_id)', { count: 'exact', head: true })
                .eq('job_search_links.search_term_id', statsSearchTermId)
                .gt('expires_at', nowIso);

              q = applyWorkTypeFilter(q, remote);
              q = applyExperienceFilter(q, experienceLevel);
              if (hasLocation) q = q.ilike('location', `%${normalizedLocation}%`);
              return q;
            }

            let q = supabase
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .gt('expires_at', nowIso);

            q = applyWorkTypeFilter(q, remote);
            q = applyExperienceFilter(q, experienceLevel);
            if (hasLocation) q = q.ilike('location', `%${normalizedLocation}%`);
            return q;
          };

          const { count: rCount } = await makeCountBase().ilike('work_type', '%remote%');
          const { count: eCount } = await makeCountBase().eq('is_easy_apply', true);
          const { count: recCount } = await makeCountBase().gte('posted_at', recentCutoffIso);

          remoteCount = rCount || 0;
          easyApplyCount = eCount || 0;
          recentCount = recCount || 0;
        }

        const stats = {
          total: totalCount,
          remote: remoteCount,
          easyApply: easyApplyCount,
          recent: recentCount,
        };

        result = {
          jobs: transformedJobs,
          totalCount,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
          fromCache,
          hasMoreResults: totalCount > startIndex + pageSize,
          stats,
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
        const { error: deleteError, count } = await supabase
          .from('job_search_cache')
          .delete()
          .lt('expires_at', new Date().toISOString());

        if (deleteError) {
          throw deleteError;
        }

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
