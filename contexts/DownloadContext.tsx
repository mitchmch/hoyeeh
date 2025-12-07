
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Content } from '../types';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';

export interface DownloadItem {
  content: Content;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
  abortController?: AbortController;
}

interface DownloadContextType {
  activeDownloads: Record<string, DownloadItem>;
  startDownload: (content: Content) => Promise<void>;
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

  // Queue Processing Effect
  useEffect(() => {
    processQueue();
  }, [activeDownloads]);

  const processQueue = async () => {
    if (processingRef.current) return;

    // Fix: Explicitly cast Object.values to DownloadItem[] to avoid "Property does not exist on type unknown" error
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
    if (activeDownloads[content.id]) return; // Already in list

    setActiveDownloads(prev => ({
      ...prev,
      [content.id]: {
        content,
        progress: 0,
        status: 'pending'
      }
    }));
  }, [activeDownloads]);

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
      // 1. Get Signed URL specifically for download (prefers MP4)
      const { url } = await api.content.getSignedUrl(content.id, 'download');

      // 2. Fetch with Progress
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.body) throw new Error('ReadableStream not supported');

      const contentLength = response.headers.get('Content-Length');
      // If Content-Length is missing, we can't calculate progress accurately, 
      // but we still download.
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;
      
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.byteLength;
        
        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        
        setActiveDownloads(prev => {
            if (!prev[content.id]) return prev; 
            return {
                ...prev,
                [content.id]: { ...prev[content.id], progress }
            };
        });
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });

      // 3. Save to Storage
      await offlineStorage.saveVideo(content, blob);

      // 4. Update Status (Remove from active list upon completion to clean up UI)
      setActiveDownloads(prev => {
          const newState = { ...prev };
          delete newState[content.id]; 
          return newState;
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Download cancelled');
      } else {
        console.error('Download failed', error);
        setActiveDownloads(prev => ({
            ...prev,
            [content.id]: { ...prev[content.id], status: 'error', error: error.message }
        }));
      }
    }
  };

  const cancelDownload = useCallback((contentId: string) => {
    setActiveDownloads(prev => {
      const item = prev[contentId];
      if (item && item.abortController) {
        item.abortController.abort();
      }
      const newState = { ...prev };
      delete newState[contentId];
      return newState;
    });
  }, []);

  const removeDownload = useCallback(async (contentId: string) => {
    // Check if active
    if (activeDownloads[contentId]) {
        cancelDownload(contentId);
    }
    // Delete from storage
    await offlineStorage.deleteVideo(contentId);
  }, [activeDownloads, cancelDownload]);

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
      cancelDownload,
      removeDownload,
      isDownloading,
      getDownloadProgress
    }}>
      {children}
    </DownloadContext.Provider>
  );
};
