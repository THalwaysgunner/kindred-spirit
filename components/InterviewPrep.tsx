
import React, { useState } from 'react';
import { Application } from '../types';
import {
   Send,
   MessageSquare,
   Bot,
   Target,
   Database,
   Code2,
   FileCode2,
   Zap,
   ChevronDown,
   Layout,
   Terminal,
   BookOpen,
   Map,
   Cpu,
   BarChart3,
   CheckCircle2,
   Briefcase,
   List,
   Building2
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

   const selectedApp = applications.find(a => a.id === selectedId) || applications[0];

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
      return (selectedApp.requirements as any).jobTasks?.slice(0, 8) || [];
   };

   return (
      <div className="flex relative">
         <style>{`
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         `}</style>

         {/* MAIN: Study Plan Content */}
         <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">

            {/* Scrollable Grid Content */}
            <div className="flex-1 space-y-10 custom-scrollbar pb-10">

               {/* Section 1: Dashboard Grid */}
               <section>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                     {/* Card 1 - Overview */}
                     <div
                        onClick={() => setActiveFeature('overview')}
                        className={`p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform
                        ${activeFeature === 'overview' ? 'bg-gradient-to-br from-blue-600 to-blue-800 ring-2 ring-white/20' : 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]'}
                    `}
                     >
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                           <Layout className="w-16 h-16 text-white rotate-12" />
                        </div>
                        <div className="relative z-10 h-32 flex flex-col justify-between">
                           <div>
                              <h4 className="text-white font-bold text-lg leading-tight mb-1">Overview</h4>
                              <p className="text-blue-100 text-xs">Job breakdown & requirements</p>
                           </div>
                           <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                              <Layout className="w-5 h-5 text-white" />
                           </div>
                        </div>
                     </div>

                     {/* Card 2 - Roadmap */}
                     <div
                        onClick={() => setActiveFeature('roadmap')}
                        className="bg-gradient-to-br from-[#0d9488] to-[#0f766e] p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
                     >
                        <div className="absolute -bottom-4 -right-4 opacity-20 group-hover:opacity-40 transition-opacity">
                           <Map className="w-24 h-24 text-white" />
                        </div>
                        <div className="relative z-10 h-32 flex flex-col justify-between">
                           <div>
                              <h4 className="text-white font-bold text-lg leading-tight mb-1">Roadmap</h4>
                              <p className="text-teal-100 text-xs">Step-by-step interview path</p>
                           </div>
                           <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
                              <Map className="w-5 h-5 text-white" />
                           </div>
                        </div>
                     </div>

                     {/* Card 3 - Skills */}
                     <div
                        onClick={() => setActiveFeature('skills')}
                        className="bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
                     >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 group-hover:scale-110 transition-transform">
                           <Cpu className="w-20 h-20 text-white" />
                        </div>
                        <div className="relative z-10 h-32 flex flex-col justify-between">
                           <div>
                              <h4 className="text-white font-bold text-lg leading-tight mb-1">Skills & Projects</h4>
                              <p className="text-purple-100 text-xs">Technical competencies map</p>
                           </div>
                           <div className="self-end">
                              <div className="flex gap-1">
                                 <div className="w-8 h-2 bg-white/30 rounded-full"></div>
                                 <div className="w-6 h-2 bg-white/30 rounded-full"></div>
                                 <div className="w-4 h-2 bg-white/30 rounded-full"></div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Card 4 - Track Progress */}
                     <div
                        onClick={() => setActiveFeature('progress')}
                        className="bg-gradient-to-br from-[#0284c7] to-[#0369a1] p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
                     >
                        <div className="relative z-10 h-32 flex flex-col justify-between">
                           <div>
                              <h4 className="text-white font-bold text-lg leading-tight mb-1">Track Progress</h4>
                              <p className="text-sky-100 text-xs">Monitor your readiness</p>
                           </div>
                           <div className="w-full flex justify-center">
                              <div className="flex items-center gap-1 border-2 border-white/30 rounded-xl px-3 py-1">
                                 <BarChart3 className="w-4 h-4 text-white" />
                                 <span className="text-white font-bold text-sm">STATS</span>
                              </div>
                           </div>
                        </div>
                     </div>

                  </div>
               </section>

               {/* Section: Overview Detail View (Conditionally Rendered) */}
               {activeFeature === 'overview' && selectedApp && (
                  <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                     <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-blue-500/30 overflow-hidden shadow-lg">

                        {/* O*NET Style Header - SIMPLIFIED */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 border-b border-blue-100 dark:border-blue-900/30">
                           <div className="flex items-start justify-between">
                              <div>
                                 <h3 className="text-2xl font-bold text-slate-900 dark:text-blue-100">{selectedApp.requirements.title}</h3>
                              </div>
                              <div className="hidden md:block text-right">
                                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-blue-950 rounded-full border border-blue-200 dark:border-blue-800 shadow-sm">
                                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                                    <span className="text-xs font-bold text-slate-700 dark:text-blue-200">Active Opportunity</span>
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1a1a]">
                           {['summary', 'tasks', 'skills', 'work'].map((tab) => (
                              <button
                                 key={tab}
                                 onClick={() => setOverviewTab(tab as any)}
                                 className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors capitalize ${overviewTab === tab
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                              >
                                 {tab}
                              </button>
                           ))}
                        </div>

                        {/* Tab Content */}
                        <div className="p-8 bg-white dark:bg-[#1a1a1a] min-h-[300px]">

                           {overviewTab === 'summary' && (
                              <div className="space-y-6">
                                 <div>
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-3">What they do</h4>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                       {selectedApp.requirements.descriptionSummary || "No summary provided for this role."}
                                    </p>
                                 </div>
                                 <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
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
                                    {getTasks().map((task, i) => (
                                       <li key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                          <div className="mt-1 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                             <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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
                                    {((selectedApp.requirements as any).keySkills || []).map((skill: string, i: number) => (
                                       <div key={i} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                                          <span className="font-medium text-slate-700 dark:text-slate-200">{skill}</span>
                                          <div className="flex gap-1">
                                             <div className="w-8 h-1.5 bg-blue-600 rounded-full"></div>
                                             <div className="w-4 h-1.5 bg-blue-200 dark:bg-blue-900 rounded-full"></div>
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
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl">
                                       <h5 className="font-bold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                                          <Building2 className="w-4 h-4" /> Cultural Fit
                                       </h5>
                                       <ul className="space-y-2">
                                          {((selectedApp.requirements as any).culturalFit || []).length > 0 ? ((selectedApp.requirements as any).culturalFit || []).map((item: string, i: number) => (
                                             <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
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

            </div>
         </div>

         {/* RIGHT SIDEBAR: AI Assistant Chat - Fixed and Pinned */}
         <div
            className={`fixed right-0 top-20 bottom-0 w-96 flex flex-col bg-white dark:bg-[#1a1a1a] shadow-2xl z-50 transition-transform duration-300 border-l border-slate-200 dark:border-slate-700 ${isChatOpen ? 'translate-x-0' : 'translate-x-full border-transparent'}`}
         >

            {/* Chat Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
               {/* Chat Header */}
               <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#202020]">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shrink-0">
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
               <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#151515] no-scrollbar">
                  {messages.map((msg, i) => (
                     <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                           ? 'bg-indigo-600 text-white rounded-br-none'
                           : 'bg-white dark:bg-[#2a2a2a] text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'
                           }`}>
                           {msg.text}
                        </div>
                     </div>
                  ))}
               </div>

               {/* Input Area - Spacious and pinned to bottom */}
               <div className="p-4 bg-white dark:bg-[#202020] border-t border-slate-100 dark:border-slate-800 h-40 flex flex-col">
                  <div className="relative flex-1 flex flex-col">
                     <textarea
                        placeholder="Ask for help..."
                        className="w-full flex-1 p-4 bg-slate-100 dark:bg-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                           }
                        }}
                     />
                     <button
                        onClick={handleSendMessage}
                        className="absolute right-3 bottom-3 p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white transition-colors shadow-lg"
                     >
                        <Send className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};
