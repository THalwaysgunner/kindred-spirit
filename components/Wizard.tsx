import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { UserProfile, JobRequirements, Application, GeneratedResume, JobSearchResult, StructuredDescription, DescriptionBlock } from '../types';
import { GeminiService } from '../services/geminiService';
import { ApifyService } from '../services/apifyService';
import { supabase } from '../services/supabaseClient';
import { Loader2, Briefcase, FileText, CheckCircle, ArrowRight, Wand2, AlertCircle, MapPin, Calendar, Globe, Pencil, Save, X, Upload, File as FileIcon, Trash2, Monitor, Link as LinkIcon, Hash, Linkedin, SquarePen, ClipboardCopy, Copy, Link2, ExternalLink } from 'lucide-react';
import { CVPreview, ResumePaper } from './CVPreview';
import { useCallback } from 'react';
import { TiptapEditor } from './TiptapEditor';

const AutoResizeTextarea = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      // Reset height to auto to correctly calculate shrink
      textareaRef.current.style.height = 'auto';
      // Set to scrollHeight
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useLayoutEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    // Initial adjustment on mount + fallback for layout shifts
    adjustHeight();
    const timer = setTimeout(adjustHeight, 100);
    return () => clearTimeout(timer);
  }, [adjustHeight]);

  return (
    <div className="mb-6">
      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">{label}</label>
      <textarea
        ref={textareaRef}
        className="w-full p-4 resize-none overflow-hidden bg-transparent border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 text-slate-900 text-sm leading-relaxed placeholder-slate-400 outline-none transition-all min-h-[300px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
      />
    </div>
  );
};

interface WizardProps {
  userProfile: UserProfile;
  onComplete: (app: Application) => void;
  onCancel: () => void;
  initialJob?: JobSearchResult | null;
  initialFile?: File | null;
}

const formatStructuredDescription = (structured: StructuredDescription): string => {
  const sections = [
    { label: 'Description', data: structured.description },
    { label: 'About the Role', data: structured.about_the_role },
    { label: 'Responsibilities', data: structured.responsibilities },
    { label: 'Requirements', data: structured.requirements },
    { label: 'Nice to Have', data: structured.nice_to_have },
    { label: 'Benefits', data: structured.benefits }
  ];

  const formattedContent = sections
    .filter(section => section.data && section.data.length > 0)
    .map(section => {
      const content = section.data.map(block => {
        if (block.type === 'paragraph') {
          let text = block.text;
          // New line after period, question mark, or colon followed by space
          text = text
            .replace(/\. /g, '.<br>')
            .replace(/\? /g, '?<br>')
            .replace(/: /g, ':<br>');

          return `<p>${text}</p>`;
        } else {
          // List items
          const items = block.items.map(item => `<li>${item}</li>`).join('');
          return `<ul>${items}</ul>`;
        }
      }).join('');

      return `<p><strong>${section.label}</strong></p>${content}`;
    })
    .join('<p><br></p>'); // Explicit single line gap between sections

  // Add 2 new lines at the bottom (reduced from 4)
  return formattedContent;
};


