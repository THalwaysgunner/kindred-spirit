
import React, { useState, useEffect } from 'react';
import { Application } from '../types';
import { GlassdoorService } from '../services/glassdoorService';
import { 
  Building2, 
  Star, 
  Briefcase, 
  ChevronLeft, 
  Loader2, 
  AlertCircle,
  Search,
  MapPin,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Award,
  ArrowRight,
  TrendingUp,
  UserCheck,
  ArrowUpRight,
  HelpCircle,
  Filter,
  DollarSign
} from 'lucide-react';

interface GetReadyProps {
  applications: Application[];
}

// --- Constants ---
const SALARY_CATEGORIES = [
  "ADMINISTRATIVE",
  "ARTS_AND_DESIGN",
  "BUSINESS",
  "CONSULTING",
  "CUSTOMER_SERVICES_AND_SUPPORT",
  "EDUCATION",
  "ENGINEERING",
  "FINANCE_AND_ACCOUNTING",
  "HEALTHCARE",
  "HUMAN_RESOURCES",
  "INFORMATION_TECHNOLOGY",
  "LEGAL",
  "MARKETING",
  "MEDIA_AND_COMMUNICATIONS",
  "MILITARY_AND_PROTECTIVE_SERVICES",
  "OPERATIONS",
  "OTHER",
  "PRODUCT_AND_PROJECT_MANAGEMENT",
  "RESEARCH_AND_SCIENCE",
  "RETAIL_AND_FOOD_SERVICES",
  "SALES",
  "SKILLED_LABOR_AND_MANUFACTURING",
  "TRANSPORTATION"
];

// --- Data Structures ---

interface InterviewReview {
  id: string;
  role: string;
  date: string;
  location: string;
  authorType: string; 
  offerStatus: 'Accepted Offer' | 'No Offer' | 'Declined Offer';
  experience: 'Positive' | 'Negative' | 'Neutral';
  difficulty: string;
  difficultyScore: number; // 1-5
  applicationProcess: string;
  questions: string[];
  helpfulCount: number;
}

interface SalaryData {
  title: string;
  avg: string;
  min: string;
  max: string;
  count: number;
  rangePercent: number; // 0-100 for visual bar
  currency: string;
}

interface SalaryEstimate {
  jobTitle: string;
  location: string;
  median: number;
  min: number;
  max: number;
  currency: string;
}

interface CompanyData {
  id: string; // Glassdoor ID
  rating: number;
  totalReviews: string;
  recommend: number; // Percentage
  ceoApproval: number; // Percentage
  awards: string[];
  description: string;
  reviews: any[]; // General reviews
  pros: string[];
  cons: string[];
  logo?: string;
}

interface InterviewStats {
  averageDifficulty: number; // 1-5
  experienceBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  totalCount: number;
  sources: { label: string; percent: number }[];
}

