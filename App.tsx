
import React, { useState, useEffect } from 'react';
import { User, Content } from './types';
import { api, authEvents } from './services/api';
import { tmdb } from './services/tmdb';
import { offlineStorage } from './services/offlineStorage';
import { VideoPlayer } from './components/VideoPlayer';
import { PaymentModal } from './components/PaymentModal';
import { AdminPanel } from './components/AdminPanel';
import { UserDashboard } from './components/UserDashboard';
import { Button } from './components/Button';
import { Toast } from './components/Toast';
import { Skeleton } from './components/Skeleton';
import { ContentDetailsModal } from './components/ContentDetailsModal';
import { ContentCard } from './components/ContentCard';
import { Sidebar } from './components/Sidebar';
import { AFRICAN_COUNTRIES } from './constants';
import { DownloadProvider } from './contexts/DownloadContext';

type ViewState = 'home' | 'movies' | 'shows' | 'player' | 'admin' | 'mylist' | 'profile' | 'search';
type ToastState = { message: string, type: 'success' | 'error' | 'info' } | null;

const HoyeehApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [content, setContent] = useState<Content[]>([]);
  const [myListContent, setMyListContent] = useState<Content[]>([]);
  
  const [recMovies, setRecMovies] = useState<Content[]>([]);
  const [recShows, setRecShows] = useState<Content[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [loadingContent, setLoadingContent] = useState(false);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [playingContent, setPlayingContent] = useState<{ url: string, title: string, id: string, progress: number } | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  
  const [showPayment, setShowPayment] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auth State
  const [mobileNumber, setMobileNumber] = useState('');
  const [pin, setPin] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const token = localStorage.getItem('hoyeeh_token');
    const storedUser = localStorage.getItem('hoyeeh_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    const handleSessionExpired = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        handleLogout();
        showToast(detail || 'Session expired', 'error');
    };
    
    const handleUnauthorized = () => {
        handleLogout();
    };

    authEvents.addEventListener('session-expired', handleSessionExpired);
    authEvents.addEventListener('unauthorized', handleUnauthorized);
    
    const handleOnline = () => { setIsOnline(true); showToast('You are back online', 'success'); };
    const handleOffline = () => { setIsOnline(false); showToast('You are offline. Showing downloads.', 'info'); };
    
    const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
        authEvents.removeEventListener('session-expired', handleSessionExpired);
        authEvents.removeEventListener('unauthorized', handleUnauthorized);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (['home', 'movies', 'shows'].includes(currentView)) {
        loadContent();
        loadRecommendations(); 
      }

      if (currentView === 'mylist') loadMyList();
      if (currentView === 'search') {
          const delayDebounceFn = setTimeout(() => {
            loadContent(searchQuery);
          }, 300);
          return () => clearTimeout(delayDebounceFn);
      }
    }
  }, [user, currentView, searchQuery, isOnline]);

  const enrichContent = async (items: Content[]) => {
    if (!isOnline) return items;
    
    const promises = items.map(async (item) => {
        if (!item.thumbnailUrl || item.thumbnailUrl === '' || item.thumbnailUrl.includes('No+Cover') || item.thumbnailUrl.includes('via.placeholder')) {
            try {
                const movieData = await tmdb.searchMovie(item.title);
                if (movieData?.thumbnailUrl) {
                    return { ...item, thumbnailUrl: movieData.thumbnailUrl };
                }
            } catch (e) { }
        }
        return item;
    });
    
    return Promise.all(promises);
  };

  const loadContent = async (query?: string) => {
    setLoadingContent(true);
    try {
      if (!isOnline) {
          const downloads = await offlineStorage.getAllDownloads();
          const offlineContent = downloads.map(d => d.content);
          setContent(offlineContent);
      } else {
          const data = await api.content.getAll(query);
          setContent(data); 
          enrichContent(data).then(enrichedData => {
             setContent(enrichedData);
          });
      }
    } catch (err) {
      console.error("Failed to load content", err);
    } finally {
      setLoadingContent(false);
    }
  };

  const loadRecommendations = async () => {
    if (!isOnline) return;
    setLoadingRecs(true);
    try {
        const { movies, shows } = await api.user.getRecommendations();
        setRecMovies(movies);
        setRecShows(shows);
        
        enrichContent(movies).then(setRecMovies);
        enrichContent(shows).then(setRecShows);
    } catch (err) {
        console.error("Failed to load recommendations");
    } finally {
        setLoadingRecs(false);
    }
  };

  const loadMyList = async () => {
     if (!isOnline) {
         setMyListContent([]); 
         return;
     }
     setLoadingContent(true);
     try {
       const data = await api.user.getMyList();
       setMyListContent(data);
       enrichContent(data).then(setMyListContent);
     } catch (err) {
       console.error("Failed to load list", err);
     } finally {
       setLoadingContent(false);
     }
  };

  const toggleMyList = async (item: Content) => {
    if (!isOnline) return showToast("Available only when online", 'error');
    if (!user) return;
    const isInList = user.myList?.includes(item.id);
    
    try {
        let updatedList;
        if (isInList) {
            await api.user.removeFromMyList(item.id);
            updatedList = user.myList.filter(id => id !== item.id);
            showToast("Removed from My List", 'info');
        } else {
            await api.user.addToMyList(item.id);
            updatedList = [...(user.myList || []), item.id];
            showToast("Added to My List", 'success');
        }
        
        const updatedUser = { ...user, myList: updatedList };
        setUser(updatedUser);
        localStorage.setItem('hoyeeh_user', JSON.stringify(updatedUser));
        
        if (currentView === 'mylist') loadMyList(); 
    } catch (err) {
        showToast("Failed to update list", 'error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isResetting) {
        await api.auth.resetPin(mobileNumber, secretWord, pin);
        setIsResetting(false);
        showToast('PIN Reset Successful. Please Login.', 'success');
        return;
      }

      if (isRegistering) {
        await api.auth.register(mobileNumber, pin, secretWord, showAdminCode ? adminCode : undefined);
        setIsRegistering(false);
        setAdminCode('');
        setShowAdminCode(false);
        showToast('Registration Successful. Please Sign In.', 'success');
        return;
      }

      const userData = await api.auth.login(mobileNumber, pin);
      setUser(userData);
      localStorage.setItem('hoyeeh_token', userData.token!);
      localStorage.setItem('hoyeeh_user', JSON.stringify(userData));
      showToast(`Welcome back!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    }
  };

  const handleDemoLogin = async () => {
    try {
        const userData = await api.auth.demoLogin();
        setUser(userData);
        localStorage.setItem('hoyeeh_token', userData.token!);
        localStorage.setItem('hoyeeh_user', JSON.stringify(userData));
        showToast(`Welcome to Hoyeeh Demo!`, 'success');
    } catch (err: any) {
        showToast("Demo Login Failed: " + err.message, 'error');
    }
  };

  const handleResetData = async () => {
      if (!window.confirm("Warning: This will delete ALL users and content data. Are you sure?")) return;
      try {
          await api.debug.reset();
          showToast("System reset complete. Please register fresh.", 'success');
          handleLogout();
      } catch (e: any) {
          showToast("Reset failed: " + e.message, 'error');
      }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('hoyeeh_token');
    localStorage.removeItem('hoyeeh_user');
    setCurrentView('home');
    setPlayingContent(null);
    setSelectedContent(null);
    setMobileNumber('');
    setPin('');
  };

  const handleContentClick = (item: Content) => {
    setSelectedContent(item);
  };

  const handlePlay = async (item: Content, startProgress = 0) => {
    if (item.isPremium && !user?.isSubscribed) {
      setShowPayment(true);
      return;
    }

    try {
      const offlineItem = await offlineStorage.getVideo(item.id);
      
      if (offlineItem) {
          const blobUrl = URL.createObjectURL(offlineItem.blob);
          setPlayingContent({ url: blobUrl, title: item.title, id: item.id, progress: startProgress });
          setSelectedContent(null);
          setCurrentView('player');
          return;
      }

      if (!isOnline) {
          showToast("Connect to internet to watch this video", 'error');
          return;
      }

      const data = await api.content.getSignedUrl(item.id);
      const progressToUse = startProgress > 0 ? startProgress : (data.progress || 0);
      
      setPlayingContent({ url: data.url, title: item.title, id: item.id, progress: progressToUse });
      setSelectedContent(null); 
      setCurrentView('player');
    } catch (err) {
       showToast("Failed to play video", 'error');
    }
  };

  const handleSubscriptionSuccess = () => {
    if (!user) return;
    const updatedUser = { ...user, isSubscribed: true };
    setUser(updatedUser);
    localStorage.setItem('hoyeeh_user', JSON.stringify(updatedUser));
    setShowPayment(false);
    showToast('Welcome to Hoyeeh Premium!', 'success');
  };

  const getDisplayContent = () => {
      if (currentView === 'movies') return content.filter(c => c.contentType === 'movie');
      if (currentView === 'shows') return content.filter(c => c.contentType === 'series');
      return content;
  };

  const displayContent = getDisplayContent();

  if (currentView === 'player' && playingContent) {
    return <VideoPlayer 
        src={playingContent.url} 
        title={playingContent.title}
        contentId={playingContent.id}
        initialProgress={playingContent.progress}
        isOffline={playingContent.url.startsWith('blob:')}
        onBack={() => {
            if (playingContent.url.startsWith('blob:')) {
                URL.revokeObjectURL(playingContent.url);
            }
            setPlayingContent(null);
            setCurrentView('home');
        }} 
    />;
  }

  // Auth Screen (unchanged)
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/70"></div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="relative z-10 w-full max-w-sm bg-dark-card/90 backdrop-blur-md p-8 rounded-xl border border-gray-800 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-brand tracking-tighter">Hoyeeh</h1>
            <p className="text-gray-400 text-sm mt-2">Streaming Africa to the World</p>
          </div>

          {!isRegistering && !isResetting && (
              <button 
                onClick={handleDemoLogin}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded mb-6 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Instant Demo Access
              </button>
          )}

          <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-gray-700 flex-1"></div>
              <span className="text-gray-500 text-xs uppercase">OR</span>
              <div className="h-px bg-gray-700 flex-1"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Mobile Number</label>
              <input 
                type="tel" 
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded mt-1 focus:border-brand focus:outline-none"
                placeholder="e.g., 237677..."
                required 
              />
            </div>

            {(isRegistering || isResetting) && (
              <div>
                <label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Secret Word</label>
                <input 
                  type="text" 
                  value={secretWord}
                  onChange={(e) => setSecretWord(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded mt-1 focus:border-brand focus:outline-none"
                  placeholder="For recovery"
                  required 
                />
              </div>
            )}

            <div>
              <label className="text-gray-400 text-xs uppercase font-bold tracking-wider">{isResetting ? 'New PIN' : 'PIN'}</label>
              <input 
                type="password" 
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded mt-1 focus:border-brand focus:outline-none"
                placeholder="****"
                maxLength={4}
                required 
              />
            </div>

            {isRegistering && (
                <div className="pt-2">
                    <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" id="admin" className="accent-brand" checked={showAdminCode} onChange={e => setShowAdminCode(e.target.checked)} />
                        <label htmlFor="admin" className="text-xs text-gray-400">Register as Partner/Admin</label>
                    </div>
                    {showAdminCode && (
                        <input 
                            type="password" 
                            value={adminCode}
                            onChange={(e) => setAdminCode(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded focus:border-brand focus:outline-none"
                            placeholder="Admin Code"
                        />
                    )}
                </div>
            )}

            <Button type="submit" fullWidth>
              {isResetting ? 'Reset PIN' : isRegistering ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            {!isResetting && !isRegistering && (
              <>
                <button onClick={() => setIsRegistering(true)} className="text-white hover:text-brand underline">New to Hoyeeh? Sign up</button>
                <button onClick={() => setIsResetting(true)} className="text-gray-500 hover:text-gray-300">Forgot PIN?</button>
              </>
            )}
            {(isRegistering || isResetting) && (
              <button onClick={() => { setIsRegistering(false); setIsResetting(false); setAdminCode(''); setShowAdminCode(false); }} className="text-gray-400 hover:text-white">Back to Login</button>
            )}
          </div>
        </div>
        
        <button 
            onClick={handleResetData}
            className="fixed bottom-4 right-4 text-xs text-gray-600 hover:text-red-500 font-mono opacity-50 hover:opacity-100 transition"
        >
            [ Reset Demo Data ]
        </button>
      </div>
    );
  }

  if (currentView === 'admin') {
    return <AdminPanel onBack={() => setCurrentView('home')} showToast={showToast} />;
  }

  if (currentView === 'profile') {
      return <UserDashboard 
        user={user} 
        onBack={() => setCurrentView('home')} 
        onLogout={handleLogout}
        onPlay={handlePlay}
        deferredPrompt={deferredPrompt}
      />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {showPayment && (
        <PaymentModal 
          user={user} 
          onSuccess={handleSubscriptionSuccess} 
          onClose={() => setShowPayment(false)} 
        />
      )}

      {selectedContent && (
        <ContentDetailsModal 
          content={selectedContent} 
          onClose={() => setSelectedContent(null)}
          onPlay={() => handlePlay(selectedContent)}
          onToggleMyList={() => toggleMyList(selectedContent)}
          isInMyList={user.myList?.includes(selectedContent.id) || false}
        />
      )}

      {/* Desktop Sidebar */}
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-24 relative pb-20 md:pb-0 overflow-x-hidden min-h-screen">
          
          {/* Top Profile/Admin Bar (Desktop) */}
          <div className="hidden md:flex absolute top-0 right-0 z-40 p-6 items-center gap-6 bg-gradient-to-b from-black/80 to-transparent w-full justify-end pointer-events-none">
             <div className="pointer-events-auto flex items-center gap-4">
                {currentView === 'search' && (
                     <input 
                       type="text" 
                       placeholder="Titles, people, genres" 
                       className="bg-black/50 border border-gray-600 rounded-full px-4 py-2 text-sm text-white focus:border-brand focus:outline-none w-64 backdrop-blur-md transition-all focus:w-80"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       autoFocus
                     />
                )}
                {user.role === 'admin' && (
                  <button onClick={() => setCurrentView('admin')} className="text-gray-300 hover:text-white font-medium text-sm">
                    Admin
                  </button>
                )}
                <button onClick={() => setCurrentView('profile')} className="w-9 h-9 rounded bg-brand flex items-center justify-center font-bold text-white border border-transparent hover:border-white transition shadow-lg">
                    {user.mobileNumber.slice(-2)}
                </button>
             </div>
          </div>

          {/* Search View Mobile Input */}
          {currentView === 'search' && (
            <div className="pt-24 px-4 md:px-8 animate-fade-in md:hidden">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search movies, genres..." 
                  className="w-full bg-gray-800 border border-gray-700 p-3 rounded text-white focus:border-brand focus:outline-none mb-6"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          )}
          
          {/* My List View */}
          {currentView === 'mylist' && (
             <div className="pt-24 px-4 md:px-8 min-h-screen animate-fade-in">
                <h2 className="text-3xl font-bold text-white mb-6">My List</h2>
                {!isOnline && <p className="text-gray-500 mb-4">Offline mode. Sync unavailable.</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {myListContent.map((item) => (
                        <ContentCard 
                            key={item.id} 
                            item={item} 
                            onClick={handleContentClick}
                            onToggleList={() => toggleMyList(item)}
                            isInList={true}
                        />
                    ))}
                    {myListContent.length === 0 && !loadingContent && <p className="text-gray-500 col-span-full">Your list is empty.</p>}
                </div>
             </div>
          )}

          {/* Home/Movies/Shows View */}
          {['home', 'movies', 'shows'].includes(currentView) && (
             <>
                {/* Hero Section */}
                {displayContent.length > 0 && (
                   <div className="relative h-[85vh] w-full group">
                      <div className="absolute inset-0">
                         <img 
                           src={displayContent[0].thumbnailUrl} 
                           className="w-full h-full object-cover"
                           alt="Hero"
                         />
                         {/* Gradient Overlay matching image style */}
                         <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent"></div>
                         <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-transparent"></div>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full md:w-2/3 flex flex-col justify-end h-full pb-20 md:pb-24">
                          {/* Metadata Badge Row */}
                          <div className="flex items-center gap-3 mb-4 animate-slide-up" style={{animationDelay: '0.1s'}}>
                              <div className="flex items-center gap-1">
                                 <span className="text-[#db202c] font-black text-2xl tracking-tighter">N</span>
                                 <span className="text-gray-300 text-xs tracking-[0.2em] font-medium">SERIES</span>
                              </div>
                          </div>

                          {/* Title */}
                          <h1 className="text-5xl md:text-7xl font-black text-white mb-4 leading-[0.9] uppercase tracking-tighter drop-shadow-2xl animate-slide-up" style={{animationDelay: '0.2s'}}>
                              {displayContent[0].title}
                          </h1>

                          {/* Info Row */}
                          <div className="flex items-center gap-4 text-white font-medium mb-6 animate-slide-up" style={{animationDelay: '0.3s'}}>
                              <span className="bg-yellow-500 text-black text-xs px-1 rounded font-bold">IMDb 8.8/10</span>
                              <span className="text-gray-300">2B+ Streams</span>
                              <span className="border border-gray-500 px-1 text-xs rounded text-gray-300">4K</span>
                              <span className="text-green-400 text-sm font-bold">98% Match</span>
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-4 animate-slide-up" style={{animationDelay: '0.4s'}}>
                             <button 
                               onClick={() => handlePlay(displayContent[0])}
                               className="bg-brand hover:bg-brand-dark text-white px-8 py-3 rounded text-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 shadow-[0_0_20px_rgba(234,88,12,0.4)]"
                             >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                Play
                             </button>
                             <button 
                               onClick={() => handleContentClick(displayContent[0])}
                               className="bg-gray-500/40 hover:bg-gray-500/60 backdrop-blur-md text-white px-8 py-3 rounded text-lg font-bold flex items-center gap-2 transition-colors border border-white/10"
                             >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                More Info
                             </button>
                          </div>
                      </div>
                   </div>
                )}

                {/* Rows */}
                <div className="relative z-10 -mt-32 pb-10 space-y-12 pl-4 md:pl-12">
                   {loadingContent ? (
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 pr-4">
                            {[...Array(6)].map((_,i) => <Skeleton key={i} className="aspect-[2/3] rounded-md" />)}
                        </div>
                   ) : (
                        <>
                             {currentView === 'home' && (
                                 <Section 
                                    title="New this week" 
                                    content={displayContent.slice(0, 10)} 
                                    onClick={handleContentClick} 
                                    onToggleList={toggleMyList}
                                    userList={user.myList}
                                 />
                             )}
                             
                             <Section 
                                title="Trending Now" 
                                content={displayContent.slice().reverse().slice(0, 10)} 
                                onClick={handleContentClick}
                                onToggleList={toggleMyList}
                                userList={user.myList}
                             />

                             {recMovies.length > 0 && (
                                <Section 
                                    title="Recommended Movies" 
                                    content={recMovies} 
                                    onClick={handleContentClick}
                                    onToggleList={toggleMyList}
                                    userList={user.myList}
                                />
                             )}
                        </>
                   )}
                </div>
             </>
          )}

           {/* Mobile Bottom Nav */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-gray-800 flex justify-around py-3 z-50 pb-safe">
            <NavIcon icon="home" label="Home" active={currentView === 'home'} onClick={() => setCurrentView('home')} />
            <NavIcon icon="movie" label="Movies" active={currentView === 'movies'} onClick={() => setCurrentView('movies')} />
            <NavIcon icon="tv" label="Series" active={currentView === 'shows'} onClick={() => setCurrentView('shows')} />
            <NavIcon icon="search" label="Search" active={currentView === 'search'} onClick={() => setCurrentView('search')} />
            <NavIcon icon="download" label="My List" active={currentView === 'mylist'} onClick={() => setCurrentView('mylist')} />
          </div>
      </main>
    </div>
  );
}

// Sub-components
const Section: React.FC<{ title: string; content: Content[]; onClick: any; onToggleList: any; userList: string[] }> = ({ title, content, onClick, onToggleList, userList }) => {
  if (content.length === 0) return null;
  return (
    <div className="animate-fade-in">
      <h3 className="text-xl md:text-2xl font-bold text-white mb-4 hover:text-brand cursor-pointer flex items-center gap-2 group">
        {title}
        <span className="text-brand text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">Explore All &gt;</span>
      </h3>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-8 snap-x pr-8">
        {content.map((item) => (
          <div key={item.id} className="flex-none w-[160px] md:w-[220px] snap-center transition-transform hover:scale-105 duration-300 origin-center">
             <ContentCard 
                item={item} 
                onClick={onClick}
                onToggleList={onToggleList}
                isInList={userList?.includes(item.id)} 
             />
          </div>
        ))}
      </div>
    </div>
  );
};

const NavIcon: React.FC<{ icon: string; label: string; active?: boolean; onClick: () => void; }> = ({ icon, label, active, onClick }) => {
  const icons: any = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    movie: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />,
    tv: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  };

  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icons[icon]}
      </svg>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
};

const App = () => (
  <DownloadProvider>
    <HoyeehApp />
  </DownloadProvider>
);

export default App;
