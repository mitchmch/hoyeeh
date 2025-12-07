
export const AFRICAN_COUNTRIES = ['CM', 'NG', 'GH', 'KE', 'ZA']; // Cameroon, Nigeria, Ghana, Kenya, South Africa

const env = (import.meta as any).env || {};

// Use relative path '/api' by default to use the Vite proxy in development or same-domain in prod.
// Only use full URL if explicitly provided.
export const API_URL = env.VITE_API_URL || '/api';

export const FLUTTERWAVE_PUBLIC_KEY = env.VITE_FW_KEY || 'FLWPUBK_TEST-SANDBOX';
export const STRIPE_PUBLIC_KEY = env.VITE_STRIPE_KEY || 'pk_test_123';
// Use a free public key for demo purposes if not provided, or strictly require env
export const TMDB_API_KEY = env.VITE_TMDB_API_KEY || '6f3977dc8470a256a7350cb703e2c366'; // Fallback demo key (often rotated, ideally use own)
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';

export const SUBSCRIPTION_PRICE = {
  AFRICA: 2000, // XAF
  INTERNATIONAL: 9.99 // USD
};
