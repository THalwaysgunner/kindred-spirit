// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { term, location } = await req.json();
    
    if (!term || typeof term !== 'string') {
      throw new Error('Search term is required');
    }

    const normalizedInput = term.toLowerCase().trim();
    const normalizedLocation = (location || '').toLowerCase().trim();

    console.log(`[Normalize] Input: "${normalizedInput}", Location: "${normalizedLocation}"`);

    // Check if we already have this raw term mapped
    const { data: existingTerm } = await supabase
      .from('search_terms')
      .select('*')
      .eq('raw_term', normalizedInput)
      .eq('location', normalizedLocation)
      .maybeSingle();

    if (existingTerm) {
      console.log(`[Normalize] Found existing mapping: "${normalizedInput}" -> "${existingTerm.canonical_term}"`);
      
      // Increment search count
      await supabase
        .from('search_terms')
        .update({ 
          search_count: existingTerm.search_count + 1,
          last_searched_at: new Date().toISOString()
        })
        .eq('id', existingTerm.id);

      return new Response(JSON.stringify({
        rawTerm: normalizedInput,
        canonicalTerm: existingTerm.canonical_term,
        searchTermId: existingTerm.id,
        isNew: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if we have a similar canonical term already
    const { data: similarTerms } = await supabase
      .from('search_terms')
      .select('canonical_term')
      .limit(50);

    const existingCanonicals = similarTerms?.map(t => t.canonical_term) || [];

    // Call AI to normalize the term
    console.log(`[Normalize] Calling AI to normalize: "${normalizedInput}"`);
    
    const systemPrompt = `You are a job search term normalizer. Your task is to convert job search queries into standardized, canonical job titles.

Rules:
1. Fix typos and spelling errors
2. Use singular form (not plural)
3. Use lowercase
4. Expand common abbreviations (sr -> senior, jr -> junior, eng -> engineer, dev -> developer)
5. Use the most common industry-standard job title
6. If the input is already a valid job title, return it as-is (just lowercase and singular)
7. Return ONLY the canonical job title, nothing else

${existingCanonicals.length > 0 ? `
Existing canonical terms in the system (prefer these if they match):
${existingCanonicals.slice(0, 30).join(', ')}
` : ''}

Examples:
"data scientis" -> "data scientist"
"Data Scientists" -> "data scientist"
"sr software eng" -> "senior software engineer"
"ML Engineer" -> "machine learning engineer"
"frontend dev" -> "frontend developer"
"product mgr" -> "product manager"
"ux designer" -> "ux designer"
"devops" -> "devops engineer"
"swe" -> "software engineer"`;

    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: normalizedInput }
        ],
        temperature: 0.1,
        max_tokens: 50
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Normalize] AI error: ${response.status} - ${errorText}`);
      // Fallback to the input itself if AI fails
      const canonicalTerm = normalizedInput;
      
      const { data: newTerm, error: insertError } = await supabase
        .from('search_terms')
        .insert({
          raw_term: normalizedInput,
          canonical_term: canonicalTerm,
          location: normalizedLocation,
          search_count: 1,
          last_searched_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Normalize] Insert error:', insertError);
        throw insertError;
      }

      return new Response(JSON.stringify({
        rawTerm: normalizedInput,
        canonicalTerm: canonicalTerm,
        searchTermId: newTerm.id,
        isNew: true,
        fallback: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await response.json();
    let canonicalTerm = aiResult.choices?.[0]?.message?.content?.trim().toLowerCase() || normalizedInput;
    
    // Clean up any quotes or extra whitespace
    canonicalTerm = canonicalTerm.replace(/['"]/g, '').trim();

    console.log(`[Normalize] AI result: "${normalizedInput}" -> "${canonicalTerm}"`);

    // Store the new mapping
    const { data: newTerm, error: insertError } = await supabase
      .from('search_terms')
      .insert({
        raw_term: normalizedInput,
        canonical_term: canonicalTerm,
        location: normalizedLocation,
        search_count: 1,
        last_searched_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      // Handle race condition - another request might have inserted it
      if (insertError.code === '23505') {
        const { data: existingAfterRace } = await supabase
          .from('search_terms')
          .select('*')
          .eq('raw_term', normalizedInput)
          .eq('location', normalizedLocation)
          .single();

        return new Response(JSON.stringify({
          rawTerm: normalizedInput,
          canonicalTerm: existingAfterRace?.canonical_term || canonicalTerm,
          searchTermId: existingAfterRace?.id,
          isNew: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw insertError;
    }

    return new Response(JSON.stringify({
      rawTerm: normalizedInput,
      canonicalTerm: canonicalTerm,
      searchTermId: newTerm.id,
      isNew: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Normalize Search Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
