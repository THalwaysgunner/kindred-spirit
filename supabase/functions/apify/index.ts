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
        const forceRefresh = !!params.forceRefresh;
        const cacheOnly = !!params.cacheOnly;
        const keywords = (params.keywords || '').trim();
        const location = (params.location || '').trim();
        const clientFilters = params.clientFilters || {};

        const nowIso = new Date().toISOString();
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize - 1;

        const hasKeywords = keywords.length > 0;
        const hasLocation = location.length > 0;
        const isBroadSearch = !hasKeywords || !hasLocation;

        const selectedWorkTypes: string[] = Array.isArray(clientFilters.workTypes)
          ? clientFilters.workTypes
          : (params.remote ? [params.remote] : []);

        const selectedExperiences: string[] = Array.isArray(clientFilters.experiences)
          ? clientFilters.experiences
          : (params.experienceLevel ? [params.experienceLevel] : []);

        const selectedDatePosted: string = (clientFilters.datePosted || params.date_posted || '').toString();
        const selectedEasyApply: boolean = !!clientFilters.easyApply || params.easy_apply === 'true';

        function applyWorkTypeFilter(query: any, columnPrefix: string) {
          if (!selectedWorkTypes || selectedWorkTypes.length === 0) return query;

          const clauses: string[] = [];
          for (const wt of selectedWorkTypes) {
            if (wt === 'remote') clauses.push(`${columnPrefix}work_type.ilike.%remote%`);
            if (wt === 'hybrid') clauses.push(`${columnPrefix}work_type.ilike.%hybrid%`);
            if (wt === 'onsite') {
              clauses.push(`${columnPrefix}work_type.ilike.%on-site%`);
              clauses.push(`${columnPrefix}work_type.ilike.%onsite%`);
            }
          }

          if (clauses.length === 0) return query;
          return query.or(clauses.join(','));
        }

        function applyExperienceFilter(query: any, columnPrefix: string) {
          if (!selectedExperiences || selectedExperiences.length === 0) return query;

          const clauses: string[] = [];
          for (const exp of selectedExperiences) {
            if (exp === 'internship') clauses.push(`${columnPrefix}job_title.ilike.%intern%`);
            if (exp === 'entry') {
              clauses.push(`${columnPrefix}job_title.ilike.%entry%`);
              clauses.push(`${columnPrefix}job_title.ilike.%junior%`);
            }
            if (exp === 'associate') clauses.push(`${columnPrefix}job_title.ilike.%associate%`);
            if (exp === 'mid_senior') {
              clauses.push(`${columnPrefix}job_title.ilike.%senior%`);
              clauses.push(`${columnPrefix}job_title.ilike.%lead%`);
            }
            if (exp === 'director') {
              clauses.push(`${columnPrefix}job_title.ilike.%director%`);
              clauses.push(`${columnPrefix}job_title.ilike.%head%`);
            }
            if (exp === 'executive') {
              clauses.push(`${columnPrefix}job_title.ilike.%executive%`);
              clauses.push(`${columnPrefix}job_title.ilike.%vp%`);
              clauses.push(`${columnPrefix}job_title.ilike.%chief%`);
            }
          }

          if (clauses.length === 0) return query;
          return query.or(clauses.join(','));
        }

        function applyDatePostedFilter(query: any, columnPrefix: string) {
          if (!selectedDatePosted) return query;
          const now = Date.now();
          let cutoffMs: number | null = null;
          if (selectedDatePosted === 'hour') cutoffMs = now - 60 * 60 * 1000;
          if (selectedDatePosted === 'day') cutoffMs = now - 24 * 60 * 60 * 1000;
          if (selectedDatePosted === 'week') cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
          if (!cutoffMs) return query;
          return query.gte(`${columnPrefix}posted_at`, new Date(cutoffMs).toISOString());
        }

        function applyEasyApplyFilter(query: any, columnPrefix: string) {
          if (!selectedEasyApply) return query;
          return query.eq(`${columnPrefix}is_easy_apply`, true);
        }

        function applyAllClientFilters(query: any, columnPrefix: string) {
          let q = query;
          q = applyWorkTypeFilter(q, columnPrefix);
          q = applyExperienceFilter(q, columnPrefix);
          q = applyDatePostedFilter(q, columnPrefix);
          q = applyEasyApplyFilter(q, columnPrefix);
          return q;
        }

        async function computeStatsForJobsTable(baseBuilder: () => any) {
          const base = baseBuilder;

          const totalQ = base().select('id', { count: 'exact', head: true });
          const remoteQ = applyAllClientFilters(base(), '').or('work_type.ilike.%remote%').select('id', { count: 'exact', head: true });
          const easyQ = applyAllClientFilters(base(), '').eq('is_easy_apply', true).select('id', { count: 'exact', head: true });
          const recentQ = applyAllClientFilters(base(), '').gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).select('id', { count: 'exact', head: true });

          const [totalRes, remoteRes, easyRes, recentRes] = await Promise.all([
            totalQ,
            remoteQ,
            easyQ,
            recentQ,
          ]);

          return {
            total: totalRes.count || 0,
            remote: remoteRes.count || 0,
            easyApply: easyRes.count || 0,
            recent: recentRes.count || 0,
          };
        }

        async function computeStatsForLinksTable(baseBuilder: () => any) {
          const base = baseBuilder;

          const totalQ = base().select('job_id', { count: 'exact', head: true });
          const remoteQ = applyAllClientFilters(base(), 'jobs.').or('jobs.work_type.ilike.%remote%').select('job_id', { count: 'exact', head: true });
          const easyQ = applyAllClientFilters(base(), 'jobs.').eq('jobs.is_easy_apply', true).select('job_id', { count: 'exact', head: true });
          const recentQ = applyAllClientFilters(base(), 'jobs.').gte('jobs.posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).select('job_id', { count: 'exact', head: true });

          const [totalRes, remoteRes, easyRes, recentRes] = await Promise.all([
            totalQ,
            remoteQ,
            easyQ,
            recentQ,
          ]);

          return {
            total: totalRes.count || 0,
            remote: remoteRes.count || 0,
            easyApply: easyRes.count || 0,
            recent: recentRes.count || 0,
          };
        }

        console.log(`[Search] Query: "${keywords}" in "${location}", page ${page}, cacheOnly: ${cacheOnly}, forceRefresh: ${forceRefresh}`);

        let fromCache = true;
        let stats: any = { total: 0, remote: 0, easyApply: 0, recent: 0 };
        let totalCount = 0;
        let jobsPage: any[] = [];

        if (isBroadSearch) {
          // Broad search = DB-only aggregation (no paid fetch)
          const normalizedLoc = normalizeText(location);
          const normalizedKw = normalizeText(keywords);
          const canonicalKw = canonicalizeKeywords(normalizedKw);

          const baseBuilder = () => {
            let q = supabase
              .from('jobs')
              .gt('expires_at', nowIso);

            if (hasLocation && !hasKeywords) {
              q = q.ilike('location', `%${normalizedLoc}%`);
            }

            if (hasKeywords && !hasLocation) {
              const terms = Array.from(new Set([normalizedKw, canonicalKw].filter(Boolean)));
              if (terms.length === 1) {
                q = q.ilike('job_title', `%${terms[0]}%`);
              } else {
                q = q.or(terms.map(t => `job_title.ilike.%${t}%`).join(','));
              }
            }

            q = applyAllClientFilters(q, '');
            return q;
          };

          const pageQuery = baseBuilder()
            .select('*', { count: 'exact' })
            .order('posted_at', { ascending: false })
            .range(startIndex, endIndex);

          const { data: rows, error: qErr, count } = await pageQuery;
          if (qErr) {
            console.error('[Search] Broad query error:', qErr);
          }

          jobsPage = rows || [];
          totalCount = count || 0;
          stats = await computeStatsForJobsTable(baseBuilder);
          fromCache = true;
        } else {
          // Specific search (keywords + location)
          const termGroup = await getSearchTermGroup(supabase, keywords, location);
          const canonicalTerm = termGroup.canonicalTerm;
          const canonicalSearchTermId = termGroup.canonicalSearchTermId;
          const normalizedLocation = termGroup.normalizedLocation;

          const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
          const isStale = !termGroup.canonicalLastFetchedAt || termGroup.canonicalLastFetchedAt < staleThreshold;

          const shouldFetch = !cacheOnly && page === 1 && (forceRefresh || isStale);

          if (shouldFetch && canonicalSearchTermId) {
            fromCache = false;
            console.log(`[Search] Fetching from API (stale: ${isStale}, force: ${forceRefresh})`);

            const inputPayload = {
              keywords: canonicalTerm,
              location: normalizedLocation,
              page_number: 1,
              // Always fetch broadly; filters are applied in DB
              remote: "",
              date_posted: "",
              experienceLevel: "",
              easy_apply: "",
              limit: JOBS_PER_API_CALL,
            };

            try {
              const newJobs = await runActor(ACTOR_JOB_SEARCH, inputPayload, apiToken, true);
              const newJobsArray = Array.isArray(newJobs) ? newJobs : [];
              console.log(`[Search] Fetched ${newJobsArray.length} jobs from API`);

              const storedCount = await storeJobs(supabase, newJobsArray, canonicalSearchTermId);
              console.log(`[Search] Stored ${storedCount} jobs`);

              await supabase
                .from('search_terms')
                .update({ last_fetched_at: new Date().toISOString() })
                .eq('id', canonicalSearchTermId);
            } catch (apiError: any) {
              console.error('[Search] API fetch failed:', apiError.message);
              // Continue with DB results
              fromCache = true;
            }
          }

          const baseLinksBuilder = () => {
            let q = supabase
              .from('job_search_links')
              .eq('search_term_id', canonicalSearchTermId)
              .gt('jobs.expires_at', nowIso);

            // join + base filter
            q = q.select('job_id, jobs!inner(*)', { count: 'exact' });
            q = applyAllClientFilters(q, 'jobs.');
            return q;
          };

          const pageQuery = baseLinksBuilder()
            .order('posted_at', { foreignTable: 'jobs', ascending: false })
            .range(startIndex, endIndex);

          const { data: linkRows, error: qErr, count } = await pageQuery;
          if (qErr) {
            console.error('[Search] Specific query error:', qErr);
          }

          jobsPage = (linkRows || []).map((r: any) => r.jobs).filter(Boolean);
          totalCount = count || 0;
          stats = await computeStatsForLinksTable(() => {
            // For stats we need the same join and filters, but HEAD-only
            let q = supabase
              .from('job_search_links')
              .eq('search_term_id', canonicalSearchTermId)
              .gt('jobs.expires_at', nowIso)
              .select('job_id, jobs!inner(id)', { count: 'exact' });
            q = applyAllClientFilters(q, 'jobs.');
            return q;
          });
        }

        // Transform jobs to match expected front-end format
        const transformedJobs = (jobsPage || []).map((job: any) => ({
          ...(job.raw_data || {}),
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
          posted_at: job.posted_at,
          is_easy_apply: job.is_easy_apply,
          applicant_count: job.applicant_count,
        }));

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
