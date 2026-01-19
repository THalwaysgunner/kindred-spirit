import React from 'react';
import { FileCheck, ExternalLink, UserCircle } from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
  onLoginClick: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onLoginClick }) => {
  return (
    <div className="relative w-full h-screen overflow-hidden font-sans bg-white">

      {/* 1. Background Image - Person at desk/creative space */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1598550476439-6847785fcea6?q=80&w=2070&auto=format&fit=crop')`,
        }}
      />

      {/* 2. Yellow Gradient Top Overlay (Solid at top, fades out) */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(180deg, #FFC947 0%, rgba(255, 201, 71, 0.9) 30%, rgba(255, 201, 71, 0) 80%)'
        }}
      ></div>

      {/* 3. Navigation / Logo - Top Center */}
      <nav className="absolute top-0 left-0 right-0 p-8 z-40 flex justify-between items-start">
        {/* Left spacer for balance */}
        <div className="w-20 hidden md:block"></div>

        {/* Centered Logo */}
        <div className="flex flex-col items-center cursor-pointer group">
          <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center mb-1 transition-transform group-hover:scale-110">
            <span className="text-white font-black text-xs italic">H</span>
          </div>
          <span className="text-slate-900 font-bold tracking-[0.2em] text-[10px] uppercase">HireChance</span>
        </div>

        {/* Right: Login & External Link */}
        <div className="flex items-center gap-3 w-20 justify-end">
          <button
            onClick={onLoginClick}
            className="flex items-center gap-1 text-slate-900 font-bold text-xs uppercase tracking-wide hover:opacity-70"
          >
            <UserCircle className="w-4 h-4" />
            Login
          </button>
        </div>
      </nav>

      {/* 4. Main Content - Centered Exactly */}
      <div className="relative z-30 w-full h-full flex flex-col justify-center items-center pb-20">

        {/* Typography Stack */}
        <div className="flex flex-col items-center text-center leading-[0.85] select-none">

          <h1 className="text-[12vw] lg:text-[9rem] font-[900] text-slate-900 tracking-tighter uppercase">
            GET HIRED
          </h1>

          <h1 className="text-[12vw] lg:text-[9rem] font-[900] text-slate-900 tracking-tighter uppercase">
            OUTSIDE
          </h1>

          {/* "THE BOX" wrapped in Blue Selection Frame */}
          <div className="relative mt-2 lg:mt-4 inline-block">

            {/* The Text */}
            <h1 className="text-[12vw] lg:text-[9rem] font-[900] text-slate-900 tracking-tighter uppercase px-4">
              THE BOX
            </h1>

            {/* Blue Selection Frame UI */}
            <div className="absolute inset-0 border-[3px] border-[#5484FF] pointer-events-none">
              {/* Square Handles */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#5484FF]"></div>
            </div>

            {/* Floating Beige Caption - Tilted off to the side */}
            <div className="absolute -top-8 -right-4 md:-right-24 transform rotate-6 z-40">
              <div className="bg-[#EADBC8] px-4 py-3 shadow-lg max-w-[140px] md:max-w-[180px]">
                <p className="font-['Caveat',sans-serif] text-slate-900 font-bold text-xs md:text-sm leading-tight text-center">
                  Your resume, tailored.
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* 5. "START HERE" Button - Pill Shape, Periwinkle Gradient */}
        <div className="mt-12 md:mt-16 relative z-50">
          <button
            onClick={onGetStarted}
            className="group relative px-10 py-4 rounded-full bg-gradient-to-r from-[#A5B4FC] to-[#818CF8] shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300"
          >
            <span className="text-white font-bold tracking-[0.2em] text-sm uppercase">Start Here</span>
            {/* White Ring Effect */}
            <div className="absolute inset-0 rounded-full ring-2 ring-white/30 group-hover:ring-white/50 transition-all"></div>
          </button>
        </div>

      </div>

      {/* Footer Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 py-3 px-6 z-30 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-900 rounded-full flex items-center justify-center">
            <FileCheck className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-xs">HireChance</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase">
          <span className="cursor-pointer hover:text-slate-600">Privacy</span>
          <span>•</span>
          <span className="cursor-pointer hover:text-slate-600">Terms</span>
        </div>
      </div>

    </div>
  );
};