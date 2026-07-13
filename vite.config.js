import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Pharmacy Management System',
        short_name: 'PharmacyOS',
        description: 'Complete pharmacy management, inventory, POS and reporting',
        theme_color: '#0f766e',
        background_color: '#0b1120',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      }
    })
  ],
  server: { port: 5173 }
});
