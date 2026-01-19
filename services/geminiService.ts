import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { JobRequirements, UserProfile, GeneratedResume, StructuredDescription, DescriptionBlock } from "../types";

// Use a safe check for the API key to avoid crashing if it's not defined yet
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env?.API_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  } catch (e) {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Safety settings to prevent blocking valid job descriptions
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- Helper: Robust JSON Extractor ---
function extractJSON(text: string): any {
  if (!text) return null;
  try {
    // 1. Try parsing directly
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extracting from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e2) {
        // continue
      }
    }

    // 3. Try finding the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e3) {
        // continue
      }
    }

    throw new Error("Could not extract valid JSON from response");
  }
}

// Schema for parsing Job Requirements
const jobRequirementsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The job title" },
    company: { type: Type.STRING, description: "The company (employer) name" },
    description: { type: Type.STRING, description: "The full job description" },
    location: { type: Type.STRING, description: "The location of the job" },
    employmentStatus: { type: Type.STRING },
    listedAt: { type: Type.STRING },
    jobUrl: { type: Type.STRING },
    experienceLevel: { type: Type.STRING },
    industries: { type: Type.ARRAY, items: { type: Type.STRING } },
    headquarters: {
      type: Type.OBJECT,
      properties: {
        country: { type: Type.STRING },
        city: { type: Type.STRING },
        line1: { type: Type.STRING },
      }
    },
    logoUrl: { type: Type.STRING },
  },
  required: ["title", "company", "description"],
};

const structuredDescriptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["paragraph", "bullets"] },
          text: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["type"]
      }
    },
    about_the_role: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["paragraph", "bullets"] },
          text: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["type"]
      }
    },
    responsibilities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["paragraph", "bullets"] },
          text: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["type"]
      }
    },
    requirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["paragraph", "bullets"] },
          text: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["type"]
      }
    },
    nice_to_have: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["paragraph", "bullets"] },
          text: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["type"]
      }
    }
  },
  required: ["description", "about_the_role", "responsibilities", "requirements", "nice_to_have"]
};

// Schema for Generated Resume
const generatedResumeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "A powerful professional summary tailored to the job" },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of skills that match the job requirements",
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          dates: { type: Type.STRING },
          bulletPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Bullet points highlighting achievements",
          },
        },
      },
    },
  },
};

// Schema for User Profile
const userProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    email: { type: Type.STRING },
    phone: { type: Type.STRING },
    linkedinUrl: { type: Type.STRING },
    profilePictureUrl: { type: Type.STRING, description: "URL of the profile image" },
    currentRole: { type: Type.STRING },
    summary: { type: Type.STRING },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          dates: { type: Type.STRING },
          duration: { type: Type.STRING },
          location: { type: Type.STRING },
          type: { type: Type.STRING, description: "Full-time, Part-time, Contract, etc." },
          description: { type: Type.STRING },
          logo: { type: Type.STRING, description: "Company logo URL" },
        }
      }
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          institution: { type: Type.STRING },
          degree: { type: Type.STRING },
          fieldOfStudy: { type: Type.STRING },
          year: { type: Type.STRING },
          logo: { type: Type.STRING, description: "School logo URL" },
        }
      }
    }
  },
  required: ["name", "skills", "experience"]
};

