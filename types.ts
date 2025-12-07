
export interface WatchHistoryItem {
  contentId: string;
  progress: number; // in seconds
  lastWatched: string;
}

export interface User {
  id: string;
  mobileNumber: string;
  role: 'user' | 'admin';
  country: string;
  isSubscribed: boolean;
  subscriptionExpiry?: string;
  token?: string; 
  myList: string[]; 
  watchHistory: WatchHistoryItem[];
}

export interface Content {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string; // DO Space path
  genre: string;
  contentType: 'movie' | 'series';
  isPremium: boolean;
  duration: number; // in seconds
}

export enum PaymentMethod {
  FLUTTERWAVE = 'flutterwave',
  STRIPE = 'stripe'
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  needsSubscription: boolean;
}
