
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
  onRate: () => void;
  isInMyList: boolean;
}

export const ContentDetailsModal: React.FC<ContentDetailsModalProps> = ({ 
  content, 
  onClose, 
  onPlay, 
  onToggleMyList, 
  onRate,
  isInMyList 
}) => {
  const { startDownload, isDownloading, getDownloadProgress } = useDownload();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const downloading = isDownloading(content.id);
  const progress = getDownloadProgress(content.id);

  useEffect(() => {
    checkDownloadStatus();
  }, [content.id, downloading]);

  const checkDownloadStatus = async () => {
    const exists = await offlineStorage.isDownloaded(content.id);
    setIsDownloaded(exists);
  };

  const handleDownloadClick = async () => {
    if (downloading) return;
    if (isDownloaded) return;
    await startDownload(content);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Content - Bottom Sheet on Mobile, Centered Modal on Desktop */}
      <div className="relative bg-[#181818] w-full md:max-w-4xl rounded-t-2xl md:rounded-xl shadow-2xl overflow-y-auto max-h-[90vh] md:max-h-none animate-slide-up md:animate-scale-up">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition md:top-4 md:right-4"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        {/* Video Preview / Image */}
        <div className="relative aspect-video w-full">
           <img 
             src={content.thumbnailUrl} 
             className="w-full h-full object-cover" 
             alt={content.title} 
           />
           <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent"></div>
           
           <div className="absolute bottom-0 left-0 p-4 md:p-8 w-full">
             <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-2 md:mb-4 drop-shadow-xl">{content.title}</h2>
           </div>
        </div>

        <div className="p-4 md:p-8">
           {/* Metadata Row */}
           <div className="flex items-center gap-3 text-sm text-gray-300 font-semibold mb-4">
               <span className="text-green-400 font-bold">98% Match</span>
               <span>{new Date().getFullYear()}</span>
               <span className="bg-gray-700 px-1.5 py-0.5 rounded text-xs text-white">13+</span>
               <span>{Math.floor((content.duration || 5400) / 60)}m</span>
               <span className="border border-gray-500 px-1 rounded text-xs text-gray-400">HD</span>
           </div>

           {/* Mobile Action Buttons - Full Width */}
           <div className="flex flex-col gap-3 mb-6">
              <Button onClick={onPlay} className="w-full py-3 text-lg font-bold flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200">
                  <svg className="w-6 h-6 fill-black" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Play
              </Button>

              <Button 
                variant="secondary" 
                onClick={handleDownloadClick}
                disabled={downloading || isDownloaded}
                className={`w-full py-3 font-bold flex items-center justify-center gap-2 ${isDownloaded ? 'bg-gray-800 text-gray-400' : 'bg-[#2a2a2a] text-white hover:bg-[#333]'}`}
              >
                  {downloading ? (
                       <>
                         <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                         <span>Downloading {progress}%</span>
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

           <p className="text-white text-sm md:text-base leading-relaxed mb-6">
             {content.description}
           </p>

           <div className="flex gap-8 mb-6">
               <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onToggleMyList}>
                   {isInMyList ? (
                     <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                   ) : (
                     <svg className="w-6 h-6 text-white group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                   )}
                   <span className="text-[10px] text-gray-400 group-hover:text-white">My List</span>
               </div>
               <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onRate}>
                   <svg className="w-6 h-6 text-white group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                   <span className="text-[10px] text-gray-400 group-hover:text-white">Rate</span>
               </div>
               <div className="flex flex-col items-center gap-1 cursor-pointer group">
                   <svg className="w-6 h-6 text-white group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                   <span className="text-[10px] text-gray-400 group-hover:text-white">Share</span>
               </div>
           </div>
           
           {/* Dummy Episodes List for Series */}
           {content.contentType === 'series' && (
             <div className="border-t border-gray-800 pt-4">
                <h3 className="text-white font-bold mb-4">Episodes</h3>
                <div className="space-y-4">
                  {[1, 2, 3].map(ep => (
                    <div key={ep} className="flex items-center gap-4 p-2 hover:bg-[#222] rounded cursor-pointer" onClick={onPlay}>
                        <div className="w-24 aspect-video bg-gray-800 rounded relative flex items-center justify-center overflow-hidden">
                           <img src={content.thumbnailUrl} className="opacity-50 object-cover w-full h-full" />
                           <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                           </div>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-bold text-sm">Episode {ep}</h4>
                            <p className="text-gray-500 text-xs line-clamp-2">{content.description}</p>
                        </div>
                        <div className="text-gray-500">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </div>
                    </div>
                  ))}
                </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
};
