
import React, { useState, useEffect } from 'react';
import { ViewState, Application, UserProfile, JobSearchResult, JobRequirements, GeneratedResume } from './types';
import { Landing } from './components/Landing';
import { Dashboard } from './components/Dashboard';
import { Wizard } from './components/Wizard';
import { Profile } from './components/Profile';
import { JobSearch } from './components/JobSearch';
import { GetReady } from './components/GetReady';
import { ApplicationsList } from './components/ApplicationsList';
import { ApplicationsList as InterviewPrep } from './components/InterviewPrep';

import {
  LayoutDashboard,
  FileText,
  User,
  LogOut,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Moon,
  Sun,
  Menu,
  FileCheck,
  Briefcase,
  Rocket,
  Plus,
  Bot,
  List,
  Code2,
  CheckCircle2,
  HelpCircle,
  Share2,
  ArrowUpRight,
} from 'lucide-react';
import { CVPreview } from './components/CVPreview';
import { Auth } from './components/Auth';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

// Initial empty states
const EMPTY_PROFILE: UserProfile = {
  name: "",
  email: "",
  phone: "",
  currentRole: "",
  linkedinUrl: "",
  summary: '',
  skills: [],
  profilePictureUrl: '',
  education: [],
  experience: []
};

// Helper to safely parse JSON if it's a string, otherwise return as is
const safeParseJSON = (input: any) => {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (e) {
      return input;
    }
  }
  return input;
};

