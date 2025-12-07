
import { API_URL } from '../constants';
import { User, Content } from '../types';

// Event emitter for auth errors
export const authEvents = new EventTarget();

const headers = () => {
  const token = localStorage.getItem('hoyeeh_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    if (res.status === 401) {
      const errorData = await res.json().catch(() => ({}));
      // Check for specific session expired message
      if (errorData.message === 'Session expired. You logged in on another device.') {
         authEvents.dispatchEvent(new CustomEvent('session-expired', { detail: errorData.message }));
      } else if (errorData.message === 'Invalid token') {
         authEvents.dispatchEvent(new CustomEvent('unauthorized'));
      }
      throw new Error(errorData.message || 'Unauthorized');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'API Request Failed');
  }
  return res.json();
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error('Unable to connect to server. Please check your internet connection or ensure the backend is running.');
    }
    throw error;
  }
};

export const api = {
  auth: {
    login: async (mobileNumber: string, pin: string) => {
      const res = await fetchWithTimeout(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber, pin })
      });
      return handleResponse(res);
    },
    register: async (mobileNumber: string, pin: string, secretWord: string, adminCode?: string) => {
      const res = await fetchWithTimeout(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber, pin, secretWord, adminCode })
      });
      return handleResponse(res);
    },
    resetPin: async (mobileNumber: string, secretWord: string, newPin: string) => {
      const res = await fetchWithTimeout(`${API_URL}/auth/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber, secretWord, newPin })
      });
      return handleResponse(res);
    },
    demoLogin: async () => {
      const res = await fetchWithTimeout(`${API_URL}/auth/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return handleResponse(res);
    }
  },
  user: {
    getMyList: async (): Promise<Content[]> => {
      const res = await fetchWithTimeout(`${API_URL}/user/mylist`, {
        headers: headers()
      });
      return handleResponse(res);
    },
    addToMyList: async (contentId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/user/mylist`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ contentId })
      });
      return handleResponse(res);
    },
    removeFromMyList: async (contentId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/user/mylist/${contentId}`, {
        method: 'DELETE',
        headers: headers()
      });
      return handleResponse(res);
    },
    getContinueWatching: async () => {
      const res = await fetchWithTimeout(`${API_URL}/user/continue-watching`, {
        headers: headers()
      });
      return handleResponse(res);
    },
    getRecommendations: async (): Promise<{movies: Content[], shows: Content[]}> => {
      const res = await fetchWithTimeout(`${API_URL}/user/recommendations`, {
        headers: headers()
      });
      return handleResponse(res);
    },
    updateProgress: async (contentId: string, progress: number) => {
      const res = await fetchWithTimeout(`${API_URL}/user/progress`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ contentId, progress })
      });
      return handleResponse(res);
    },
    changeSettings: async (newPin?: string, newSecret?: string) => {
      const res = await fetchWithTimeout(`${API_URL}/user/change-settings`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ newPin, newSecret })
      });
      return handleResponse(res);
    },
    cancelSubscription: async () => {
      const res = await fetchWithTimeout(`${API_URL}/user/cancel-subscription`, {
        method: 'POST',
        headers: headers()
      });
      return handleResponse(res);
    },
    clearHistory: async () => {
      const res = await fetchWithTimeout(`${API_URL}/user/history`, {
        method: 'DELETE',
        headers: headers()
      });
      return handleResponse(res);
    }
  },
  content: {
    getAll: async (query?: string) => {
      const url = query ? `${API_URL}/content?q=${encodeURIComponent(query)}` : `${API_URL}/content`;
      const res = await fetchWithTimeout(url, {
        headers: headers()
      });
      return handleResponse(res);
    },
    getSignedUrl: async (contentId: string, type?: 'download') => {
      const url = type ? `${API_URL}/content/${contentId}/sign?type=${type}` : `${API_URL}/content/${contentId}/sign`;
      const res = await fetchWithTimeout(url, {
        headers: headers()
      });
      return handleResponse(res);
    }
  },
  admin: {
    getUsers: async (): Promise<User[]> => {
      const res = await fetchWithTimeout(`${API_URL}/admin/users`, {
        headers: headers()
      });
      return handleResponse(res);
    },
    resetUserPin: async (userId: string, newPin: string) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/user/${userId}/reset-pin`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ newPin })
      });
      return handleResponse(res);
    },
    resetUserSecret: async (userId: string, newSecret: string) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/user/${userId}/reset-secret`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ newSecret })
      });
      return handleResponse(res);
    },
    toggleSubscription: async (userId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/user/${userId}/toggle-subscription`, {
        method: 'POST',
        headers: headers()
      });
      return handleResponse(res);
    },
    getUploadUrl: async (fileName: string, fileType: string) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/upload-url`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ fileName, fileType })
      });
      return handleResponse(res);
    },
    uploadFileToSpaces: async (uploadUrl: string, file: File, onProgress: (percent: number) => void) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('x-amz-acl', 'private');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true);
          } else {
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });
    },
    transcodeVideo: async (contentId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/content/${contentId}/transcode`, {
        method: 'POST',
        headers: headers()
      });
      return handleResponse(res);
    },
    addContent: async (content: Omit<Content, 'id'>) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/content`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(content)
      });
      return handleResponse(res);
    },
    deleteContent: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/admin/content/${id}`, {
        method: 'DELETE',
        headers: headers()
      });
      return handleResponse(res);
    }
  },
  debug: {
    reset: async () => {
        const res = await fetchWithTimeout(`${API_URL}/debug/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return handleResponse(res);
    }
  },
  payment: {
    verify: async (txRef: string) => {
      return { success: true };
    }
  }
};
