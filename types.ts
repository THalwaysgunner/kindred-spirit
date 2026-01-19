
export type ViewState = 'landing' | 'dashboard' | 'create' | 'applications-list' | 'profile' | 'view-application' | 'search' | 'get-ready' | 'company-research' | 'interview-prep';

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  profilePictureUrl?: string;
  currentRole: string;
  summary: string;
  useRegisteredEmail: boolean; // New field
  isVerified?: boolean; // LinkedIn verified
  skills: { id?: string; name: string }[]; // Updated to object array
  experience: ExperienceItem[];
  education: EducationItem[];
  rawResumeText?: string;
}

export interface ExperienceItem {
  id?: string; // For keying
  company: string;
  role: string;
  dates: string; // "Oct 2017 - Oct 2019"
  duration?: string; // "2 yrs 1 mo"
  location?: string;
  description: string;
  type?: string; // "Full-time", "Part-time", "Contract"
  logo?: string; // Optional URL for company logo
}

export interface EducationItem {
  id?: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  year: string; // "2024 - 2028"
  logo?: string;
}

export interface JobRequirements {
  title: string;
  company: string; // From company_info.name
  description: string; // From job_info.description
  location: string;
  employmentStatus: string; // From job_info.employment_status
  listedAt: string; // From job_info.listed_at
  jobUrl: string; // From job_info.job_url
  experienceLevel: string; // From job_info.experience_level
  industries: string[]; // From company_info.industries
  headquarters: {
    country: string;
    city: string;
    line1: string;
  };
  logoUrl: string; // From company_info.logo_url
  nice_to_have?: string; // Optional field for unstructured nice-to-have text
  about_the_role?: string; // Optional field for unstructured about-the-role text
  responsibilities?: string; // Optional field for unstructured responsibilities text
  requirements?: string; // Optional field for unstructured requirements text
  benefits?: string; // Optional field for unstructured benefits text
}

export interface GeneratedResume {
  name?: string;
  currentRole?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  headerLogo?: string;
  styles?: {
    headerBg?: string;
    headerTextColor?: string;
    accentColor?: string;
  };
  summary: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    dates: string;
    bulletPoints: string[];
  }[];
  education?: EducationItem[];
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletBlock {
  type: 'bullets';
  items: string[];
}

export type DescriptionBlock = ParagraphBlock | BulletBlock;

export interface StructuredDescription {
  description: DescriptionBlock[];
  about_the_role: DescriptionBlock[];
  responsibilities: DescriptionBlock[];
  requirements: DescriptionBlock[];
  nice_to_have: DescriptionBlock[];
  benefits: DescriptionBlock[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  location: string;
  notes: string;
}

export interface Application {
  id: string;
  jobUrl?: string; // Deprecated in favor of job_url but keeping for legacy
  jobText?: string;
  requirements: JobRequirements; // Maps to job_details jsonb
  tailoredResume: GeneratedResume; // Maps to tailored_resume jsonb
  createdAt: string;
  status: 'Draft' | 'Bookmarked' | 'Applying' | 'Applied' | 'Interviewing' | 'Negotiating' | 'Offer' | 'Accepted' | 'Rejected' | 'Not Selected' | 'I Withdrew' | 'No Response' | 'Archived';
  matchScore: number;
  notes?: string;

  // Structured Data Fields for Bulls/Formatting
  description?: DescriptionBlock[];
  about_the_role?: DescriptionBlock[];
  responsibilities?: DescriptionBlock[];
  structured_requirements?: DescriptionBlock[];
  nice_to_have?: DescriptionBlock[];
  benefits?: DescriptionBlock[];

  hq_address?: string;
  posted_on?: string;
  logo_url?: string;
  job_resume?: string;
  location?: string;
  employmentStatus?: string;
  experienceLevel?: string;
  industries?: string[];

  // Legacy/UI Fields
  salary?: string;
  salary_expectation?: {
    amount: string;
    currency: string;
  };
  nextInterviewDate?: string;
  meetings?: Meeting[];
  workType?: 'Remote' | 'Hybrid' | 'On-site' | 'Contract' | 'Unknown';
}

// Search Specific Types matching the Scraper API
export interface JobSearchResult {
  job_id: string;
  job_title: string;
  company: string;
  company_url?: string;
  company_urn?: string;
  location: string;
  posted_at: string;
  posted_at_epoch?: number;
  created_at?: string;
  description: string;
  is_easy_apply: boolean;
  is_promoted: boolean;
  is_verified: boolean;
  applicant_count: number;
  job_url: string;
  apply_url?: string;
  salary?: string;
  work_type?: string; // e.g. "Full-time", "Contract"
  job_insights?: string[]; // Array of insight strings
  geo_id?: string;
  companyLogo?: string; // Optional, might be constructed or missing
}

export interface SearchFilters {
  keywords: string;
  location: string;
  date_posted: string;
  experienceLevel: string;
  remote: string;
  easy_apply: string;
}
