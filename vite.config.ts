import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,ttf,eot,woff}"],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        offlineGoogleAnalytics: true,
        runtimeCaching: [
          // Supabase API - Network First with offline fallback
          {
            urlPattern:
              /^https:\/\/pqemckhqlhzucmxxdmeo\.supabase\.co\/rest\/v1\/.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200],
              },
              backgroundSync: {
                name: "supabase-api-sync",
                options: {
                  maxRetentionTime: 24 * 60, // 24 hours
                },
              },
            },
          },
          // Supabase Auth - Network First
          {
            urlPattern:
              /^https:\/\/pqemckhqlhzucmxxdmeo\.supabase\.co\/auth\/v1\/.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-auth-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Static assets - Cache First
          {
            urlPattern: /.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          // Fonts - Cache First
          {
            urlPattern: /.*\.(?:woff|woff2|ttf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
          // App shell - Stale While Revalidate
          {
            urlPattern:
              /^(?!.*[.](?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$).*$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-shell-cache",
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Background sync for offline actions
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "masked-icon.svg",
        "robots.txt",
      ],
      manifest: {
        name: "مركز البدر - نظام إدارة مخزن الهواتف",
        short_name: "مركز البدر",
        description: "نظام إدارة شامل لمحلات الهواتف - يعمل أوف لاين بشكل كامل",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait-primary",
        lang: "ar",
        dir: "rtl",
        categories: ["business", "productivity", "finance"],
        icons: [
          {
            src: "icons/icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "icons/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "icons/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          {
            name: "إضافة عملية بيع",
            short_name: "بيع جديد",
            description: "إضافة عملية بيع جديدة بسرعة",
            url: "/add-sale",
            icons: [{ src: "icons/icon-192x192.svg", sizes: "192x192" }],
          },
          {
            name: "المخزن",
            short_name: "المنتجات",
            description: "إدارة المخزن والمنتجات",
            url: "/inventory",
            icons: [{ src: "icons/icon-192x192.svg", sizes: "192x192" }],
          },
          {
            name: "العملاء",
            short_name: "العملاء",
            description: "إدارة العملاء والديون",
            url: "/",
            icons: [{ src: "icons/icon-192x192.svg", sizes: "192x192" }],
          },
        ],
        // Enhanced PWA features
        prefer_related_applications: false,
        edge_side_panel: {
          preferred_width: 400,
        },
        // Share target for external content
        share_target: {
          action: "/",
          method: "GET",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
        // Protocol handlers
        protocol_handlers: [
          {
            protocol: "web+badr",
            url: "/?action=%s",
          },
        ],
      },
      devOptions: {
        enabled: false, // Disable in development to prevent conflicts
        type: "module",
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: ["lucide-react", "@radix-ui/react-dialog"],
          routing: ["react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
    // Generate source maps for better debugging
    sourcemap: true,
    // Increase chunk size warning limit for PWA
    chunkSizeWarningLimit: 1600,
  },
  server: {
    // Enable HTTPS for better PWA testing
    // https: true,
    host: true,
    port: 3000,
  },
  preview: {
    port: 3000,
    host: true,
  },
});
