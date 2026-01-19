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
  return {
    company: coalesce(raw.company, raw.company_name, raw.companyName) || 'Company',
    role: coalesce(raw.title, raw.role) || 'Role',
    dates: coalesce(raw.dates, raw.date_range, raw.dateRange, raw.duration),
    duration: coalesce(raw.duration),
    location: coalesce(raw.location),
    description: coalesce(raw.description),
    logo: coalesce(
      raw.company_logo_url,
      raw.companyLogoUrl,
      raw.logo,
      raw.logo_url,
      raw.logoUrl
    ),
    type: ''
  };
}

/**
 * Map raw education item to normalized EducationItem
 */
function mapEducation(raw: ApifyEducation): EducationItem {
  // Parse year from duration string like "2016 - 2019" or just use year field
  let yearStr = coalesce(raw.year, raw.years, raw.duration, raw.dates, raw.date_range, raw.dateRange);
  
  return {
    institution: coalesce(raw.school, raw.institution, raw.school_name, raw.schoolName) || 'Institution',
    degree: coalesce(raw.degree, raw.degree_name, raw.degreeName),
    fieldOfStudy: coalesce(raw.field_of_study, raw.fieldOfStudy, raw.field),
    year: yearStr,
    logo: coalesce(
      raw.school_logo_url,
      raw.schoolLogoUrl,
      raw.logo,
      raw.logo_url,
      raw.logoUrl
    )
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
  const experiences = (rawData.experience || rawData.positions || []).map(mapExperience);
  const educations = (rawData.education || rawData.schools || []).map(mapEducation);
  const skills = parseSkills(rawData.skills || []);
  
  // Build full name from parts if needed
  const fullName = coalesce(
    rawData.fullName,
    rawData.full_name,
    rawData.name,
    rawData.firstName && rawData.lastName ? `${rawData.firstName} ${rawData.lastName}` : undefined
  );
  
  return {
    name: fullName || existingProfile?.name || '',
    currentRole: coalesce(
      rawData.headline,
      rawData.headlineRole,
      rawData.current_role,
      rawData.currentRole
    ) || existingProfile?.currentRole || '',
    summary: coalesce(rawData.summary, rawData.about, rawData.bio) || existingProfile?.summary || '',
    email: existingProfile?.email || coalesce(rawData.email) || '', // Prefer existing email
    phone: existingProfile?.phone || coalesce(rawData.phone) || '',
    linkedinUrl: coalesce(
      rawData.linkedinUrl,
      rawData.linkedin_url,
      rawData.publicIdentifier ? `https://linkedin.com/in/${rawData.publicIdentifier}` : undefined
    ) || existingProfile?.linkedinUrl || '',
    profilePictureUrl: coalesce(
      rawData.profilePicture,
      rawData.profilePictureUrl,
      rawData.profile_picture_url,
      rawData.avatar,
      rawData.avatarUrl
    ) || existingProfile?.profilePictureUrl || '',
    skills: skills.length > 0 ? skills : (existingProfile?.skills || []),
    experience: experiences.length > 0 ? experiences : (existingProfile?.experience || []),
    education: educations.length > 0 ? educations : (existingProfile?.education || []),
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
      company: exp.company || 'Company',
      role: exp.role || 'Role',
      dates: exp.dates || '',
      duration: exp.duration || '',
      location: exp.location || '',
      description: exp.description || '',
      logo: (exp as any).logo || (exp as any).company_logo_url || (exp as any).companyLogoUrl || (exp as any).logo_url || '',
      type: exp.type || ''
    })),
    education: (profile.education || []).map(edu => ({
      ...edu,
      institution: edu.institution || (edu as any).school || 'Institution',
      degree: edu.degree || '',
      fieldOfStudy: edu.fieldOfStudy || (edu as any).field_of_study || '',
      year: edu.year || (edu as any).duration || (edu as any).dates || '',
      logo: (edu as any).logo || (edu as any).school_logo_url || (edu as any).schoolLogoUrl || (edu as any).logo_url || ''
    }))
  };
}