export const GetReady: React.FC<GetReadyProps> = ({ applications }) => {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'interviews' | 'salaries'>('overview');
  
  // Data State
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [interviews, setInterviews] = useState<InterviewReview[]>([]);
  const [salaries, setSalaries] = useState<SalaryData[]>([]);
  const [salaryEstimate, setSalaryEstimate] = useState<SalaryEstimate | null>(null);
  
  // Derived Stats
  const [interviewStats, setInterviewStats] = useState<InterviewStats | null>(null);

  // Loading/Error State
  const [loading, setLoading] = useState<boolean>(false);
  const [interviewsLoading, setInterviewsLoading] = useState<boolean>(false);
  const [salariesLoading, setSalariesLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search State
  const [interviewPage, setInterviewPage] = useState<number>(1);
  const [hasMoreInterviews, setHasMoreInterviews] = useState<boolean>(true);
  const [activeInterviewTerm, setActiveInterviewTerm] = useState<string>(''); // Tracks if we are searching Title vs Category vs All

  // --- FILTERS STATE ---
  const [selectedCategory, setSelectedCategory] = useState<string>('ENGINEERING');
  const [salaryLocationInput, setSalaryLocationInput] = useState<string>('');

  // --- 1. Initial Fetch ---
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedApp) return;

      setLoading(true);
      setError(null);
      setCompanyData(null);
      setInterviews([]);
      setSalaries([]);
      setSalaryEstimate(null);
      setInterviewPage(1);
      setHasMoreInterviews(true);

      try {
        // 1. Clean Company Name
        const rawCompanyName = selectedApp.requirements.company;
        const cleanCompanyName = rawCompanyName
          .replace(/,?\s*(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation)\.?$/i, '')
          .trim();

        // 2. Identify Context
        const jobTitle = selectedApp.requirements.title;
        const jobCategory = GlassdoorService.getJobCategory(jobTitle); 
        let jobLocation = selectedApp.requirements.location || 'United States';
        if (jobLocation.toLowerCase().includes('remote')) {
           jobLocation = 'United States'; 
        }

        // Initialize Filter States
        setSelectedCategory(jobCategory);
        setSalaryLocationInput(jobLocation);

        // A. Search for Company ID
        const searchResult = await GlassdoorService.searchCompany(cleanCompanyName);
        
        if (!searchResult || !searchResult.company_id) {
          setError(`Could not find company data for "${cleanCompanyName}"`);
          setLoading(false);
          return;
        }

        const companyId = searchResult.company_id.toString();

        // B. Fetch Parallel Data (Overview, Reviews, Estimate)
        const [overview, reviewsData, estimateData] = await Promise.all([
          GlassdoorService.getOverview(companyId),
          GlassdoorService.getReviews(companyId),
          GlassdoorService.getSalaryEstimate(jobTitle, jobLocation)
        ]);

        // C. Initial Salary Fetch (Using default category)
        const salariesData = await GlassdoorService.getSalaries(companyId, jobCategory, jobLocation);

        // D. SMART INTERVIEW FETCH (Fallback Logic)
        // 1. Try Specific Title
        let interviewsData = await GlassdoorService.getInterviews(companyId, 1, jobTitle, jobLocation);
        let finalTerm = jobTitle;

        // 2. If < 5 results, Try Category (e.g. Engineering)
        if (!interviewsData?.interviews || interviewsData.interviews.length < 5) {
           console.log("Low results for title, trying category:", jobCategory);
           if (jobCategory) {
               const catData = await GlassdoorService.getInterviews(companyId, 1, jobCategory, jobLocation);
               // If category gave us more results, switch to it
               if (catData?.interviews?.length > (interviewsData?.interviews?.length || 0)) {
                   interviewsData = catData;
                   finalTerm = jobCategory;
               }
           }
        }

        // 3. If STILL < 5 results, Try All Roles (Empty String)
        if (!interviewsData?.interviews || interviewsData.interviews.length < 5) {
            console.log("Low results for category, fetching all roles.");
            // We keep location to keep it relevant, but remove job title filter
            const allData = await GlassdoorService.getInterviews(companyId, 1, '', jobLocation);
            interviewsData = allData;
            finalTerm = ''; // Empty string means "All"
        }

        setActiveInterviewTerm(finalTerm);

        // E. Map Company
        const mappedCompany: CompanyData = {
          id: companyId,
          rating: overview?.rating || 0,
          totalReviews: overview?.review_count?.toLocaleString() || '0',
          recommend: Math.round((overview?.recommend_to_friend_rating || 0) * 100),
          ceoApproval: Math.round((overview?.ceo_rating || 0) * 100),
          awards: (overview?.best_places_to_work_awards || []).slice(0, 2).map((a: any) => `${a.rank} Best Place (${a.time_period})`),
          description: overview?.company_description || 'No description available.',
          reviews: reviewsData?.reviews || [],
          pros: [],
          cons: [],
          logo: overview?.logo || searchResult?.logo
        };
        setCompanyData(mappedCompany);

        // Map Interviews
        const mappedInterviews = mapInterviews(interviewsData?.interviews || []);
        setInterviews(mappedInterviews);
        calculateInterviewStats(mappedInterviews);
        
        // If we fetched a page and got < 10 items, probably no more pages
        if (!interviewsData?.interviews || interviewsData.interviews.length < 10) {
            setHasMoreInterviews(false);
        }

        // Map Salaries
        const mappedSalaries = mapSalaries(salariesData?.salaries || []);
        setSalaries(mappedSalaries);

        // Map Estimate
        if (estimateData && estimateData.median_salary) {
           setSalaryEstimate({
             jobTitle: jobTitle,
             location: jobLocation,
             median: estimateData.median_salary,
             min: estimateData.min_salary,
             max: estimateData.max_salary,
             currency: estimateData.currency || 'USD'
           });
        }

      } catch (err) {
        console.error("Failed to load Glassdoor data", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedApp]);

  // --- 2. Filter Salaries Handler ---
  const handleFilterSalaries = async () => {
     if (!companyData) return;
     setSalariesLoading(true);
     try {
        const data = await GlassdoorService.getSalaries(
           companyData.id, 
           selectedCategory, 
           salaryLocationInput
        );
        setSalaries(mapSalaries(data?.salaries || []));
     } catch (err) {
        console.error("Filter salaries failed", err);
     } finally {
        setSalariesLoading(false);
     }
  };

  // --- 3. Load More Interviews ---
  const loadMoreInterviews = async () => {
    if (!companyData || !hasMoreInterviews || interviewsLoading) return;
    
    setInterviewsLoading(true);
    const nextPage = interviewPage + 1;
    
    try {
       // Use the term that we decided on during initial fetch (Title vs Category vs All)
       const data = await GlassdoorService.getInterviews(
          companyData.id, 
          nextPage, 
          activeInterviewTerm, 
          selectedApp?.requirements.location || '' 
       );
       
       const newInterviews = mapInterviews(data?.interviews || []);
       
       if (newInterviews.length === 0) {
          setHasMoreInterviews(false);
       } else {
          const updatedList = [...interviews, ...newInterviews];
          setInterviews(updatedList);
          setInterviewPage(nextPage);
          calculateInterviewStats(updatedList);
       }

    } catch (err) {
       console.error("Failed to load more interviews", err);
    } finally {
       setInterviewsLoading(false);
    }
  };

  // --- Helper: Mappers & Calculations ---

  const mapInterviews = (rawList: any[]): InterviewReview[] => {
    return rawList.map((int: any) => {
        let outcome: any = 'No Offer';
        if (int.outcome === 'accept_offer') outcome = 'Accepted Offer';
        else if (int.outcome === 'decline_offer') outcome = 'Declined Offer';

        // Difficulty Mapping
        let difficulty = 'Average';
        let difficultyScore = 3;
        
        if (int.difficulty) {
           const d = int.difficulty.toLowerCase();
           if (d === 'very_difficult' || d === 'difficult') { difficulty = 'Difficult'; difficultyScore = 4; }
           if (d === 'very_difficult') difficultyScore = 5;
           if (d === 'average') { difficulty = 'Average'; difficultyScore = 3; }
           if (d === 'easy' || d === 'very_easy') { difficulty = 'Easy'; difficultyScore = 2; }
           if (d === 'very_easy') difficultyScore = 1;
        }

        let experience: any = 'Neutral';
        if (int.experience) {
           const expLower = int.experience.toLowerCase();
           if (expLower === 'positive') experience = 'Positive';
           else if (expLower === 'negative') experience = 'Negative';
        }

        // ----------------------------------------------------
        // FIX: Robust Question Extraction
        // API often returns questions as [ { questionText: "..." }, ... ]
        // We need to extract the string content safely.
        // ----------------------------------------------------
        const rawQuestions = int.questions || [];
        const cleanQuestions = rawQuestions.map((q: any) => {
             if (typeof q === 'string') return q;
             // Check common fields where the text might be hidden
             return q.questionText || q.question || q.text || '';
        }).filter((q: string) => q && q.length > 0);

        return {
          id: int.interview_id?.toString() || Math.random().toString(),
          role: int.job_title || 'Candidate',
          date: int.review_datetime ? new Date(int.review_datetime).toLocaleDateString() : 'Recent',
          location: int.location || 'Unknown',
          authorType: int.is_current_employee ? 'Current Employee' : 'Candidate',
          offerStatus: outcome,
          experience: experience,
          difficulty: difficulty,
          difficultyScore: difficultyScore,
          applicationProcess: int.process_description || 'No description provided.',
          questions: cleanQuestions,
          helpfulCount: int.helpful_count || 0
        };
     });
  };

  const mapSalaries = (rawList: any[]): SalaryData[] => {
      // API returns multiple pages, we might have duplicates if ID exists, but we'll list all for volume
      return rawList.map((sal: any) => {
           const min = sal.min_total_pay || sal.min_salary || 0;
           const max = sal.max_total_pay || sal.max_salary || 0;
           const med = sal.median_total_pay || sal.median_salary || 0;
           
           const rangePercent = max > 0 ? Math.min(((med - min) / (max - min)) * 100, 100) : 50;

           return {
             title: sal.job_title,
             avg: `$${Math.round(med).toLocaleString()}`,
             min: `$${Math.round(min / 1000)}k`,
             max: `$${Math.round(max / 1000)}k`,
             count: sal.salary_count,
             rangePercent: isNaN(rangePercent) ? 50 : rangePercent,
             currency: sal.salary_currency || 'USD'
           };
      });
  };

  const calculateInterviewStats = (items: InterviewReview[]) => {
     if (items.length === 0) {
        setInterviewStats(null);
        return;
     }

     const total = items.length;
     const avgDiff = items.reduce((acc, curr) => acc + curr.difficultyScore, 0) / total;
     
     const positive = items.filter(i => i.experience === 'Positive').length;
     const negative = items.filter(i => i.experience === 'Negative').length;
     const neutral = items.filter(i => i.experience === 'Neutral').length;

     let online = 0, recruiter = 0, referral = 0, agency = 0;
     items.forEach(i => {
        const text = i.applicationProcess.toLowerCase();
        if (text.includes('online') || text.includes('applied')) online++;
        else if (text.includes('recruiter') || text.includes('reached out') || text.includes('linkedin')) recruiter++;
        else if (text.includes('referral') || text.includes('friend')) referral++;
        else if (text.includes('agency') || text.includes('staffing')) agency++;
        else online++; 
     });

     const sourceTotal = total; 

     setInterviewStats({
        averageDifficulty: parseFloat(avgDiff.toFixed(1)),
        experienceBreakdown: {
           positive: Math.round((positive / total) * 100),
           negative: Math.round((negative / total) * 100),
           neutral: Math.round((neutral / total) * 100)
        },
        totalCount: total,
        sources: [
           { label: 'Applied online', percent: Math.round((online/sourceTotal)*100) },
           { label: 'Recruiter', percent: Math.round((recruiter/sourceTotal)*100) },
           { label: 'Employee Referral', percent: Math.round((referral/sourceTotal)*100) },
           { label: 'Staffing Agency', percent: Math.round((agency/sourceTotal)*100) },
        ].sort((a,b) => b.percent - a.percent)
     });
  };


  // --- View: Selection ---
  if (!selectedApp) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Company Research</h1>
          <p className="text-slate-500 dark:text-slate-400">Select a company from your applications to unlock interview insights, salaries, and reviews.</p>
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-vexo-card rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
             <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
             <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Applications Found</h3>
             <p className="text-slate-500">Apply to jobs to start seeing insights here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map(app => (
              <div 
                key={app.id}
                onClick={() => {
                  setSelectedApp(app);
                  setActiveTab('overview');
                }}
                className="bg-white dark:bg-vexo-card rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-[#0CAA41] transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                   <ArrowUpRight className="w-5 h-5 text-[#0CAA41]" />
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 overflow-hidden">
                    {app.requirements.company.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-[#0CAA41] transition-colors">{app.requirements.company}</h3>
                    <p className="text-sm text-slate-500">{app.requirements.location || 'Headquarters'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Role</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]" title={app.requirements.title}>{app.requirements.title}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Status</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                        app.status === 'Offer' ? 'bg-green-100 text-green-700' : 
                        app.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {app.status}
                      </span>
                   </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-[#0CAA41] font-bold text-sm">
                   <Briefcase className="w-4 h-4" />
                   View Insights
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- View: Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
         <Loader2 className="w-12 h-12 text-[#0CAA41] animate-spin mb-4" />
         <h3 className="text-xl font-bold text-slate-900 dark:text-white">Analyzing Company Data</h3>
         <p className="text-slate-500">Fetching live insights for {selectedApp.requirements.title} at {selectedApp.requirements.company}...</p>
      </div>
    );
  }

  // --- View: Error State ---
  if (error || !companyData) {
    return (
       <div className="max-w-5xl mx-auto">
         <button 
           onClick={() => setSelectedApp(null)}
           className="flex items-center gap-2 text-slate-500 mb-6"
         >
           <ChevronLeft className="w-4 h-4" /> Back
         </button>
         <div className="flex flex-col items-center justify-center h-[40vh] bg-white dark:bg-vexo-card rounded-3xl border border-slate-200 dark:border-slate-700 p-8 text-center">
           <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
           <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Data Not Found</h3>
           <p className="text-slate-500 mb-6">{error || "We couldn't retrieve information for this company."}</p>
           <button 
              onClick={() => setSelectedApp(null)}
              className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-lg"
           >
              Try Another Company
           </button>
         </div>
       </div>
    );
  }

  // --- View: Company Detail ---
  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      {/* Navigation Back */}
      <button 
        onClick={() => setSelectedApp(null)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 font-medium transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Company List
      </button>

      {/* 1. Header Card */}
      <div className="bg-white dark:bg-vexo-card rounded-t-3xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6 shadow-sm">
         <div className="h-40 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 relative">
            <div className="absolute -bottom-8 left-8 w-24 h-24 bg-white dark:bg-slate-800 rounded-lg shadow-md border-4 border-white dark:border-vexo-card flex items-center justify-center overflow-hidden">
               {companyData.logo ? (
                 <img src={companyData.logo} alt="Logo" className="w-full h-full object-contain p-2" />
               ) : (
                 <span className="text-4xl font-bold text-slate-800 dark:text-white">{selectedApp.requirements.company.charAt(0)}</span>
               )}
            </div>
         </div>
         
         <div className="pt-12 px-8 pb-6">
            <div className="flex justify-between items-start">
               <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{selectedApp.requirements.company}</h1>
                  <p className="text-sm text-slate-500 mb-4 font-medium flex items-center gap-2">
                     <Briefcase className="w-4 h-4" /> Looking for: <span className="text-slate-900 dark:text-white">{selectedCategory}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                     {companyData.awards.map((award, i) => (
                        <span key={i} className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded text-xs font-bold border border-yellow-100 dark:border-yellow-900/30">
                           <Award className="w-3 h-3" /> {award}
                        </span>
                     ))}
                  </div>
               </div>
               <div className="flex gap-3">
                  <button className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-bold hover:opacity-80 transition-opacity text-sm">
                    Follow
                  </button>
               </div>
            </div>

            <div className="flex gap-8 border-b border-slate-200 dark:border-slate-700 mt-6 overflow-x-auto">
               {['overview', 'interviews', 'salaries', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`pb-3 text-sm font-bold capitalize transition-colors relative whitespace-nowrap ${
                       activeTab === tab 
                       ? 'text-slate-900 dark:text-white border-b-2 border-[#0CAA41]' 
                       : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
               ))}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Main Content */}
         <div className="lg:col-span-2 space-y-6">

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                 <div className="bg-[#E6FDF0] dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Is {selectedApp.requirements.company} a good fit?</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                       Based on your application for <strong>{selectedApp.requirements.title}</strong> in {selectedApp.requirements.location || 'US'}.
                    </p>
                 </div>

                 <div className="bg-white dark:bg-vexo-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Company Snapshot</h3>
                    
                    <div className="flex items-center gap-4 mb-6">
                       <span className="text-5xl font-bold text-slate-900 dark:text-white">{companyData.rating}</span>
                       <div>
                          <div className="flex text-[#0CAA41] mb-1">
                             {[1,2,3,4,5].map(i => (
                               <Star 
                                 key={i} 
                                 className={`w-5 h-5 ${i <= Math.round(companyData.rating) ? 'fill-[#0CAA41] text-[#0CAA41]' : 'fill-slate-200 text-slate-200'}`} 
                               />
                             ))}
                          </div>
                          <span className="text-sm text-slate-500">{companyData.totalReviews} Reviews</span>
                       </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                       <h4 className="font-bold text-slate-900 dark:text-white mb-2">About</h4>
                       <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {companyData.description}
                       </p>
                    </div>
                 </div>
              </>
            )}

            {/* TAB: INTERVIEWS */}
            {activeTab === 'interviews' && (
               <>
                 {/* Interview Header Stats */}
                 {interviewStats ? (
                   <div className="bg-white dark:bg-vexo-card border border-slate-200 dark:border-slate-700 p-6 rounded-2xl mb-6 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {selectedApp.requirements.company} interview questions
                         </h3>
                         <span className="text-xs text-slate-400">Updated recently</span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-12 mb-8">
                         <div>
                            <div className="flex items-baseline gap-2 mb-1">
                               <span className="text-4xl font-bold text-slate-900 dark:text-white">{interviewStats.averageDifficulty}</span>
                               <span className="text-lg font-medium text-slate-500">/ 5 difficulty</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-slate-500">
                               <HelpCircle className="w-3 h-3" />
                               <span>Average interview difficulty</span>
                            </div>
                         </div>

                         <div className="flex-1">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Interview experience</h4>
                            <div className="flex h-8 w-full mb-2">
                               {interviewStats.experienceBreakdown.positive > 0 && (
                                 <div style={{ width: `${interviewStats.experienceBreakdown.positive}%` }} className="bg-[#00A65F] first:rounded-l-sm"></div>
                               )}
                               {interviewStats.experienceBreakdown.neutral > 0 && (
                                 <div style={{ width: `${interviewStats.experienceBreakdown.neutral}%` }} className="bg-[#6C757D]"></div>
                               )}
                               {interviewStats.experienceBreakdown.negative > 0 && (
                                 <div style={{ width: `${interviewStats.experienceBreakdown.negative}%` }} className="bg-[#DE1C24] last:rounded-r-sm"></div>
                               )}
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                               <span className="text-[#00A65F]">{interviewStats.experienceBreakdown.positive}% Positive</span>
                               <span className="text-[#DE1C24]">{interviewStats.experienceBreakdown.negative}% Negative</span>
                            </div>
                         </div>
                      </div>

                      <div>
                         <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">How others got an interview</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                            {interviewStats.sources.map((source, idx) => (
                               <div key={idx} className="flex items-center gap-3 text-sm">
                                  <span className="w-8 font-bold text-slate-900 dark:text-white text-right">{source.percent}%</span>
                                  <span className="w-32 text-slate-600 dark:text-slate-400 truncate">{source.label}</span>
                                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                     <div className="h-full bg-slate-600 dark:bg-slate-400" style={{ width: `${source.percent}%` }}></div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                 ) : (
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-center text-sm text-slate-500 mb-6">
                       Not enough data to calculate stats for this specific role.
                    </div>
                 )}

                 {/* Interview List */}
                 <div className="space-y-4">
                    {interviews.map((review) => (
                       <div key={review.id} className="bg-white dark:bg-vexo-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{review.role}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                   <span>{review.date}</span>
                                </div>
                             </div>
                          </div>

                          <div className="flex flex-wrap gap-4 mb-6">
                             {review.offerStatus === 'Accepted Offer' && (
                               <div className="flex items-center gap-1.5 text-sm font-bold text-[#00A65F]">
                                  <CheckCircle2 className="w-4 h-4" /> Accepted Offer
                               </div>
                             )}
                             {review.offerStatus === 'No Offer' && (
                               <div className="flex items-center gap-1.5 text-sm font-bold text-slate-500">
                                  <XCircle className="w-4 h-4" /> No Offer
                               </div>
                             )}
                             <div className="flex items-center gap-1.5 text-sm font-bold">
                                <span className={review.experience === 'Positive' ? 'text-[#00A65F]' : review.experience === 'Negative' ? 'text-[#DE1C24]' : 'text-yellow-600'}>
                                   {review.experience} Experience
                                </span>
                             </div>
                             <div className="flex items-center gap-1.5 text-sm font-bold">
                                <span className="text-slate-500">{review.difficulty} Interview</span>
                             </div>
                          </div>

                          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                             {review.applicationProcess && (
                               <div>
                                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Process</span>
                                  <p>{review.applicationProcess}</p>
                                </div>
                             )}
                             {review.questions.length > 0 && (
                                <div className="mt-4">
                                   <span className="font-bold text-slate-900 dark:text-white block mb-2">Interview Questions</span>
                                   <ul className="space-y-3">
                                      {review.questions.map((q, idx) => (
                                         <li key={idx} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border-l-4 border-[#0CAA41]">
                                            <p className="text-slate-800 dark:text-slate-200 font-medium">{q}</p>
                                            <div className="mt-2 text-xs text-slate-500 font-bold uppercase tracking-wide cursor-pointer hover:underline">Answer Question</div>
                                         </li>
                                      ))}
                                   </ul>
                                </div>
                             )}
                          </div>
                       </div>
                    ))}

                    {hasMoreInterviews && (
                       <button 
                          onClick={loadMoreInterviews}
                          disabled={interviewsLoading}
                          className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                       >
                          {interviewsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load More Interviews'}
                       </button>
                    )}
                 </div>
               </>
            )}

            {/* TAB: SALARIES (Redesigned with Filter Bar & Estimation) */}
            {activeTab === 'salaries' && (
               <>
                 {/* 1. Salary Estimation Card */}
                 {salaryEstimate ? (
                    <div className="bg-white dark:bg-vexo-card border border-slate-200 dark:border-slate-700 p-6 rounded-2xl mb-6 shadow-sm">
                       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                          <div>
                             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Estimated Market Value</h3>
                             <p className="text-sm text-slate-500">For {salaryEstimate.jobTitle} in {salaryEstimate.location}</p>
                          </div>
                          <div className="mt-2 md:mt-0 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold rounded-lg text-sm border border-green-100 dark:border-green-900/30">
                             High Confidence
                          </div>
                       </div>

                       <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-6 rounded-xl">
                          <div className="text-center flex-1 border-r border-slate-200 dark:border-slate-700">
                             <div className="text-xs text-slate-500 font-bold uppercase mb-1">Min</div>
                             <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
                                ${Math.round(salaryEstimate.min / 1000)}k
                             </div>
                          </div>
                          <div className="text-center flex-1">
                             <div className="text-xs text-green-600 font-bold uppercase mb-1">Median</div>
                             <div className="text-4xl font-bold text-slate-900 dark:text-white">
                                ${Math.round(salaryEstimate.median / 1000)}k
                             </div>
                          </div>
                          <div className="text-center flex-1 border-l border-slate-200 dark:border-slate-700">
                             <div className="text-xs text-slate-500 font-bold uppercase mb-1">Max</div>
                             <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
                                ${Math.round(salaryEstimate.max / 1000)}k
                             </div>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl text-center text-sm text-blue-800 dark:text-blue-300 mb-6">
                       Could not generate a specific estimate for {selectedApp.requirements.title}. Please check general salaries below.
                    </div>
                 )}

                 {/* 2. Filter Bar */}
                 <div className="bg-white dark:bg-vexo-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                       <div className="flex-1 w-full">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Job Category</label>
                          <div className="relative">
                             <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                             <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0CAA41] appearance-none"
                             >
                                <option value="ALL">All Categories</option>
                                {SALARY_CATEGORIES.map(cat => (
                                   <option key={cat} value={cat}>
                                      {cat.replace(/_/g, ' ').replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))}
                                   </option>
                                ))}
                             </select>
                          </div>
                       </div>
                       
                       <div className="flex-1 w-full">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location</label>
                          <div className="relative">
                             <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                             <input 
                                type="text" 
                                value={salaryLocationInput}
                                onChange={(e) => setSalaryLocationInput(e.target.value)}
                                placeholder="City or Country"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0CAA41]"
                             />
                          </div>
                       </div>

                       <button 
                          onClick={handleFilterSalaries}
                          disabled={salariesLoading}
                          className="w-full md:w-auto px-6 py-3 bg-[#0CAA41] hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                       >
                          {salariesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Filter Salaries'}
                       </button>
                    </div>
                 </div>

                 {/* 3. Salaries List */}
                 <div className="bg-white dark:bg-vexo-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         Salary Reports
                         <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-full font-normal">
                            {salaries.length} reports
                         </span>
                      </h3>
                    </div>

                    <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-700">
                       {salaries.length === 0 ? (
                          <div className="text-center py-10 text-slate-500">
                             No salaries found for this category/location. Try broadening your filters.
                          </div>
                       ) : (
                          salaries.map((salary, i) => (
                             <div key={i} className="group py-6 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-6 px-6 transition-colors cursor-pointer">
                                <div>
                                   <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 group-hover:underline decoration-slate-900">
                                     {salary.title}
                                   </h4>
                                   <span className="text-xs text-slate-500 font-medium">{salary.count} Salaries submitted</span>
                                </div>
                                <div className="text-right">
                                   <div className="font-bold text-lg text-slate-900 dark:text-white">
                                      {salary.min} - {salary.max} <span className="text-sm font-normal text-slate-500">/ yr</span>
                                   </div>
                                   <div className="mt-2 w-32 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full ml-auto overflow-hidden">
                                      <div 
                                         className="h-full bg-slate-800 dark:bg-slate-400 rounded-full"
                                         style={{ marginLeft: '20%', width: '60%' }} // Visual placeholder for distribution
                                      ></div>
                                   </div>
                                </div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
               </>
            )}

            {/* TAB: REVIEWS (General Company Reviews) */}
            {activeTab === 'reviews' && (
               <div className="space-y-4">
                  {companyData.reviews.length === 0 ? (
                     <div className="text-center py-10 text-slate-500">No reviews found.</div>
                  ) : (
                     companyData.reviews.map((rev: any, i: number) => (
                        <div key={i} className="bg-white dark:bg-vexo-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                           <div className="flex justify-between mb-2">
                              <h4 className="font-bold text-lg text-slate-900 dark:text-white">"{rev.summary}"</h4>
                              <span className="text-xs text-slate-400">{new Date(rev.review_datetime).toLocaleDateString()}</span>
                           </div>
                           <div className="flex items-center gap-2 mb-4">
                              <div className="flex text-[#0CAA41]">
                                 {[1,2,3,4,5].map(star => (
                                    <Star key={star} className={`w-4 h-4 ${star <= rev.rating ? 'fill-current' : 'text-slate-200'}`} />
                                 ))}
                              </div>
                              <span className="text-sm text-slate-500">Current Employee - {rev.job_title}</span>
                           </div>
                           
                           <div className="space-y-3">
                              <div>
                                 <span className="text-xs font-bold text-green-600 uppercase">Pros</span>
                                 <p className="text-sm text-slate-600 dark:text-slate-300">{rev.pros}</p>
                              </div>
                              <div>
                                 <span className="text-xs font-bold text-red-600 uppercase">Cons</span>
                                 <p className="text-sm text-slate-600 dark:text-slate-300">{rev.cons}</p>
                              </div>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            )}

         </div>

         {/* Sidebar Stats */}
         <div className="space-y-6">
            <div className="bg-white dark:bg-vexo-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <h3 className="font-bold text-slate-900 dark:text-white mb-4">Company Ratings</h3>
               <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                     <span className="block text-2xl font-bold text-slate-900 dark:text-white">{companyData.recommend}%</span>
                     <span className="text-xs text-slate-500">Recommend</span>
                  </div>
                  <div className="flex-1 text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                     <span className="block text-2xl font-bold text-slate-900 dark:text-white">{companyData.ceoApproval}%</span>
                     <span className="text-xs text-slate-500">CEO Approval</span>
                  </div>
               </div>
               <button className="w-full py-2.5 text-sm font-bold text-[#0CAA41] border border-[#0CAA41] rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  Prepare for Interview
               </button>
            </div>
         </div>

      </div>
    </div>
  );
};
