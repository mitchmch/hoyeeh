
import React, { useState } from 'react';
import { Logo } from './Logo';
import { Button } from './Button';

interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: (email?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onGetStarted }) => {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-black text-white selection:bg-brand selection:text-white overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative h-[100vh] min-h-[600px] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero.png"
            className="w-full h-full object-cover opacity-100"
            alt="Background"
          />
          {/* Gradient Overlay: Dark on left/bottom for text readability, transparent on right for the Lion */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
        </div>

        {/* Header */}
        <div className="relative z-20 flex justify-between items-center px-6 md:px-12 py-6">
          <Logo className="w-24 h-8 md:w-36 md:h-12" />
          <div className="flex gap-4">
             <button 
               onClick={onSignIn}
               className="bg-brand hover:bg-brand-dark text-white px-4 py-1.5 rounded font-semibold text-sm transition"
             >
               Sign In
             </button>
          </div>
        </div>

        {/* Content - Aligned Left for the Lion Image */}
        <div className="relative z-10 flex-1 flex flex-col items-center md:items-start justify-center text-center md:text-left px-4 md:px-20 animate-fade-in">
          <h1 className="text-4xl md:text-7xl font-black max-w-4xl mb-4 leading-tight drop-shadow-xl">
            Unlimited African movies,<br /> TV shows, and more.
          </h1>
          <p className="text-xl md:text-3xl font-medium mb-6 drop-shadow-md">
            Watch anywhere. Cancel anytime.
          </p>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl drop-shadow">
            Ready to watch? Enter your email to create or restart your membership.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl items-center">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full md:flex-1 bg-black/60 border border-gray-500 rounded p-4 text-white placeholder-gray-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand h-14 backdrop-blur-sm"
            />
            <button 
              onClick={() => onGetStarted(email)}
              className="bg-brand hover:bg-brand-dark text-white text-xl font-bold px-8 py-3 rounded h-14 flex items-center gap-2 transition w-full md:w-auto justify-center whitespace-nowrap shadow-lg shadow-brand/20"
            >
              Get Started <span className="text-2xl">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Sections */}
      <div className="border-t-8 border-[#232323] py-16 px-6 md:px-20 bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Enjoy on your TV</h2>
            <p className="text-xl md:text-2xl text-gray-300">
              Watch on Smart TVs, Playstation, Xbox, Chromecast, Apple TV, Blu-ray players, and more.
            </p>
          </div>
          <div className="flex-1 relative">
             <div className="relative z-10">
                <img src="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/tv.png" className="w-full" />
             </div>
             <div className="absolute top-[20%] left-[13%] right-[13%] bottom-[20%] z-0 bg-black">
                {/* Video Placeholder */}
             </div>
          </div>
        </div>
      </div>

      <div className="border-t-8 border-[#232323] py-16 px-6 md:px-20 bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Download your shows to watch offline</h2>
            <p className="text-xl md:text-2xl text-gray-300">
              Save your favorites easily and always have something to watch.
            </p>
          </div>
          <div className="flex-1">
             <div className="relative">
                <img src="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/mobile-0819.jpg" className="w-full" />
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black border-2 border-gray-600 rounded-xl flex items-center gap-4 p-2 w-[70%] shadow-xl">
                    <div className="w-10 h-14 bg-gray-800">
                       <img src="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/boxshot.png" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-left">
                       <div className="text-white font-bold text-sm">Stranger Things</div>
                       <div className="text-blue-500 text-xs">Downloading...</div>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-gray-600 border-t-blue-500 animate-spin"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
      
      <div className="border-t-8 border-[#232323] py-16 px-6 md:px-20 bg-black text-center">
         <h2 className="text-3xl md:text-5xl font-bold mb-8">Frequently Asked Questions</h2>
         <div className="max-w-3xl mx-auto space-y-2 mb-12">
            {['What is Hoyeeh?', 'How much does it cost?', 'Where can I watch?', 'How do I cancel?'].map(q => (
                <div key={q} className="bg-[#2d2d2d] hover:bg-[#414141] transition p-6 text-left text-xl md:text-2xl flex justify-between cursor-pointer">
                   {q} <span>+</span>
                </div>
            ))}
         </div>
         <p className="text-lg text-gray-300 mb-6">Ready to watch? Enter your email to create or restart your membership.</p>
         <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl mx-auto items-center">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full md:flex-1 bg-black/60 border border-gray-500 rounded p-4 text-white placeholder-gray-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand h-14"
            />
            <button 
              onClick={() => onGetStarted(email)}
              className="bg-brand hover:bg-brand-dark text-white text-xl font-bold px-8 py-3 rounded h-14 flex items-center gap-2 transition w-full md:w-auto justify-center whitespace-nowrap"
            >
              Get Started <span className="text-2xl">›</span>
            </button>
          </div>
      </div>

      <div className="border-t-8 border-[#232323] py-12 px-6 md:px-20 bg-black text-gray-500 text-sm">
         <div className="max-w-5xl mx-auto">
            <p className="mb-6">Questions? Call 000-800-040-1843</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
               <a href="#" className="hover:underline">FAQ</a>
               <a href="#" className="hover:underline">Help Center</a>
               <a href="#" className="hover:underline">Account</a>
               <a href="#" className="hover:underline">Media Center</a>
               <a href="#" className="hover:underline">Investor Relations</a>
               <a href="#" className="hover:underline">Jobs</a>
               <a href="#" className="hover:underline">Ways to Watch</a>
               <a href="#" className="hover:underline">Terms of Use</a>
               <a href="#" className="hover:underline">Privacy</a>
               <a href="#" className="hover:underline">Cookie Preferences</a>
               <a href="#" className="hover:underline">Corporate Information</a>
               <a href="#" className="hover:underline">Contact Us</a>
               <a href="#" className="hover:underline">Speed Test</a>
               <a href="#" className="hover:underline">Legal Notices</a>
               <a href="#" className="hover:underline">Only on Hoyeeh</a>
            </div>
            <p>Hoyeeh Africa</p>
         </div>
      </div>
    </div>
  );
};
