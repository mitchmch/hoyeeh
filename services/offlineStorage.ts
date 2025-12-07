
import { Content } from '../types';

const DB_NAME = 'HoyeehOfflineDB';
const STORE_NAME = 'downloads';
const TEMP_STORE_NAME = 'active_downloads';
const VERSION = 2;

interface OfflineItem {
  id: string;
  content: Content;
  blob: Blob;
  downloadDate: number;
}

export interface DownloadState {
  id: string;
  content: Content;
  chunks: Blob[];
  loaded: number;
  total: number;
  status: 'paused' | 'error' | 'downloading';
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TEMP_STORE_NAME)) {
        db.createObjectStore(TEMP_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const offlineStorage = {
  // --- Completed Downloads ---
  saveVideo: async (content: Content, blob: Blob) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const item: OfflineItem = {
        id: content.id,
        content,
        blob,
        downloadDate: Date.now(),
      };
      
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getVideo: async (contentId: string): Promise<OfflineItem | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(contentId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  getAllDownloads: async (): Promise<OfflineItem[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  deleteVideo: async (contentId: string) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(contentId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  clearAllDownloads: async () => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- Resumable / Active Downloads ---
  saveDownloadState: async (state: DownloadState) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TEMP_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(TEMP_STORE_NAME);
      const request = store.put(state);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getDownloadState: async (contentId: string): Promise<DownloadState | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TEMP_STORE_NAME, 'readonly');
      const store = transaction.objectStore(TEMP_STORE_NAME);
      const request = store.get(contentId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  getAllActiveDownloads: async (): Promise<DownloadState[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TEMP_STORE_NAME, 'readonly');
      const store = transaction.objectStore(TEMP_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  deleteDownloadState: async (contentId: string) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TEMP_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(TEMP_STORE_NAME);
      const request = store.delete(contentId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getStorageEstimate: async () => {
    if (navigator.storage && navigator.storage.estimate) {
        return await navigator.storage.estimate();
    }
    return undefined;
  },

  isDownloaded: async (contentId: string): Promise<boolean> => {
    const item = await offlineStorage.getVideo(contentId);
    return !!item;
  }
};
