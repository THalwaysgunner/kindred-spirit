
// Specific API credentials provided by developer
const API_TOKEN = ''; // Set via environment variable VITE_APIFY_TOKEN

// Actor IDs
const ACTOR_CRAWLER = 'apify~website-content-crawler';
const ACTOR_LINKEDIN_ID = 'apimaestro~linkedin-job-detail';
const ACTOR_JOB_SEARCH = 'apimaestro~linkedin-jobs-scraper-api';
const ACTOR_LINKEDIN_PROFILE = 'apimaestro~linkedin-profile-detail';

/**
 * Service to interact with Apify Actors
 */
export const ApifyService = {
  /**
   * Runs specific Apify Actors based on input type (URL vs ID).
   */
  async fetchJobDetails(jobInput: string, type: 'url' | 'id'): Promise<any> {

    let actorId = ACTOR_CRAWLER;
    let inputPayload: any = {};
    const cleanInput = jobInput.trim();

    if (type === 'id') {
      actorId = ACTOR_LINKEDIN_ID;

      // If user accidentally pasted a URL in ID mode, try to extract ID
      let id = cleanInput;
      const idMatch = cleanInput.match(/currentJobId=(\d+)/) || cleanInput.match(/\/view\/(\d+)/);
      if (idMatch) {
        id = idMatch[1];
      }

      inputPayload = {
        job_id: [id]
      };
    } else {
      // URL Mode: Use the general crawler
      actorId = ACTOR_CRAWLER;
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

    console.log(`[Apify] Starting run for actor: ${actorId} with type: ${type}`);
    return this._runActor(actorId, inputPayload);
  },

  /**
   * Search for jobs using LinkedIn Scraper
   */
  async searchJobs(params: any): Promise<any[]> {
    const actorId = ACTOR_JOB_SEARCH;
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

    console.log(`[Apify] Searching jobs with:`, inputPayload);
    // Returns array of items directly from _runActor
    const result = await this._runActor(actorId, inputPayload, true); // true = return all items
    return Array.isArray(result) ? result : [];
  },

  /**
   * Fetch LinkedIn Profile Details
   */
  async fetchLinkedInProfile(profileUrl: string): Promise<any> {
    const actorId = ACTOR_LINKEDIN_PROFILE;
    const inputPayload = {
      username: profileUrl,
      includeEmail: true
    };

    console.log(`[Apify] Fetching LinkedIn Profile: ${profileUrl}`);
    // Use true to get all items, usually it's just one profile
    const result = await this._runActor(actorId, inputPayload, true);
    return Array.isArray(result) && result.length > 0 ? result[0] : null;
  },

  /**
   * Helper to execute actor run and poll for results
   */
  async _runActor(actorId: string, inputPayload: any, returnAllItems = false): Promise<any> {
    // 1. Start the Actor Run
    const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${API_TOKEN}`;

    try {
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

      // 2. Poll for Completion
      const maxRetries = 60; // Increased timeout for search
      let attempt = 0;
      let isComplete = false;

      while (attempt < maxRetries && !isComplete) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempt++;

        const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${API_TOKEN}`;
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
        throw new Error("Apify scrape timed out (client-side limit).");
      }

      // 3. Fetch Dataset Items
      console.log('[Apify] Run succeeded. Fetching results...');
      const itemsUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${API_TOKEN}`;
      const itemsRes = await fetch(itemsUrl);
      const items = await itemsRes.json();

      if (returnAllItems) {
        return items;
      }

      if (Array.isArray(items) && items.length > 0) {
        return items[0];
      }

      return null;

    } catch (error) {
      console.error("[Apify] Service execution failed:", error);
      throw error;
    }
  }
};
