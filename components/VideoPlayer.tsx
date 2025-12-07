
import React, { useEffect, useRef, useState, useCallback } from 'react';
import videojs from 'video.js';
import { api } from '../services/api';
// CSS is loaded in index.html via CDN to avoid resolution issues in browser ESM
import type Player from 'video.js/dist/types/player';

interface VideoPlayerProps {
  src: string;
  title?: string;
  contentId?: string; // Needed for saving progress
  initialProgress?: number; // Fetched from backend
  poster?: string;
  isOffline?: boolean;
  onBack: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title, contentId, initialProgress = 0, poster, isOffline, onBack }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const progressInterval = useRef<any>(null);
  const lastTapRef = useRef<{time: number, x: number}>({time: 0, x: 0});
  
  // UX State
  const [showControls, setShowControls] = useState(true);
  const [seekFeedback, setSeekFeedback] = useState<'backward' | 'forward' | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Quality State (Mock/Basic implementation since standard HLS plugin access varies)
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [qualityLevel, setQualityLevel] = useState<'Auto' | 'High' | 'Low'>('Auto');

  useEffect(() => {
    // Keyboard Event Listener
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!playerRef.current) return;
        const player = playerRef.current;
        
        switch(e.key) {
            case 'ArrowLeft':
                player.currentTime(Math.max(0, player.currentTime() - 10));
                setSeekFeedback('backward');
                setTimeout(() => setSeekFeedback(null), 600);
                break;
            case 'ArrowRight':
                player.currentTime(Math.min(player.duration(), player.currentTime() + 10));
                setSeekFeedback('forward');
                setTimeout(() => setSeekFeedback(null), 600);
                break;
            case ' ':
            case 'k':
                if (player.paused()) player.play();
                else player.pause();
                break;
            case 'f':
                if (player.isFullscreen()) player.exitFullscreen();
                else player.requestFullscreen();
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current?.appendChild(videoElement);

      const isHls = src.includes('.m3u8') || src.includes('/api/stream/manifest');

      const player = playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true,
        poster: poster,
        inactivityTimeout: 3000, // Hide controls after 3s of idleness
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        userActions: {
          hotkeys: true,
          doubleClick: false // Disable default fullscreen double-click to implement seek
        },
        html5: {
          hls: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: !videojs.browser.IS_SAFARI, // Safari often handles native HLS better on iOS
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false
        },
        sources: [{
          src: src,
          type: isHls ? 'application/x-mpegURL' : 'video/mp4'
        }]
      }, () => {
        // Init logic
        if (initialProgress > 0) player.currentTime(initialProgress);
        else if (contentId) {
            const savedTime = localStorage.getItem(`hoyeeh_progress_${contentId}`);
            if (savedTime) {
                const time = parseFloat(savedTime);
                if (time > 0) player.currentTime(time);
            }
        }
        
        // Auto focus for keyboard shortcuts
        videoElement.focus();
      });

      player.on('error', () => {
          const errorObj = player.error();
          let msg = 'An unexpected error occurred.';
          
          if (errorObj) {
              const code = errorObj.code;
              // Map HTML5 Media Error Codes to User-Friendly Messages
              switch (code) {
                  case 1: // MEDIA_ERR_ABORTED
                      msg = 'Playback was cancelled.';
                      break;
                  case 2: // MEDIA_ERR_NETWORK
                      msg = 'Network connection lost. Please check your internet connection.';
                      break;
                  case 3: // MEDIA_ERR_DECODE
                      msg = 'Video is corrupted or the format is not supported.';
                      break;
                  case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                      msg = 'Video unavailable or access denied. The link may have expired.';
                      break;
                  default:
                      msg = errorObj.message || 'We are unable to play this video right now.';
              }
          }
          setError(msg);
      });

      // Hook into Video.js user activity for the Top Bar
      player.on('useractive', () => setShowControls(true));
      player.on('userinactive', () => {
          if (!showQualityMenu) setShowControls(false); // Keep controls if menu open
      });

      // --- Sync Progress to Backend ---
      const syncProgress = async () => {
        if (contentId && playerRef.current) {
            const currentTime = playerRef.current.currentTime();
            if (currentTime > 5) { // Only save if watched more than 5s
                try {
                    // Only sync to API if online, otherwise just local
                    if (!isOffline && navigator.onLine) {
                        await api.user.updateProgress(contentId, currentTime);
                    }
                    localStorage.setItem(`hoyeeh_progress_${contentId}`, currentTime.toString());
                } catch (e) {
                    console.error("Failed to sync progress", e);
                }
            }
        }
      };

      player.on('pause', syncProgress);
      
      // Sync every 10 seconds while playing
      progressInterval.current = setInterval(() => {
          if (playerRef.current && !playerRef.current.paused()) {
              syncProgress();
          }
      }, 10000);

    } else {
      const player = playerRef.current;
      const isHls = src.includes('.m3u8') || src.includes('/api/stream/manifest');
      
      player.error(null); // Clear previous errors
      setError(null);
      player.autoplay(true);
      player.src({
        src: src,
        type: isHls ? 'application/x-mpegURL' : 'video/mp4'
      });
    }
  }, [src, poster, contentId, initialProgress]);

  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // --- Double Tap / Click Logic ---
  const handleTouchZoneClick = (side: 'left' | 'right') => {
      const now = Date.now();
      if (now - lastTapRef.current.time < 300) {
          // Double Tap Detected
          const player = playerRef.current;
          if (player) {
              const curr = player.currentTime();
              if (side === 'left') {
                  player.currentTime(Math.max(0, curr - 10));
                  setSeekFeedback('backward');
              } else {
                  player.currentTime(Math.min(player.duration(), curr + 10));
                  setSeekFeedback('forward');
              }
              // Hide feedback after animation
              setTimeout(() => setSeekFeedback(null), 600);
          }
      } else {
          // Single Tap - Toggle Play/Pause
          const player = playerRef.current;
          if(player) {
               if(player.paused()) player.play();
               else player.pause();
          }
      }
      lastTapRef.current = { time: now, x: 0 };
  };

  const handleRetry = () => {
      if(playerRef.current) {
          const currentTime = playerRef.current.currentTime();
          setError(null);
          playerRef.current.src(playerRef.current.currentSrc());
          playerRef.current.load();
          // Attempt to restore position if possible (might not work for live streams or specific errors)
          if (currentTime > 0) {
            playerRef.current.currentTime(currentTime);
          }
          playerRef.current.play().catch(e => {
             console.error("Retry play failed", e);
             setError("Retry failed. Please go back and try again.");
          });
      }
  };

  const handleQualityChange = (level: 'Auto' | 'High' | 'Low') => {
      // NOTE: Real HLS level switching requires access to player.tech().hls.representations()
      // This is a UI simulation that would hook into actual logic in a production environment with videojs-contrib-hls
      setQualityLevel(level);
      setShowQualityMenu(false);
      // Logic stub:
      // if (playerRef.current.tech_.hls) ...
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center font-sans">
      
      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 p-4 z-[60] bg-gradient-to-b from-black/90 to-transparent flex items-center gap-4 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <button 
            onClick={onBack}
            className="text-white hover:text-brand transition p-2 rounded-full hover:bg-white/10"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
        </button>
        {title && <h2 className="text-white text-lg font-bold drop-shadow-md truncate select-none">{title}</h2>}
        
        <div className="ml-auto flex items-center gap-4">
            {/* Quality Selector */}
            {!isOffline && (
                <div className="relative">
                    <button 
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="flex items-center gap-1 text-white text-sm font-bold bg-black/50 px-2 py-1 rounded hover:bg-white/20 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {qualityLevel}
                    </button>
                    {showQualityMenu && (
                        <div className="absolute top-full right-0 mt-2 bg-gray-900 border border-gray-700 rounded shadow-xl flex flex-col min-w-[100px] overflow-hidden">
                            {['Auto', 'High', 'Low'].map(lvl => (
                                <button 
                                    key={lvl} 
                                    onClick={() => handleQualityChange(lvl as any)}
                                    className={`px-4 py-2 text-left text-sm hover:bg-white/10 ${qualityLevel === lvl ? 'text-brand font-bold' : 'text-white'}`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isOffline && (
                <div className="bg-gray-800 text-gray-300 text-xs font-bold px-2 py-1 rounded border border-gray-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" /></svg>
                    OFFLINE
                </div>
            )}
        </div>
      </div>

      {/* Seek Zones */}
      <div 
        className="absolute top-0 bottom-24 left-0 w-[25%] z-[55] cursor-pointer" 
        onClick={() => handleTouchZoneClick('left')}
      ></div>
      <div 
        className="absolute top-0 bottom-24 right-0 w-[25%] z-[55] cursor-pointer" 
        onClick={() => handleTouchZoneClick('right')}
      ></div>

      {/* Visual Feedback */}
      {seekFeedback && (
          <div className="absolute z-[70] inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center justify-center bg-black/60 rounded-full w-24 h-24 backdrop-blur-sm animate-ping-short">
                  {seekFeedback === 'backward' ? (
                     <>
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                        <span className="text-white text-xs font-bold mt-1">-10s</span>
                     </>
                  ) : (
                     <>
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                        <span className="text-white text-xs font-bold mt-1">+10s</span>
                     </>
                  )}
              </div>
          </div>
      )}

      {/* Error Overlay */}
      {error && (
          <div className="absolute z-[80] inset-0 flex items-center justify-center bg-black/90 p-6">
              <div className="text-center">
                  <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Playback Error</h3>
                  <p className="text-gray-400 mb-6 max-w-xs mx-auto">{error}</p>
                  <button onClick={handleRetry} className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200 transition">
                      Retry
                  </button>
                  <button onClick={onBack} className="block mt-4 text-gray-500 text-sm hover:text-white w-full">
                      Go Back
                  </button>
              </div>
          </div>
      )}

      <div data-vjs-player ref={videoRef} className="w-full max-w-6xl h-full" />
      
      <style>{`
        .video-js .vjs-big-play-button {
          background-color: #ea580c;
          border-color: #ea580c;
          border-radius: 50%;
          width: 2em;
          height: 2em;
          line-height: 2em;
          margin-left: -1em;
          margin-top: -1em;
          transition: all 0.3s;
        }
        .video-js .vjs-big-play-button:hover {
          background-color: #c2410c;
          transform: scale(1.1);
        }
        .video-js .vjs-control-bar {
          background-color: rgba(0,0,0,0.85);
          backdrop-filter: blur(4px);
        }
        .video-js .vjs-play-progress {
          background-color: #ea580c;
        }
        .video-js .vjs-slider {
          background-color: rgba(255,255,255,0.3);
        }
        /* Loading Spinner */
        .video-js .vjs-loading-spinner {
          border: 4px solid rgba(234, 88, 12, 0.3);
          border-top-color: #ea580c;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: vjs-spinner-spin 1s linear infinite;
        }
        @keyframes ping-short {
            0% { transform: scale(0.8); opacity: 0; }
            20% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-ping-short {
            animation: ping-short 0.6s cubic-bezier(0, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};
