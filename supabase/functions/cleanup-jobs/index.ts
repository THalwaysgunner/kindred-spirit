// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    console.log(`[Cleanup] Starting job cleanup at ${now}`);

    // 1. Delete expired jobs (expires_at < now)
    const { error: deleteJobsError, count: deletedJobsCount } = await supabase
      .from('jobs')
      .delete()
      .lt('expires_at', now);

    if (deleteJobsError) {
      console.error('[Cleanup] Error deleting expired jobs:', deleteJobsError);
      throw deleteJobsError;
    }

    console.log(`[Cleanup] Deleted ${deletedJobsCount || 0} expired jobs`);

    // 2. Clean up orphaned job_search_links (cascade should handle this, but just in case)
    // This is handled by ON DELETE CASCADE, so we skip explicit cleanup

    // 3. Reset search_count for terms not searched in 30 days (optional - reduces noise in popular searches)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: resetError, count: resetCount } = await supabase
      .from('search_terms')
      .update({ search_count: 1 })
      .lt('last_searched_at', thirtyDaysAgo)
      .gt('search_count', 1);

    if (resetError) {
      console.error('[Cleanup] Error resetting stale search counts:', resetError);
    } else {
      console.log(`[Cleanup] Reset search count for ${resetCount || 0} stale search terms`);
    }

    // 4. Delete search terms that have no linked jobs and haven't been searched in 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Get search terms with no links
    const { data: orphanedTerms } = await supabase
      .from('search_terms')
      .select('id, canonical_term')
      .lt('last_searched_at', sixtyDaysAgo);

    let deletedTermsCount = 0;
    for (const term of orphanedTerms || []) {
      // Check if term has any linked jobs
      const { count: linkCount } = await supabase
        .from('job_search_links')
        .select('*', { count: 'exact', head: true })
        .eq('search_term_id', term.id);

      if (linkCount === 0) {
        await supabase
          .from('search_terms')
          .delete()
          .eq('id', term.id);
        deletedTermsCount++;
      }
    }

    console.log(`[Cleanup] Deleted ${deletedTermsCount} orphaned search terms`);

    // 5. Get current stats
    const { count: totalJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    const { count: totalSearchTerms } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true });

    const { count: totalLinks } = await supabase
      .from('job_search_links')
      .select('*', { count: 'exact', head: true });

    // 6. Also clean up the old job_search_cache table if it still exists
    const { error: oldCacheError, count: oldCacheDeleted } = await supabase
      .from('job_search_cache')
      .delete()
      .lt('expires_at', now);

    if (!oldCacheError && oldCacheDeleted) {
      console.log(`[Cleanup] Also deleted ${oldCacheDeleted} entries from old job_search_cache`);
    }

    const summary = {
      deletedExpiredJobs: deletedJobsCount || 0,
      resetStaleSearchTerms: resetCount || 0,
      deletedOrphanedTerms: deletedTermsCount,
      oldCacheDeleted: oldCacheDeleted || 0,
      currentStats: {
        totalJobs: totalJobs || 0,
        totalSearchTerms: totalSearchTerms || 0,
        totalLinks: totalLinks || 0
      }
    };

    console.log('[Cleanup] Complete:', JSON.stringify(summary));

    return new Response(JSON.stringify({
      success: true,
      ...summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Cleanup Jobs Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
