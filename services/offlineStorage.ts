
import { Content } from '../types';

const DB_NAME = 'HoyeehOfflineDB';
const STORE_NAME = 'downloads';
const VERSION = 1;

interface OfflineItem {
  id: string;
  content: Content;
  blob: Blob;
  downloadDate: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const offlineStorage = {
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

  getStorageEstimate: async () => {
    if (navigator.storage && navigator.storage.estimate) {
        return await navigator.storage.estimate();
    }
    return undefined;
  },

  // Helper to check if item is downloaded
  isDownloaded: async (contentId: string): Promise<boolean> => {
    const item = await offlineStorage.getVideo(contentId);
    return !!item;
  }
};
