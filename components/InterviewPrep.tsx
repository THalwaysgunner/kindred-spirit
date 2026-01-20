
import React, { useState, useMemo } from 'react';
import { Application } from '../types';
import {
   Bot,
   Building2,
   CheckCircle2,
   ChevronLeft,
   ChevronRight,
   Briefcase,
   Search,
   Send,
   TrendingUp
} from 'lucide-react';

interface InterviewPrepProps {
   applications: Application[];
   selectedId?: string;
   isChatOpen: boolean;
   setIsChatOpen: (open: boolean) => void;
}

export const InterviewPrep: React.FC<InterviewPrepProps> = ({ applications, selectedId, isChatOpen, setIsChatOpen }) => {
   const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([
      { role: 'assistant', text: 'Hi! I can help you prepare for your interviews. Ask me anything about the study plans on the right.' }
   ]);
   const [chatInput, setChatInput] = useState('');

   // UI State for the Study Plan Grid
   const [activeFeature, setActiveFeature] = useState<'overview' | 'roadmap' | 'skills' | 'progress' | null>('overview');
   const [overviewTab, setOverviewTab] = useState<'summary' | 'tasks' | 'skills' | 'work'>('summary');
   const [isTabsExpanded, setIsTabsExpanded] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');

   const selectedApp = applications.find(a => a.id === selectedId) || applications[0];

   // Stats for Study Plan
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

   const mainTabs = ['Overview', 'Roadmap', 'Skills', 'Progress'];
   const moreTabs = ['Resources', 'Mock Interview', 'Notes'];
   const featureOrder = ['overview', 'roadmap', 'skills', 'progress'] as const;

   const handleSendMessage = () => {
      if (!chatInput.trim()) return;
      const newMessages = [...messages, { role: 'user', text: chatInput }];
      setMessages(newMessages as any);
      setChatInput('');

      // Simulate Response
      setTimeout(() => {
         setMessages(prev => [...prev, {
            role: 'assistant',
            text: `That's a great question about ${selectedApp?.requirements.company || 'your interview'}. Check the Overview tab for specific requirements.`
         }]);
      }, 1000);
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSendMessage();
   };

   // Helper to split description into "Tasks"
   const getTasks = () => {
      if (!selectedApp) return [];
      const tasks = (selectedApp.requirements as any).jobTasks?.slice(0, 8) || [];
      if (!searchQuery.trim()) return tasks;
      const q = searchQuery.toLowerCase();
      return tasks.filter((t: any) => String(t).toLowerCase().includes(q));
   };

   const handleTabClick = (tab: string) => {
      switch (tab) {
         case 'Overview':
            setActiveFeature('overview');
            break;
         case 'Roadmap':
            setActiveFeature('roadmap');
            break;
         case 'Skills':
            setActiveFeature('skills');
            break;
         case 'Progress':
            setActiveFeature('progress');
            break;
         default:
            setActiveFeature('overview');
      }
   };

   const getActiveTabName = () => {
      switch (activeFeature) {
         case 'overview': return 'Overview';
         case 'roadmap': return 'Roadmap';
         case 'skills': return 'Skills';
         case 'progress': return 'Progress';
         default: return 'Overview';
      }
   };

   return (
      <div className="flex relative min-h-screen bg-white dark:bg-[#0D0F16] font-sans transition-colors w-full overflow-x-hidden">
         <style>{`
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         `}</style>

         {/* MAIN: Study Plan Content */}
         <div className={`flex flex-col w-full transition-all duration-300 ${isChatOpen ? 'mr-96' : ''}`}>

            {/* 1. Stat Cards Unified Grid Area - EXACT SAME AS ApplicationsList */}
            <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-800/50 gap-px border-b border-slate-200 dark:border-slate-800 w-full">
               {stats.map((stat, i) => (
                  <div
                     key={i}
                     onClick={() => setActiveFeature(featureOrder[i] ?? 'overview')}
                     className="bg-white dark:bg-[#0D0F16] p-6 flex flex-col h-28 font-sans group cursor-pointer"
                  >
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

            {/* 2. Sub Nav Tabs - EXACT SAME AS ApplicationsList */}
            <div className="flex items-center gap-8 px-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar w-full">
               {mainTabs.map((tab) => (
                  <button
                     key={tab}
                     onClick={() => handleTabClick(tab)}
                     className={`py-4 text-xs font-medium tracking-wide border-b-2 transition-all whitespace-nowrap ${getActiveTabName() === tab
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
                     onClick={() => handleTabClick(tab)}
                     className={`py-4 text-xs font-medium tracking-wide border-b-2 transition-all whitespace-nowrap animate-in slide-in-from-left-2 fade-in duration-300 ${getActiveTabName() === tab
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

            {/* 3. Action Toolbar Row (same layout as My Applications) */}
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
                  <button
                     onClick={() => setIsChatOpen(!isChatOpen)}
                     className="px-4 py-2 text-slate-600 dark:text-slate-300 text-xs tracking-wider border border-transparent rounded-md flex items-center gap-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-orange-500 hover:text-orange-500"
                  >
                     <Bot className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                     {isChatOpen ? 'Close Coach' : 'Open Coach'}
                  </button>
               </div>
            </div>

            {/* 4. Content Area (same table-area layout as My Applications) */}
            <div className="flex-1 w-full overflow-x-auto no-scrollbar">
               <div className="min-w-[1300px] px-8 py-6">
                  <div className="space-y-8">

                     {/* Detail View Section */}
                     {activeFeature === 'overview' && selectedApp && (
                        <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                           <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-slate-700 overflow-hidden">

                              {/* Header */}
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-200 dark:border-slate-700">
                                 <div className="flex items-start justify-between">
                                    <div>
                                       <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedApp.requirements.title}</h3>
                                       <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedApp.requirements.company}</p>
                                    </div>
                                    <div className="hidden md:block text-right">
                                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Active Study Plan</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              {/* Inner Tabs - exact same style as My Applications */}
                              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D0F16]">
                                 {['summary', 'tasks', 'skills', 'work'].map((tab) => (
                                    <button
                                       key={tab}
                                       onClick={() => setOverviewTab(tab as any)}
                                       className={`px-6 py-4 text-xs font-medium tracking-wide border-b-2 transition-colors capitalize ${overviewTab === tab
                                          ? 'border-[#FF6B00] text-[#FF6B00]'
                                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                          }`}
                                    >
                                       {tab}
                                    </button>
                                 ))}
                              </div>

                              {/* Tab Content */}
                              <div className="p-8 bg-white dark:bg-[#0D0F16] min-h-[300px]">

                                 {overviewTab === 'summary' && (
                                    <div className="space-y-6">
                                       <div>
                                          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-3">What they do</h4>
                                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                             {selectedApp.requirements.description || "No summary provided for this role."}
                                          </p>
                                       </div>
                                       <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                          <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                             <Briefcase className="w-4 h-4 text-slate-500" /> Core Focus
                                          </h5>
                                          <p className="text-xs text-slate-600 dark:text-slate-400">
                                             Develop and implement a set of techniques or analytics applications to transform raw data into meaningful information using data-oriented programming languages and visualization software.
                                          </p>
                                       </div>
                                    </div>
                                 )}

                                 {overviewTab === 'tasks' && (
                                    <div>
                                       <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tasks & Responsibilities</h4>
                                       <ul className="space-y-3">
                                          {getTasks().map((task: string, i: number) => (
                                             <li key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <div className="mt-1 w-5 h-5 rounded-full bg-[#FF6B00]/10 flex items-center justify-center shrink-0">
                                                   <CheckCircle2 className="w-3 h-3 text-[#FF6B00]" />
                                                </div>
                                                <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{task}</span>
                                             </li>
                                          ))}
                                       </ul>
                                    </div>
                                 )}

                                 {overviewTab === 'skills' && (
                                    <div>
                                       <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Technology Skills</h4>
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {(((selectedApp.requirements as any).keySkills || []) as string[])
                                             .filter((skill) => !searchQuery.trim() || String(skill).toLowerCase().includes(searchQuery.toLowerCase()))
                                             .map((skill: string, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700">
                                                   <span className="font-medium text-slate-700 dark:text-slate-200">{skill}</span>
                                                   <div className="flex gap-1">
                                                      <div className="w-8 h-1.5 bg-[#FF6B00] rounded-full"></div>
                                                      <div className="w-4 h-1.5 bg-[#FF6B00]/20 rounded-full"></div>
                                                   </div>
                                                </div>
                                             ))}
                                       </div>
                                    </div>
                                 )}

                                 {overviewTab === 'work' && (
                                    <div>
                                       <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Work Context & Culture</h4>
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 border border-slate-200 dark:border-slate-700">
                                             <h5 className="font-bold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                                                <Building2 className="w-4 h-4" /> Cultural Fit
                                             </h5>
                                             <ul className="space-y-2">
                                                {((selectedApp.requirements as any).culturalFit || [])
                                                   .filter((item: any) => !searchQuery.trim() || String(item).toLowerCase().includes(searchQuery.toLowerCase()))
                                                   .length > 0 ? ((selectedApp.requirements as any).culturalFit || [])
                                                      .filter((item: any) => !searchQuery.trim() || String(item).toLowerCase().includes(searchQuery.toLowerCase()))
                                                      .map((item: string, i: number) => (
                                                         <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]"></span>
                                                            {item}
                                                         </li>
                                                      )) : (
                                                      <li className="text-sm text-slate-500 italic">No cultural fit data extracted.</li>
                                                   )}
                                             </ul>
                                          </div>
                                       </div>
                                    </div>
                                 )}

                              </div>
                           </div>
                        </section>
                     )}

                     {activeFeature === 'roadmap' && (
                        <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                           <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-slate-700 p-8">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Interview Roadmap</h3>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">Your personalized interview preparation path will appear here.</p>
                           </div>
                        </section>
                     )}

                     {activeFeature === 'skills' && (
                        <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                           <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-slate-700 p-8">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Skills & Projects</h3>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">Your technical skills assessment and project recommendations will appear here.</p>
                           </div>
                        </section>
                     )}

                     {activeFeature === 'progress' && (
                        <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                           <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-slate-700 p-8">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Track Progress</h3>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">Your interview preparation progress and readiness metrics will appear here.</p>
                           </div>
                        </section>
                     )}

                  </div>
               </div>
            </div>
         </div>

         {/* RIGHT SIDEBAR: AI Assistant Chat - Fixed and Pinned */}
         <div
            className={`fixed right-0 top-20 bottom-0 w-96 flex flex-col bg-white dark:bg-[#0D0F16] shadow-2xl z-50 transition-transform duration-300 border-l border-slate-200 dark:border-slate-700 ${isChatOpen ? 'translate-x-0' : 'translate-x-full border-transparent'}`}
         >

            {/* Chat Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
               {/* Chat Header */}
               <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-white" />
                     </div>
                     <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Study Coach</h3>
                        <div className="flex items-center gap-1.5">
                           <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                           <span className="text-xs text-slate-500 dark:text-slate-400">Online</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Chat Messages */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#0a0a0a] no-scrollbar">
                  {messages.map((msg, i) => (
                     <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                           ? 'bg-[#FF6B00] text-white'
                           : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                           }`}>
                           {msg.text}
                        </div>
                     </div>
                  ))}
               </div>

               {/* Chat Input */}
               <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D0F16]">
                  <div className="flex items-center gap-2">
                     <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything..."
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-[#FF6B00] transition-colors placeholder:text-slate-400"
                     />
                     <button
                        onClick={handleSendMessage}
                        className="p-3 bg-[#FF6B00] hover:bg-[#E66000] text-white rounded-xl transition-colors"
                     >
                        <Send className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};
