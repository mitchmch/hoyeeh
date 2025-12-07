
import React from 'react';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: 'search', icon: 'search', label: 'Search' },
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'shows', icon: 'tv', label: 'TV Shows' },
    { id: 'movies', icon: 'movie', label: 'Movies' },
    { id: 'mylist', icon: 'plus', label: 'My List' },
  ];

  const icons: any = {
    search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    tv: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    movie: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />,
  };

  return (
    <aside className="hidden md:flex flex-col w-24 bg-black/95 border-r border-white/5 fixed left-0 top-0 bottom-0 z-50 py-8 items-center justify-between">
      {/* Logo Icon */}
      <div className="mb-8">
        <h1 className="text-brand font-black text-2xl tracking-tighter cursor-pointer" onClick={() => onChangeView('home')}>H</h1>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-8 w-full">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`relative group w-full flex justify-center py-2 transition-all duration-300 ${isActive ? 'text-white' : 'text-gray-500 hover:text-white'}`}
              title={item.label}
            >
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand rounded-l-md shadow-[0_0_10px_rgba(234,88,12,0.5)]"></div>
              )}
              <svg className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {icons[item.icon]}
              </svg>
            </button>
          );
        })}
      </nav>

      {/* Bottom Icons (Settings/Admin maybe) */}
      <div className="flex flex-col gap-6">
         {/* Placeholder for settings icon */}
      </div>
    </aside>
  );
};
