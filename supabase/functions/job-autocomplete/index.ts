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

    const { query, limit = 10 } = await req.json();

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchQuery = query.toLowerCase().trim();
    console.log(`[Autocomplete] Searching for: "${searchQuery}"`);

    // Split search into words for better matching
    const searchWords = searchQuery.split(/\s+/).filter(w => w.length >= 2);
    
    // Build search patterns - search for each word
    const patterns = searchWords.map(word => `%${word}%`);
    const primaryPattern = `%${searchQuery}%`;

    // Search alternate_titles table (has variations like "ML Engineer", "Machine Learning Engineer")
    const { data: alternateTitles, error: altError } = await supabase
      .from('alternate_titles')
      .select('alternate_title, short_title, o_net_soc_code')
      .or(`alternate_title.ilike.${primaryPattern},short_title.ilike.${primaryPattern}`)
      .limit(limit * 3);

    if (altError) {
      console.error('[Autocomplete] Error searching alternate_titles:', altError);
    }

    // Also search with individual words for better fuzzy matching
    let wordMatchTitles: any[] = [];
    if (searchWords.length > 0 && (alternateTitles?.length || 0) < limit) {
      // Search for titles containing all the words
      const { data: wordMatches } = await supabase
        .from('alternate_titles')
        .select('alternate_title, short_title, o_net_soc_code')
        .ilike('alternate_title', patterns[0])
        .limit(limit * 2);
      
      wordMatchTitles = wordMatches || [];
    }

    // Search occupation_data table (has main occupation titles)
    const { data: occupations, error: occError } = await supabase
      .from('occupation_data')
      .select('title, o_net_soc_code')
      .ilike('title', primaryPattern)
      .limit(limit);

    if (occError) {
      console.error('[Autocomplete] Error searching occupation_data:', occError);
    }

    // Search sample_of_reported_titles (has real job titles people have reported)
    const { data: reportedTitles, error: repError } = await supabase
      .from('sample_of_reported_titles')
      .select('reported_job_title, o_net_soc_code')
      .ilike('reported_job_title', primaryPattern)
      .limit(limit);

    if (repError) {
      console.error('[Autocomplete] Error searching sample_of_reported_titles:', repError);
    }

    // Combine and deduplicate results
    const titleSet = new Map<string, { title: string; onetCode: string | null }>();

    // Add alternate titles (highest priority - these are official variations)
    [...(alternateTitles || []), ...wordMatchTitles].forEach(item => {
      const title = item.alternate_title || item.short_title;
      if (title && !titleSet.has(title.toLowerCase())) {
        titleSet.set(title.toLowerCase(), { 
          title: title, 
          onetCode: item.o_net_soc_code 
        });
      }
    });

    // Add main occupation titles
    (occupations || []).forEach(item => {
      if (item.title && !titleSet.has(item.title.toLowerCase())) {
        titleSet.set(item.title.toLowerCase(), { 
          title: item.title, 
          onetCode: item.o_net_soc_code 
        });
      }
    });

    // Add reported titles
    (reportedTitles || []).forEach(item => {
      if (item.reported_job_title && !titleSet.has(item.reported_job_title.toLowerCase())) {
        titleSet.set(item.reported_job_title.toLowerCase(), { 
          title: item.reported_job_title, 
          onetCode: item.o_net_soc_code 
        });
      }
    });

    // Sort by relevance (titles starting with query first, then contains, then word matches)
    const suggestions = Array.from(titleSet.values())
      .filter(item => {
        // For multi-word queries, check if title contains all words
        if (searchWords.length > 1) {
          const lowerTitle = item.title.toLowerCase();
          return searchWords.every(word => lowerTitle.includes(word));
        }
        return true;
      })
      .sort((a, b) => {
        const aLower = a.title.toLowerCase();
        const bLower = b.title.toLowerCase();
        const aStarts = aLower.startsWith(searchQuery);
        const bStarts = bLower.startsWith(searchQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Prefer exact word match over partial
        const aExact = aLower.includes(searchQuery);
        const bExact = bLower.includes(searchQuery);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return a.title.length - b.title.length; // Shorter titles first
      })
      .slice(0, limit);

    console.log(`[Autocomplete] Found ${suggestions.length} suggestions`);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Autocomplete Error]:', error);
    return new Response(JSON.stringify({ error: error.message, suggestions: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
