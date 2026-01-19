// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { action, jobText, jobUrl, rawData, profile, job, base64Data, mimeType, source } = await req.json();
    
    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case 'analyzeJob': {
        systemPrompt = "You are an intelligent recruiter assistant. Analyze job descriptions and extract key requirements.";
        userPrompt = jobUrl 
          ? `Access the following Job URL: ${jobUrl}\nExtract the Job Title, Company Name, Location, and Posting Date. Summarize the description and extract key skills.`
          : `Analyze this job description and extract key requirements:\n\n${jobText}`;
        
        userPrompt += `\n\nOutput ONLY valid JSON with this structure:
        {
          "title": "Job Title",
          "company": "Company Name",
          "description": "Full job description",
          "location": "Location",
          "employmentStatus": "Full-time/Part-time/Contract",
          "listedAt": "Date Posted",
          "jobUrl": "URL if available",
          "experienceLevel": "Entry/Mid/Senior",
          "industries": ["Industry1", "Industry2"],
          "headquarters": { "country": "", "city": "", "line1": "" },
          "logoUrl": "Logo URL if available"
        }`;
        break;
      }

      case 'analyzeJobFile': {
        systemPrompt = "You are an intelligent recruiter assistant. Analyze documents containing job descriptions.";
        userPrompt = `Analyze this document (Job Description) and extract key requirements.
        
        [Document content provided as base64 data]
        
        Output ONLY valid JSON with this structure:
        {
          "title": "Job Title",
          "company": "Company Name",
          "description": "Full job description",
          "location": "Location",
          "employmentStatus": "Full-time/Part-time/Contract",
          "listedAt": "Date Posted",
          "experienceLevel": "Entry/Mid/Senior",
          "industries": ["Industry1"]
        }`;
        break;
      }

      case 'analyzeRawData': {
        const jsonString = JSON.stringify(rawData).substring(0, 500000);
        systemPrompt = "You are an expert data normalizer.";
        userPrompt = `Analyze this raw JSON scraped from a job board and extract ALL the key info.
        
        RAW DATA:
        ${jsonString}

        Format as JSON with: title, company, description, location, employmentStatus, listedAt, jobUrl, experienceLevel, industries, headquarters (object with city, country, line1), logoUrl`;
        break;
      }

      case 'generateTailoredResume': {
        systemPrompt = "You are an expert career coach who creates tailored resumes.";
        userPrompt = `Create a tailored resume based on the User Profile and Job Requirements.
        
        USER PROFILE:
        ${JSON.stringify(profile)}
        
        JOB REQUIREMENTS:
        ${JSON.stringify(job)}
        
        Output ONLY valid JSON with:
        {
          "summary": "A powerful professional summary tailored to the job",
          "skills": ["Skill1", "Skill2"],
          "experience": [
            {
              "company": "Company Name",
              "role": "Role Title",
              "dates": "Date Range",
              "bulletPoints": ["Achievement 1", "Achievement 2"]
            }
          ],
          "matchScore": 85
        }`;
        break;
      }

      case 'mapProfileData': {
        const jsonString = JSON.stringify(rawData).substring(0, 1000000);
        systemPrompt = "You are an expert HR data specialist.";
        userPrompt = `Map the provided ${source} data into a standardized User Profile JSON.
        
        CRITICAL INSTRUCTIONS:
        1. EXTRACT EVERYTHING: Look for education, schools, experience, positions arrays.
        2. Dates vs Duration: 'dates' = range (e.g. "Jan 2020 - Present"), 'duration' = span (e.g. "4 yrs 2 mos")
        3. Extract profile picture URL and company logos.
        
        RAW DATA:
        ${jsonString}
        
        Output JSON with: name, email, phone, linkedinUrl, profilePictureUrl, currentRole, summary, skills[], experience[], education[]`;
        break;
      }

      case 'structureJobDescription': {
        systemPrompt = "You are a structured data expert.";
        userPrompt = `Divide this job description into verbatim blocks without rewriting.
        
        TEXT:
        ${jobText}
        
        Output JSON with arrays for: description, about_the_role, responsibilities, requirements, nice_to_have, benefits
        Each array contains objects like: { "type": "paragraph", "text": "..." } or { "type": "bullets", "items": ["..."] }`;
        break;
      }

      case 'parseResumeFile': {
        systemPrompt = "You are an expert resume parser.";
        userPrompt = `Parse this resume document and extract user profile information.
        
        [Document content provided as base64 data]
        
        Output JSON with: name, email, phone, linkedinUrl, currentRole, summary, skills[], experience[], education[]`;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[AI Edge Function] Processing action: ${action}`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI returned no content');
    }

    // Try to parse JSON from the response
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        result = JSON.parse(codeBlockMatch[1]);
      } else {
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          result = JSON.parse(content.substring(start, end + 1));
        } else {
          throw new Error('Could not extract JSON from AI response');
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[AI Edge Function Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
