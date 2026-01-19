import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Application, UserProfile, GeneratedResume } from '../types';
import { Mail, Phone, Linkedin, Download, X, Plus, Trash2, Upload } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ResumePaperProps {
  application: Application;
  profile: UserProfile;
  editable?: boolean;
  onUpdate?: (updated: GeneratedResume) => void;
}

export const ResumePaper = forwardRef<HTMLDivElement, ResumePaperProps>(({ application, profile, editable, onUpdate }, ref) => {
  console.log('[DEBUG] ResumePaper rendering for application:', application);
  const resume = application.tailoredResume;

  const handleUpdate = (field: string, value: any) => {
    if (!onUpdate || !resume) return;
    onUpdate({
      ...resume,
      [field]: value
    });
  };

  const updateExperience = (idx: number, field: string, value: any) => {
    if (!onUpdate || !resume) return;
    const newExp = [...(resume.experience || [])];
    newExp[idx] = { ...newExp[idx], [field]: value };
    onUpdate({ ...resume, experience: newExp });
  };

  const addExperience = () => {
    if (!onUpdate || !resume) return;
    const newExp = [
      ...(resume.experience || []),
      { company: 'New Company', role: 'New Role', dates: 'Dates', bulletPoints: ['New achievement'] }
    ];
    onUpdate({ ...resume, experience: newExp });
  };

  const deleteExperience = (idx: number) => {
    if (!onUpdate || !resume) return;
    const newExp = [...(resume.experience || [])];
    newExp.splice(idx, 1);
    onUpdate({ ...resume, experience: newExp });
  };

  const updateBullet = (expIdx: number, bulletIdx: number, value: string) => {
    if (!onUpdate || !resume) return;
    const newExp = [...(resume.experience || [])];
    const newBullets = [...(newExp[expIdx].bulletPoints || [])];
    newBullets[bulletIdx] = value;
    newExp[expIdx] = { ...newExp[expIdx], bulletPoints: newBullets };
    onUpdate({ ...resume, experience: newExp });
  };

  const addBullet = (expIdx: number) => {
    if (!onUpdate || !resume) return;
    const newExp = [...(resume.experience || [])];
    newExp[expIdx].bulletPoints.push('New achievement');
    onUpdate({ ...resume, experience: newExp });
  };

  const deleteBullet = (expIdx: number, bulletIdx: number) => {
    if (!onUpdate || !resume) return;
    const newExp = [...(resume.experience || [])];
    newExp[expIdx].bulletPoints.splice(bulletIdx, 1);
    onUpdate({ ...resume, experience: newExp });
  };

  const updateSkill = (idx: number, value: string) => {
    if (!onUpdate || !resume) return;
    const newSkills = [...(resume.skills || [])];
    newSkills[idx] = value;
    onUpdate({ ...resume, skills: newSkills });
  };

  const addSkill = () => {
    if (!onUpdate || !resume) return;
    const newSkills = [...(resume.skills || []), 'New Skill'];
    onUpdate({ ...resume, skills: newSkills });
  };

  const deleteSkill = (idx: number) => {
    if (!onUpdate || !resume) return;
    const newSkills = [...(resume.skills || [])];
    newSkills.splice(idx, 1);
    onUpdate({ ...resume, skills: newSkills });
  };

  const updateEducation = (idx: number, field: string, value: any) => {
    if (!onUpdate || !resume) return;
    const currentEdu = resume.education || profile.education || [];
    const newEdu = [...currentEdu];
    newEdu[idx] = { ...newEdu[idx], [field]: value };
    onUpdate({ ...resume, education: newEdu });
  };

  const addEducation = () => {
    if (!onUpdate || !resume) return;
    const currentEdu = resume.education || profile.education || [];
    const newEdu = [...currentEdu, { institution: 'New Institution', degree: 'Degree', year: 'Year' }];
    onUpdate({ ...resume, education: newEdu });
  };

  const deleteEducation = (idx: number) => {
    if (!onUpdate || !resume) return;
    const currentEdu = resume.education || profile.education || [];
    const newEdu = [...currentEdu];
    newEdu.splice(idx, 1);
    onUpdate({ ...resume, education: newEdu });
  };

  const eduList = resume?.education || profile.education || [];

  const updateStyle = (styleField: string, color: string) => {
    if (!onUpdate || !resume) return;
    onUpdate({
      ...resume,
      styles: {
        ...(resume.styles || {}),
        [styleField]: color
      }
    });
  };

  const headerBg = resume?.styles?.headerBg || '#0f172a';
  const headerTextColor = resume?.styles?.headerTextColor || '#ffffff';
  const accentColor = resume?.styles?.accentColor || '#818cf8';

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragRef.current.startX,
        y: e.clientY - dragRef.current.startY
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX - position.x,
      startY: e.clientY - position.y
    };
  };

  return (
    <div className="relative group/resumebase">
      {editable && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `calc(50% - 630px + ${position.x}px)`,
            top: `calc(150px + ${position.y}px)`,
          }}
        >
          <div className="p-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[20px_40px_80px_rgba(0,0,0,0.2)] w-64 animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
            <div
              onMouseDown={onMouseDown}
              className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3 cursor-grab active:cursor-grabbing group"
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <div className="w-3 h-0.5 bg-slate-300 group-hover:bg-[#5D5FEF] transition-colors rounded-full"></div>
                  <div className="w-3 h-0.5 bg-slate-300 group-hover:bg-[#5D5FEF] transition-colors rounded-full"></div>
                  <div className="w-3 h-0.5 bg-slate-300 group-hover:bg-[#5D5FEF] transition-colors rounded-full"></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Theme Editor</span>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">Header Color</span>
                <div className="flex items-center gap-2 flex-nowrap">
                  {['#0f172a', '#4f46e5', '#1e3a8a', '#064e3b', '#e11d48', '#ffffff'].map(c => (
                    <button
                      key={c}
                      onClick={() => updateStyle('headerBg', c)}
                      className={`w-5 h-5 rounded-full border border-slate-200 transition-all hover:scale-110 shrink-0 ${headerBg === c ? 'ring-2 ring-[#5D5FEF] ring-offset-1 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <div className="relative w-5 h-5 shrink-0">
                    <button className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:border-[#5D5FEF] hover:text-[#5D5FEF] transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => updateStyle('headerBg', e.target.value)}
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">Text Color</span>
                <div className="flex items-center gap-2 flex-nowrap">
                  {['#ffffff', '#cbd5e1', '#fcd34d', '#7dd3fc', '#0f172a'].map(c => (
                    <button
                      key={c}
                      onClick={() => updateStyle('headerTextColor', c)}
                      className={`w-5 h-5 rounded-full border border-slate-200 transition-all hover:scale-110 shrink-0 ${headerTextColor === c ? 'ring-2 ring-[#5D5FEF] ring-offset-1 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <div className="relative w-5 h-5 shrink-0">
                    <button className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:border-[#5D5FEF] hover:text-[#5D5FEF] transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => updateStyle('headerTextColor', e.target.value)}
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">Accent / Icons</span>
                <div className="flex items-center gap-2 flex-nowrap">
                  {['#818cf8', '#fbbf24', '#38bdf8', '#f87171', '#ffffff', '#10b981'].map(c => (
                    <button
                      key={c}
                      onClick={() => updateStyle('accentColor', c)}
                      className={`w-5 h-5 rounded-full border border-slate-200 transition-all hover:scale-110 shrink-0 ${accentColor === c ? 'ring-2 ring-[#5D5FEF] ring-offset-1 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <div className="relative w-5 h-5 shrink-0">
                    <button className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:border-[#5D5FEF] hover:text-[#5D5FEF] transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => updateStyle('accentColor', e.target.value)}
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={ref} className="bg-white shadow-[0_30px_60px_rgba(0,0,0,0.12)] rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 print:shadow-none print:border-none print:rounded-none">
        {/* Header Section */}
        <div
          className="p-12 relative overflow-hidden transition-colors duration-500"
          style={{ backgroundColor: headerBg, color: headerTextColor }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>

          <div className="relative z-10 flex justify-between items-start">
            <div className="flex-1">
              {editable ? (
                <input
                  className="text-4xl font-black uppercase tracking-tight mb-2 bg-white/10 border border-white/20 rounded-lg px-4 py-1 w-full text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/50 outline-none"
                  value={resume?.name || profile.name}
                  onChange={(e) => handleUpdate('name', e.target.value)}
                  style={{ color: headerTextColor }}
                  placeholder="Full Name"
                />
              ) : (
                <h2 className="text-4xl font-black uppercase tracking-tight mb-2" style={{ color: headerTextColor }}>{resume?.name || profile.name}</h2>
              )}

              {editable ? (
                <input
                  className="font-bold text-xl mb-8 tracking-wide bg-white/5 border border-white/10 rounded-lg px-4 py-1 w-full text-slate-300 placeholder:text-slate-500 focus:ring-2 focus:ring-white/30 outline-none mt-2"
                  value={resume?.currentRole || profile.currentRole}
                  onChange={(e) => handleUpdate('currentRole', e.target.value)}
                  style={{ color: headerTextColor, opacity: 0.7 }}
                  placeholder="Current Role"
                />
              ) : (
                <p className="font-bold text-xl mb-8 tracking-wide transition-opacity opacity-70" style={{ color: headerTextColor }}>{resume?.currentRole || profile.currentRole}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-8 text-sm font-medium pt-4 relative z-10">
            {(editable || (resume?.email !== null && (resume?.email || profile.email))) && (
              <div className={`flex items-center gap-2.5 group/contact transition-opacity duration-300 ${resume?.email === null ? 'opacity-30' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center relative">
                  <Mail className="w-4 h-4" style={{ color: accentColor }} />
                  {editable && (
                    <button
                      onClick={() => handleUpdate('email', resume?.email === null ? '' : null)}
                      className="absolute -top-1 -right-1 bg-white/10 hover:bg-white/20 p-0.5 rounded-full backdrop-blur-sm opacity-0 group-hover/contact:opacity-100 transition-opacity"
                    >
                      {resume?.email === null ? <Plus className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-white" />}
                    </button>
                  )}
                </div>
                {editable ? (
                  <input
                    className={`bg-transparent border-b border-white/10 focus:border-white/30 outline-none w-48 transition-all ${resume?.email === null ? 'line-through' : ''}`}
                    value={resume?.email === null ? 'Hidden' : (resume?.email || profile.email)}
                    onChange={(e) => handleUpdate('email', e.target.value)}
                    style={{ color: headerTextColor }}
                    placeholder="Email"
                    disabled={resume?.email === null}
                  />
                ) : (
                  <span style={{ color: headerTextColor, opacity: 0.9 }}>{resume?.email || profile.email}</span>
                )}
              </div>
            )}

            {(editable || (resume?.phone !== null && (resume?.phone || profile.phone))) && (
              <div className={`flex items-center gap-2.5 group/contact transition-opacity duration-300 ${resume?.phone === null ? 'opacity-30' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center relative">
                  <Phone className="w-4 h-4" style={{ color: accentColor }} />
                  {editable && (
                    <button
                      onClick={() => handleUpdate('phone', resume?.phone === null ? '' : null)}
                      className="absolute -top-1 -right-1 bg-white/10 hover:bg-white/20 p-0.5 rounded-full backdrop-blur-sm opacity-0 group-hover/contact:opacity-100 transition-opacity"
                    >
                      {resume?.phone === null ? <Plus className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-white" />}
                    </button>
                  )}
                </div>
                {editable ? (
                  <input
                    className={`bg-transparent border-b border-white/10 focus:border-white/30 outline-none w-36 transition-all ${resume?.phone === null ? 'line-through' : ''}`}
                    value={resume?.phone === null ? 'Hidden' : (resume?.phone || profile.phone)}
                    onChange={(e) => handleUpdate('phone', e.target.value)}
                    style={{ color: headerTextColor }}
                    placeholder="Phone"
                    disabled={resume?.phone === null}
                  />
                ) : (
                  <span style={{ color: headerTextColor, opacity: 0.9 }}>{resume?.phone || profile.phone}</span>
                )}
              </div>
            )}

            {(editable || (resume?.linkedinUrl !== null && (resume?.linkedinUrl || profile.linkedinUrl))) && (
              <div className={`flex items-center gap-2.5 group/contact transition-opacity duration-300 ${resume?.linkedinUrl === null ? 'opacity-30' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center relative">
                  <Linkedin className="w-4 h-4" style={{ color: accentColor }} />
                  {editable && (
                    <button
                      onClick={() => handleUpdate('linkedinUrl', resume?.linkedinUrl === null ? '' : null)}
                      className="absolute -top-1 -right-1 bg-white/10 hover:bg-white/20 p-0.5 rounded-full backdrop-blur-sm opacity-0 group-hover/contact:opacity-100 transition-opacity"
                    >
                      {resume?.linkedinUrl === null ? <Plus className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-white" />}
                    </button>
                  )}
                </div>
                {editable ? (
                  <input
                    className={`bg-transparent border-b border-white/10 focus:border-white/30 outline-none w-48 transition-all ${resume?.linkedinUrl === null ? 'line-through' : ''}`}
                    value={resume?.linkedinUrl === null ? 'Hidden' : (resume?.linkedinUrl || profile.linkedinUrl)}
                    onChange={(e) => handleUpdate('linkedinUrl', e.target.value)}
                    style={{ color: headerTextColor }}
                    placeholder="LinkedIn URL"
                    disabled={resume?.linkedinUrl === null}
                  />
                ) : (
                  <span style={{ color: headerTextColor, opacity: 0.9 }}>{(resume?.linkedinUrl || profile.linkedinUrl).replace('https://', '').replace('www.', '')}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-12 space-y-12 bg-white">
          {/* Summary */}
          <section>
            <h3 className="text-xs font-black text-[#5D5FEF] uppercase tracking-[0.25em] mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-[#5D5FEF]/20"></span>
              Professional Summary
            </h3>
            {editable ? (
              <textarea
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-700 leading-relaxed text-base font-medium focus:ring-2 focus:ring-[#5D5FEF] outline-none transition-all"
                value={resume?.summary || ''}
                onChange={(e) => handleUpdate('summary', e.target.value)}
                rows={4}
              />
            ) : (
              <p className="text-slate-700 leading-relaxed text-base font-medium">
                {resume?.summary || 'No summary available.'}
              </p>
            )}
          </section>

          {/* Skills */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-[#5D5FEF] uppercase tracking-[0.25em] flex items-center gap-3">
                <span className="w-8 h-px bg-[#5D5FEF]/20"></span>
                Core Competencies
              </h3>
              {editable && (
                <button
                  onClick={addSkill}
                  className="p-1 px-3 bg-indigo-50 text-[#5D5FEF] rounded-full text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                  title="Add Skill"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {(resume?.skills || []).map((skill: string, idx: number) => (
                editable ? (
                  <div key={idx} className="group relative flex items-center">
                    <input
                      className="bg-slate-50 text-slate-700 border border-slate-200 px-4 py-1.5 rounded-full text-xs font-bold tracking-tight focus:ring-2 focus:ring-[#5D5FEF] outline-none min-w-[100px] pr-8"
                      value={skill}
                      onChange={(e) => updateSkill(idx, e.target.value)}
                    />
                    <button
                      onClick={() => deleteSkill(idx)}
                      className="absolute right-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span key={idx} className="bg-slate-50 text-slate-700 border border-slate-100 px-4 py-1.5 rounded-full text-xs font-bold tracking-tight">
                    {skill}
                  </span>
                )
              ))}
            </div>
          </section>

          {/* Experience */}
          <section>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xs font-black text-[#5D5FEF] uppercase tracking-[0.25em] flex items-center gap-3">
                <span className="w-8 h-px bg-[#5D5FEF]/20"></span>
                Professional Experience
              </h3>
              {editable && (
                <button
                  onClick={addExperience}
                  className="p-1.5 px-4 bg-indigo-50 text-[#5D5FEF] rounded-full text-xs font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Experience
                </button>
              )}
            </div>
            <div className="space-y-10">
              {(resume?.experience || []).map((exp: any, idx: number) => (
                <div key={idx} className="relative group p-4 -m-4 rounded-3xl hover:bg-slate-50/50 transition-colors border border-transparent hover:border-slate-100">
                  {editable && (
                    <button
                      onClick={() => deleteExperience(idx)}
                      className="absolute -right-2 top-0 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Professional Experience"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex justify-between items-baseline mb-2 gap-4">
                    {editable ? (
                      <input
                        className="font-extrabold text-slate-900 text-lg bg-white border border-slate-200 px-3 py-1 rounded w-full focus:ring-2 focus:ring-[#5D5FEF] outline-none shadow-sm"
                        value={exp.role}
                        onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                      />
                    ) : (
                      <h4 className="font-extrabold text-slate-900 text-lg">{exp.role}</h4>
                    )}
                    {editable ? (
                      <input
                        className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1 rounded focus:ring-2 focus:ring-[#5D5FEF] outline-none w-48 shadow-sm"
                        value={exp.dates}
                        onChange={(e) => updateExperience(idx, 'dates', e.target.value)}
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{exp.dates}</span>
                    )}
                  </div>
                  {editable ? (
                    <input
                      className="text-sm font-bold text-[#5D5FEF] mb-4 uppercase tracking-wider bg-white border border-slate-200 px-3 py-1 rounded w-full focus:ring-2 focus:ring-[#5D5FEF] outline-none mt-2 shadow-sm"
                      value={exp.company}
                      onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                    />
                  ) : (
                    <div className="text-sm font-bold text-[#5D5FEF] mb-4 uppercase tracking-wider">{exp.company}</div>
                  )}
                  <ul className="space-y-3 mt-4">
                    {(exp.bulletPoints || []).map((point: string, pIdx: number) => (
                      <li key={pIdx} className="text-[15px] text-slate-600 leading-relaxed flex gap-3 group/bullet">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0"></span>
                        {editable ? (
                          <div className="relative w-full flex items-start gap-2">
                            <textarea
                              className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[15px] focus:ring-2 focus:ring-[#5D5FEF] outline-none transition-all shadow-sm"
                              value={point}
                              onChange={(e) => updateBullet(idx, pIdx, e.target.value)}
                              rows={2}
                            />
                            <button
                              onClick={() => deleteBullet(idx, pIdx)}
                              className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/bullet:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          point
                        )}
                      </li>
                    ))}
                    {editable && (
                      <li className="flex justify-start pt-2">
                        <button
                          onClick={() => addBullet(idx)}
                          className="text-xs font-bold text-slate-400 hover:text-[#5D5FEF] flex items-center gap-1.5 px-4 py-2 border border-dashed border-slate-200 rounded-lg hover:border-[#5D5FEF] transition-all"
                        >
                          <Plus className="w-3 h-3" /> Add Point
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Education */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-[#5D5FEF] uppercase tracking-[0.25em] flex items-center gap-3">
                <span className="w-8 h-px bg-[#5D5FEF]/20"></span>
                Education
              </h3>
              {editable && (
                <button
                  onClick={addEducation}
                  className="p-1 px-3 bg-indigo-50 text-[#5D5FEF] rounded-full text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-8">
              {eduList.map((edu, idx) => (
                <div key={idx} className="relative group p-6 rounded-3xl bg-slate-50/50 border border-slate-100 hover:border-[#5D5FEF]/30 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                  {editable && (
                    <button
                      onClick={() => deleteEducation(idx)}
                      className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 text-slate-300 hover:text-red-500 rounded-full shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <div className="flex-1 space-y-1">
                    {editable ? (
                      <>
                        <input
                          className="font-bold text-slate-900 text-sm leading-tight bg-white border border-slate-200 px-2 py-0.5 rounded w-full focus:ring-1 focus:ring-[#5D5FEF] outline-none"
                          value={edu.institution}
                          onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                          placeholder="Institution"
                        />
                        <input
                          className="text-xs text-slate-500 font-bold italic bg-white border border-slate-200 px-2 py-0.5 rounded w-full focus:ring-1 focus:ring-[#5D5FEF] outline-none"
                          value={edu.degree}
                          onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                          placeholder="Degree"
                        />
                        <input
                          className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-white border border-slate-200 px-2 py-0.5 rounded w-full focus:ring-1 focus:ring-[#5D5FEF] outline-none"
                          value={edu.year}
                          onChange={(e) => updateEducation(idx, 'year', e.target.value)}
                          placeholder="Year"
                        />
                      </>
                    ) : (
                      <>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{edu.institution}</h4>
                        <p className="text-xs text-slate-500 font-bold italic">{edu.degree}</p>
                        <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">{edu.year}</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div >
  );
});

ResumePaper.displayName = 'ResumePaper';

interface CVPreviewProps {
  application: Application;
  profile: UserProfile;
  onClose?: () => void;
}

export const CVPreview: React.FC<CVPreviewProps> = ({ application, profile, onClose }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    const opt = {
      margin: 0,
      filename: `${profile.name.replace(/\s+/g, '_')}_Resume_${(application.requirements?.company || 'Company').replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    } as any;

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Dashboard Style Header */}
      <div className="flex items-center justify-between px-2 print:hidden">
        <div className="flex flex-col">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{application.requirements?.title || 'Job Application'}</h1>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-1">Application for {application.requirements?.company || 'Company'}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Match Score</span>
            <span className="text-2xl font-black text-green-500">{application.matchScore}%</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Professional Resume Paper */}
      <ResumePaper ref={contentRef} application={application} profile={profile} />
    </div>
  );
};
