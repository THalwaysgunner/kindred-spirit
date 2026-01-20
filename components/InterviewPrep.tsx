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
  TrendingUp,
  Bot
} from 'lucide-react';

interface InterviewPrepProps {
  applications: Application[];
  selectedId?: string;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
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

export const InterviewPrep: React.FC<InterviewPrepProps> = ({ applications, selectedId, isChatOpen, setIsChatOpen }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [appToDownload, setAppToDownload] = useState<Application | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [isTabsExpanded, setIsTabsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainTabs = ['Overview', 'Roadmap', 'Skills', 'Progress'];
  const moreTabs = ['Resources', 'Mock Interview', 'Notes'];

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

  // Stats Calculations - STUDY PLAN VERSION
  const stats = useMemo(() => {
    const totalPlans = applications.length;
    const inProgress = applications.filter(a => a.status === 'Applying' || a.status === 'Interviewing').length;
    const completed = applications.filter(a => a.status === 'Offer' || a.status === 'Accepted').length;
    const avgScore = applications.length > 0
      ? Math.round(applications.reduce((acc, a) => acc + (a.matchScore || 0), 0) / applications.length)
      : 0;

    return [
      { label: 'Total Plans', value: totalPlans, growth: '12%', trend: 'up' },
      { label: 'In Progress', value: inProgress, growth: '8%', trend: 'up' },
      { label: 'Completed', value: completed, growth: '15%', trend: 'up' },
      { label: 'Avg Score', value: `${avgScore}%`, growth: '5%', trend: 'up' },
    ];
  }, [applications]);

  // Filter Logic
  const filteredApps = applications.filter(app => {
    const matchesSearch =
      app.requirements.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.requirements.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
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
    console.log('[DEBUG] InterviewPrep handleRowClick called with app:', app);
    setSelectedApp(app);
    setSidebarTab('details');
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
          filename: `Study_Plan_${app.requirements.company.replace(/\s+/g, '_')}.pdf`,
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
    <div className="flex relative min-h-screen bg-white dark:bg-[#0D0F16] font-sans transition-colors w-full overflow-x-hidden">
      {/* Table Side */}
      <div className={`flex flex-col w-full transition-all duration-300 ${selectedApp ? 'mr-[600px]' : ''}`}>
        {/* 1. Stat Cards Unified Grid Area */}
        <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-800/50 gap-px border-b border-slate-200 dark:border-slate-800 w-full">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-[#0D0F16] p-6 flex flex-col h-28 font-sans group">
              <p className="text-xs font-normal text-slate-400 tracking-wider mb-auto">{stat.label}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2 relative -top-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{stat.value}</span>
                  <div className={`flex items-center gap-0.5 text-sm font-bold ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    <TrendingUp className="w-4 h-4" />
                    <span>{stat.growth}</span>
                  </div>
                </div>

                <div className="w-1/3 h-10 opacity-30 group-hover:opacity-100 transition-opacity mr-6">
                  <svg viewBox="0 0 100 20" className="w-full h-full text-[#FF6B00] overflow-visible">
                    <defs>
                      <linearGradient id={`grad-study-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#FF6B00', stopOpacity: 0.2 }} />
                        <stop offset="100%" style={{ stopColor: '#FF6B00', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 15 L 10 12 L 20 16 L 30 10 L 40 14 L 50 8 L 60 12 L 70 6 L 80 10 L 90 4 L 100 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M0 15 L 10 12 L 20 16 L 30 10 L 40 14 L 50 8 L 60 12 L 70 6 L 80 10 L 90 4 L 100 8 V 20 H 0 Z"
                      fill={`url(#grad-study-${i})`}
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 2. Sub Nav Tabs */}
        <div className="flex items-center gap-8 px-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar w-full">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-xs font-medium tracking-wide border-b-2 transition-all whitespace-nowrap ${activeTab === tab
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              {tab}
            </button>
          ))}

          {isTabsExpanded && moreTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-xs font-medium tracking-wide border-b-2 transition-all whitespace-nowrap animate-in slide-in-from-left-2 fade-in duration-300 ${activeTab === tab
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              {tab}
            </button>
          ))}

          <button
            onClick={() => setIsTabsExpanded(!isTabsExpanded)}
            className="p-1 items-center flex transition-colors"
          >
            {isTabsExpanded ? (
              <ChevronLeft className="w-4 h-4 text-[#FF6B00] hover:text-slate-900 dark:hover:text-white stroke-[1.5] transition-colors" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 hover:text-[#FF6B00] stroke-[1.5] transition-colors" />
            )}
          </button>
        </div>

        {/* 3. Action Toolbar Row */}
        <div className="flex items-center justify-between px-8 py-5 w-full">
          <div className="flex items-center gap-4">
            <div className="relative group w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg text-xs tracking-wider outline-none focus:border-slate-300 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-slate-600 dark:text-slate-300 text-xs tracking-wider border border-transparent rounded-md flex items-center gap-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-orange-500 hover:text-orange-500">
              <Upload className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
              Import
            </button>
            <button className="px-4 py-2 text-slate-600 dark:text-slate-300 text-xs tracking-wider border border-transparent rounded-md flex items-center gap-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-orange-500 hover:text-orange-500">
              <Download className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
              Export
            </button>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="px-5 py-2.5 bg-[#FF6B00] text-white hover:bg-[#E66000] text-xs tracking-wider rounded-md flex items-center gap-2 transition-all shadow-sm shadow-orange-500/20 ml-2"
            >
              <Bot className="w-4 h-4 stroke-[2]" />
              Open Coach
            </button>
          </div>
        </div>

        {/* 4. CRM Data Table */}
        <div className="flex-1 w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-sm border-collapse min-w-[1300px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="py-4 w-12 pl-8">
                  <div
                    onClick={toggleSelectAll}
                    className={`w-4 h-4 rounded cursor-pointer flex items-center justify-center transition-colors ${selectedIds.length === filteredApps.length && filteredApps.length > 0 ? 'bg-[#FF6B00]' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    {selectedIds.length === filteredApps.length && filteredApps.length > 0 && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </div>
                </th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Company</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Role</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Created</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Location</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Level</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Type</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4 text-center">Link</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4 text-center">CV</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4 text-left">Status</th>
                <th className="py-4 text-xs font-normal text-slate-400 tracking-wider px-4">Score</th>
                <th className="py-4 w-12 pr-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-20 text-center text-slate-400 text-xs italic tracking-wider">No study plans found</td>
                </tr>
              ) : filteredApps.map((app, idx) => (
                <tr
                  key={app.id}
                  onClick={() => handleRowClick(app)}
                  className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${selectedIds.includes(app.id) ? 'bg-[#FFF0E6]/30 dark:bg-orange-950/10' : ''} ${selectedApp?.id === app.id ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                >
                  <td className="py-5 w-12 pl-8" onClick={(e) => { e.stopPropagation(); toggleSelectRow(app.id, e as any); }}>
                    <div
                      className={`w-4 h-4 rounded cursor-pointer flex items-center justify-center transition-colors ${selectedIds.includes(app.id) ? 'bg-[#FF6B00]' : 'bg-slate-100 dark:bg-slate-800'}`}
                    >
                      {selectedIds.includes(app.id) && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex-shrink-0">
                        {app.requirements.logoUrl ? (
                          <img
                            src={app.requirements.logoUrl}
                            alt={app.requirements.company}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-900 tracking-wider">
                            {app.requirements.company.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-900 dark:text-white truncate max-w-[150px] tracking-wider">{app.requirements.company}</span>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-xs text-slate-900 dark:text-white tracking-wider">
                    {app.requirements.title}
                  </td>
                  <td className="py-5 px-4 text-xs text-slate-900 dark:text-white tracking-wider whitespace-nowrap">
                    {new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-5 px-4 text-xs text-slate-900 dark:text-white tracking-wider whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                    {app.requirements.location}
                  </td>
                  <td className="py-5 px-4 text-xs text-slate-900 dark:text-white tracking-wider">
                    {app.matchScore > 85 ? 'Senior' : app.matchScore > 60 ? 'Mid' : 'Junior'}
                  </td>
                  <td className="py-5 px-4 text-xs text-slate-900 dark:text-white tracking-wider">
                    {app.workType || 'Remote'}
                  </td>
                  <td className="py-5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {app.jobUrl ? (
                        <a
                          href={app.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-300 hover:text-[#FF6B00] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Job Link"
                        >
                          <ExternalLink className="w-4 h-4 stroke-[1.5]" />
                        </a>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="p-1.5 text-slate-300 hover:text-[#5D5FEF] transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleRowClick(app); }}
                        title="Preview CV"
                      >
                        <Eye className="w-4 h-4 stroke-[1.5]" />
                      </button>
                      <button
                        className={`p-1.5 transition-colors ${isDownloading && appToDownload?.id === app.id ? 'animate-spin text-[#FF6B00]' : 'text-slate-300 hover:text-[#5D5FEF]'}`}
                        onClick={(e) => handleDirectDownload(app, e as any)}
                        disabled={isDownloading}
                        title="Download CV"
                      >
                        <Download className="w-4 h-4 stroke-[1.5]" />
                      </button>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-center relative">
                    <div className="relative inline-block w-full" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenStatusId(openStatusId === app.id ? null : app.id);
                        }}
                        className="flex items-center justify-between w-full group transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="text-xs text-slate-900 dark:text-white tracking-wider">
                          {app.status === 'Draft' ? 'New' :
                            app.status === 'Interviewing' ? 'Interview' :
                              app.status === 'Offer' ? 'Accepted' :
                                app.status}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors stroke-[1.5]" />
                      </button>

                      {openStatusId === app.id && (
                        <div className="absolute left-0 top-full mt-0 w-full bg-white dark:bg-slate-800 rounded-b-md shadow-xl border-x border-b border-slate-100 dark:border-slate-700 border-t-0 py-1 z-[100] animate-in fade-in zoom-in-95 duration-200">
                          {['New', 'Applying', 'Applied', 'Interview', 'Negotiate', 'Accepted', 'Rejected', 'I Withdrew', 'No Response', 'Archived'].map((status) => (
                            <button
                              key={status}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenStatusId(null);
                              }}
                              className="w-full flex justify-start text-left pl-2 py-2 text-xs text-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-orange-500 transition-colors tracking-wider"
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(i => {
                          const threshold = i * 5;
                          const isFilled = app.matchScore >= threshold;

                          let barColor = 'bg-slate-200 dark:bg-slate-800';

                          if (isFilled) {
                            if (i <= 5) barColor = 'bg-orange-500';
                            else if (i <= 10) barColor = 'bg-yellow-400';
                            else if (i <= 15) barColor = 'bg-lime-400';
                            else barColor = 'bg-emerald-500';
                          }

                          return (
                            <div key={i} className={`w-[2px] h-3 rounded-full mr-[1px] ${barColor}`}></div>
                          );
                        })}
                      </div>
                      <div className="border border-slate-200 dark:border-slate-700 rounded-[4px] w-[34px] h-[18px] flex items-center justify-center bg-white dark:bg-transparent">
                        <span className="text-[10px] text-slate-700 dark:text-slate-300 tracking-tight">{app.matchScore}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 w-12 pr-8 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}>
                      <ChevronRight className={`w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-all stroke-[1.5] cursor-pointer ${selectedApp?.id === app.id ? 'translate-x-1 text-[#FF6B00]' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Right Slide-out Sidebar (Study Plan Details) */}
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
                  <span className="text-slate-800 dark:text-slate-200">{selectedApp.requirements?.title || 'Study Plan'}</span>
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
              {/* Profile Section */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
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

              {/* Match Badge */}
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
                    {tab === 'details' ? 'Overview' : tab === 'cv' ? 'Resources' : 'Notes'}
                  </button>
                ))}
              </div>

              <div className="p-8 space-y-8">
                {sidebarTab === 'details' && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header: Role info */}
                    <div>
                      <h2 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">Position</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal tracking-wider">{selectedApp.requirements?.title}</p>
                    </div>

                    {/* About the Job */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">About The Job</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.description} />
                      </div>
                    </section>

                    {/* About The Role */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">About The Role</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.about_the_role} />
                      </div>
                    </section>

                    {/* Responsibilities */}
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">Responsibilities</h3>
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
                    <section>
                      <h3 className="block text-xs font-bold text-slate-900 dark:text-white mb-2 tracking-wider">Nice To Have</h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed font-normal tracking-wider">
                        <RenderBlocks blocks={selectedApp.nice_to_have} />
                      </div>
                    </section>
                  </div>
                )}

                {sidebarTab === 'cv' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wider">Study Resources</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Resources for this study plan will appear here.</p>
                  </div>
                )}

                {sidebarTab === 'followup' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wider">Notes</h3>
                    <textarea
                      className="w-full h-40 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-md text-xs text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:text-xs placeholder:tracking-wider focus:border-slate-400 dark:focus:border-slate-600 outline-none transition-all no-scrollbar font-normal tracking-wider"
                      placeholder="Add your study notes..."
                      value={selectedApp.notes || ''}
                      onChange={(e) => {
                        setSelectedApp({
                          ...selectedApp,
                          notes: e.target.value
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
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
