
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Content } from '../types';
import { api } from '../services/api';
import { offlineStorage, DownloadState } from '../services/offlineStorage';

export interface DownloadItem {
  content: Content;
  progress: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
  abortController?: AbortController;
  total?: number;
}

interface DownloadContextType {
  activeDownloads: Record<string, DownloadItem>;
  startDownload: (content: Content) => Promise<void>;
  pauseDownload: (contentId: string) => void;
  resumeDownload: (contentId: string) => Promise<void>;
  cancelDownload: (contentId: string) => void;
  removeDownload: (contentId: string) => Promise<void>;
  isDownloading: (contentId: string) => boolean;
  getDownloadProgress: (contentId: string) => number;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const useDownload = () => {
  const context = useContext(DownloadContext);
  if (!context) throw new Error('useDownload must be used within a DownloadProvider');
  return context;
};

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadItem>>({});
  const processingRef = useRef(false);

  // Load interrupted downloads on mount
  useEffect(() => {
    const loadInterrupted = async () => {
        try {
            const savedStates = await offlineStorage.getAllActiveDownloads();
            const recovered: Record<string, DownloadItem> = {};
            savedStates.forEach(state => {
                recovered[state.id] = {
                    content: state.content,
                    progress: state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0,
                    status: 'paused', // Initially paused on reload
                    total: state.total
                };
            });
            setActiveDownloads(prev => ({ ...prev, ...recovered }));
        } catch (e) {
            console.error("Failed to recover downloads", e);
        }
    };
    loadInterrupted();
  }, []);

  // Queue Processing Effect
  useEffect(() => {
    processQueue();
  }, [activeDownloads]);

  const processQueue = async () => {
    if (processingRef.current) return;

    const downloads = Object.values(activeDownloads) as DownloadItem[];
    const downloading = downloads.filter(d => d.status === 'downloading');
    const pending = downloads.filter(d => d.status === 'pending');

    // Limit concurrency to 1
    if (downloading.length < 1 && pending.length > 0) {
      const nextItem = pending[0];
      processingRef.current = true;
      await executeDownload(nextItem.content);
      processingRef.current = false;
    }
  };

  const startDownload = useCallback(async (content: Content) => {
    if (activeDownloads[content.id]) {
        // If it exists but is paused/error, resume it
        const item = activeDownloads[content.id];
        if (item.status === 'paused' || item.status === 'error') {
            await resumeDownload(content.id);
        }
        return; 
    }

    setActiveDownloads(prev => ({
      ...prev,
      [content.id]: {
        content,
        progress: 0,
        status: 'pending'
      }
    }));
  }, [activeDownloads]);

  const resumeDownload = useCallback(async (contentId: string) => {
     setActiveDownloads(prev => {
         const item = prev[contentId];
         if (!item) return prev;
         return {
             ...prev,
             [contentId]: { ...item, status: 'pending', error: undefined }
         };
     });
  }, []);

  const pauseDownload = useCallback((contentId: string) => {
    setActiveDownloads(prev => {
      const item = prev[contentId];
      if (item && item.abortController) {
        item.abortController.abort(); // This triggers the AbortError in executeDownload
      }
      return {
          ...prev,
          [contentId]: { ...item, status: 'paused', abortController: undefined }
      };
    });
  }, []);

