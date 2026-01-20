// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTOR_JOB_SEARCH = 'apimaestro~linkedin-jobs-scraper-api';
const JOBS_PER_API_CALL = 100;
const STALE_HOURS = 12; // Consider data stale after 12 hours

// Parse relative date strings like "2 days ago", "1 week ago" into actual timestamps
function parsePostedDate(postedText: string): Date {
  const now = new Date();
  
  if (!postedText) return now;
  
  const text = postedText.toLowerCase();
  
  // Handle "X hours ago"
  const hoursMatch = text.match(/(\d+)\s*hours?\s*ago/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }
  
  // Handle "X days ago"
  const daysMatch = text.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  
  // Handle "X weeks ago"
  const weeksMatch = text.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  }
  
  // Handle "X months ago"
  const monthsMatch = text.match(/(\d+)\s*months?\s*ago/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1]);
    return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
  }
  
  // Handle "just now" or "today"
  if (text.includes('just now') || text.includes('today')) {
    return now;
  }
  
  // Handle "yesterday"
  if (text.includes('yesterday')) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return now;
}

async function runApifyActor(inputPayload: any, apiToken: string): Promise<any[]> {
  const startUrl = `https://api.apify.com/v2/acts/${ACTOR_JOB_SEARCH}/runs?token=${apiToken}`;

  console.log(`[Prefetch] Starting Apify actor for: ${inputPayload.keywords} in ${inputPayload.location}`);
  
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

    if (status === 'SUCCEEDED') {
      isComplete = true;
    } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify Run Failed with status: ${status}`);
    }
  }

  if (!isComplete) {
    throw new Error("Apify scrape timed out.");
  }

  const itemsUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${apiToken}`;
  const itemsRes = await fetch(itemsUrl);
  const items = await itemsRes.json();

  return Array.isArray(items) ? items : [];
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

    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

    // Get top popular search terms that are stale or never fetched
    const { data: staleTerms, error: queryError } = await supabase
      .from('search_terms')
      .select('*')
      .or(`last_fetched_at.is.null,last_fetched_at.lt.${staleThreshold}`)
      .order('search_count', { ascending: false })
      .limit(20);

    if (queryError) {
      throw queryError;
    }

    console.log(`[Prefetch] Found ${staleTerms?.length || 0} stale search terms to refresh`);

    const results: { term: string; location: string; jobsFetched: number; error?: string }[] = [];

    for (const searchTerm of staleTerms || []) {
      try {
        console.log(`[Prefetch] Fetching jobs for: "${searchTerm.canonical_term}" in "${searchTerm.location}"`);

        const inputPayload = {
          keywords: searchTerm.canonical_term || "software engineer",
          location: searchTerm.location || "United States",
          page_number: 1,
          remote: searchTerm.filters?.remote || "",
          date_posted: searchTerm.filters?.date_posted || "",
          experienceLevel: searchTerm.filters?.experienceLevel || "",
          easy_apply: searchTerm.filters?.easy_apply || "",
          limit: JOBS_PER_API_CALL
        };

        const jobs = await runApifyActor(inputPayload, apiToken);
        console.log(`[Prefetch] Fetched ${jobs.length} jobs for "${searchTerm.canonical_term}"`);

        // Upsert jobs into the jobs table
        let insertedCount = 0;
        for (const job of jobs) {
          if (!job.job_url) continue;

          const postedAt = parsePostedDate(job.posted_time || job.posted_at_text || '');
          const expiresAt = new Date(postedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after posting

          const { data: upsertedJob, error: upsertError } = await supabase
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
            }, {
              onConflict: 'job_url'
            })
            .select('id')
            .single();

          if (upsertError) {
            console.error(`[Prefetch] Error upserting job: ${upsertError.message}`);
            continue;
          }

          // Create link between job and search term
          if (upsertedJob) {
            await supabase
              .from('job_search_links')
              .upsert({
                job_id: upsertedJob.id,
                search_term_id: searchTerm.id
              }, {
                onConflict: 'job_id,search_term_id'
              });
            insertedCount++;
          }
        }

        // Update last_fetched_at for this search term
        await supabase
          .from('search_terms')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', searchTerm.id);

        results.push({
          term: searchTerm.canonical_term,
          location: searchTerm.location,
          jobsFetched: insertedCount
        });

        // Add a small delay between API calls to be nice to Apify
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (termError: any) {
        console.error(`[Prefetch] Error processing "${searchTerm.canonical_term}":`, termError);
        results.push({
          term: searchTerm.canonical_term,
          location: searchTerm.location,
          jobsFetched: 0,
          error: termError.message
        });
      }
    }

    console.log(`[Prefetch] Completed. Processed ${results.length} search terms`);

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Prefetch Jobs Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