export default function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedStudyAppId, setSelectedStudyAppId] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (applications.length > 0 && !selectedStudyAppId) {
      setSelectedStudyAppId(applications[0].id);
    }
  }, [applications]);
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Sidebar Collapsible State
  const [applicationsMenuOpen, setApplicationsMenuOpen] = useState(false);
  const [getReadyMenuOpen, setGetReadyMenuOpen] = useState(false);

  // Job Data passed from Search to Wizard
  const [prefilledJob, setPrefilledJob] = useState<JobSearchResult | null>(null);
  const [initialFile, setInitialFile] = useState<File | null>(null);

  // Fetch all user data from Supabase
  const fetchUserData = async (userId: string, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      // 2. Fetch Education
      const { data: eduData, error: eduError } = await supabase
        .from('education')
        .select('*')
        .eq('profile_id', userId);

      if (eduError) throw eduError;

      // 3. Fetch Experience
      const { data: expData, error: expError } = await supabase
        .from('experience')
        .select('*')
        .eq('profile_id', userId);

      if (expError) throw expError;

      // 4. Fetch Skills from skills table
      const { data: skillsData, error: skillsError } = await supabase
        .from('skills')
        .select('*')
        .eq('profile_id', userId);

      if (skillsError) throw skillsError;

      // 5. Fetch Applications
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;

      // Combine into local state
      if (profileData) {
        console.log('App: Hydrating profile from DB:', profileData.full_name);
        const userProfile: UserProfile = {
          name: profileData?.full_name || '',
          email: profileData?.email || '',
          phone: profileData?.phone || '',
          currentRole: profileData?.headline_role || '',
          linkedinUrl: profileData?.linkedin_url || '',
          summary: profileData?.summary || '',
          profilePictureUrl: profileData?.profile_picture_url || '',
          skills: skillsData ? skillsData.map((s: any) => ({ id: s.id, name: s.name })) : [],
          education: eduData ? eduData.map((e: any) => ({
            id: e.id,
            institution: e.institution,
            degree: e.degree,
            fieldOfStudy: e.field_of_study,
            year: e.year,
            logo: e.logo_url
          })) : [],
          experience: expData ? expData.map((e: any) => ({
            id: e.id,
            company: e.company,
            role: e.role,
            dates: e.dates,
            duration: e.duration,
            location: e.location,
            description: e.description,
            logo: e.logo_url
          })) : []
        };
        setProfile(userProfile);
      }

      if (appsData) {
        console.log('[DEBUG] Raw applications data from database:', appsData);
        const mappedApps = appsData.map((a: any) => {
          // Standardize requirements structure
          const rawJobDetails = a.job_details?.requirements || a.job_details;
          const safeRequirements: any = {
            title: a.job_title || rawJobDetails?.title || 'Untitled',
            company: a.company || rawJobDetails?.company || 'Unknown',
            description: a.description_text || rawJobDetails?.description || '',
            location: a.location || rawJobDetails?.location || 'Remote',
            employmentStatus: a.employment_status || rawJobDetails?.employmentStatus || '',
            listedAt: a.posted_on || rawJobDetails?.listedAt || '',
            jobUrl: a.link || a.job_url || rawJobDetails?.jobUrl || '',
            experienceLevel: a.experience_level || rawJobDetails?.experienceLevel || '',
            industries: a.industries || rawJobDetails?.industries || [],
            headquarters: rawJobDetails?.headquarters || { line1: a.hq_address || '', city: '', country: '' },
            logoUrl: a.logo_url || rawJobDetails?.logoUrl || '',
            aboutJob: rawJobDetails?.aboutJob || '',
            aboutRole: rawJobDetails?.aboutRole || '',
            whatYouWillDo: rawJobDetails?.whatYouWillDo || [],
            culturalFit: rawJobDetails?.culturalFit || [],
            keySkills: rawJobDetails?.keySkills || [],
            preferredQualifications: rawJobDetails?.preferredQualifications || [],
            descriptionSummary: rawJobDetails?.descriptionSummary || '',
            jobTasks: rawJobDetails?.jobTasks || []
          };

          // Standardize tailoredResume structure
          const rawResume = a.tailored_resume || a.tailored_resume_data;
          const safeResume: any = {
            summary: rawResume?.summary || '',
            skills: rawResume?.skills || [],
            experience: rawResume?.experience || [],
            matchScore: rawResume?.matchScore || a.match_score || 0
          };

          return {
            id: a.id,
            jobUrl: a.link || a.job_url,
            requirements: safeRequirements,
            tailoredResume: safeResume,
            status: a.status,
            matchScore: a.match_score || 0,
            notes: a.notes,
            createdAt: a.created_at,
            salary: a.salary,
            nextInterviewDate: a.next_interview_date,
            workType: a.work_type,

            // Map structured fields
            // Map structured fields (Parse JSON if stringified)
            description: safeParseJSON(a.description),
            about_the_role: safeParseJSON(a.about_the_role),
            responsibilities: safeParseJSON(a.responsibilities),
            structured_requirements: safeParseJSON(a.requirements),
            nice_to_have: safeParseJSON(a.nice_to_have),

            hq_address: a.hq_address,
            posted_on: a.posted_on,
            logo_url: a.logo_url,
            location: a.location,
            employmentStatus: a.employment_status,
            experienceLevel: a.experience_level,
            industries: a.industries
          };
        });
        console.log('[DEBUG] Final mapped applications state:', mappedApps);
        setApplications(mappedApps);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check for active session and listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else setLoading(false);
    });

    let hasInitialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('App: Auth state change:', event, !!session);
      setSession(session);

      if (session) {
        setShowAuthModal(false);

        // Handle events intelligently to avoid resetting user progress
        if (event === 'SIGNED_IN' && !hasInitialized) {
          // Only redirect on first explicit login, not on tab refocus
          hasInitialized = true;
          fetchUserData(session.user.id);
          setView('dashboard');
        } else if (event === 'INITIAL_SESSION') {
          // On boot: only move to dashboard if we are still on landing
          hasInitialized = true;
          fetchUserData(session.user.id);
          setView(current => current === 'landing' ? 'dashboard' : current);
        } else if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && hasInitialized)) {
          // Token refreshed or tab refocus: sync data silently, preserve view
          fetchUserData(session.user.id, true);
        }
      } else {
        hasInitialized = false;
        setProfile(EMPTY_PROFILE);
        setApplications([]);
        setLoading(false);
        setView('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Toggle dark mode class on html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleCreateApplication = async (app: Application) => {
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('applications')
        .insert({
          profile_id: session.user.id,
          job_title: app.requirements.title,
          company: app.requirements.company,
          job_details: app.requirements, // legacy jsonb
          location: app.requirements.location,
          employment_status: app.requirements.employmentStatus,
          experience_level: app.requirements.experienceLevel,
          job_url: app.jobUrl,
          industries: app.requirements.industries,
          description: app.description ? JSON.stringify(app.description) : app.requirements.description,
          about_the_role: app.about_the_role ? JSON.stringify(app.about_the_role) : undefined,
          responsibilities: app.responsibilities ? JSON.stringify(app.responsibilities) : undefined,
          requirements: app.structured_requirements ? JSON.stringify(app.structured_requirements) : undefined,
          nice_to_have: app.nice_to_have ? JSON.stringify(app.nice_to_have) : undefined,
          benefits: app.benefits ? JSON.stringify(app.benefits) : undefined,
          hq_address: `${app.requirements.headquarters?.line1 || ''}, ${app.requirements.headquarters?.city || ''}, ${app.requirements.headquarters?.country || ''}`,
          posted_on: app.requirements.listedAt,
          logo_url: app.requirements.logoUrl,
          tailored_resume: app.tailoredResume,
          status: app.status,
          match_score: app.matchScore,
          notes: app.notes,
          link: app.jobUrl // Keep link for backwards sync
        })
        .select()
        .single();

      if (error) throw error;

      const newApp: Application = {
        id: data.id,
        requirements: app.requirements,
        tailoredResume: app.tailoredResume,
        status: data.status,
        matchScore: data.match_score,
        notes: data.notes,
        createdAt: data.created_at,
        jobUrl: data.link || data.job_url,
        description: app.description,
        about_the_role: app.about_the_role,
        responsibilities: app.responsibilities,
        structured_requirements: app.structured_requirements,
        nice_to_have: app.nice_to_have,
        benefits: app.benefits,
        location: app.requirements.location,
        employmentStatus: app.requirements.employmentStatus,
        experienceLevel: app.requirements.experienceLevel,
        industries: app.requirements.industries,
        posted_on: data.posted_on,
        logo_url: data.logo_url
      };

      setApplications([newApp, ...applications]);
      setView('applications-list');
    } catch (error) {
      console.error('Error creating application:', error);
    }
  };

  const handleUpdateApplication = async (updatedApp: Application) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: updatedApp.status,
          notes: updatedApp.notes,
          match_score: updatedApp.matchScore,
          tailored_resume: updatedApp.tailoredResume,
          // Expanded fields for full CRUD support
          job_title: updatedApp.requirements?.title,
          company: updatedApp.requirements?.company,
          description: updatedApp.description ? JSON.stringify(updatedApp.description) : undefined,
          about_the_role: updatedApp.about_the_role ? JSON.stringify(updatedApp.about_the_role) : undefined,
          responsibilities: updatedApp.responsibilities ? JSON.stringify(updatedApp.responsibilities) : undefined,
          requirements: updatedApp.structured_requirements ? JSON.stringify(updatedApp.structured_requirements) : undefined,
          nice_to_have: updatedApp.nice_to_have ? JSON.stringify(updatedApp.nice_to_have) : undefined,
          location: updatedApp.location || updatedApp.requirements?.location,
          employment_status: updatedApp.employmentStatus || updatedApp.requirements?.employmentStatus,
          experience_level: updatedApp.experienceLevel || updatedApp.requirements?.experienceLevel,
          job_url: updatedApp.jobUrl,
          industries: updatedApp.industries || updatedApp.requirements?.industries,
          logo_url: updatedApp.logo_url || updatedApp.requirements?.logoUrl
        })
        .eq('id', updatedApp.id);

      if (error) throw error;

      const newApps = applications.map(app => app.id === updatedApp.id ? updatedApp : app);
      setApplications(newApps);
    } catch (error) {
      console.error('Error updating application:', error);
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', appId);

      if (error) throw error;

      setApplications(applications.filter(app => app.id !== appId));
      if (selectedApp?.id === appId) {
        setSelectedApp(null);
        setView('applications-list');
      }
    } catch (error) {
      console.error('Error deleting application:', error);
    }
  };

  // Refetch user data (used by Profile after save)
  const handleRefetchUserData = async () => {
    if (session?.user?.id) {
      await fetchUserData(session.user.id, true);
    }
  };

  const handleViewApplication = (app: Application) => {
    setSelectedApp(app);
    setView('view-application');
  };

  // Handler for analyzing a job from the search view
  const handleAnalyzeJob = (job: JobSearchResult) => {
    console.log("Analyzing job from search:", job);
    setPrefilledJob(job);
    setView('create');
  };

  // Expanded Sidebar Item with Children support
  const SidebarItem = ({
    icon: Icon,
    label,
    active,
    onClick,
    children,
    isOpen
  }: {
    icon: any,
    label: string,
    active: boolean,
    onClick: () => void,
    children?: React.ReactNode,
    isOpen?: boolean
  }) => (
    <div className="w-full">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative
          ${active
            ? 'bg-white/10 text-white shadow-lg'
            : 'text-white/60 hover:text-white hover:bg-white/5'
          }
        `}
      >
        {active && !children && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>}
        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />

        {sidebarOpen && (
          <div className="flex-1 flex items-center justify-between overflow-hidden">
            <span className="font-medium whitespace-nowrap truncate">{label}</span>
            {children && (
              isOpen ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />
            )}
          </div>
        )}
      </button>
      {/* Indented Children */}
      {sidebarOpen && children && isOpen && (
        <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1">
          {children}
        </div>
      )}
    </div>
  );

  // Sub-item component for indented items
  const SidebarSubItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm
        ${active
          ? 'bg-white/20 text-white'
          : 'text-white/50 hover:text-white hover:bg-white/5'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </button>
  );

  if (!session && view === 'landing') {
    return (
      <>
        <Landing
          onGetStarted={() => setShowAuthModal(true)}
          onLoginClick={() => setShowAuthModal(true)}
        />
        {showAuthModal && (
          <Auth
            onAuthSuccess={() => setShowAuthModal(false)}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  // If not logged in and somehow tried to bypass landing, force landing
  if (!session) {
    setView('landing');
    return null;
  }

  if (loading && session) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0F111A]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading your path...</p>
        </div>
      </div>
    );
  }

  // Helper to detect if any application sub-view is active to highlight parent
  const isAppActive = view === 'create' || view === 'applications-list';
  const isGetReadyActive = view === 'company-research' || view === 'interview-prep';

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-[#0F111A] overflow-hidden ${darkMode ? 'dark' : ''}`}>
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-[#5D5FEF] transition-all duration-300 relative flex flex-col z-50`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-lg">
            <Rocket className="w-5 h-5 text-[#5D5FEF]" />
          </div>
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg tracking-tight">HireChance</span>
              <span className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">AI Career Path</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          <SidebarItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={view === 'dashboard'}
            onClick={() => setView('dashboard')}
          />
          <SidebarItem
            icon={Search}
            label="Search Jobs"
            active={view === 'search'}
            onClick={() => setView('search')}
          />

          <SidebarItem
            icon={Briefcase}
            label="Applications"
            active={view === 'applications-list' || view === 'view-application'}
            onClick={() => setApplicationsMenuOpen(!applicationsMenuOpen)}
            isOpen={applicationsMenuOpen}
          >
            <SidebarSubItem
              icon={Plus}
              label="New Application"
              active={view === 'create'}
              onClick={() => { setView('create'); setPrefilledJob(null); }}
            />
            <SidebarSubItem
              icon={List}
              label="My Applications"
              active={view === 'applications-list'}
              onClick={() => setView('applications-list')}
            />
          </SidebarItem>

          <SidebarItem
            icon={Rocket}
            label="Get Ready"
            active={view === 'interview-prep' || view === 'company-research' || view === 'get-ready'}
            onClick={() => setGetReadyMenuOpen(!getReadyMenuOpen)}
            isOpen={getReadyMenuOpen}
          >
            <SidebarSubItem
              icon={Search}
              label="Company Research"
              active={view === 'company-research'}
              onClick={() => setView('company-research')}
            />
            <SidebarSubItem
              icon={Code2}
              label="Study Plan"
              active={view === 'interview-prep'}
              onClick={() => setView('interview-prep')}
            />

          </SidebarItem>

          <SidebarItem
            icon={User}
            label="Profile"
            active={view === 'profile'}
            onClick={() => setView('profile')}
          />
        </div>

        <div className="p-4 space-y-2 border-t border-white/10 mt-auto">
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={false}
            onClick={() => { }}
          />
          <SidebarItem
            icon={LogOut}
            label="Logout"
            active={false}
            onClick={() => supabase.auth.signOut()}
          />
        </div>
      </aside>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed z-[60] left-0 transition-all duration-300 flex items-center justify-center w-6 h-12 bg-white border border-[#5D5FEF]/20 border-l-0 rounded-r-lg shadow-lg hover:w-8 group"
        style={{
          top: '35%',
          transform: `translateX(${sidebarOpen ? '288px' : '80px'})`,
          marginTop: '-24px'
        }}
        title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-5 h-5 text-[#5D5FEF]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[#5D5FEF]" />
        )}
      </button>

      {/* AI Study Coach Toggle Button - Attached to sidebar */}
      {view === 'interview-prep' && (
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="fixed z-[60] flex items-center justify-center w-6 h-12 bg-[#5D5FEF] border border-white/20 border-r-0 rounded-l-lg shadow-lg hover:w-8 group"
          style={{
            top: '35%',
            marginTop: '-24px',
            right: isChatOpen ? '384px' : '0px',
            transition: 'right 0.3s ease-out'
          }}
          title={isChatOpen ? "Close Study Coach" : "Open Study Coach"}
        >
          <Bot className="w-4 h-4 text-white" />
          <span className={`absolute top-2 ${isChatOpen ? 'left-2' : 'right-2'} w-2 h-2 bg-green-500 rounded-full border border-white ${!isChatOpen ? 'animate-pulse' : ''}`}></span>
        </button>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className={`h-20 bg-white dark:bg-[#0F111A] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-40 transition-colors ${(view === 'applications-list' || view === 'interview-prep') ? 'px-0' : 'px-8'}`}>
          <div className={`flex-1 flex items-center justify-between ${(view === 'applications-list' || view === 'interview-prep') ? 'px-8' : ''}`}>
            <div className="flex items-center gap-4">
              {view === 'interview-prep' ? (
                <div className="flex items-center gap-6">
                  <h2 className="text-slate-900 dark:text-white font-bold text-xl tracking-tight">Study Plan</h2>

                  {/* Job Selector Dropdown in Header */}
                  <div className="relative group z-50">
                    <button className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-none transition-all h-10 min-w-[180px]">
                      <div className="flex-1 text-center">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-none">
                          {applications.find(a => a.id === selectedStudyAppId)?.requirements.company || 'Target Job'}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />
                    </button>

                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-none shadow-2xl overflow-hidden hidden group-hover:block animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl transition-all">
                      <div className="p-2 space-y-1">
                        {applications.map(app => (
                          <div
                            key={app.id}
                            onClick={() => setSelectedStudyAppId(app.id)}
                            className={`px-4 py-3 rounded-none cursor-pointer flex items-center justify-center transition-colors ${selectedStudyAppId === app.id
                              ? 'bg-[#5D5FEF]/10 dark:bg-[#5D5FEF]/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              }`}
                          >
                            <div className="text-center overflow-hidden">
                              <div className="text-slate-900 dark:text-white font-bold text-sm truncate">{app.requirements.company}</div>
                              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider truncate">{app.requirements.title}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <h2 className="text-slate-900 dark:text-white font-bold text-xl tracking-tight flex items-baseline gap-3">
                  {view === 'applications-list' ? 'My Applications' : (
                    <span>
                      {view === 'dashboard' && 'Dashboard'}
                      {view === 'create' && 'Create Application'}
                      {view === 'profile' && 'Profile'}
                      {view === 'view-application' && 'Application Details'}
                      {view === 'search' && 'Search Jobs'}
                      {view === 'get-ready' && 'Get Ready'}
                    </span>
                  )}
                  {view === 'applications-list' && (
                    <span className="text-slate-500 text-sm font-bold lowercase">
                      {applications.length}
                    </span>
                  )}
                </h2>
              )}
            </div>

            <div className="flex items-center gap-4">

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-50 dark:hover:text-yellow-400 transition-all border border-slate-100 dark:border-slate-700"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-brand-500 transition-all border border-slate-100 dark:border-slate-700 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white dark:ring-slate-800"></span>
              </button>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{profile.name}</span>
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Premium Member</span>
                </div>
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-2 ring-brand-500/20 bg-slate-100 flex items-center justify-center">
                  {profile.profilePictureUrl ? (
                    <img
                      src={profile.profilePictureUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-hidden flex flex-row transition-colors relative ${view === 'create' ? 'bg-white' : 'bg-slate-50/50'} dark:bg-[#0F111A]`}>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className={`transition-all duration-300 ${view === 'applications-list' || view === 'create' || view === 'interview-prep' || view === 'search' ? 'p-0' : 'p-8 max-w-[1600px] mx-auto'} ${isChatOpen && view === 'interview-prep' ? 'mr-[384px]' : ''}`}>
              {view === 'dashboard' && (
                <Dashboard onNew={() => setView('create')} applications={applications} onView={handleViewApplication} />
              )}
              {view === 'create' && (
                <Wizard
                  onComplete={handleCreateApplication}
                  userProfile={profile}
                  initialJob={prefilledJob}
                  initialFile={initialFile}
                  onCancel={() => { setView('dashboard'); setInitialFile(null); }}
                />
              )}
              {view === 'profile' && (
                <Profile
                  profile={profile}
                  onChange={setProfile}
                  session={session}
                  onRefetch={handleRefetchUserData}
                />
              )}
              {view === 'applications-list' && (
                <ApplicationsList
                  applications={applications}
                  profile={profile}
                  onViewApplication={handleViewApplication}
                  onImport={(file) => {
                    setInitialFile(file);
                    setView('create');
                  }}
                />
              )}
              {view === 'view-application' && selectedApp && (
                <div className="space-y-6">
                  <button
                    onClick={() => setView('applications-list')}
                    className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to List
                  </button>
                  <CVPreview application={selectedApp} profile={profile} onClose={() => setView('applications-list')} />
                </div>
              )}
              {view === 'search' && <JobSearch onAnalyzeJob={handleAnalyzeJob} />}
              {view === 'company-research' && <GetReady applications={applications} />}
              {view === 'interview-prep' && (
                <InterviewPrep
                  applications={applications}
                  profile={profile}
                  onViewApplication={handleViewApplication}
                  onImport={(file) => {
                    setInitialFile(file);
                    setView('create');
                  }}
                />
              )}
            </div>
          </div>

          {/* AI Study Coach Panel */}
          {view === 'interview-prep' && (
            <div
              className="fixed top-20 bottom-0 w-[384px] bg-white dark:bg-[#0D0F16] border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col"
              style={{
                right: isChatOpen ? '0px' : '-384px',
                transition: 'right 0.3s ease-out'
              }}
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#5D5FEF] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Study Coach</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">AI Interview Prep</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#5D5FEF] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 max-w-[280px]">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      Hi! I'm your Study Coach. I'll help you prepare for your interview at <span className="font-bold text-[#5D5FEF]">{applications.find(a => a.id === selectedStudyAppId)?.requirements.company || 'your target company'}</span>.
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-2">
                      What would you like to work on today?
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2 pt-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold px-1">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Technical Questions', icon: Code2 },
                      { label: 'Behavioral Prep', icon: User },
                      { label: 'Company Research', icon: Search },
                      { label: 'Mock Interview', icon: Bot },
                    ].map((action, i) => (
                      <button
                        key={i}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#5D5FEF]/10 dark:hover:bg-[#5D5FEF]/20 border border-slate-200 dark:border-slate-700 hover:border-[#5D5FEF] rounded-xl text-left transition-all group"
                      >
                        <action.icon className="w-4 h-4 text-slate-400 group-hover:text-[#5D5FEF] mb-2" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-[#5D5FEF]">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ask me anything..."
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#5D5FEF] outline-none transition-all"
                  />
                  <button className="p-3 bg-[#5D5FEF] text-white rounded-xl hover:bg-[#4B4DD6] transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div >
  );
}