  const executeDownload = async (content: Content) => {
    const abortController = new AbortController();

    setActiveDownloads(prev => ({
      ...prev,
      [content.id]: {
        ...prev[content.id],
        status: 'downloading',
        abortController
      }
    }));

    try {
      // 1. Check for existing partial state
      const savedState = await offlineStorage.getDownloadState(content.id);
      let loaded = 0;
      let total = 0;
      let chunks: Blob[] = [];

      if (savedState) {
          loaded = savedState.loaded;
          total = savedState.total;
          chunks = savedState.chunks;
      }

      // 2. Get Signed URL
      const { url } = await api.content.getSignedUrl(content.id, 'download');

      // 3. Fetch with Range if resuming
      const headers: HeadersInit = {};
      if (loaded > 0) {
          headers['Range'] = `bytes=${loaded}-`;
      }

      const response = await fetch(url, { 
          signal: abortController.signal,
          headers
      });

      if (!response.body) throw new Error('ReadableStream not supported');
      if (!response.ok && response.status !== 206) {
           throw new Error(`Download failed: ${response.statusText}`);
      }

      // If new download, get total length
      if (loaded === 0) {
          const contentLength = response.headers.get('Content-Length');
          total = contentLength ? parseInt(contentLength, 10) : 0;
      } else {
          // If resuming, Content-Length is remaining bytes
          // We rely on saved 'total' if available, or try to parse Content-Range
          // Content-Range: bytes 100-200/200
          if (!total) {
               const cr = response.headers.get('Content-Range');
               if (cr) {
                   const parts = cr.split('/');
                   if (parts[1]) total = parseInt(parts[1], 10);
               }
          }
      }

      const reader = response.body.getReader();
      let lastSaveTime = Date.now();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(new Blob([value]));
        loaded += value.byteLength;
        
        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        
        // Update UI State
        setActiveDownloads(prev => {
            if (!prev[content.id]) return prev; 
            return {
                ...prev,
                [content.id]: { ...prev[content.id], progress, total }
            };
        });

        // Periodic Save to IDB (every 2 seconds)
        if (Date.now() - lastSaveTime > 2000) {
            await offlineStorage.saveDownloadState({
                id: content.id,
                content,
                chunks, // Note: Storing array of blobs in IDB
                loaded,
                total,
                status: 'downloading',
                timestamp: Date.now()
            });
            lastSaveTime = Date.now();
        }
      }

      // Final Blob Assembly
      const finalBlob = new Blob(chunks, { type: 'video/mp4' });

      // 4. Save Completed Video
      await offlineStorage.saveVideo(content, finalBlob);

      // 5. Cleanup Active State
      await offlineStorage.deleteDownloadState(content.id);
      setActiveDownloads(prev => {
          const newState = { ...prev };
          delete newState[content.id]; 
          return newState;
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Download paused/aborted');
        // Save state one last time on pause
        // Note: We can't access local variables easily here if we don't track them in a ref or similar,
        // but the periodic save catches most.
        setActiveDownloads(prev => ({
            ...prev,
            [content.id]: { ...prev[content.id], status: 'paused', abortController: undefined }
        }));
      } else {
        console.error('Download failed', error);
        setActiveDownloads(prev => ({
            ...prev,
            [content.id]: { ...prev[content.id], status: 'error', error: error.message, abortController: undefined }
        }));
      }
    }
  };

  const cancelDownload = useCallback(async (contentId: string) => {
    // Abort if running
    if (activeDownloads[contentId]?.abortController) {
        activeDownloads[contentId].abortController?.abort();
    }
    
    // Remove from IDB active state
    await offlineStorage.deleteDownloadState(contentId);

    // Remove from UI
    setActiveDownloads(prev => {
      const newState = { ...prev };
      delete newState[contentId];
      return newState;
    });
  }, [activeDownloads]);

  const removeDownload = useCallback(async (contentId: string) => {
    // Remove complete download
    await offlineStorage.deleteVideo(contentId);
    // Also check active/paused downloads
    await cancelDownload(contentId);
  }, [cancelDownload]);

  const isDownloading = useCallback((contentId: string) => {
    return !!activeDownloads[contentId];
  }, [activeDownloads]);

  const getDownloadProgress = useCallback((contentId: string) => {
    return activeDownloads[contentId]?.progress || 0;
  }, [activeDownloads]);

  return (
    <DownloadContext.Provider value={{
      activeDownloads,
      startDownload,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      removeDownload,
      isDownloading,
      getDownloadProgress
    }}>
      {children}
    </DownloadContext.Provider>
  );
};
