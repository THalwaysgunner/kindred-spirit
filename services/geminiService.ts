import { supabase } from './supabaseClient';
import { JobRequirements, UserProfile, GeneratedResume, StructuredDescription } from '../types';

export const GeminiService = {
  async analyzeJob(jobText: string, jobUrl?: string): Promise<JobRequirements> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'analyzeJob', jobText, jobUrl }
    });
    if (error) throw error;
    return data as JobRequirements;
  },

  async analyzeJobFile(base64Data: string, mimeType: string): Promise<JobRequirements> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'analyzeJobFile', base64Data, mimeType }
    });
    if (error) throw error;
    return data as JobRequirements;
  },

  async analyzeRawData(rawData: any): Promise<JobRequirements> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'analyzeRawData', rawData }
    });
    if (error) throw error;
    return data as JobRequirements;
  },

  async generateTailoredResume(profile: UserProfile, job: JobRequirements): Promise<GeneratedResume & { matchScore: number }> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'generateTailoredResume', profile, job }
    });
    if (error) throw error;
    return data;
  },

  async mapProfileData(rawData: any, source: string): Promise<UserProfile> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'mapProfileData', rawData, source }
    });
    if (error) throw error;
    return data as UserProfile;
  },

  async structureJobDescription(text: string): Promise<StructuredDescription> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'structureJobDescription', jobText: text }
    });
    if (error) throw error;
    return data as StructuredDescription;
  },

  async parseResumeFile(base64Data: string, mimeType: string): Promise<UserProfile> {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: { action: 'parseResumeFile', base64Data, mimeType }
    });
    if (error) throw error;
    return data as UserProfile;
  }
};