export const GeminiService = {
  /**
   * Analyzes job description text or uses Google Search to find info from a URL
   */
  async analyzeJob(jobText: string, jobUrl?: string): Promise<JobRequirements> {
    const model = "gemini-2.5-flash";
    const useSearch = !!(jobUrl && jobUrl.length > 5);

    let prompt = "";
    const parts: any[] = [];

    if (useSearch) {
      // Use Google Search grounding
      prompt = `
        You are an intelligent recruiter assistant.
        1. Access the following Job URL: ${jobUrl}
        2. Extract the Job Title, Company Name, Location, and Posting Date.
        3. Summarize the description and extract key skills.

        Output ONLY valid JSON. Structure:
        {
          "title": "Job Title",
          "company": "Company Name",
          "location": "Location",
          "postingDate": "Date Posted",
          "keySkills": ["Skill 1", "Skill 2"],
          "descriptionSummary": "Summary",
          "culturalFit": ["Value 1"]
        }
      `;
    } else {
      prompt = `Analyze the provided job information and extract key requirements into JSON.`;
    }

    if (jobText) {
      prompt += `\n\nJob Text Provided:\n${jobText}`;
    }

    parts.push({ text: prompt });

    const config: any = {
      safetySettings: SAFETY_SETTINGS,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
      config.responseSchema = jobRequirementsSchema;
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: config,
      });

      const text = response.text;
      if (!text) {
        console.warn("Gemini returned empty text. Candidates:", response.candidates);
        throw new Error("AI returned no content. Please try again.");
      }

      return extractJSON(text) as JobRequirements;
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      throw error; // Let the UI handle the error
    }
  },

  /**
   * Analyzes an uploaded file (PDF, Image) for job requirements
   */
  async analyzeJobFile(base64Data: string, mimeType: string): Promise<JobRequirements> {
    const model = "gemini-2.5-flash";

    const prompt = `
      You are an intelligent recruiter assistant.
      Analyze the provided document (Job Description) and extract key requirements.

      Output ONLY valid JSON matching this schema:
      - title
      - company
      - location
      - postingDate
      - keySkills (array)
      - descriptionSummary
      - culturalFit (array)
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: jobRequirementsSchema,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const text = response.text;
      if (!text) throw new Error("AI returned no content for file analysis.");
      return JSON.parse(text) as JobRequirements;
    } catch (error) {
      console.error("Gemini File Analysis Error:", error);
      throw error;
    }
  },

  /**
   * Normalizes raw JSON data (e.g. from Apify) into a standard JobRequirements object
   */
  async analyzeRawData(rawData: any): Promise<JobRequirements> {
    const model = "gemini-2.5-flash";

    // Convert to string and ensure we don't truncate important data
    // Gemini 2.5 Flash has a large context window, so we can send a lot.
    // 500,000 chars is roughly 125k tokens, safe for 2.5 Flash.
    const jsonString = JSON.stringify(rawData).substring(0, 500000);

    const prompt = `
      You are an expert data normalizer.
      Analyze this raw JSON scraped from a job board and extract ALL the key info.
      
      RAW DATA:
      ${jsonString}

      Format as JSON matching this schema:
      - title (from job_info.title)
      - company (from company_info.name)
      - description (the full job_info.description)
      - location (from job_info.location)
      - employmentStatus (from job_info.employment_status)
      - listedAt (from job_info.listed_at)
      - jobUrl (from job_info.job_url)
      - experienceLevel (from job_info.experience_level)
      - industries (from company_info.industries)
      - headquarters (object with city, country, line1 from company_info.headquarters)
      - logoUrl (from company_info.logo_url)
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: jobRequirementsSchema,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const text = response.text;
      if (!text) throw new Error("AI returned no content for raw data analysis.");
      return JSON.parse(text) as JobRequirements;
    } catch (error) {
      console.error("Gemini Raw Data Analysis Error:", error);
      throw error;
    }
  },

  /**
   * Generates a tailored resume based on user profile and job requirements
   */
  async generateTailoredResume(profile: UserProfile, job: JobRequirements): Promise<GeneratedResume & { matchScore: number }> {
    const model = "gemini-2.5-flash";

    const prompt = `
      You are an expert career coach.
      Create a tailored resume based on the User Profile and Job Requirements.
      
      USER PROFILE:
      ${JSON.stringify(profile)}
      
      JOB REQUIREMENTS:
      ${JSON.stringify(job)}
    `;

    const extendedSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        ...generatedResumeSchema.properties,
        matchScore: { type: Type.INTEGER, description: "A score from 0 to 100 indicating fit" }
      },
      required: ["summary", "skills", "experience", "matchScore"]
    };

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: extendedSchema,
          thinkingConfig: { thinkingBudget: 1024 },
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const text = response.text;
      if (!text) throw new Error("AI returned no content for resume generation.");
      return JSON.parse(text);
    } catch (error) {
      console.error("Resume Generation Error:", error);
      throw error;
    }
  },

  /**
   * Maps Raw Profile Data (from LinkedIn Apify or other sources) to UserProfile
   */
  async mapProfileData(rawData: any, source: string): Promise<UserProfile> {
    const model = "gemini-2.5-flash";

    // INCREASED LIMIT: Ensure we capture full education/experience history which might be at the end of large JSONs.
    // 1,000,000 chars is roughly 250k tokens. Gemini 2.5 Flash supports 1M tokens.
    const jsonString = JSON.stringify(rawData).substring(0, 1000000);

    const prompt = `
      You are an expert HR data specialist.
      Map the provided ${source} data into a standardized User Profile JSON.
      
      CRITICAL INSTRUCTIONS:
      1. **EXTRACT EVERYTHING**: Scour the entire JSON. Do NOT stop after the first few items. 
         - Look for 'education', 'schools', 'education_history' arrays.
         - Look for 'experience', 'positions', 'work_history' arrays.
         - If there are fields like 'see_more' or nested lists, include them.
         - Capture ALL items found, regardless of date.
      
      2. **Dates vs Duration**: 
         - 'dates' should ONLY contain the range (e.g. "Jan 2020 - Present" or "2015 - 2019").
         - 'duration' should ONLY contain the time span (e.g. "4 yrs 2 mos"). 
         - DO NOT put the date range inside the duration field.
         - If the input has "Jan 2020 - Present · 4 yrs", split it. "Jan 2020 - Present" is date, "4 yrs" is duration.

      3. **Images**:
         - Extract the profile picture URL.
         - For every experience/education item, extract the logo URL if available.

      4. **Cleanup**:
         - Ensure no field contains the string "null" or "undefined". Use empty string if missing.

      RAW DATA:
      ${jsonString}
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: userProfileSchema,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const text = response.text;
      if (!text) throw new Error("AI returned no content for profile mapping.");
      return JSON.parse(text) as UserProfile;
    } catch (error) {
      console.error("Gemini CV Mapping Error:", error);
      throw error;
    }
  },

  /**
   * Structuring Agent: Divides job description into verbatim blocks.
   * NO REWRITING, NO SUMMARY, NO NORMALIZATION.
   */
  async structureJobDescription(text: string): Promise<StructuredDescription> {
    const model = "gemini-2.5-flash";

    const prompt = `
      SYSTEM ROLE:
      You are a strict data extraction engine. Your task is to restructure job description text into a fixed JSON schema.
      You are NOT allowed to rewrite, summarize, paraphrase, improve, normalize, or modify the content in any way.
      You must preserve 100% of the original text content verbatim.
      Your only job is to divide the text into structured blocks.

      CRITICAL RULES:
      - Do NOT change any wording.
      - Do NOT remove any text.
      - Do NOT add any new text.
      - Do NOT fix grammar or spelling.
      - Do NOT normalize formatting inside sentences.
      - Do NOT merge or split sentences unless splitting into paragraph/bullet blocks.
      - Preserve capitalization and punctuation exactly as given.
      - Every part of the source text must appear in the output.
      - If something does not match a category, still include it under the most appropriate section.

      OUTPUT FORMAT:
      Return a single JSON object with the following fixed keys:

      {
        "description": [],
        "about_the_role": [],
        "responsibilities": [],
        "requirements": [],
        "nice_to_have": []
      }

      Each key must contain an array of blocks.
      Each block must be either:

      Paragraph block:
      {
        "type": "paragraph",
        "text": "<verbatim text>"
      }

      Bullet block:
      {
        "type": "bullets",
        "items": ["<verbatim line>", "<verbatim line>"]
      }

      CLASSIFICATION RULES:

      1) description:
        - Company overview
        - Mission
        - Vision
        - Growth story
        - Funding
        - Culture intro
        - Hiring statement

      2) about_the_role:
        - Role summary
        - Position overview
        - Impact
        - Purpose of the role

      3) responsibilities:
        - Tasks
        - Duties
        - What the role does
        - Sentences starting with verbs (Design, Build, Develop, Implement, Own, Lead, etc.)

      4) requirements:
        - Experience
        - Degrees
        - Qualifications
        - Required skills
        - Mandatory background
        - Must-have tools
        - Years of experience
        - Required: sections

      5) nice_to_have:
        - Advantage
        - Preferred
        - Bonus
        - Nice to have

      BLOCK SPLITTING RULES:

      - If the source uses bullets, preserve them as bullet blocks.
      - If the source uses paragraphs, preserve them as paragraph blocks.
      - If multiple bullets appear consecutively, group them into a single bullet block.
      - If paragraphs appear between bullet sections, create a new paragraph block.
      - Never merge bullets into paragraphs.
      - Never merge paragraphs into bullets.

      COVERAGE RULE:
      100% of the input text must appear in the output.
      No text may be dropped or rewritten.

      After extraction:
      - Verify no block contains only a section header or label.
      - Verify benefits appear ONLY under "benefits".
      - Verify responsibilities appear ONLY under "responsibilities".
      - Verify requirements appear ONLY under "requirements".
      - Verify nice-to-have appears ONLY under "nice_to_have".

      If any rule is violated, fix it before returning output.

      ━━━━━━━━━━━━━━━━━━━━━━
      Now parse the following job description text and return the structured JSON.

      INPUT TEXT:
      ${text}
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: structuredDescriptionSchema,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const resultText = response.text;
      if (!resultText) throw new Error("AI returned no content for structuring.");
      console.log("[GeminiService] Raw AI Response for Structuring:", resultText);
      return JSON.parse(resultText) as StructuredDescription;
    } catch (error) {
      console.error("Gemini Structuring Error:", error);
      throw error;
    }
  },
  /**
   * Parses a resume file (PDF/Image) into a UserProfile structure
   */
  async parseResumeFile(base64Data: string, mimeType: string): Promise<UserProfile> {
    const model = "gemini-2.5-flash";
    const prompt = `
      You are an expert HR assistant.
      Extract candidate information from the provided resume document.
      
      Map the data into the following JSON structure:
      {
        "name": "Full Name",
        "email": "Email Address",
        "phone": "Phone Number",
        "linkedinUrl": "LinkedIn Profile URL",
        "currentRole": "Current or Most Recent Job Title",
        "summary": "Professional Summary",
        "skills": ["Skill 1", "Skill 2", ...],
        "experience": [
            {
                "company": "Company Name",
                "role": "Job Title",
                "dates": "Date Range (e.g. Jan 2020 - Present)",
                "duration": "Duration (e.g. 2 yrs)",
                "location": "Location",
                "description": "Job Description / Achievements"
            }
        ],
        "education": [
            {
                "institution": "School/University Name",
                "degree": "Degree Name",
                "fieldOfStudy": "Field",
                "year": "Year Range (e.g. 2018 - 2022)"
            }
        ]
      }
      
      If a field is not found, use an empty string or empty array.
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: userProfileSchema,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const text = response.text;
      if (!text) throw new Error("AI returned no content for resume parsing.");
      return JSON.parse(text) as UserProfile;
    } catch (error) {
      console.error("Gemini Resume Parse Error:", error);
      throw error;
    }
  }
};