export const Wizard: React.FC<WizardProps> = ({ userProfile, onComplete, onCancel, initialJob, initialFile }) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [inputType, setInputType] = useState<'url' | 'id'>('url');
  const [jobInput, setJobInput] = useState(''); // Unified input for URL or ID
  const [jobText, setJobText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data States
  const [jobRequirements, setJobRequirements] = useState<JobRequirements | null>(null);
  // We use this state to allow the user to edit the extracted data in Step 2
  const [editedRequirements, setEditedRequirements] = useState<JobRequirements | null>(null);
  const [structuredDescription, setStructuredDescription] = useState<StructuredDescription | null>(null);

  const [generatedResume, setGeneratedResume] = useState<GeneratedResume | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [isApifySource, setIsApifySource] = useState(false);
  const [isEditingGeneratedResume, setIsEditingGeneratedResume] = useState(false);
  const [resumeBackup, setResumeBackup] = useState<GeneratedResume | null>(null);
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [showInputModal, setShowInputModal] = useState(false);
  const [linkedInTab, setLinkedInTab] = useState<'url' | 'id'>('url');
  const [modalInputValue, setModalInputValue] = useState('');
  const [isManualEntry, setIsManualEntry] = useState(false);

  // Consolidate formatted text once Step 2 is reached
  useEffect(() => {
    if (step === 2 && editedRequirements && !editedRequirements.description?.includes('**')) {
      const consolidated = {
        description: formattedDescription,
        about_the_role: formattedAboutTheRole,
        responsibilities: formattedResponsibilities,
        requirements: formattedRequirements,
        nice_to_have: formattedNiceToHave,
        benefits: formattedBenefits
      };

      setEditedRequirements(prev => prev ? ({
        ...prev,
        ...consolidated
      }) : null);
    }
  }, [step]);

  const formattedDescription = useMemo(() => {
    if (!structuredDescription) return editedRequirements?.description || '';
    return (structuredDescription.description || []).map(b => b.type === 'paragraph' ? b.text : b.items.map(i => `• ${i}`).join('\n')).join('\n\n');
  }, [structuredDescription, editedRequirements?.description]);

  const formattedAboutTheRole = useMemo(() => {
    if (!structuredDescription) return editedRequirements?.about_the_role || '';
    return (structuredDescription.about_the_role || []).map(b => b.type === 'paragraph' ? b.text : b.items.map(i => `• ${i}`).join('\n')).join('\n\n');
  }, [structuredDescription, editedRequirements?.about_the_role]);

  const formattedResponsibilities = useMemo(() => {
    if (!structuredDescription) return editedRequirements?.responsibilities || '';
    return (structuredDescription.responsibilities || []).map(b => b.type === 'paragraph' ? b.text : b.items.map(i => `• ${i}`).join('\n')).join('\n\n');
  }, [structuredDescription, editedRequirements?.responsibilities]);

  const formattedRequirements = useMemo(() => {
    if (!structuredDescription) return editedRequirements?.requirements || '';
    return (structuredDescription.requirements || []).map(b => b.type === 'paragraph' ? b.text : b.items.map(i => `• ${i}`).join('\n')).join('\n\n');
  }, [structuredDescription, editedRequirements?.requirements]);

  const formattedNiceToHave = useMemo(() => {
    if (!structuredDescription) return editedRequirements?.nice_to_have || '';
    return (structuredDescription.nice_to_have || []).map(b => b.type === 'paragraph' ? b.text : b.items.map(i => `• ${i}`).join('\n')).join('\n\n');
  }, [structuredDescription, editedRequirements?.nice_to_have]);

  const formattedBenefits = useMemo(() => {
    if (!structuredDescription) return editedRequirements?.benefits || '';
    return (structuredDescription.benefits || []).map(b => b.type === 'paragraph' ? b.text : b.items.map(i => `• ${i}`).join('\n')).join('\n\n');
  }, [structuredDescription, editedRequirements?.benefits]);

  // --- Auto-Run Logic for "Create CV" from Search ---
  useEffect(() => {
    const runFastTrack = async () => {
      if (!initialJob) return;

      setLoading(true);
      setError(null);
      setLoadingMessage('Processing Job Data & Generating Resume...');

      try {
        // 1. Analyze Raw Data (Normalize to JobRequirements)
        // We use the same 'analyzeRawData' from Gemini service which is designed for this
        const requirements = await GeminiService.analyzeRawData(initialJob);
        setJobRequirements(requirements);
        setEditedRequirements(requirements);
        setIsApifySource(true); // Technically from Apify search

        // 2. Generate Resume immediately
        setLoadingMessage('Tailoring your CV...');
        const resumeResult = await GeminiService.generateTailoredResume(userProfile, requirements);

        setGeneratedResume(resumeResult);
        setMatchScore(resumeResult.matchScore);

        // 3. Skip to Result Step
        setStep(3);
      } catch (err: any) {
        console.error("Fast track error:", err);
        setError("Failed to auto-generate CV. Please try manual entry.");
        setStep(1); // Fallback to step 1 on failure
      } finally {
        setLoading(false);
      }
    };

    if (initialJob) {
      runFastTrack();
    }
  }, [initialJob, userProfile]);



  // Helper to handle edits in Step 2
  const handleEditChange = (field: keyof JobRequirements, value: any) => {
    if (!editedRequirements) return;
    setEditedRequirements({
      ...editedRequirements,
      [field]: value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Clear other inputs to show priority
      setJobInput('');
      setJobText('');
    }
  };

  const handleScreenshot = async () => {
    // 0. Clear other inputs so the user knows this is the active choice
    setJobInput('');
    setJobText('');
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("Screen capture is not supported in this browser.");
      return;
    }

    try {
      // 1. Ask user to select screen/window
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      // 2. Create hidden video to play stream
      // IMPORTANT: Attach to DOM to ensure frames are decoded
      const video = document.createElement('video');
      video.style.position = 'absolute';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      document.body.appendChild(video);

      video.srcObject = stream;
      await video.play();

      // Wait for video dimensions to be ready
      await new Promise((resolve) => {
        if (video.readyState >= 1) resolve(true);
        video.onloadedmetadata = () => resolve(true);
      });

      // Small delay to ensure the frame is fully rendered/not black
      await new Promise(r => setTimeout(r, 800));

      // 3. Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 5. Convert to file and set state
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
            setSelectedFile(file);
          }
        }, 'image/png');
      }

      // 4. Cleanup
      document.body.removeChild(video);
      stream.getTracks().forEach(track => track.stop());

    } catch (err: any) {
      console.error("Screenshot error:", err);

      // Check for specific permission policy error or user denial
      if (err.name === 'NotAllowedError') {
        // User clicked "Cancel" in the browser dialog.
        return;
      }

      if (err.message?.includes('permissions policy') || err.message?.includes('display-capture')) {
        setError("Screen capture is disabled in this environment. Please upload an image or PDF instead.");
      } else {
        setError("Failed to capture screen. Please try again or upload a file.");
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // remove data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyzeJob = useCallback(async () => {
    if (!jobText && !jobInput && !selectedFile) return;
    setLoading(true);
    setError(null);
    setLoadingMessage('Analyzing job requirements...');

    try {
      let result: JobRequirements;
      setIsApifySource(false);

      if (selectedFile) {
        // --- 1. File Upload Handler ---
        setLoadingMessage(`Processing ${selectedFile.name}...`);

        if (selectedFile.type === 'text/plain') {
          // Read text file directly
          const text = await selectedFile.text();
          result = await GeminiService.analyzeJob(text);
        } else {
          // PDF or Image
          const base64 = await fileToBase64(selectedFile);
          result = await GeminiService.analyzeJobFile(base64, selectedFile.type);
        }

      } else if (jobInput) {
        // --- 2. URL/ID Handler (Apify / Search) ---
        // If the user selected "Job ID", we force Apify with ID actor.
        // If "URL", we use Apify Crawler.

        const isLinkedIn = jobInput.toLowerCase().includes('linkedin.com') || inputType === 'id';
        const isLinkedInUrl = jobInput.toLowerCase().includes('linkedin.com');

        if (isLinkedIn) {
          let finalJobInput = jobInput.trim();
          let finalInputType = inputType;

          // Behind the scenes: If it's a LinkedIn URL, extract the ID and use the ID API
          if (isLinkedInUrl) {
            // Robust regex for various LinkedIn URL formats
            const idMatch =
              finalJobInput.match(/currentJobId=(\d+)/) ||
              finalJobInput.match(/\/view\/(\d+)/) ||
              finalJobInput.match(/-(\d+)(?:\/|\?|$)/); // Matches IDs at the end of slugified URLs

            if (idMatch) {
              finalJobInput = idMatch[1];
              finalInputType = 'id';
              console.log(`[Wizard] Extracted LinkedIn ID ${finalJobInput} from URL.`);
            }
          }

          setLoadingMessage(finalInputType === 'id' ? 'Fetching Detailed LinkedIn Job Data...' : 'Crawling Job URL...');
          let rawData = null;
          try {
            rawData = await ApifyService.fetchJobDetails(finalJobInput, finalInputType);
          } catch (apifyErr) {
            console.warn("Apify failed:", apifyErr);
          }

          if (!rawData) {
            console.warn("Apify returned no data, falling back to standard search.");
            setLoadingMessage('Refining analysis with Google Search...');
            result = await GeminiService.analyzeJob(jobText, jobInput);
          } else {
            // DIRECT MAPPING - NO AI
            // Handle both array (Apify search) and single object (Job ID fetch)
            const data = Array.isArray(rawData) ? rawData[0] : rawData;

            if (data && data.job_info) {
              setIsApifySource(true);
              result = {
                title: data.job_info.title || '',
                company: data.company_info?.name || '',
                description: data.job_info.description || '',
                location: data.job_info.location || '',
                employmentStatus: data.job_info.employment_status || '',
                listedAt: data.job_info.listed_at || '',
                jobUrl: data.job_info.job_url || '',
                experienceLevel: data.job_info.experience_level || '',
                industries: data.company_info?.industries || [],
                headquarters: {
                  country: data.company_info?.headquarters?.country || '',
                  city: data.company_info?.headquarters?.city || '',
                  line1: data.company_info?.headquarters?.line1 || ''
                },
                logoUrl: data.company_info?.logo_url || ''
              };
              console.log("[Wizard] Direct LinkedIn Mapping Success:", result);
            } else {
              setIsApifySource(true);
              setLoadingMessage('Extracting insights from scraped data...');
              result = await GeminiService.analyzeRawData(rawData);
            }
          }
        } else {
          // Standard URL (not LinkedIn specific optimization)
          result = await GeminiService.analyzeJob(jobText, jobInput);
        }

      } else {
        // --- 3. Text Handler ---
        result = await GeminiService.analyzeJob(jobText);
      }

      // --- 4. NEW: Structuring Agent ---
      if (result.description) {
        setLoadingMessage('Structuring job description...');
        try {
          console.log("[Wizard] Before Structuring - Raw Description Length:", result.description.length);
          const structuredData = await GeminiService.structureJobDescription(result.description);
          console.log("[Wizard] Structured JSON Output:", JSON.stringify(structuredData, null, 2));
          setStructuredDescription(structuredData);
          // Also update the plain text version for database consistency if needed
          result.description = formatStructuredDescription(structuredData);
        } catch (structErr) {
          console.error("[Wizard] Structuring Agent Failed:", structErr);
          setStructuredDescription(null);
        }
      }

      setJobRequirements(result);
      setEditedRequirements(result); // Initialize edit form with result
      setStep(2);
    } catch (e: any) {
      console.error(e);
      setError("We couldn't extract the job details automatically. Please check your input or try pasting the text manually.");
    } finally {
      setLoading(false);
    }
  }, [jobText, jobInput, selectedFile, inputType, structuredDescription]);

  // --- Auto-Run Logic for "Imported File" ---
  useEffect(() => {
    if (initialFile && !jobRequirements) {
      handleAnalyzeJob();
    }
  }, [initialFile, handleAnalyzeJob]);

  const handleGenerateResume = async () => {
    if (!editedRequirements) return;
    executeGeneration();
  };

  const executeGeneration = async () => {
    if (!editedRequirements) return;
    setLoading(true);
    setLoadingMessage('Tailoring your resume...');

    try {
      // 1. Format LinkedIn URL if needed
      let finalJobUrl = editedRequirements.jobUrl || '';
      if (inputType === 'id' && jobInput && !finalJobUrl.includes('linkedin.com')) {
        finalJobUrl = `https://www.linkedin.com/jobs/view/${jobInput}`;
      }

      // 2. Prepare clean PDF-style text for AI
      const cleanJobSummary = `
JOB TITLE: ${editedRequirements.title}
COMPANY: ${editedRequirements.company}
LOCATION: ${editedRequirements.location}
STATUS: ${editedRequirements.employmentStatus}
EXPERIENCE: ${editedRequirements.experienceLevel}

${formatStructuredDescription(structuredDescription || {
        description: [{ type: 'paragraph', text: editedRequirements.description }],
        about_the_role: [],
        responsibilities: [],
        requirements: [],
        nice_to_have: [],
        benefits: []
      })}

HQ: ${editedRequirements.headquarters?.line1 || ''}, ${editedRequirements.headquarters?.city || ''}, ${editedRequirements.headquarters?.country || ''}
POSTED: ${editedRequirements.listedAt || ''}
`.trim();

      // 3. AIService Call (using clean summary)
      const result = await GeminiService.generateTailoredResume(userProfile, {
        ...editedRequirements,
        description: cleanJobSummary // Pass the clean version
      });

      console.log('[DEBUG] Gemini AI generation result:', result);
      setGeneratedResume(result);
      setMatchScore(result.matchScore);
      setStep(3);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('429') || e.message?.toLowerCase().includes('quota')) {
        setError("Daily AI limit reached (20 requests/day). Please try again in 24 hours or upgrade your Gemini API plan.");
      } else {
        setError("Failed to generate resume. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!editedRequirements || !generatedResume) return;

    let finalJobUrl = initialJob ? initialJob.job_url : (jobInput || undefined);

    // If user provided a Job ID, format it into a full LinkedIn URL
    if (inputType === 'id' && jobInput && !initialJob) {
      finalJobUrl = `https://www.linkedin.com/jobs/view/${jobInput.trim()}/`;
    }

    const newApp: Application = {
      id: Date.now().toString(),
      jobUrl: finalJobUrl,
      jobText: jobText || undefined,
      requirements: editedRequirements,
      tailoredResume: generatedResume,
      createdAt: new Date().toISOString(),
      status: 'Draft',
      matchScore,
      description: structuredDescription?.description,
      about_the_role: structuredDescription?.about_the_role,
      responsibilities: structuredDescription?.responsibilities,
      structured_requirements: structuredDescription?.requirements,
      nice_to_have: structuredDescription?.nice_to_have,
      benefits: structuredDescription?.benefits
    };
    console.log('[DEBUG] Wizard handleSave called, final newApp:', newApp);
    onComplete(newApp);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 bg-white rounded-xl shadow-sm border border-slate-100 min-h-[400px]">
        <div className="relative">
          <div className="absolute inset-0 bg-brand-200 rounded-full blur-xl animate-pulse"></div>
          <Loader2 className="w-16 h-16 text-brand-600 animate-spin relative z-10" />
        </div>
        <h3 className="mt-6 text-xl font-semibold text-slate-800">{loadingMessage}</h3>
        <p className="text-slate-500 mt-2 text-center max-w-md text-sm">
          {loadingMessage.includes('Apify') || loadingMessage.includes('Crawling') ? 'This usually takes 10-30 seconds for deep scraping...' : 'Connecting to live data sources...'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[80vh] flex flex-col justify-start px-20 py-8 relative">

      {/* Stepper */}


      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full min-h-[70vh] flex flex-col">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mt-10">Welcome,</h1>
          <div className="w-full flex-1 flex flex-col justify-center gap-4 my-auto">
            <div className="text-left mb-8">

              <p className="text-black font-bold text-lg">Please choose the way you would like to proceed</p>
            </div>

            <div className="flex justify-between w-full gap-4">
              {[
                { id: 'job_url', line1: 'Job', line2: 'Link', icon: LinkIcon },
                { id: 'linkedin', line1: 'LinkedIn', line2: 'Link/IDs', icon: Linkedin },
                { id: 'upload', line1: 'Upload', line2: 'Job File', icon: Upload },
                { id: 'text', line1: 'Copy', line2: 'Job Text', icon: Copy },
                { id: 'manual', line1: 'Add', line2: 'Manually', icon: SquarePen },
              ].map((card) => (<div
                key={card.id}
                onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
                className={`group relative flex-1 max-w-[280px] aspect-[4/5] rounded-xl cursor-pointer transition-all duration-200
                        ${selectedCard === card.id
                    ? 'bg-white text-[#5D5FEF] border border-[#5D5FEF]'
                    : 'bg-white text-slate-900 border border-slate-200 hover:border-[#5D5FEF] hover:text-[#5D5FEF]'
                  }
                     `}
              >
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300">
                  <card.icon className={`transition-all duration-300 ${selectedCard === card.id ? 'w-32 h-32 text-[#5D5FEF] stroke-2' : 'w-16 h-16 text-slate-900 stroke-1 group-hover:text-[#5D5FEF] group-hover:w-24 group-hover:h-24 group-hover:stroke-2'}`} />
                </div>
                <span className="absolute bottom-20 left-0 w-full px-4 font-bold text-base tracking-wide text-center">
                  <div className="block">{card.line1}</div>
                  <div className="block">{card.line2}</div>
                </span>
              </div>
              ))}
            </div>

            <div className="flex justify-end mt-8">
              <button
                className={`px-8 py-3 rounded-lg font-bold border-2 transition-all flex items-center gap-2
                      ${!selectedCard
                    ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-default'
                    : 'bg-white text-orange-500 border-orange-500 hover:bg-orange-500 hover:text-white cursor-pointer'
                  }
                   `}
                disabled={!selectedCard}
                onClick={() => {
                  if (selectedCard === 'manual') {
                    // Manual entry: skip modal, go directly to Step 2 with empty form
                    const emptyRequirements: JobRequirements = {
                      title: '',
                      company: '',
                      description: '',
                      location: '',
                      employmentStatus: '',
                      listedAt: '',
                      jobUrl: '',
                      experienceLevel: '',
                      industries: [],
                      headquarters: {
                        country: '',
                        city: '',
                        line1: ''
                      },
                      logoUrl: ''
                    };
                    setEditedRequirements(emptyRequirements);
                    setJobRequirements(emptyRequirements);
                    setIsManualEntry(true);
                    setStep(2);
                  } else {
                    // Other cards: open modal for input
                    setShowInputModal(true);
                  }
                }}
              >
                Next <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1 Input Modal */}
            {showInputModal && (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/40 backdrop-blur-md animate-in fade-in duration-200 pt-16 pb-4 px-4">
                <div className={`bg-white rounded-xl p-10 w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative border border-slate-100 flex flex-col ${selectedCard === 'text' ? 'max-w-4xl h-[80vh]' : 'max-w-xl'}`}>

                  {selectedCard === 'job_url' && (
                    <div className="space-y-6">
                      <h3 className="text-2xl font-bold text-slate-900 text-center">Please pass the Job URL</h3>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="https://company.com/careers/job..."
                          className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-[#5D5FEF] focus:bg-white focus:ring-4 focus:ring-[#5D5FEF]/10 outline-none transition-all font-medium text-slate-800 placeholder-slate-400"
                          value={modalInputValue}
                          onChange={(e) => setModalInputValue(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  {selectedCard === 'linkedin' && (
                    <div className="space-y-8">
                      <h3 className="text-2xl font-bold text-slate-900 text-center">Please pass the LinkedIn Job URL or ID</h3>

                      <div className="flex flex-col gap-6">
                        {/* Tabs */}
                        <div className="flex justify-center">
                          <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1 shadow-inner">
                            <button
                              onClick={() => setLinkedInTab('url')}
                              className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${linkedInTab === 'url' ? 'bg-white text-[#5D5FEF] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                              URL
                            </button>
                            <button
                              onClick={() => setLinkedInTab('id')}
                              className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${linkedInTab === 'id' ? 'bg-white text-[#5D5FEF] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                              ID
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            placeholder={linkedInTab === 'url' ? "https://linkedin.com/jobs/view/..." : "375849..."}
                            className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-[#5D5FEF] focus:bg-white focus:ring-4 focus:ring-[#5D5FEF]/10 outline-none transition-all font-medium text-slate-800 placeholder-slate-400"
                            value={modalInputValue}
                            onChange={(e) => setModalInputValue(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCard === 'upload' && (
                    <div className="space-y-6 text-center">
                      <h3 className="text-2xl font-bold text-slate-900">Please upload the Job Description file</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">(image, pdf, doc, text)</p>

                      <div className="border-3 border-dashed border-slate-200 hover:border-[#5D5FEF] hover:bg-[#5D5FEF]/5 rounded-xl p-10 transition-all cursor-pointer group flex flex-col items-center justify-center gap-4 min-h-[200px]">
                        <div className="w-16 h-16 rounded-xl bg-slate-100 group-hover:bg-[#5D5FEF]/10 flex items-center justify-center transition-colors">
                          <Upload className="w-8 h-8 text-slate-400 group-hover:text-[#5D5FEF] transition-colors" />
                        </div>
                        <span className="text-slate-400 group-hover:text-[#5D5FEF] font-bold transition-colors">Click to upload or drag and drop</span>
                      </div>
                    </div>
                  )}

                  {selectedCard === 'text' && (
                    <div className="flex-1 flex flex-col gap-6 w-full">
                      <h3 className="text-2xl font-bold text-slate-900 text-center">Please paste the Job Description</h3>
                      <div className="relative flex-1 w-full">
                        <textarea
                          placeholder="Paste the full job description here..."
                          className="absolute inset-0 w-full h-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-[#5D5FEF] focus:bg-white focus:ring-4 focus:ring-[#5D5FEF]/10 outline-none transition-all font-medium text-slate-800 placeholder-slate-400 resize-none"
                          value={modalInputValue}
                          onChange={(e) => setModalInputValue(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer Buttons */}
                  <div className="flex items-center justify-end gap-3 mt-auto border-t border-slate-100 pt-6">
                    <button
                      onClick={() => setShowInputModal(false)}
                      className="px-6 py-2.5 rounded-xl font-bold bg-slate-50 text-slate-700 border border-transparent hover:border-slate-300 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (selectedCard === 'manual') {
                          // Initialize completely empty requirements for manual entry
                          const emptyRequirements: JobRequirements = {
                            title: '',
                            company: '',
                            description: '',
                            location: '',
                            employmentStatus: '',
                            listedAt: '',
                            jobUrl: '',
                            experienceLevel: '',
                            industries: [],
                            headquarters: {
                              country: '',
                              city: '',
                              line1: ''
                            },
                            logoUrl: ''
                          };
                          setEditedRequirements(emptyRequirements);
                          setJobRequirements(emptyRequirements);
                          setStep(2);
                          setShowInputModal(false);
                        } else if (selectedCard === 'text') {
                          // Copy Text: Pass through AI formatter
                          if (!modalInputValue.trim()) {
                            setError('Please paste the job description text');
                            return;
                          }
                          setShowInputModal(false);
                          setLoading(true);
                          setLoadingMessage('Analyzing job description...');
                          try {
                            const result = await GeminiService.analyzeJob(modalInputValue);
                            setJobRequirements(result);
                            setEditedRequirements(result);
                            setStep(2);
                          } catch (e: any) {
                            console.error(e);
                            setError("Failed to analyze job description.");
                          } finally {
                            setLoading(false);
                            setModalInputValue('');
                          }
                        } else if (selectedCard === 'job_url' || selectedCard === 'linkedin') {
                          // URL/LinkedIn: Extract ID and process immediately
                          if (!modalInputValue.trim()) {
                            setError('Please enter a valid URL or ID');
                            return;
                          }

                          let finalInput = modalInputValue.trim();
                          let finalType: 'url' | 'id' = selectedCard === 'linkedin' ? linkedInTab : 'url';

                          // If LinkedIn URL, extract ID
                          if (finalInput.toLowerCase().includes('linkedin.com')) {
                            const idMatch =
                              finalInput.match(/currentJobId=(\d+)/) ||
                              finalInput.match(/\/view\/(\d+)/) ||
                              finalInput.match(/-(\d+)(?:\/|\?|$)/);

                            if (idMatch) {
                              finalInput = idMatch[1];
                              finalType = 'id';
                            }
                          }

                          // Close modal and start processing
                          setShowInputModal(false);
                          setModalInputValue('');
                          setJobInput(finalInput);
                          setInputType(finalType);

                          // Trigger analysis immediately with the captured values
                          (async () => {
                            setLoading(true);
                            setError(null);
                            setLoadingMessage('Analyzing job requirements...');

                            try {
                              await handleAnalyzeJob();
                            } catch (e: any) {
                              console.error(e);
                              setError("Failed to analyze job. Please try again.");
                              setLoading(false);
                            }
                          })();
                        } else if (selectedCard === 'upload') {
                          // Upload will be handled when file is selected
                          setError('Please select a file to upload');
                        } else {
                          console.log('Modal Submit:', selectedCard, modalInputValue);
                        }
                      }}
                      className="px-8 py-2.5 rounded-xl font-bold bg-[#5D5FEF] text-white shadow-lg shadow-[#5D5FEF]/25 hover:shadow-xl hover:shadow-[#5D5FEF]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                      Next
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {
        step === 2 && editedRequirements && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                {editedRequirements.logoUrl ? (
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img src={editedRequirements.logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                    <Globe className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{editedRequirements.title}</h2>
                  <p className="text-slate-500 text-sm">{editedRequirements.company}</p>
                </div>
              </div>
              <div className="text-right">
                {editedRequirements.listedAt && (
                  <div className="text-sm font-bold text-slate-900 mb-1">Posted On</div>
                )}
                <div className="text-slate-500 font-normal">
                  {editedRequirements.listedAt ? new Date(editedRequirements.listedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Company</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 font-normal"
                    value={editedRequirements.company}
                    onChange={(e) => handleEditChange('company', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Job Title</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 font-normal"
                    value={editedRequirements.title}
                    onChange={(e) => handleEditChange('title', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Location</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900"
                    value={editedRequirements.location || ''}
                    onChange={(e) => handleEditChange('location', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Employment Status</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900"
                    value={editedRequirements.employmentStatus || ''}
                    onChange={(e) => handleEditChange('employmentStatus', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1">Experience Level</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900"
                    value={editedRequirements.experienceLevel || ''}
                    onChange={(e) => handleEditChange('experienceLevel', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="space-y-1 mb-16">
                  <label className="block text-sm font-bold text-slate-900 mb-1">Description</label>
                  <TiptapEditor
                    value={editedRequirements.description || ''}
                    onChange={(val) => handleEditChange('description', val)}
                  />
                </div>


              </div>
            </div>
            {/* LinkedIn Specific Detailed Fields (Headquarters only) */}
            {editedRequirements.headquarters && (
              <div className="space-y-6 mb-12">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 dark:border-slate-700 pb-2">Our HQ</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Country</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 font-normal"
                      value={editedRequirements.headquarters?.country || ''}
                      onChange={(e) => setEditedRequirements({
                        ...editedRequirements,
                        headquarters: { ...editedRequirements.headquarters, country: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">City</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 font-normal"
                      value={editedRequirements.headquarters?.city || ''}
                      onChange={(e) => setEditedRequirements({
                        ...editedRequirements,
                        headquarters: { ...editedRequirements.headquarters, city: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Street</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 font-normal"
                      value={editedRequirements.headquarters?.line1 || ''}
                      onChange={(e) => setEditedRequirements({
                        ...editedRequirements,
                        headquarters: { ...editedRequirements.headquarters, line1: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between mt-8">
              <div className="flex items-center gap-3">
                <Wand2 className="w-5 h-5 text-indigo-600" />
                <p className="text-indigo-900 text-sm font-medium">Looks good? Let's build your resume.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium text-sm"
                >
                  Back
                </button>
                {isManualEntry ? (
                  <button
                    onClick={async () => {
                      // Collect all manually entered data
                      const manualDataText = `
Job Title: ${editedRequirements.title}
Company: ${editedRequirements.company}
Location: ${editedRequirements.location}
Employment Status: ${editedRequirements.employmentStatus}
Experience Level: ${editedRequirements.experienceLevel}
Description: ${editedRequirements.description}
                      `.trim();

                      setLoading(true);
                      setLoadingMessage('Formatting your manual entry with AI...');
                      try {
                        const formattedResult = await GeminiService.analyzeJob(manualDataText);
                        setEditedRequirements(formattedResult);
                        setJobRequirements(formattedResult);
                        setIsManualEntry(false); // Switch to normal mode after formatting
                      } catch (e: any) {
                        console.error(e);
                        setError("Failed to format data. Please review and try again.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    Update with AI <Wand2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateResume}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    Confirm & Generate <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }

      {
        step === 3 && generatedResume && editedRequirements && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center sticky top-4 z-20">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Match Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-green-600">{matchScore}%</span>
                    <span className="text-xs text-slate-400">fit</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2"></div>
                <div>
                  <h3 className="font-bold text-slate-800">{editedRequirements.title}</h3>
                  <p className="text-xs text-slate-500">{editedRequirements.company}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {isEditingGeneratedResume ? (
                  <>
                    <button
                      onClick={() => setIsEditingGeneratedResume(false)}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-all whitespace-nowrap"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        if (resumeBackup) {
                          setGeneratedResume(resumeBackup);
                        }
                        setIsEditingGeneratedResume(false);
                      }}
                      className="text-sm font-medium px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      Discard
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setStep(2)} className="text-slate-500 hover:text-slate-800 text-sm font-medium px-3">
                      Back
                    </button>
                    <button
                      onClick={() => {
                        setResumeBackup(JSON.parse(JSON.stringify(generatedResume)));
                        setIsEditingGeneratedResume(true);
                      }}
                      className="text-slate-500 hover:text-slate-800 text-sm font-medium px-4 py-2 rounded-lg transition-all"
                    >
                      Edit CV
                    </button>
                    <button
                      onClick={handleSave}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-all flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Application
                    </button>
                  </>
                )}
              </div>
            </div>

            <ResumePaper
              application={{
                id: 'preview',
                requirements: editedRequirements,
                tailoredResume: generatedResume,
                matchScore: matchScore,
                status: 'Draft',
                createdAt: new Date().toISOString(),
                jobUrl: editedRequirements.jobUrl || ''
              }}
              profile={userProfile}
              editable={isEditingGeneratedResume}
              onUpdate={(updated) => setGeneratedResume(updated)}
            />
          </div>
        )
      }
    </div >
  );
};
