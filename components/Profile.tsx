
import React, { useState, useRef } from 'react';
import { UserProfile, ExperienceItem, EducationItem } from '../types';
import { ApifyService } from '../services/apifyService';
import { GeminiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import {
  User,
  Briefcase,
  GraduationCap,
  Save,
  Upload,
  Linkedin,
  Loader2,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Building2,
  X,
  Camera,
  ChevronDown,
  ChevronUp,
  BadgeCheck
} from 'lucide-react';

interface ProfileProps {
  profile: UserProfile;
  onChange: (p: UserProfile) => void;
  session: Session | null;
}

// Helper Component for Collapsible Text
const CollapsibleText = ({ text, lines = 2 }: { text: string, lines?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  // Logic to determine if "Show More" is needed
  const isLong = text.length > (lines * 80) || text.split('\n').length > lines;

  return (
    <div>
      <p
        className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: isExpanded ? 'unset' : lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-xs text-brand-600 dark:text-brand-400 font-bold mt-1 hover:underline flex items-center gap-1"
        >
          {isExpanded ? (
            <>Show Less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Show More <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
};

export const Profile: React.FC<ProfileProps> = ({ profile, onChange, session }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  // Consolidating LinkedIn URL state into the profile object directly
  const [activeTab, setActiveTab] = useState<'import' | 'linkedin'>('import');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skillInput, setSkillInput] = useState('');

  // --- Edit Mode State ---
  const [editingExpIndex, setEditingExpIndex] = useState<number | null>(null);
  const [editingEduIndex, setEditingEduIndex] = useState<number | null>(null);

  // Summary Edit State
  const [editingSummary, setEditingSummary] = useState(false);
  const [tempSummary, setTempSummary] = useState('');

  // Personal Details Edit State
  const [editingPersonalDetails, setEditingPersonalDetails] = useState(false);
  const [tempPersonal, setTempPersonal] = useState({
    name: profile.name,
    currentRole: profile.currentRole,
    email: profile.email,
    phone: profile.phone
  });

  // Skills Edit State
  const [editingSkills, setEditingSkills] = useState(false);
  const [tempSkills, setTempSkills] = useState<{ id?: string; name: string }[]>(profile.skills);

  // Import Section State
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Temp state for the item currently being edited
  const [tempExp, setTempExp] = useState<ExperienceItem | null>(null);
  const [tempEdu, setTempEdu] = useState<EducationItem | null>(null);

  // Track the last version that was persisted to the database
  const [lastSavedProfile, setLastSavedProfile] = useState<UserProfile>(profile);

  // Sync baseline when data first arrives from server
  React.useEffect(() => {
    if (profile.name && !lastSavedProfile.name) {
      setLastSavedProfile(profile);
    }
  }, [profile]);

  // Helper to safely render text (prevents "null" string from API)
  const safeText = (text?: string | null) => {
    if (!text || text === 'null' || text === 'undefined') return null;
    return text;
  };

  const isUuid = (id?: string) => {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  };
  // Skills state management
  const addSkill = () => {
    if (!skillInput.trim()) return;
    const name = skillInput.trim();
    const isDuplicate = tempSkills.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      setSkillInput('');
      return;
    }
    setTempSkills([...tempSkills, { name }]);
    setSkillInput('');
  };

  const deleteSkill = (skillName: string) => {
    setTempSkills(tempSkills.filter(s => s.name !== skillName));
  };

  const handleKeyDownSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const saveSkills = async () => {
    if (!session) return;
    setSaving('skills');
    try {
      const skillNames = tempSkills.map(s => s.name);

      // Skills are stored as text[] array on profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ skills: skillNames })
        .eq('id', session.user.id);

      if (error) throw error;

      const newProfile = { ...profile, skills: tempSkills };
      onChange(newProfile);
      setLastSavedProfile(newProfile);
      setEditingSkills(false);
    } catch (err) {
      console.error('Error saving skills:', err);
    } finally {
      setSaving(null);
    }
  };

  const startEditSkills = () => {
    setTempSkills(profile.skills);
    setEditingSkills(true);
  };



  // Helper to deduplicate Dates vs Duration
  const renderDateRow = (dates?: string, duration?: string) => {
    const d = safeText(dates);
    const dur = safeText(duration);

    if (!d && !dur) return <span className="text-slate-400">Date N/A</span>;
    if (d && !dur) return <span>{d}</span>;
    if (!d && dur) return <span>{dur}</span>;

    // Check for near-exact duplication
    if (d === dur) return <span>{d}</span>;
    // Check if one contains the other (simple check)
    if (d?.includes(dur!)) return <span>{d}</span>;

    return (
      <div className="flex items-center gap-1.5">
        <span>{d}</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="text-slate-500 dark:text-slate-400">{dur}</span>
      </div>
    );
  };

  const handleChange = (field: keyof UserProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  const savePersonalDetails = async () => {
    if (!session) return;
    setSaving('personal');
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        full_name: tempPersonal.name,
        headline_role: tempPersonal.currentRole,
        email: tempPersonal.email,
        phone: tempPersonal.phone,
        profile_picture_url: profile.profilePictureUrl
      });
      if (error) throw error;

      const newProfile = {
        ...profile,
        name: tempPersonal.name,
        currentRole: tempPersonal.currentRole,
        email: tempPersonal.email,
        phone: tempPersonal.phone
      };
      onChange(newProfile);
      setLastSavedProfile(newProfile);
      setEditingPersonalDetails(false);
    } catch (err: any) {
      console.error('Error saving personal details:', err);
    } finally {
      setSaving(null);
    }
  };

  const startEditPersonal = () => {
    setTempPersonal({
      name: profile.name,
      currentRole: profile.currentRole,
      email: profile.email,
      phone: profile.phone
    });
    setEditingPersonalDetails(true);
  };

  // --- Import Handlers ---

  const handleProfileImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file || !session) return;

      setSaving('profile-image');
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(filePath);

        // 3. Update Profile Table immediately
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ profile_picture_url: publicUrl })
          .eq('id', session.user.id);

        if (updateError) throw updateError;

        // 4. Update local state
        onChange({ ...profile, profilePictureUrl: publicUrl });
      } catch (err) {
        console.error('Error uploading profile picture:', err);
      } finally {
        setSaving(null);
      }
    };
    input.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingMessage('Parsing...');
    setSaving('import');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const parsedProfile = await GeminiService.parseResumeFile(base64, file.type);

          // Re-map skills from string[] to {name: string}[]
          const mappedSkills = (parsedProfile.skills || []).map((s: any) => ({
            name: typeof s === 'string' ? s : s.name
          }));

          onChange({
            ...profile,
            ...parsedProfile,
            skills: mappedSkills,
            profilePictureUrl: parsedProfile.profilePictureUrl || profile.profilePictureUrl
          });
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
          setSaving(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setSaving(null);
    }
  };

  const handleLinkedinImport = async () => {
    if (!profile.linkedinUrl || !session) return;
    setLoading(true);
    setLoadingMessage('Importing...');
    setSaving('import');

    try {
      const rawData = await ApifyService.fetchLinkedInProfile(profile.linkedinUrl);
      if (!rawData) throw new Error("Could not fetch LinkedIn data");

      setLoadingMessage('Normalizing...');
      const mappedProfile = await GeminiService.mapProfileData(rawData, 'LinkedIn');
      const mappedSkills = (mappedProfile.skills || []).map((s: any) => ({
        name: typeof s === 'string' ? s : s.name
      }));

      const newProfile = {
        ...profile,
        ...mappedProfile,
        skills: mappedSkills,
        isVerified: true,
        profilePictureUrl: mappedProfile.profilePictureUrl || profile.profilePictureUrl
      };


      // Handle Email Lock during LinkedIn import (Removed overwrite)
      onChange(newProfile);
    } catch (err: any) {
      console.error('LinkedIn Import Error:', err);
    } finally {
      setLoading(false);
      setSaving(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!session) return;

    setSaving('all');

    try {
      // 1. Save Basic Profile Info
      // 1. Save Basic Profile Info (skills stored as text[] on profiles table)
      const skillNames = profile.skills.map(s => s.name);
      
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        full_name: profile.name,
        headline_role: profile.currentRole,
        linkedin_url: profile.linkedinUrl,
        summary: profile.summary,
        email: profile.email,
        phone: profile.phone,
        profile_picture_url: profile.profilePictureUrl,
        skills: skillNames
      });

      if (profileError) throw profileError;

      // 2. Upsert Experience
      for (const exp of profile.experience) {
        const payload = {
          profile_id: session.user.id,
          company: exp.company || 'Unknown Company',
          role: exp.role || 'Professional',
          dates: exp.dates || '',
          duration: exp.duration || '',
          location: exp.location || '',
          description: exp.description || '',
          logo_url: exp.logo || ''
        };
        
        if (isUuid(exp.id)) {
          await supabase.from('experience').update(payload).eq('id', exp.id);
        } else {
          const { data } = await supabase.from('experience').insert(payload).select().single();
          if (data) exp.id = data.id;
        }
      }

      // 3. Upsert Education
      for (const edu of profile.education) {
        const payload = {
          profile_id: session.user.id,
          institution: edu.institution || 'Unknown Institution',
          degree: edu.degree || 'Degree',
          field_of_study: edu.fieldOfStudy || '',
          year: edu.year || '',
          logo_url: edu.logo || ''
        };
        
        if (isUuid(edu.id)) {
          await supabase.from('education').update(payload).eq('id', edu.id);
        } else {
          const { data } = await supabase.from('education').insert(payload).select().single();
          if (data) edu.id = data.id;
        }
      }

      // Update local state with refreshed data
      onChange({ ...profile });
      setLastSavedProfile(profile);
    } catch (err: any) {
      console.error('Save Error:', err);
    } finally {
      setSaving(null);
    }
  };

  // --- Summary Handlers ---
  const startEditSummary = () => {
    setTempSummary(profile.summary || '');
    setEditingSummary(true);
  };

  const saveSummary = async () => {
    if (!session) return;
    setSaving('about');
    try {
      const { error } = await supabase.from('profiles').update({ summary: tempSummary }).eq('id', session.user.id);
      if (error) throw error;
      const newProfile = { ...profile, summary: tempSummary };
      onChange(newProfile);
      setLastSavedProfile(newProfile);
      setEditingSummary(false);
    } catch (err: any) {
      console.error('Error saving summary:', err);
    } finally {
      setSaving(null);
    }
  };

  // --- Experience Handlers ---

  const startAddExperience = () => {
    const newItem: ExperienceItem = { company: '', role: '', dates: '', description: '', location: '', type: '' };
    setTempExp(newItem);
    const newExpList = [{ ...newItem, id: Date.now().toString() }, ...profile.experience];
    onChange({ ...profile, experience: newExpList });
    setEditingExpIndex(0); // Edit the first item (newly added)
    setTempExp(newExpList[0]);
  };

  const startEditExperience = (index: number) => {
    setEditingExpIndex(index);
    setTempExp({ ...profile.experience[index] });
  };

  const cancelEditExperience = (index: number) => {
    setEditingExpIndex(null);
    setTempExp(null);
    const item = profile.experience[index];
    if (!item.company && !item.role) {
      deleteExperience(index);
    }
  };

  const saveExperience = async (index: number) => {
    if (!tempExp || !session) return;
    setSaving(`exp-${index}`);

    try {
      const { data, error } = await supabase
        .from('experience')
        .upsert({
          id: isUuid(tempExp.id) ? tempExp.id : undefined,
          profile_id: session.user.id,
          company: tempExp.company || 'Unknown Company',
          role: tempExp.role || 'Professional',
          dates: tempExp.dates || '',
          duration: tempExp.duration || '',
          location: tempExp.location || '',
          description: tempExp.description || '',
          logo_url: tempExp.logo || ''
        })
        .select()
        .single();

      if (error) throw error;

      const updated = [...profile.experience];
      updated[index] = { ...tempExp, id: data.id, logo: data.logo_url };
      const newProfile = { ...profile, experience: updated };
      onChange(newProfile);
      setLastSavedProfile(newProfile);
      setEditingExpIndex(null);
      setTempExp(null);
    } catch (err: any) {
      console.error('Error saving experience:', err);
    } finally {
      setSaving(null);
    }
  };

  const deleteExperience = async (index: number) => {
    const item = profile.experience[index];
    if (item.id && session && !item.id.includes('exp')) {
      await supabase.from('experience').delete().eq('id', item.id);
    }

    const updated = [...profile.experience];
    updated.splice(index, 1);
    const newProfile = { ...profile, experience: updated };
    onChange(newProfile);
    setLastSavedProfile(newProfile);
    if (editingExpIndex === index) {
      setEditingExpIndex(null);
      setTempExp(null);
    }
  };

  // --- Education Handlers ---

  const startAddEducation = () => {
    const newItem: EducationItem = { institution: '', degree: '', year: '', fieldOfStudy: '' };
    const newList = [{ ...newItem, id: Date.now().toString() }, ...profile.education];
    onChange({ ...profile, education: newList });
    setEditingEduIndex(0);
    setTempEdu(newList[0]);
  };

  const startEditEducation = (index: number) => {
    setEditingEduIndex(index);
    setTempEdu({ ...profile.education[index] });
  };

  const cancelEditEducation = (index: number) => {
    setEditingEduIndex(null);
    setTempEdu(null);
    const item = profile.education[index];
    if (!item.institution && !item.degree) {
      deleteEducation(index);
    }
  };

  const saveEducation = async (index: number) => {
    if (!tempEdu || !session) return;
    setSaving(`edu-${index}`);

    try {
      const { data, error } = await supabase
        .from('education')
        .upsert({
          id: isUuid(tempEdu.id) ? tempEdu.id : undefined,
          profile_id: session.user.id,
          institution: tempEdu.institution || 'Unknown Institution',
          degree: tempEdu.degree || 'Degree',
          field_of_study: tempEdu.fieldOfStudy || '',
          year: tempEdu.year || '',
          logo_url: tempEdu.logo || ''
        })
        .select()
        .single();

      if (error) throw error;

      const updated = [...profile.education];
      updated[index] = { ...tempEdu, id: data.id, logo: data.logo_url };
      const newProfile = { ...profile, education: updated };
      onChange(newProfile);
      setLastSavedProfile(newProfile);
      setEditingEduIndex(null);
      setTempEdu(null);
    } catch (err: any) {
      console.error('Error saving education:', err);
    } finally {
      setSaving(null);
    }
  };

  const deleteEducation = async (index: number) => {
    const item = profile.education[index];
    if (item.id && session && !item.id.includes('edu')) {
      await supabase.from('education').delete().eq('id', item.id);
    }

    const updated = [...profile.education];
    updated.splice(index, 1);
    const newProfile = { ...profile, education: updated };
    onChange(newProfile);
    setLastSavedProfile(newProfile);
    if (editingEduIndex === index) {
      setEditingEduIndex(null);
      setTempEdu(null);
    }
  };

  // --- Skills Handlers (Empty - using inline or component level now) ---


  return (
    <div className="max-w-4xl mx-auto pb-20">

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        {/* Avatar Header */}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative group cursor-pointer" onClick={handleProfileImageClick}>
            <div className="w-24 h-24 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border-2 border-brand-100 dark:border-brand-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-500">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-brand-500" />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {saving === 'profile-image' ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
              {profile.name || 'Your Name'}
              {profile.isVerified && (
                <BadgeCheck className="w-6 h-6 text-blue-500 fill-blue-500/10" aria-label="LinkedIn Verified" />
              )}
            </h1>
            <p className="text-brand-600 dark:text-brand-400 font-medium">
              {profile.currentRole || 'Your Professional Headline'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Manage your "Source of Truth" for AI generations.</p>
          </div>
        </div>

        {JSON.stringify(profile) !== JSON.stringify(lastSavedProfile) && (
          <button
            onClick={handleSaveProfile}
            disabled={saving === 'all'}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg flex items-center gap-2 hover:bg-brand-700 shadow-sm transition-all disabled:opacity-50 animate-in fade-in slide-in-from-top-2"
          >
            {saving === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        )}
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-vexo-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8 overflow-hidden transition-all">
        <button
          onClick={() => setIsImportOpen(!isImportOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-brand-500" /> Import Profile
            </h2>
            <span className="text-xs text-slate-400 font-medium ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
              LinkedIn & Resume
            </span>
          </div>
          {isImportOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {isImportOpen && (
          <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4 mt-6">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Import Method
              </h3>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('import')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'import' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Auto-Import
                </button>
                <button
                  onClick={() => setActiveTab('linkedin')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'linkedin' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  LinkedIn URL
                </button>
              </div>
            </div>

            {activeTab === 'import' ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-brand-500 transition-colors group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#0A66C2] text-white rounded-lg flex items-center justify-center">
                      <Linkedin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">LinkedIn Import</h3>
                      <p className="text-xs text-slate-500">Fetch details from public profile</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="https://linkedin.com/in/username"
                      className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg outline-none focus:border-brand-500 dark:text-white"
                      value={profile.linkedinUrl}
                      onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                    />
                    <button
                      onClick={handleLinkedinImport}
                      disabled={!profile.linkedinUrl || saving === 'import'}
                      className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-lg text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      {saving === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Fetch Profile
                    </button>
                  </div>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-brand-500 transition-colors group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-500 text-white rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Upload CV / Resume</h3>
                      <p className="text-xs text-slate-500">Parse PDF or Image instantly</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Select File
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                    />
                    <p className="text-[10px] text-center text-slate-400">Supported: PDF, PNG, JPG</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 px-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <Linkedin className="w-12 h-12 text-[#0A66C2] mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Import from LinkedIn URL</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                  Paste your public LinkedIn profile URL to automatically sync your professional headline, experience, and education.
                </p>
                <div className="max-w-md mx-auto space-y-3">
                  <input
                    type="text"
                    placeholder="https://linkedin.com/in/username"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg outline-none focus:border-brand-500 dark:text-white text-sm"
                    value={profile.linkedinUrl}
                    onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                  />
                  <button
                    onClick={handleLinkedinImport}
                    disabled={!profile.linkedinUrl || saving === 'import'}
                    className="w-full py-2 bg-[#0A66C2] text-white font-bold rounded-lg text-sm disabled:opacity-50 hover:bg-[#004182] transition-colors flex items-center justify-center gap-2"
                  >
                    {saving === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
                    Import LinkedIn Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6">

        {/* Basic Info */}
        <div className="bg-white dark:bg-vexo-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative group">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-brand-500" /> Personal Details
            </h2>
            {!editingPersonalDetails && (
              <button
                onClick={startEditPersonal}
                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                title="Edit Personal Details"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          {editingPersonalDetails ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={tempPersonal.name}
                    onChange={(e) => setTempPersonal({ ...tempPersonal, name: e.target.value })}
                    className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Role</label>
                  <input
                    type="text"
                    value={tempPersonal.currentRole}
                    onChange={(e) => setTempPersonal({ ...tempPersonal, currentRole: e.target.value })}
                    className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={tempPersonal.email}
                    onChange={(e) => setTempPersonal({ ...tempPersonal, email: e.target.value })}
                    className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={tempPersonal.phone || ''}
                    onChange={(e) => setTempPersonal({ ...tempPersonal, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingPersonalDetails(false)} className="px-4 py-2 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors">Cancel</button>
                <button
                  onClick={savePersonalDetails}
                  disabled={saving === 'personal'}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {saving === 'personal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-y-4 gap-x-8">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Full Name</span>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{profile.name || 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Current Role</span>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{profile.currentRole || 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Email Address</span>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{profile.email || 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Phone Number</span>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{profile.phone || 'Not specified'}</p>
              </div>
            </div>
          )}
        </div>

        {/* About Section */}
        <div className="bg-white dark:bg-vexo-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative group">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500" /> About
            </h2>
            {!editingSummary && (
              <button
                onClick={startEditSummary}
                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                title="Edit Summary"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          {editingSummary ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <textarea
                className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none dark:text-white min-h-[120px] text-sm leading-relaxed"
                value={tempSummary}
                onChange={(e) => setTempSummary(e.target.value)}
                placeholder="Write a professional summary about yourself..."
              />
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => setEditingSummary(false)} className="px-4 py-2 text-slate-500 text-sm font-medium hover:text-slate-700">Cancel</button>
                <button
                  onClick={saveSummary}
                  disabled={saving === 'about'}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving === 'about' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {profile.summary ? (
                <CollapsibleText text={profile.summary} lines={4} />
              ) : (
                <span className="text-slate-400 italic">No summary added yet. Click edit to add one.</span>
              )}
            </div>
          )}
        </div>

        {/* Experience Section */}
        <div className="bg-white dark:bg-vexo-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand-500" /> Experience
            </h2>
            <button
              onClick={startAddExperience}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-bold text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Experience
            </button>
          </div>

          <div className="space-y-6">
            {profile.experience.map((exp, i) => {
              const isEditing = editingExpIndex === i;

              if (isEditing && tempExp) {
                return (
                  <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-brand-200 dark:border-brand-900 animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-sm font-bold text-brand-700 dark:text-brand-300 mb-3 uppercase tracking-wide">
                      Editing Experience
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <input
                        placeholder="Job Title"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempExp.role}
                        onChange={(e) => setTempExp({ ...tempExp, role: e.target.value })}
                      />
                      <input
                        placeholder="Company"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempExp.company}
                        onChange={(e) => setTempExp({ ...tempExp, company: e.target.value })}
                      />
                      <input
                        placeholder="Dates (e.g. Jan 2020 - Present)"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempExp.dates}
                        onChange={(e) => setTempExp({ ...tempExp, dates: e.target.value })}
                      />
                      <input
                        placeholder="Duration (e.g. 2 yrs)"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempExp.duration || ''}
                        onChange={(e) => setTempExp({ ...tempExp, duration: e.target.value })}
                      />
                      <input
                        placeholder="Location"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempExp.location || ''}
                        onChange={(e) => setTempExp({ ...tempExp, location: e.target.value })}
                      />
                      <input
                        placeholder="Type (e.g. Full-time)"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempExp.type || ''}
                        onChange={(e) => setTempExp({ ...tempExp, type: e.target.value })}
                      />
                    </div>
                    <textarea
                      placeholder="Description"
                      className="w-full p-2 mb-4 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm h-32 dark:text-white"
                      value={tempExp.description}
                      onChange={(e) => setTempExp({ ...tempExp, description: e.target.value })}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => cancelEditExperience(i)} className="px-4 py-2 text-slate-500 text-sm font-medium hover:text-slate-700">Cancel</button>
                      <button
                        onClick={() => saveExperience(i)}
                        disabled={saving === `exp-${i}`}
                        className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {saving === `exp-${i}` && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="flex gap-4 group relative hover:bg-slate-50 dark:hover:bg-slate-800/30 p-2 -mx-2 rounded-xl transition-colors">
                  {/* Action Buttons (Hover) */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1 bg-white dark:bg-slate-800 shadow-sm rounded-lg p-1 border border-slate-200 dark:border-slate-700 transition-all z-10">
                    <button
                      onClick={() => startEditExperience(i)}
                      className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteExperience(i)}
                      className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Logo Placeholder */}
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden mt-1">
                    {safeText(exp.logo) ? (
                      <img src={exp.logo} alt={exp.company} className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{safeText(exp.role) || 'Unknown Role'}</h3>
                    <div className="text-sm text-slate-700 dark:text-slate-300 mb-0.5">
                      {safeText(exp.company)} {safeText(exp.type) && <span className="text-slate-500">• {exp.type}</span>}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      {renderDateRow(exp.dates, exp.duration)}
                    </div>
                    {safeText(exp.location) && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span> {exp.location}
                      </div>
                    )}

                    {/* Collapsible Description */}
                    <CollapsibleText text={exp.description} />
                  </div>
                </div>
              );
            })}

            {profile.experience.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">No experience added yet. Import your CV or add manually.</div>
            )}
          </div>
        </div>

        {/* Education Section */}
        <div className="bg-white dark:bg-vexo-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand-500" /> Education
            </h2>
            <button
              onClick={startAddEducation}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-bold text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Education
            </button>
          </div>

          <div className="space-y-6">
            {profile.education.map((edu, i) => {
              const isEditing = editingEduIndex === i;

              if (isEditing && tempEdu) {
                return (
                  <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-brand-200 dark:border-brand-900 animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-sm font-bold text-brand-700 dark:text-brand-300 mb-3 uppercase tracking-wide">
                      Editing Education
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <input
                        placeholder="School / University"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempEdu.institution}
                        onChange={(e) => setTempEdu({ ...tempEdu, institution: e.target.value })}
                      />
                      <input
                        placeholder="Degree (e.g. B.Sc.)"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempEdu.degree}
                        onChange={(e) => setTempEdu({ ...tempEdu, degree: e.target.value })}
                      />
                      <input
                        placeholder="Field of Study"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempEdu.fieldOfStudy || ''}
                        onChange={(e) => setTempEdu({ ...tempEdu, fieldOfStudy: e.target.value })}
                      />
                      <input
                        placeholder="Years (e.g. 2020 - 2024)"
                        className="p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm dark:text-white"
                        value={tempEdu.year}
                        onChange={(e) => setTempEdu({ ...tempEdu, year: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => cancelEditEducation(i)} className="px-4 py-2 text-slate-500 text-sm font-medium hover:text-slate-700">Cancel</button>
                      <button
                        onClick={() => saveEducation(i)}
                        disabled={saving === `edu-${i}`}
                        className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {saving === `edu-${i}` && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="flex gap-4 group relative hover:bg-slate-50 dark:hover:bg-slate-800/30 p-2 -mx-2 rounded-xl transition-colors">
                  {/* Action Buttons (Hover) */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1 bg-white dark:bg-slate-800 shadow-sm rounded-lg p-1 border border-slate-200 dark:border-slate-700 transition-all z-10">
                    <button
                      onClick={() => startEditEducation(i)}
                      className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteEducation(i)}
                      className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden mt-1">
                    {safeText(edu.logo) ? (
                      <img src={edu.logo} alt={edu.institution} className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 pb-6 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{safeText(edu.institution)}</h3>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {safeText(edu.degree)} {safeText(edu.fieldOfStudy) && <span>, {edu.fieldOfStudy}</span>}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {safeText(edu.year)}
                    </div>
                  </div>
                </div>
              );
            })}

            {profile.education.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">No education added yet.</div>
            )}
          </div>
        </div>

        {/* Skills Section */}
        <div className="bg-white dark:bg-vexo-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative group">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-brand-500" /> Skills
            </h2>
            {!editingSkills && (
              <button
                onClick={startEditSkills}
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-bold text-sm flex items-center gap-1 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Skill
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {(editingSkills ? tempSkills : profile.skills).map((skill, i) => (
              <div key={i} className="group relative px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                {skill.name}
                {editingSkills && (
                  <button
                    onClick={() => deleteSkill(skill.name)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {(editingSkills ? tempSkills : profile.skills).length === 0 && (
              <p className="text-sm text-slate-400 italic">No skills added yet.</p>
            )}
          </div>

          {editingSkills && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Add a skill (e.g. Project Management)..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleKeyDownSkill}
                />
                <button
                  onClick={addSkill}
                  disabled={!skillInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-600 text-white rounded-lg disabled:opacity-50 hover:bg-brand-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingSkills(false)} className="px-4 py-2 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors">Cancel</button>
                <button
                  onClick={saveSkills}
                  disabled={saving === 'skills'}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {saving === 'skills' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
