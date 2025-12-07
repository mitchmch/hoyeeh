
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Hoyeeh Streaming',
        short_name: 'Hoyeeh',
        description: 'Premium African Streaming Service',
        theme_color: '#ea580c',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'https://picsum.photos/192/192', // Placeholder icon
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://picsum.photos/512/512', // Placeholder icon
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
});
