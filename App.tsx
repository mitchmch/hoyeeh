
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
import { FeedbackModal } from './components/FeedbackModal';
import { Logo } from './components/Logo';

type ViewState = 'home' | 'movies' | 'shows' | 'player' | 'admin' | 'mylist' | 'profile' | 'search';
type ToastState = { message: string, type: 'success' | 'error' | 'info' } | null;

const HoyeehApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isProfileSelected, setIsProfileSelected] = useState(false);
  const [editMode, setEditMode] = useState(false); // Added missing state
  
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

  // Feedback State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<Content | null>(null);
  
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
      // If user is already stored, we show profile selector first
      setIsProfileSelected(false);
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
    if (user && isProfileSelected) {
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
  }, [user, isProfileSelected, currentView, searchQuery, isOnline]);

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
      setIsProfileSelected(false); // Go to profile selection
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
        setIsProfileSelected(false);
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
    setIsProfileSelected(false);
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

  const handleFeedbackSubmit = async (data: any) => {
    try {
       await api.user.submitFeedback(data);
       showToast("Thank you for your feedback!", 'success');
       setFeedbackTarget(null);
    } catch (err) {
       showToast("Failed to submit feedback", 'error');
    }
  };

  const openFeedback = (item?: Content) => {
      setFeedbackTarget(item || null);
      setIsFeedbackOpen(true);
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

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col p-6 relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
             <img src="https://assets.nflxext.com/ffe/siteui/vlv3/9d3533b2-0e2b-40b2-95e0-ecd7979cc93b/d3a7396f-6d74-47b2-15b7-b77525be4301/IN-en-20240311-popsignuptwoweeks-perspective_alpha_website_small.jpg" 
                  className="w-full h-full object-cover opacity-50" />
             <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black"></div>
        </div>

        {/* Top Bar */}
        <div className="relative z-10 flex justify-between items-center mb-12 pt-4">
             <Logo className="w-24 h-12" />
             <button className="text-white text-sm font-medium" onClick={() => { setIsRegistering(!isRegistering); setIsResetting(false); }}>
                 {isRegistering ? 'Sign In' : 'Help'}
             </button>
        </div>

        {/* Login Form Container */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-md mx-auto w-full animate-fade-in">
           {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
           
           <h2 className="text-3xl font-bold text-white mb-8">{isResetting ? 'Reset PIN' : isRegistering ? 'Create Account' : 'Sign In'}</h2>
           
           {!isRegistering && !isResetting && (
              <button 
                onClick={handleDemoLogin}
                className="w-full bg-white text-black font-bold py-3 rounded mb-6 flex items-center justify-center gap-2 hover:bg-gray-200 transition"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Instant Demo Access
              </button>
           )}

           <form onSubmit={handleLogin} className="space-y-4">
             <div className="relative group">
               <input 
                 type="tel" 
                 value={mobileNumber}
                 onChange={(e) => setMobileNumber(e.target.value)}
                 className="w-full bg-[#333] text-white rounded px-4 pt-5 pb-2 outline-none focus:bg-[#454545] peer transition-colors"
                 required 
               />
               <label className={`absolute left-4 top-3.5 text-gray-400 text-sm transition-all peer-focus:text-[10px] peer-focus:top-1 ${mobileNumber ? 'top-1 text-[10px]' : ''}`}>
                 Email or phone number
               </label>
             </div>

             <div className="relative group">
                <input 
                  type="password" 
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-[#333] text-white rounded px-4 pt-5 pb-2 outline-none focus:bg-[#454545] peer transition-colors"
                  maxLength={4}
                  required 
                />
                <label className={`absolute left-4 top-3.5 text-gray-400 text-sm transition-all peer-focus:text-[10px] peer-focus:top-1 ${pin ? 'top-1 text-[10px]' : ''}`}>
                  PIN (4 digits)
                </label>
             </div>

             {(isRegistering || isResetting) && (
               <div className="relative group">
                  <input 
                    type="text" 
                    value={secretWord}
                    onChange={(e) => setSecretWord(e.target.value)}
                    className="w-full bg-[#333] text-white rounded px-4 pt-5 pb-2 outline-none focus:bg-[#454545] peer transition-colors"
                    required 
                  />
                  <label className={`absolute left-4 top-3.5 text-gray-400 text-sm transition-all peer-focus:text-[10px] peer-focus:top-1 ${secretWord ? 'top-1 text-[10px]' : ''}`}>
                    Secret Word
                  </label>
               </div>
             )}

             {isRegistering && (
                <div className="flex items-center gap-2 py-2">
                    <input type="checkbox" id="admin" className="accent-brand w-4 h-4" checked={showAdminCode} onChange={e => setShowAdminCode(e.target.checked)} />
                    <label htmlFor="admin" className="text-sm text-gray-400">Partner Code</label>
                </div>
             )}
             
             {showAdminCode && isRegistering && (
                <div className="relative group">
                    <input 
                        type="password" 
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        className="w-full bg-[#333] text-white rounded px-4 p-3 outline-none focus:bg-[#454545]"
                        placeholder="Enter Admin Code"
                    />
                </div>
             )}

             <Button type="submit" fullWidth className="mt-6 py-4 font-bold text-base bg-brand hover:bg-brand-dark">
               {isResetting ? 'Reset PIN' : isRegistering ? 'Sign Up' : 'Sign In'}
             </Button>

             {!isRegistering && !isResetting && (
                <div className="flex justify-between items-center text-sm text-gray-400 mt-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" className="accent-gray-500" /> Remember me
                    </label>
                    <button type="button" onClick={() => setIsResetting(true)} className="hover:underline">Need help?</button>
                </div>
             )}
           </form>

           <div className="mt-8">
             <div className="text-gray-500 text-base">
                {isRegistering ? 'Already have an account?' : 'New to Hoyeeh?'}{' '}
                <button 
                    onClick={() => { setIsRegistering(!isRegistering); setIsResetting(false); }}
                    className="text-white hover:underline font-medium"
                >
                    {isRegistering ? 'Sign in now' : 'Sign up now'}.
                </button>
             </div>
           </div>
        </div>
      </div>
    );
  }

  // 2. PROFILE SELECTION SCREEN
  if (!isProfileSelected && user) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center animate-fade-in relative">
              <div className="absolute top-6 right-6">
                  <button onClick={() => setEditMode(prev => !prev)} className="text-gray-400 font-bold text-sm tracking-widest hover:text-white">
                     {editMode ? 'DONE' : 'EDIT'}
                  </button>
              </div>

              <div className="absolute top-6 left-0 right-0 flex justify-center pt-8">
                  <Logo className="w-32 h-16" />
              </div>

              <h2 className="text-white text-xl md:text-3xl font-medium mb-8">Who's Watching?</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 px-8">
                  {/* Main Profile */}
                  <div className="flex flex-col items-center gap-3 group cursor-pointer" onClick={() => setIsProfileSelected(true)}>
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center relative overflow-hidden ring-2 ring-transparent group-hover:ring-white transition-all">
                          <span className="text-4xl font-bold text-white">{user.mobileNumber.slice(-2)}</span>
                          {editMode && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></div>}
                      </div>
                      <span className="text-gray-400 group-hover:text-white transition font-medium">My Profile</span>
                  </div>

                  {/* Kids Profile (Dummy) */}
                  <div className="flex flex-col items-center gap-3 group cursor-pointer" onClick={() => setIsProfileSelected(true)}>
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center relative overflow-hidden ring-2 ring-transparent group-hover:ring-white transition-all">
                          <span className="text-3xl font-bold text-white">Kids</span>
                          {editMode && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></div>}
                      </div>
                      <span className="text-gray-400 group-hover:text-white transition font-medium">Kids</span>
                  </div>

                  {/* Add Profile */}
                  <div className="flex flex-col items-center gap-3 group cursor-pointer opacity-70 hover:opacity-100">
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded border-2 border-gray-600 flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all">
                          <svg className="w-12 h-12 text-gray-400 group-hover:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                      </div>
                      <span className="text-gray-400 group-hover:text-white transition font-medium">Add Profile</span>
                  </div>
              </div>
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
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col md:flex-row">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {showPayment && (
        <PaymentModal 
          user={user} 
          onSuccess={handleSubscriptionSuccess} 
          onClose={() => setShowPayment(false)} 
        />
      )}

      {isFeedbackOpen && (
        <FeedbackModal 
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          onSubmit={handleFeedbackSubmit}
          initialContentId={feedbackTarget?.id}
          initialTitle={feedbackTarget?.title}
        />
      )}

      {selectedContent && (
        <ContentDetailsModal 
          content={selectedContent} 
          onClose={() => setSelectedContent(null)}
          onPlay={() => handlePlay(selectedContent)}
          onToggleMyList={() => toggleMyList(selectedContent)}
          onRate={() => openFeedback(selectedContent)}
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
                <button onClick={() => setIsProfileSelected(false)} className="w-9 h-9 rounded bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center font-bold text-white border border-transparent hover:border-white transition shadow-lg">
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
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                   <div className="relative h-[80vh] md:h-[85vh] w-full group">
                      <div className="absolute inset-0">
                         <img 
                           src={displayContent[0].thumbnailUrl} 
                           className="w-full h-full object-cover"
                           alt="Hero"
                         />
                         {/* Gradient Overlays */}
                         <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/20 to-transparent"></div>
                         <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent md:hidden"></div>
                      </div>
                      
                      {/* Mobile Top Bar */}
                      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 md:hidden">
                         <Logo className="w-10 h-10 rounded-lg" variant="icon" />
                         <div className="flex gap-4 font-semibold text-white text-sm shadow-black drop-shadow-md">
                            <span onClick={() => setCurrentView('shows')} className={currentView === 'shows' ? 'text-white' : 'text-gray-300'}>TV Shows</span>
                            <span onClick={() => setCurrentView('movies')} className={currentView === 'movies' ? 'text-white' : 'text-gray-300'}>Movies</span>
                            <span onClick={() => setCurrentView('mylist')} className={currentView === 'mylist' ? 'text-white' : 'text-gray-300'}>My List</span>
                         </div>
                      </div>

                      <div className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-end pb-10 md:items-start md:pl-12 md:pb-24">
                          
                          {/* Metadata - Genre row */}
                          <div className="flex items-center gap-2 mb-4 text-sm font-medium text-white drop-shadow-md md:hidden">
                                <span>{displayContent[0].genre}</span>
                                <span className="text-gray-400">•</span>
                                <span>Exciting</span>
                                <span className="text-gray-400">•</span>
                                <span>Drama</span>
                          </div>

                          {/* Desktop Title & Meta (Hidden on Mobile usually or simplified) */}
                          <div className="hidden md:block mb-6">
                              <h1 className="text-7xl font-black text-white mb-4 leading-[0.9] uppercase tracking-tighter drop-shadow-2xl">
                                  {displayContent[0].title}
                              </h1>
                              <div className="flex items-center gap-4 text-white font-medium">
                                  <span className="bg-yellow-500 text-black text-xs px-1 rounded font-bold">IMDb 8.8</span>
                                  <span className="text-green-400 text-sm font-bold">98% Match</span>
                              </div>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="flex items-center gap-4 md:gap-4 w-full justify-center md:justify-start px-4">
                             {/* My List Button (Mobile) */}
                             <div className="flex flex-col items-center gap-1 cursor-pointer md:hidden" onClick={() => toggleMyList(displayContent[0])}>
                                 {user.myList?.includes(displayContent[0].id) ? (
                                    <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                                 ) : (
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                 )}
                                 <span className="text-[10px] text-gray-300 font-medium">My List</span>
                             </div>

                             {/* Play Button */}
                             <button 
                               onClick={() => handlePlay(displayContent[0])}
                               className="bg-white text-black px-6 py-2 rounded-md font-bold flex items-center gap-2 hover:bg-gray-200 transition min-w-[100px] justify-center md:px-8 md:py-3 md:text-lg"
                             >
                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                Play
                             </button>

                             {/* Info Button */}
                             <div className="flex flex-col items-center gap-1 cursor-pointer md:hidden" onClick={() => handleContentClick(displayContent[0])}>
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 <span className="text-[10px] text-gray-300 font-medium">Info</span>
                             </div>

                             {/* Desktop More Info Button */}
                             <button 
                               onClick={() => handleContentClick(displayContent[0])}
                               className="hidden md:flex bg-gray-500/40 hover:bg-gray-500/60 backdrop-blur-md text-white px-8 py-3 rounded text-lg font-bold items-center gap-2 transition-colors border border-white/10"
                             >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                More Info
                             </button>
                          </div>
                      </div>
                   </div>
                )}

                {/* Rows */}
                <div className="relative z-10 -mt-8 md:-mt-32 pb-24 space-y-8 pl-4 md:pl-12">
                   {loadingContent ? (
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pr-4">
                            {[...Array(6)].map((_,i) => <Skeleton key={i} className="aspect-[2/3] rounded-md" />)}
                        </div>
                   ) : (
                        <>
                             {currentView === 'home' && (
                                 <Section 
                                    title="New Releases" 
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
                                    title="Top Picks for You" 
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
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121212]/95 backdrop-blur-md border-t border-gray-800 flex justify-around py-3 z-50 pb-safe">
            <NavIcon icon="home" label="Home" active={currentView === 'home'} onClick={() => setCurrentView('home')} />
            <NavIcon icon="game" label="Games" active={false} onClick={() => {}} /> {/* Decorative for Netflix feel */}
            <NavIcon icon="movie" label="New & Hot" active={currentView === 'movies'} onClick={() => setCurrentView('movies')} />
            <NavIcon icon="download" label="Downloads" active={currentView === 'mylist'} onClick={() => setCurrentView('mylist')} />
          </div>

          {/* General Feedback Floating Button */}
          <button 
             onClick={() => openFeedback()}
             className="fixed bottom-20 md:bottom-10 right-4 md:right-10 z-[60] bg-gray-800 text-white p-3 rounded-full shadow-xl hover:bg-gray-700 transition-transform hover:scale-105 border border-gray-700"
             aria-label="Send Feedback"
          >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
          </button>
      </main>
    </div>
  );
}

// Sub-components
const Section: React.FC<{ title: string; content: Content[]; onClick: any; onToggleList: any; userList: string[] }> = ({ title, content, onClick, onToggleList, userList }) => {
  if (content.length === 0) return null;
  return (
    <div className="animate-fade-in">
      <h3 className="text-lg md:text-2xl font-bold text-white mb-3 hover:text-brand cursor-pointer flex items-center gap-2 group pl-1">
        {title}
        <span className="text-brand text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 hidden md:inline">Explore All &gt;</span>
      </h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8 snap-x pr-4">
        {content.map((item) => (
          <div key={item.id} className="flex-none w-[110px] md:w-[220px] snap-center transition-transform hover:scale-105 duration-300 origin-center">
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
    tv: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    game: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
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

const App = () => {
    return (
        <DownloadProvider>
            <HoyeehApp />
        </DownloadProvider>
    );
};

export default App;
