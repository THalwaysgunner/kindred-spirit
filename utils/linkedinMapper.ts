/**
 * Deterministic mapper from raw LinkedIn/Apify data to normalized profile shape.
 * This ensures logos, years, institution names are never lost due to AI variability.
 */

import { UserProfile, ExperienceItem, EducationItem } from '../types';

interface ApifyExperience {
  company?: string;
  company_name?: string;
  companyName?: string;
  title?: string;
  role?: string;
  duration?: string;
  dates?: string;
  date_range?: string;
  dateRange?: string;
  location?: string;
  description?: string;
  company_logo_url?: string;
  companyLogoUrl?: string;
  logo?: string;
  logo_url?: string;
  logoUrl?: string;
}

interface ApifyEducation {
  school?: string;
  institution?: string;
  school_name?: string;
  schoolName?: string;
  degree?: string;
  degree_name?: string;
  degreeName?: string;
  field_of_study?: string;
  fieldOfStudy?: string;
  field?: string;
  duration?: string;
  dates?: string;
  date_range?: string;
  dateRange?: string;
  year?: string;
  years?: string;
  school_logo_url?: string;
  schoolLogoUrl?: string;
  logo?: string;
  logo_url?: string;
  logoUrl?: string;
}

interface ApifyRawProfile {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  headline?: string;
  headlineRole?: string;
  current_role?: string;
  currentRole?: string;
  summary?: string;
  about?: string;
  bio?: string;
  profilePicture?: string;
  profilePictureUrl?: string;
  profile_picture_url?: string;
  avatar?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  linkedin_url?: string;
  publicIdentifier?: string;
  skills?: any[];
  experience?: ApifyExperience[];
  positions?: ApifyExperience[];
  education?: ApifyEducation[];
  schools?: ApifyEducation[];
}

/**
 * Extract the first non-empty value from multiple possible keys
 */
function coalesce(...values: (string | undefined | null)[]): string {
  for (const v of values) {
    if (v && v.trim() && v !== 'null' && v !== 'undefined') {
      return v.trim();
    }
  }
  return '';
}

/**
 * Map raw experience item to normalized ExperienceItem
 */
function mapExperience(raw: ApifyExperience): ExperienceItem {
  // Parse duration string like "Sep 2025 - Present · 5 mos" into dates and duration
  const durationStr = raw.duration || '';
  let dates = '';
  let duration = '';

  if (durationStr.includes(' · ')) {
    const parts = durationStr.split(' · ');
    dates = parts[0] || '';
    duration = parts[1] || '';
  } else {
    dates = durationStr;
  }

  return {
    company: raw.company || '',
    role: raw.title || '',
    dates: dates,
    duration: duration,
    location: raw.location || '',
    description: raw.description || '',
    logo: raw.company_logo_url || '',
    type: (raw as any).employment_type || ''
  };
}

/**
 * Map raw education item to normalized EducationItem
 */
function mapEducation(raw: ApifyEducation): EducationItem {
  return {
    institution: raw.school || '',
    degree: raw.degree || '',
    fieldOfStudy: raw.field_of_study || '',
    year: raw.duration || '',
    logo: raw.school_logo_url || ''
  };
}

/**
 * Parse skills from various formats
 */
function parseSkills(rawSkills: any[]): { name: string }[] {
  if (!rawSkills || !Array.isArray(rawSkills)) return [];

  return rawSkills.map(skill => {
    if (typeof skill === 'string') {
      return { name: skill };
    }
    if (skill && typeof skill === 'object') {
      return { name: skill.name || skill.skill || skill.title || String(skill) };
    }
    return { name: String(skill) };
  }).filter(s => s.name && s.name.trim());
}

/**
 * Main deterministic mapper function
 * This normalizes ALL possible field name variants from Apify/LinkedIn scraping
 */
export function mapLinkedInToProfile(rawData: ApifyRawProfile, existingProfile?: Partial<UserProfile>): UserProfile {
  // Get basic_info object from API response
  const basicInfo = (rawData as any).basic_info || {};

  // Map experience array
  const experiences = (rawData.experience || []).map(mapExperience);

  // Map education array
  const educations = (rawData.education || []).map(mapEducation);

  // Map skills from basic_info.top_skills array (array of strings)
  const topSkills = basicInfo.top_skills || [];
  const skills = topSkills.map((skill: string) => ({ name: skill }));

  // Build full name - API uses basic_info.fullname
  const fullName = basicInfo.fullname || '';

  return {
    name: fullName,
    currentRole: basicInfo.headline || '',
    summary: basicInfo.about || '',
    email: basicInfo.email || '',
    phone: '',
    linkedinUrl: basicInfo.profile_url || '',
    profilePictureUrl: basicInfo.profile_picture_url || '',
    skills: skills,
    experience: experiences,
    education: educations,
    isVerified: true
  };
}

/**
 * Normalize a profile that may have been mapped by AI with inconsistent keys
 * This is a safety fallback to ensure all fields are properly populated
 */
export function normalizeProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    name: profile.name || '',
    currentRole: profile.currentRole || '',
    summary: profile.summary || '',
    email: profile.email || '',
    phone: profile.phone || '',
    linkedinUrl: profile.linkedinUrl || '',
    profilePictureUrl: profile.profilePictureUrl || '',
    skills: (profile.skills || []).map(s =>
      typeof s === 'string' ? { name: s } : { name: s.name || '' }
    ).filter(s => s.name),
    experience: (profile.experience || []).map(exp => ({
      ...exp,
      company: exp.company || '',
      role: exp.role || (exp as any).title || '',
      dates: exp.dates || '',
      duration: exp.duration || '',
      location: exp.location || '',
      description: exp.description || '',
      logo: exp.logo || (exp as any).company_logo_url || (exp as any).companyLogoUrl || '',
      type: exp.type || (exp as any).employment_type || ''
    })),
    education: (profile.education || []).map(edu => ({
      ...edu,
      institution: edu.institution || (edu as any).school || '',
      degree: edu.degree || '',
      fieldOfStudy: edu.fieldOfStudy || (edu as any).field_of_study || '',
      year: edu.year || (edu as any).duration || '',
      logo: edu.logo || (edu as any).school_logo_url || (edu as any).schoolLogoUrl || ''
    }))
  };
}
