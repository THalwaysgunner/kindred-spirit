import React from 'react';
import { Application } from '../types';
import { Calendar, TrendingUp, MoreHorizontal, ArrowUpRight, Plus, Briefcase, CheckCircle2 } from 'lucide-react';

interface DashboardProps {
   applications: Application[];
   onNew: () => void;
   onView: (app: Application) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ applications, onNew, onView }) => {

   // Calculate Stats
   const totalApps = applications.length;
   const interviews = applications.filter(a => a.status === 'Interviewing').length;
   const avgMatch = totalApps > 0 ? Math.round(applications.reduce((acc, curr) => acc + curr.matchScore, 0) / totalApps) : 0;

   return (
      <div className="space-y-6">

         {/* Top Row Grid */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Card 1: Total Applications (Matches "Total Balance") */}
            <div className="bg-white dark:bg-vexo-card p-6 rounded-3xl shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                     <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Total Applications</p>
                     <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{totalApps}</h3>
                  </div>
                  <select className="bg-slate-100 dark:bg-[#2C2E3E] text-xs text-slate-600 dark:text-white px-3 py-1 rounded-lg border-none outline-none">
                     <option>Monthly</option>
                     <option>Weekly</option>
                  </select>
               </div>

               <div className="flex gap-4 mt-6 relative z-10">
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-[#5D5FEF]/20 flex items-center justify-center">
                           <Briefcase className="w-4 h-4 text-[#5D5FEF]" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Interviewing</span>
                     </div>
                     <div className="text-lg font-bold text-slate-900 dark:text-white">{interviews}</div>
                  </div>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-[#FACD68]/20 flex items-center justify-center">
                           <CheckCircle2 className="w-4 h-4 text-[#FACD68]" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Offers</span>
                     </div>
                     <div className="text-lg font-bold text-slate-900 dark:text-white">{applications.filter(a => a.status === 'Offer').length}</div>
                  </div>
               </div>

               {/* Abstract Bars Visual */}
               <div className="absolute bottom-6 right-6 flex items-end gap-2 opacity-50">
                  <div className="w-1.5 h-8 bg-vexo-sidebar rounded-full"></div>
                  <div className="w-1.5 h-12 bg-vexo-sidebar/50 rounded-full"></div>
                  <div className="w-1.5 h-6 bg-vexo-accent rounded-full"></div>
                  <div className="w-1.5 h-10 bg-vexo-sidebar rounded-full"></div>
                  <div className="w-1.5 h-4 bg-vexo-sidebar/30 rounded-full"></div>
               </div>
            </div>

            {/* Card 2: Quick Action (Matches "Withdraw") */}
            <div className="bg-white dark:bg-vexo-card p-6 rounded-3xl shadow-sm flex flex-col justify-between relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-vexo-sidebar/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
               <div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">New Opportunity?</p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white">Create Now</h3>
                  <p className="text-xs text-slate-500 mt-2">Tailor a new resume in seconds.</p>
               </div>

               <button
                  onClick={onNew}
                  className="mt-6 w-full py-3 bg-vexo-sidebar hover:bg-vexo-sidebarLight text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
               >
                  <Plus className="w-5 h-5" /> Start Application
               </button>
            </div>

            {/* Card 3: Recent Activity List (Matches "Recent Transactions") */}
            <div className="bg-white dark:bg-vexo-card p-6 rounded-3xl shadow-sm row-span-2">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                  <button className="text-xs text-vexo-sidebar font-bold hover:underline">See all</button>
               </div>

               <div className="space-y-6">
                  {applications.slice(0, 5).map(app => (
                     <div key={app.id} className="flex items-center justify-between group cursor-pointer" onClick={() => onView(app)}>
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#2C2E3E] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-white">
                              {(app.requirements?.company || 'U').charAt(0)}
                           </div>
                           <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-vexo-sidebar transition-colors">{app.requirements?.company || 'Unknown'}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{app.requirements?.title || 'Untitled'}</div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className={`font-bold text-sm ${app.matchScore > 80 ? 'text-vexo-success' : 'text-slate-900 dark:text-white'}`}>
                              {app.matchScore}%
                           </div>
                           <div className="text-xs text-slate-500">{new Date(app.createdAt).toLocaleDateString()}</div>
                        </div>
                     </div>
                  ))}
                  {applications.length === 0 && (
                     <div className="text-center text-slate-500 text-sm py-4">No activity yet.</div>
                  )}
               </div>
            </div>

            {/* Card 4: Stats Chart Visual (Matches "Recent Subscription" / "Revenue" area) */}
            <div className="lg:col-span-2 bg-white dark:bg-vexo-card p-6 rounded-3xl shadow-sm">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Performance Overview</h3>
                  <div className="flex gap-2">
                     <span className="w-2 h-2 rounded-full bg-vexo-sidebar mt-1"></span>
                     <span className="text-xs text-slate-500">Match Score</span>
                  </div>
               </div>

               {/* CSS Bar Chart Simulation */}
               <div className="h-48 flex items-end justify-between gap-2 px-2">
                  {[65, 40, 75, 50, 90, 85, 45, 70, 95, 60, 55, 80].map((h, i) => (
                     <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                        <div
                           className="w-full bg-slate-100 dark:bg-[#2C2E3E] rounded-t-lg relative overflow-hidden transition-all duration-300 group-hover:bg-[#2C2E3E] dark:group-hover:bg-[#36384B]"
                           style={{ height: '100%' }}
                        >
                           <div
                              className="absolute bottom-0 left-0 right-0 bg-vexo-sidebar rounded-t-lg opacity-80 group-hover:opacity-100 transition-all"
                              style={{ height: `${h}%` }}
                           ></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                           {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
                        </span>
                     </div>
                  ))}
               </div>
            </div>

         </div>
      </div>
   );
};
