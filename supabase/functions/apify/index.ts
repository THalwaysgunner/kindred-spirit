// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Actor IDs
const ACTOR_CRAWLER = 'apify~website-content-crawler';
const ACTOR_LINKEDIN_ID = 'apimaestro~linkedin-job-detail';
const ACTOR_JOB_SEARCH = 'apimaestro~linkedin-jobs-scraper-api';
const ACTOR_LINKEDIN_PROFILE = 'apimaestro~linkedin-profile-detail';

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
        const inputPayload = {
          keywords: params.keywords || "engineer",
          location: params.location || "United States",
          page_number: 1,
          remote: params.remote || "",
          date_posted: params.date_posted || "",
          experienceLevel: params.experienceLevel || "",
          easy_apply: params.easy_apply || "",
          limit: 20
        };
        result = await runActor(ACTOR_JOB_SEARCH, inputPayload, apiToken, true);
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
