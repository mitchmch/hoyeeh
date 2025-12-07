
import React, { useState, useEffect } from 'react';
import { Content } from '../types';

interface ContentCardProps {
    item: Content;
    onClick: (item: Content) => void;
    onToggleList?: (item: Content) => void;
    isInList?: boolean;
}

export const ContentCard: React.FC<ContentCardProps> = ({ item, onClick, onToggleList, isInList }) => {
    const placeholder = 'https://via.placeholder.com/300x450?text=No+Image';
    const [imgSrc, setImgSrc] = useState(item.thumbnailUrl || placeholder);

    useEffect(() => {
        setImgSrc(item.thumbnailUrl || placeholder);
    }, [item.thumbnailUrl]);

    return (
        <div 
            className="group relative aspect-[2/3] w-full rounded-md overflow-hidden bg-gray-900 cursor-pointer shadow-black/50 shadow-xl transition-all duration-500 hover:z-20 hover:scale-105 hover:shadow-2xl hover:shadow-brand/20 ring-1 ring-white/5 hover:ring-brand/50"
            onClick={() => onClick(item)}
        >
            <img 
              src={imgSrc}
              alt={item.title} 
              className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-30" 
              loading="lazy"
              onError={() => setImgSrc(placeholder)}
            />
            
            {/* Badges */}
            {item.isPremium && (
                <div className="absolute top-2 right-2 bg-brand text-white text-[9px] font-black tracking-widest px-2 py-1 rounded-sm shadow z-10">
                    PREMIUM
                </div>
            )}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <span className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 text-white px-1.5 rounded uppercase font-bold">HD</span>
            </div>

            {/* Hover Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 translate-y-4 group-hover:translate-y-0">
                <h4 className="text-white font-black text-center text-sm mb-4 leading-tight drop-shadow-md line-clamp-2 uppercase tracking-wide">{item.title}</h4>
                
                <div className="flex gap-4 mb-4">
                    <button 
                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-brand hover:text-white transition-transform hover:scale-110 shadow-lg"
                        title="Play"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    
                    {onToggleList && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleList(item); }}
                            className="w-10 h-10 rounded-full border-2 border-gray-400 text-gray-200 flex items-center justify-center hover:border-white hover:text-white transition-transform hover:scale-110 bg-black/40 backdrop-blur-sm"
                            title={isInList ? "Remove from List" : "Add to List"}
                        >
                             {isInList ? (
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                             ) : (
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                             )}
                        </button>
                    )}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                   <div className="flex justify-between items-center text-[10px] text-gray-300 font-bold uppercase tracking-wider">
                      <span>{item.genre}</span>
                      <span className="text-brand">98% Match</span>
                   </div>
                </div>
            </div>
        </div>
    );
};
