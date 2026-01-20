import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Application, UserProfile, DescriptionBlock } from '../types';
import { ResumePaper } from './CVPreview';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import {
  Search,
  MoreHorizontal,
  Plus,
  Download,
  Upload,
  UserPlus,
  ArrowUpRight,

  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  Calendar,
  DollarSign,
  Info,
  MapPin,
  Clock,
  Briefcase,
  Eye,
  Check,
  X,
  Trash2,
  Archive,
  Pencil,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

interface ApplicationsListProps {
  applications: Application[];
  profile: UserProfile;
  onUpdate?: (app: Application) => void;
  onViewApplication: (app: Application) => void;
  onImport?: (file: File) => void;
}

const RenderBlocks = ({ blocks }: { blocks?: DescriptionBlock[] | string }) => {
  if (!blocks) return <p className="text-[13px] text-slate-600 dark:text-slate-300 font-bold italic">No details available.</p>;

  if (typeof blocks === 'string') {
    return <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{blocks}</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === 'paragraph') {
          return (
            <p key={i} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {block.text}
            </p>
          );
        }
        return (
          <ul key={i} className="space-y-3">
            {block.items.map((item, idx) => (
              <li key={idx} className="flex gap-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="text-slate-900 dark:text-white">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
};

export const ApplicationsList: React.FC<ApplicationsListProps> = ({ applications, profile, onViewApplication, onUpdate, onImport }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [appToDownload, setAppToDownload] = useState<Application | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [isTabsExpanded, setIsTabsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainTabs = ['All', 'New', 'Applying', 'Applied', 'Interview'];
  const moreTabs = ['Negotiate', 'Accepted', 'Rejected', 'I Withdrew', 'No Response', 'Archived'];

  // Sidebar State
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'details' | 'cv' | 'followup'>('details');
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);

  // Meeting Sidebar State
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [tempDate, setTempDate] = useState('');
  const [tempTime, setTempTime] = useState('');
  const [newMeetingData, setNewMeetingData] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    location: '',
    notes: ''
  });
  const meetingFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAddingMeeting && meetingFormRef.current) {
      meetingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isAddingMeeting]);
  // Study Plan Card Labels
  const studyPlanCards = [
    { label: 'Overview' },
    { label: 'Roadmap' },
    { label: 'Skills & Projects' },
    { label: 'Track Progress' },
  ];

  // Filter Logic
  const filteredApps = applications.filter(app => {
    const matchesTab = (() => {
      switch (activeTab) {
        case 'All': return true;
        case 'New': return app.status === 'Draft';
        case 'Applying': return app.status === 'Applying' || app.status === 'Draft'; // Keep flexible
        case 'Applied': return app.status === 'Applied';
        case 'Interview': return app.status === 'Interviewing';
        case 'Negotiate': return app.status === 'Negotiating' || app.status === 'Offer';
        case 'Accepted': return app.status === 'Accepted' || app.status === 'Offer';
        case 'Rejected': return app.status === 'Rejected';
        case 'I Withdrew': return app.status === 'I Withdrew';
        case 'No Response': return app.status === 'No Response';
        case 'Archived': return app.status === 'Archived';
        default: return true;
      }
    })();

    const matchesSearch =
      app.requirements.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.requirements.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  // Close dropdown or sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openStatusId) {
        setOpenStatusId(null);
      }
      if (selectedApp && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSelectedApp(null);
        setIsSidebarMenuOpen(false);
      }
      if (isCurrencyMenuOpen && !(event.target as HTMLElement).closest('.currency-menu-trigger')) {
        setIsCurrencyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openStatusId, selectedApp, isSidebarMenuOpen, isCurrencyMenuOpen]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredApps.length && filteredApps.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredApps.map(app => app.id));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRowClick = (app: Application) => {
    console.log('[DEBUG] ApplicationsList handleRowClick called with app:', app);
    setSelectedApp(app);
    setSidebarTab('details'); // Open details/application tab on row click
  };

  const handleDirectDownload = (app: Application, e: React.MouseEvent) => {
    e.stopPropagation();
    setAppToDownload(app);
    setIsDownloading(true);

    setTimeout(() => {
      if (downloadRef.current) {
        const element = downloadRef.current;
        const opt = {
          margin: 0,
          filename: `${profile.name.replace(/\s+/g, '_')}_Resume_${app.requirements.company.replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        } as any;

        html2pdf().set(opt).from(element).save().then(() => {
          setIsDownloading(false);
          setAppToDownload(null);
        });
      }
    }, 100);
  };

  return (
    <div className="flex relative h-full bg-white dark:bg-[#0D0F16] font-sans transition-colors w-full overflow-hidden">
      {/* Main Content */}
      <div className={`flex flex-col w-full transition-all duration-300 ${selectedApp ? 'mr-[600px]' : ''}`}>
        {/* 1. Study Plan Clickable Cards - Sticky */}
        <div className="sticky top-0 z-10 grid grid-cols-4 bg-slate-100 dark:bg-slate-800/50 gap-px border-b border-slate-200 dark:border-slate-800 w-full">
          {studyPlanCards.map((card, i) => (
            <button
              key={i}
              className="bg-white dark:bg-[#0D0F16] p-6 flex items-center justify-center h-28 font-sans cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left w-full"
            >
              <p className="text-xs font-normal text-slate-400 tracking-wider">{card.label}</p>
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Content will go here */}
        </div>
      </div>

      {/* 5. Right Slide-out Sidebar (Application Details) */}
      <div ref={sidebarRef} className={`fixed right-0 top-20 bottom-0 w-[600px] bg-white dark:bg-[#0D0F16] border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 transition-transform duration-300 transform ${selectedApp ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedApp && (
          <div className="flex flex-col h-full font-sans">
            {/* Header Content */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
              <div className="text-[14px]">
                {selectedApp.jobUrl ? (
                  <a
                    href={selectedApp.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 hover:underline"
                  >
                    {selectedApp.requirements?.title || 'View Job'}
                  </a>
                ) : (
                  <span className="text-slate-800 dark:text-slate-200">{selectedApp.requirements?.title || 'Job Application'}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative sidebar-menu-trigger">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSidebarMenuOpen(!isSidebarMenuOpen);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1.5 text-slate-400 hover:text-orange-500 border border-transparent hover:border-orange-500 rounded-md transition-all"
                  >
                    <MoreHorizontal className="w-5 h-5 stroke-[1.5]" />
                  </button>

                  {isSidebarMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-0.5 w-32 bg-white dark:bg-slate-800 rounded-md rounded-t-none shadow-xl border border-slate-100 dark:border-slate-700 border-t-0 py-1 z-50 animate-in fade-in zoom-in-95 duration-200"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setIsSidebarMenuOpen(false)}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-orange-500 flex items-center gap-2 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => setIsSidebarMenuOpen(false)}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-orange-500 flex items-center gap-2 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </button>
                      <button
                        onClick={() => setIsSidebarMenuOpen(false)}
                        className="w-full text-left px-4 py-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={() => setSelectedApp(null)} className="p-1.5 text-slate-400 hover:text-orange-500 border border-transparent hover:border-orange-500 rounded-md transition-all">
                  <X className="w-5 h-5 stroke-[1.5]" />
                </button>
              </div>
            </div>

            {/* Sidebar Body with Padding */}
            <div className="p-6 pb-4">
              {/* Profile Section - Exactly like ref */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* Circular Logo */}
                  {/* Logo - No Container */}
                  <div className="w-14 h-14 flex-shrink-0">
                    {selectedApp.requirements.logoUrl ? (
                      <img
                        src={selectedApp.requirements.logoUrl}
                        alt={selectedApp.requirements.company}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-xl text-white uppercase">
                        {selectedApp.requirements.company.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg text-slate-900 dark:text-white leading-tight font-normal tracking-tight">{selectedApp.requirements.company}</h2>
                    <div className="flex items-center gap-1 text-slate-400 text-xs mt-1 font-normal tracking-wider">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedApp.requirements.location || 'Remote'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Badge - Almost no radius */}
              <div className="inline-flex items-center gap-1.5 mt-5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-[4px]">
                <span className={`text-xs font-semibold ${selectedApp.matchScore > 75 ? 'text-emerald-500' :
                  selectedApp.matchScore > 50 ? 'text-lime-500' :
                    selectedApp.matchScore > 25 ? 'text-yellow-500' :
                      'text-orange-500'
                  }`}>{selectedApp.matchScore}%</span>
                <span className="text-xs text-black dark:text-slate-400 tracking-wider">Matched</span>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-8 px-8 border-b border-slate-100 dark:border-slate-800/50 sticky top-0 bg-white dark:bg-[#0D0F16] z-10">
                {(['details', 'cv', 'followup'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSidebarTab(tab)}
                    className={`py-5 text-xs tracking-wider border-b-2 transition-all ${sidebarTab === tab ? 'text-orange-500 border-orange-500' : 'text-slate-900 border-transparent hover:text-orange-500'}`}
                  >
                    {tab === 'details' ? 'Application' : tab === 'cv' ? 'Resume' : 'Follow up'}
                  </button>
                ))}
              </div>

              <div className="p-8 space-y-8">
                {sidebarTab === 'details' && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header: Role info inside application tab per request */}
                    <div>
                      <h2 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">Position</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal tracking-wider">{selectedApp.requirements?.title}</p>
                    </div>

                    {/* About the Job */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">About The Job</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.description || selectedApp.jobText || (selectedApp.requirements as any).descriptionSummary || selectedApp.requirements.description} />
                      </div>
                    </section>

                    {/* About The Role */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">About The Role</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.about_the_role} />
                      </div>
                    </section>

                    {/* What You’ll Do */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">What You'll Do</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.responsibilities} />
                      </div>
                    </section>

                    {/* Requirements */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">Requirements</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.structured_requirements} />
                      </div>
                    </section>

                    {/* Nice To Have */}
                    {selectedApp.nice_to_have && (
                      <section>
                        <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">Nice To Have</h3>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                          <RenderBlocks blocks={selectedApp.nice_to_have} />
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {sidebarTab === 'cv' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-700">
                          <FileText className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white tracking-wider">{profile.name.replace(/\s+/g, '_')}_Resume.pdf</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-normal tracking-wider">280KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => onViewApplication(selectedApp)}
                          className="text-xs text-slate-600 dark:text-slate-300 hover:text-orange-500 flex items-center gap-1 font-normal tracking-wider"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </button>
                        <button
                          onClick={(e) => handleDirectDownload(selectedApp, e as any)}
                          className="text-xs text-slate-600 dark:text-slate-300 hover:text-orange-500 flex items-center gap-1 font-normal tracking-wider"
                        >
                          Download
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {sidebarTab === 'followup' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 tracking-wider">Salary Expectation</h3>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Amount (e.g. 120,000)"
                            className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                            value={selectedApp.salary_expectation?.amount || ''}
                            onChange={(e) => {
                              const updatedApp = {
                                ...selectedApp,
                                salary_expectation: {
                                  ...(selectedApp.salary_expectation || { currency: 'USD' }),
                                  amount: e.target.value
                                }
                              };
                              setSelectedApp(updatedApp);
                            }}
                            onBlur={() => onUpdate?.(selectedApp!)}
                          />
                        </div>
                        <div className="w-28 relative currency-menu-trigger">
                          <button
                            onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)}
                            className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-orange-500 rounded-md text-xs text-slate-900 dark:text-white outline-none flex items-center justify-between transition-all font-normal tracking-wider"
                          >
                            <span className="truncate">{selectedApp.salary_expectation?.currency || 'USD'}</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isCurrencyMenuOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isCurrencyMenuOpen && (
                            <div className="absolute left-0 right-0 top-full mt-0.5 bg-white dark:bg-slate-800 rounded-md rounded-t-none shadow-xl border border-slate-100 dark:border-slate-700 border-t-0 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                              {['USD', 'EUR', 'GBP', 'ILS', 'CAD', 'AUD'].map((curr) => (
                                <button
                                  key={curr}
                                  onClick={() => {
                                    const updatedApp = {
                                      ...selectedApp,
                                      salary_expectation: {
                                        ...(selectedApp.salary_expectation || { amount: '' }),
                                        currency: curr
                                      }
                                    };
                                    onUpdate?.(updatedApp);
                                    setSelectedApp(updatedApp);
                                    setIsCurrencyMenuOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-orange-500 transition-colors font-normal tracking-wider"
                                >
                                  {curr}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 tracking-wider">Notes</h3>
                      <textarea
                        className="w-full h-40 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all no-scrollbar font-normal tracking-wider"
                        placeholder="Add your notes about this application..."
                        value={selectedApp.notes || ''}
                        onChange={(e) => {
                          setSelectedApp({
                            ...selectedApp,
                            notes: e.target.value
                          });
                        }}
                        onBlur={() => onUpdate?.(selectedApp!)}
                      />
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-0 tracking-wider">Meetings</h3>
                        <button
                          onClick={() => {
                            setIsAddingMeeting(true);
                            setEditingMeetingId(null);
                            setNewMeetingData({ title: '', date: '', time: '', description: '', location: '', notes: '' });
                            setTimeout(() => {
                              meetingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 150);
                          }}
                          className="w-8 h-8 border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white rounded-md transition-all flex items-center justify-center flex-shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(selectedApp.meetings || []).map((meeting) => (
                          <div key={meeting.id} data-meeting-container={meeting.id}>
                            {editingMeetingId === meeting.id ? (
                              <div className="space-y-4 animate-in fade-in duration-200 py-4 relative">
                                <div className="flex gap-3 items-end">
                                  <div className="flex-1 space-y-2">
                                    <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Title</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Technical Interview"
                                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                                      value={newMeetingData.title}
                                      onChange={e => setNewMeetingData({ ...newMeetingData, title: e.target.value })}
                                    />
                                  </div>
                                  <div className="w-[180px] space-y-2">
                                    <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Date & Time</label>
                                    <button
                                      onClick={() => {
                                        setTempDate(newMeetingData.date || new Date().toISOString().split('T')[0]);
                                        setTempTime(newMeetingData.time || '10:00');
                                        setCalendarMonth(new Date(newMeetingData.date || new Date()));
                                        setIsDatePickerOpen(true);
                                      }}
                                      className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-left text-slate-900 dark:text-white placeholder:text-slate-300 focus:border-orange-500 outline-none transition-all font-normal tracking-wider flex items-center justify-between"
                                    >
                                      <span className="truncate">
                                        {newMeetingData.date ? (
                                          new Date(newMeetingData.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        ) : 'Select Date'}
                                        {newMeetingData.time ? ` at ${newMeetingData.time}` : ''}
                                      </span>
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                  </div>
                                </div>

                                {isDatePickerOpen && (
                                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                                    <div className="bg-white dark:bg-slate-900 rounded-sm shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[480px] overflow-hidden">
                                      <div className="flex h-[380px]">
                                        {/* Calendar Side */}
                                        <div className="flex-1 p-6 border-r border-slate-100 dark:border-slate-800">
                                          <div className="flex items-center justify-between mb-6">
                                            <button
                                              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                                              className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                            >
                                              <ChevronLeft className="w-4 h-4 text-slate-400" />
                                            </button>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-wider">
                                              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <button
                                              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                                              className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                            >
                                              <ChevronRight className="w-4 h-4 text-slate-400" />
                                            </button>
                                          </div>

                                          <div className="grid grid-cols-7 gap-1 mb-2">
                                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                                              <div key={day} className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">{day}</div>
                                            ))}
                                          </div>

                                          <div className="grid grid-cols-7 gap-1">
                                            {(() => {
                                              const days = [];
                                              const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                                              const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

                                              // Previous month padding
                                              let prevDays = start.getDay() === 0 ? 6 : start.getDay() - 1;
                                              const prevMonthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 0).getDate();
                                              for (let i = prevDays - 1; i >= 0; i--) {
                                                days.push(<div key={`prev-${i}`} className="h-8 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700">{prevMonthEnd - i}</div>);
                                              }

                                              // Current month days
                                              for (let i = 1; i <= end.getDate(); i++) {
                                                const dateStr = `${calendarMonth.getFullYear()}-${(calendarMonth.getMonth() + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                                                const isSelected = tempDate === dateStr;
                                                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                                                days.push(
                                                  <button
                                                    key={i}
                                                    onClick={() => setTempDate(dateStr)}
                                                    className={`h-8 w-8 flex items-center justify-center text-[11px] rounded-sm transition-all relative ${isSelected ? 'bg-orange-500 text-white font-bold' :
                                                      'hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-600 dark:text-slate-400'
                                                      }`}
                                                  >
                                                    {i}
                                                    {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full" />}
                                                  </button>
                                                );
                                              }

                                              // Next month padding
                                              const totalDays = days.length;
                                              for (let i = 1; i <= (42 - totalDays); i++) {
                                                days.push(<div key={`next-${i}`} className="h-8 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700">{i}</div>);
                                              }

                                              return days;
                                            })()}
                                          </div>
                                        </div>

                                        {/* Time Side */}
                                        <div className="w-[140px] border-l border-slate-100 dark:border-slate-800 overflow-y-auto no-scrollbar py-4 p-2">
                                          <div className="space-y-1">
                                            {(() => {
                                              const slots = [];
                                              for (let h = 8; h <= 21; h++) {
                                                for (let m = 0; m < 60; m += 15) {
                                                  const hour = h > 12 ? h - 12 : h;
                                                  const ampm = h >= 12 ? 'PM' : 'AM';
                                                  const timeVal = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                                  const label = `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
                                                  const isSelected = tempTime === timeVal;

                                                  slots.push(
                                                    <button
                                                      key={timeVal}
                                                      onClick={() => setTempTime(timeVal)}
                                                      className={`w-full py-2 px-3 text-[11px] text-left rounded-sm transition-all ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold border border-orange-200 dark:border-orange-800/50' :
                                                        'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                      {label}
                                                    </button>
                                                  );
                                                }
                                              }
                                              return slots;
                                            })()}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Footer */}
                                      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                        <button
                                          onClick={() => setIsDatePickerOpen(false)}
                                          className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-sm text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                        >
                                          Cancel
                                        </button>
                                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-sm text-[11px] text-slate-900 dark:text-white font-medium flex-1 text-center">
                                          {tempDate ? new Date(tempDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}
                                          {tempTime ? ` at ${tempTime}` : ''}
                                        </div>
                                        <button
                                          onClick={() => {
                                            setNewMeetingData({ ...newMeetingData, date: tempDate, time: tempTime });
                                            setIsDatePickerOpen(false);
                                          }}
                                          disabled={!tempDate || !tempTime}
                                          className="px-8 py-2 bg-orange-500 text-white rounded-sm text-[11px] font-bold hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Description</label>
                                  <input
                                    type="text"
                                    placeholder="Interview call"
                                    className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                                    value={newMeetingData.description}
                                    onChange={e => setNewMeetingData({ ...newMeetingData, description: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Location / Link</label>
                                  <input
                                    type="text"
                                    placeholder="Google Meet or Address"
                                    className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                                    value={newMeetingData.location}
                                    onChange={e => setNewMeetingData({ ...newMeetingData, location: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Additional Notes</label>
                                  <textarea
                                    placeholder="Summary of the meeting..."
                                    className="w-full h-32 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider no-scrollbar"
                                    value={newMeetingData.notes}
                                    onChange={e => setNewMeetingData({ ...newMeetingData, notes: e.target.value })}
                                  />
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                  <button
                                    onClick={() => {
                                      setEditingMeetingId(null);
                                      setNewMeetingData({ title: '', date: '', time: '', description: '', location: '', notes: '' });
                                    }}
                                    className="px-6 py-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 rounded-[4px] transition-all font-normal tracking-wider"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!newMeetingData.date || !newMeetingData.description) return;

                                      let updatedMeetings = [...(selectedApp!.meetings || [])];
                                      if (editingMeetingId) {
                                        updatedMeetings = updatedMeetings.map(m =>
                                          m.id === editingMeetingId ? { ...newMeetingData, id: m.id } : m
                                        );
                                      } else {
                                        updatedMeetings.push({
                                          id: Date.now().toString(),
                                          ...newMeetingData
                                        });
                                      }

                                      const updatedApp = {
                                        ...selectedApp!,
                                        meetings: updatedMeetings
                                      };
                                      onUpdate?.(updatedApp);
                                      setSelectedApp(updatedApp);
                                      setIsAddingMeeting(false);
                                      setEditingMeetingId(null);
                                      setNewMeetingData({ title: '', date: '', time: '', description: '', location: '', notes: '' });
                                    }}
                                    className="px-6 py-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white rounded-[4px] transition-all font-normal tracking-wider"
                                  >
                                    Save Meeting
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg overflow-hidden transition-all border-none">
                                <button
                                  onClick={(e) => {
                                    const isExpanding = expandedMeetingId !== meeting.id;
                                    setExpandedMeetingId(isExpanding ? meeting.id : null);
                                    if (isExpanding) {
                                      const container = e.currentTarget.closest('[data-meeting-container]');
                                      setTimeout(() => {
                                        container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }, 150);
                                    }
                                  }}
                                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-sm flex items-center justify-center shadow-sm flex-shrink-0">
                                      <Calendar className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <span className="text-xs font-normal text-slate-900 dark:text-white tracking-wider truncate flex-1 min-w-0">{meeting.title}</span>
                                  </div>
                                  <div className="flex items-center gap-4 ml-auto pr-1">
                                    <span className="text-xs text-slate-900 dark:text-white tracking-wider font-normal flex-shrink-0">
                                      {meeting.date && (() => {
                                        const date = new Date(meeting.date + 'T00:00:00');
                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', ', ');
                                      })()}
                                    </span>
                                    {meeting.time && (
                                      <span className="text-xs text-slate-900 dark:text-white tracking-wider font-normal flex-shrink-0">
                                        {meeting.time}
                                      </span>
                                    )}
                                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedMeetingId === meeting.id ? 'rotate-90' : ''}`} />
                                  </div>
                                </button>

                                {expandedMeetingId === meeting.id && (
                                  <div className="px-4 pb-4 pt-0 border-t border-slate-50 dark:border-slate-800/50 space-y-3 bg-slate-50/30 dark:bg-slate-800/20 animate-in slide-in-from-top-1 duration-200">
                                    {meeting.description && (
                                      <div className="space-y-2 pt-3">
                                        <p className="text-xs font-normal text-slate-900 dark:text-white tracking-wider">Description</p>
                                        <p className="text-xs font-normal text-slate-600 dark:text-slate-300 tracking-wider ">{meeting.description}</p>
                                      </div>
                                    )}

                                    {meeting.location && (
                                      <div className="space-y-2">
                                        <p className="text-xs font-normal text-slate-900 dark:text-white tracking-wider">Location / Link</p>
                                        {(() => {
                                          const isLink = (str: string) => {
                                            try {
                                              const url = new URL(str);
                                              return url.protocol === 'http:' || url.protocol === 'https:';
                                            } catch (_) {
                                              return str.includes('www.') || str.includes('google.com') || str.includes('zoom.us') || str.includes('meet.google.com');
                                            }
                                          };
                                          if (isLink(meeting.location)) {
                                            return (
                                              <a href={meeting.location.startsWith('http') ? meeting.location : `https://${meeting.location}`} target="_blank" rel="noopener noreferrer" className="text-xs font-normal text-blue-500 hover:underline break-all block tracking-wider">
                                                {meeting.location}
                                              </a>
                                            );
                                          }
                                          return <p className="text-xs font-normal text-slate-600 dark:text-slate-300 tracking-wider">{meeting.location}</p>;
                                        })()}
                                      </div>
                                    )}

                                    {meeting.notes && (
                                      <div className="space-y-2">
                                        <p className="text-xs font-normal text-slate-900 dark:text-white tracking-wider">Additional Notes</p>
                                        <p className="text-xs font-normal text-slate-600 dark:text-slate-300 whitespace-pre-wrap tracking-wider">{meeting.notes}</p>
                                      </div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-2 pb-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const container = e.currentTarget.closest('[data-meeting-container]');
                                          setEditingMeetingId(meeting.id);
                                          setExpandedMeetingId(null);
                                          setIsAddingMeeting(false);
                                          setNewMeetingData({
                                            title: meeting.title || '',
                                            date: meeting.date,
                                            time: meeting.time,
                                            description: meeting.description,
                                            location: meeting.location,
                                            notes: meeting.notes
                                          });
                                          setTimeout(() => {
                                            container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          }, 150);
                                        }}
                                        className="p-1 px-2 border border-slate-200 dark:border-slate-700 rounded text-slate-400 hover:text-orange-500 hover:border-orange-500 transition-all text-[10px] items-center flex gap-1 font-normal tracking-wider"
                                      >
                                        <Pencil className="w-3 h-3" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updatedApp = {
                                            ...selectedApp!,
                                            meetings: (selectedApp!.meetings || []).filter(m => m.id !== meeting.id)
                                          };
                                          onUpdate?.(updatedApp);
                                          setSelectedApp(updatedApp);
                                        }}
                                        className="p-1 px-2 border border-slate-200 dark:border-slate-700 rounded text-slate-400 hover:text-red-500 hover:border-red-500 transition-all text-[10px] items-center flex gap-1 font-normal tracking-wider"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {isAddingMeeting && !editingMeetingId && (
                        <div ref={meetingFormRef} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative">
                          <div className="flex gap-3 items-end">
                            <div className="flex-1 space-y-2">
                              <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Title</label>
                              <input
                                type="text"
                                placeholder="e.g. Technical Interview"
                                className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                                value={newMeetingData.title}
                                onChange={e => setNewMeetingData({ ...newMeetingData, title: e.target.value })}
                              />
                            </div>
                            <div className="w-[180px] space-y-2">
                              <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Date & Time</label>
                              <button
                                onClick={() => {
                                  setTempDate(newMeetingData.date || new Date().toISOString().split('T')[0]);
                                  setTempTime(newMeetingData.time || '10:00');
                                  setCalendarMonth(new Date(newMeetingData.date || new Date()));
                                  setIsDatePickerOpen(true);
                                }}
                                className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-left text-slate-900 dark:text-white placeholder:text-slate-300 focus:border-orange-500 outline-none transition-all font-normal tracking-wider flex items-center justify-between"
                              >
                                <span className="truncate">
                                  {newMeetingData.date ? (
                                    new Date(newMeetingData.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  ) : 'Select Date'}
                                  {newMeetingData.time ? ` at ${newMeetingData.time}` : ''}
                                </span>
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                            </div>
                          </div>

                          {isDatePickerOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                              <div className="bg-white dark:bg-slate-900 rounded-sm shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[480px] overflow-hidden">
                                <div className="flex h-[380px]">
                                  {/* Calendar Side */}
                                  <div className="flex-1 p-6 border-r border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-6">
                                      <button
                                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                                        className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                      >
                                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                                      </button>
                                      <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-wider">
                                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                      </h4>
                                      <button
                                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                                        className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                      >
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                                        <div key={day} className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">{day}</div>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1">
                                      {(() => {
                                        const days = [];
                                        const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                                        const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

                                        // Previous month padding
                                        let prevDays = start.getDay() === 0 ? 6 : start.getDay() - 1;
                                        const prevMonthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 0).getDate();
                                        for (let i = prevDays - 1; i >= 0; i--) {
                                          days.push(<div key={`prev-${i}`} className="h-8 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700">{prevMonthEnd - i}</div>);
                                        }

                                        // Current month days
                                        for (let i = 1; i <= end.getDate(); i++) {
                                          const dateStr = `${calendarMonth.getFullYear()}-${(calendarMonth.getMonth() + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                                          const isSelected = tempDate === dateStr;
                                          const isToday = new Date().toISOString().split('T')[0] === dateStr;

                                          days.push(
                                            <button
                                              key={i}
                                              onClick={() => setTempDate(dateStr)}
                                              className={`h-8 w-8 flex items-center justify-center text-[11px] rounded-sm transition-all relative ${isSelected ? 'bg-orange-500 text-white font-bold' :
                                                'hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                              {i}
                                              {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full" />}
                                            </button>
                                          );
                                        }

                                        // Next month padding
                                        const totalDays = days.length;
                                        for (let i = 1; i <= (42 - totalDays); i++) {
                                          days.push(<div key={`next-${i}`} className="h-8 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700">{i}</div>);
                                        }

                                        return days;
                                      })()}
                                    </div>
                                  </div>

                                  {/* Time Side */}
                                  <div className="w-[140px] border-l border-slate-100 dark:border-slate-800 overflow-y-auto no-scrollbar py-4 p-2">
                                    <div className="space-y-1">
                                      {(() => {
                                        const slots = [];
                                        for (let h = 8; h <= 21; h++) {
                                          for (let m = 0; m < 60; m += 15) {
                                            const hour = h > 12 ? h - 12 : h;
                                            const ampm = h >= 12 ? 'PM' : 'AM';
                                            const timeVal = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                            const label = `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
                                            const isSelected = tempTime === timeVal;

                                            slots.push(
                                              <button
                                                key={timeVal}
                                                onClick={() => setTempTime(timeVal)}
                                                className={`w-full py-2 px-3 text-[11px] text-left rounded-sm transition-all ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold border border-orange-200 dark:border-orange-800/50' :
                                                  'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                  }`}
                                              >
                                                {label}
                                              </button>
                                            );
                                          }
                                        }
                                        return slots;
                                      })()}
                                    </div>
                                  </div>
                                </div>

                                {/* Footer */}
                                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                  <button
                                    onClick={() => setIsDatePickerOpen(false)}
                                    className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-sm text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                  >
                                    Cancel
                                  </button>
                                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-sm text-[11px] text-slate-900 dark:text-white font-medium flex-1 text-center">
                                    {tempDate ? new Date(tempDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}
                                    {tempTime ? ` at ${tempTime}` : ''}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setNewMeetingData({ ...newMeetingData, date: tempDate, time: tempTime });
                                      setIsDatePickerOpen(false);
                                    }}
                                    disabled={!tempDate || !tempTime}
                                    className="px-8 py-2 bg-orange-500 text-white rounded-sm text-[11px] font-bold hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Description</label>
                            <input
                              type="text"
                              placeholder="Interview call"
                              className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                              value={newMeetingData.description}
                              onChange={e => setNewMeetingData({ ...newMeetingData, description: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Location / Link</label>
                            <input
                              type="text"
                              placeholder="Google Meet or Address"
                              className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider"
                              value={newMeetingData.location}
                              onChange={e => setNewMeetingData({ ...newMeetingData, location: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-normal text-slate-900 dark:text-white tracking-wider block">Additional Notes</label>
                            <textarea
                              placeholder="Summary of the meeting..."
                              className="w-full h-32 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all font-normal tracking-wider no-scrollbar"
                              value={newMeetingData.notes}
                              onChange={e => setNewMeetingData({ ...newMeetingData, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              onClick={() => {
                                setIsAddingMeeting(false);
                                setEditingMeetingId(null);
                                setNewMeetingData({ title: '', date: '', time: '', description: '', location: '', notes: '' });
                              }}
                              className="px-6 py-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 rounded-[4px] transition-all font-normal tracking-wider"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (!newMeetingData.date || !newMeetingData.description) return;

                                let updatedMeetings = [...(selectedApp!.meetings || [])];
                                if (editingMeetingId) {
                                  updatedMeetings = updatedMeetings.map(m =>
                                    m.id === editingMeetingId ? { ...newMeetingData, id: m.id } : m
                                  );
                                } else {
                                  updatedMeetings.push({
                                    id: Date.now().toString(),
                                    ...newMeetingData
                                  });
                                }

                                const updatedApp = {
                                  ...selectedApp!,
                                  meetings: updatedMeetings
                                };
                                onUpdate?.(updatedApp);
                                setSelectedApp(updatedApp);
                                setIsAddingMeeting(false);
                                setEditingMeetingId(null);
                                setNewMeetingData({ title: '', date: '', time: '', description: '', location: '', notes: '' });
                              }}
                              className="px-6 py-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white rounded-[4px] transition-all font-normal tracking-wider"
                            >
                              Save Meeting
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Hidden Content for Silent PDF Generation */}
      <div className="absolute top-[-10000px] left-[-10000px] w-[800px] pointer-events-none">
        {appToDownload && (
          <ResumePaper ref={downloadRef} application={appToDownload} profile={profile} />
        )}
      </div>

      {/* 8. Floating Action Pillbar */}
      {
        selectedIds.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#0B0C14] dark:bg-white text-white dark:text-slate-900 h-[52px] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center px-2 z-[70] border border-white/5 dark:border-slate-200 animate-in slide-in-from-bottom-5 duration-300 gap-2">

            <div className="pl-6 pr-4 border-r border-white/20 dark:border-slate-200/50 h-5 flex items-center">
              <span className="text-[12px] font-medium whitespace-nowrap">Selected: {selectedIds.length}</span>
            </div>

            <div className="flex items-center gap-1 h-full">
              <button className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-all rounded-lg group text-white dark:text-slate-900 hover:text-[#FF6B00]">
                <Pencil className="w-4 h-4 stroke-[1.5]" />
                Edit
              </button>

              <div className="h-4 w-px bg-white/20 dark:bg-slate-200/50 mx-1"></div>

              <button className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors rounded-lg group text-white dark:text-slate-900 hover:text-[#FF6B00]">
                <Archive className="w-4 h-4 stroke-[1.5]" />
                Archive
              </button>

              <div className="h-4 w-px bg-white/20 dark:bg-slate-200/50 mx-1"></div>

              <button className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors rounded-lg group text-white dark:text-slate-900 hover:text-red-500">
                <Trash2 className="w-4 h-4 stroke-[1.5]" />
                Delete
              </button>
            </div>

            <div className="pl-2 pr-1">
              <button
                onClick={() => setSelectedIds([])}
                className="px-5 py-2 bg-white dark:bg-slate-900 text-[#FF6B00] dark:text-white hover:bg-[#FF6B00] hover:text-white dark:hover:bg-[#FF6B00] dark:hover:text-white font-bold text-[11px] rounded-md transition-all shadow-sm"
              >
                Discard
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
};
