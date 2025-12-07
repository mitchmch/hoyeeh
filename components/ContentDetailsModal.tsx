
import React, { useState, useEffect } from 'react';
import { Content } from '../types';
import { Button } from './Button';
import { offlineStorage } from '../services/offlineStorage';
import { useDownload } from '../contexts/DownloadContext';

interface ContentDetailsModalProps {
  content: Content;
  onClose: () => void;
  onPlay: () => void;
  onToggleMyList: () => void;
  isInMyList: boolean;
}

export const ContentDetailsModal: React.FC<ContentDetailsModalProps> = ({ 
  content, 
  onClose, 
  onPlay, 
  onToggleMyList, 
  isInMyList 
}) => {
  const { startDownload, isDownloading, getDownloadProgress } = useDownload();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const downloading = isDownloading(content.id);
  const progress = getDownloadProgress(content.id);

  // Check storage on mount to see if already downloaded
  useEffect(() => {
    checkDownloadStatus();
  }, [content.id, downloading]); // Re-check if downloading state changes (e.g. finishes)

  const checkDownloadStatus = async () => {
    // If it's currently downloading in context, we know status. 
    // If not, check offline storage for completion.
    const exists = await offlineStorage.isDownloaded(content.id);
    setIsDownloaded(exists);
  };

  const handleDownloadClick = async () => {
    if (downloading) return;
    if (isDownloaded) return; // Already done

    await startDownload(content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-[#181818] w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden animate-scale-up">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div className="relative aspect-video w-full">
           <img 
             src={content.thumbnailUrl} 
             className="w-full h-full object-cover" 
             alt={content.title} 
           />
           <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent"></div>
           
           <div className="absolute bottom-0 left-0 p-8 w-full">
             <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 drop-shadow-xl">{content.title}</h2>
             <div className="flex gap-4 items-center flex-wrap">
                <Button onClick={onPlay} className="px-8 py-3 text-lg flex items-center gap-2">
                   <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                   Play
                </Button>
                
                <button 
                  onClick={onToggleMyList}
                  className="flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 border-gray-500 hover:border-white text-gray-300 hover:text-white transition bg-black/30 backdrop-blur-md"
                  title={isInMyList ? "Remove from List" : "Add to List"}
                >
                   {isInMyList ? (
                     <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                   ) : (
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                   )}
                </button>

                <Button 
                    variant="secondary" 
                    onClick={handleDownloadClick}
                    disabled={downloading || isDownloaded}
                    className={`flex items-center gap-2 min-w-[140px] justify-center ${isDownloaded ? 'bg-green-600 text-white hover:bg-green-700' : ''}`}
                >
                    {downloading ? (
                         <>
                           <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                           <span>{progress}%</span>
                         </>
                    ) : isDownloaded ? (
                        <>
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                           Downloaded
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download
                        </>
                    )}
                </Button>
             </div>
           </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-400 font-semibold">
                 <span className="text-green-400">98% Match</span>
                 <span>{Math.floor((content.duration || 5400) / 60)}m</span>
                 <span className="border border-gray-600 px-1 rounded text-xs">HD</span>
                 <span>{content.genre}</span>
              </div>
              <p className="text-gray-300 text-lg leading-relaxed">
                {content.description}
              </p>
           </div>
           <div className="text-sm text-gray-400 space-y-2">
              <p><span className="text-gray-500">Genre:</span> <span className="text-white">{content.genre}</span></p>
              <p><span className="text-gray-500">Language:</span> <span className="text-white">English, French</span></p>
              <p><span className="text-gray-500">Maturity:</span> <span className="text-white">PG-13</span></p>
              {content.isPremium && (
                <div className="mt-4 inline-block bg-brand/20 text-brand px-2 py-1 rounded text-xs font-bold border border-brand/50">
                   PREMIUM CONTENT
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
