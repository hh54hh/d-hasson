// Enhanced Service Worker for مركز البدر - Complete Offline Support
// نظام Service Worker متقدم لدعم العمل بدون إنترنت بشكل كامل

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";

const CACHE_NAME = "badr-center-v1.2.0";
const DATA_CACHE_NAME = "badr-data-v1.2.0";
const OFFLINE_URL = "/offline.html";

// Precache and route static assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
  // Icons
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
  // Static assets will be handled by Vite's PWA plugin
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^https:\/\/pqemckhqlhzucmxxdmeo\.supabase\.co\/rest\/v1\//,
  /^https:\/\/pqemckhqlhzucmxxdmeo\.supabase\.co\/auth\/v1\//,
];

// Install event - Cache static resources
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Installing...");

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log("📦 Service Worker: Caching static files");
        await cache.addAll(STATIC_CACHE_URLS);

        // Force activation of new service worker
        self.skipWaiting();
        console.log("✅ Service Worker: Installation complete");
      } catch (error) {
        console.error("❌ Service Worker: Installation failed", error);
      }
    })(),
  );
});

// Activate event - Clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker: Activating...");

  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
          .map((name) => {
            console.log("🗑️ Service Worker: Deleting old cache:", name);
            return caches.delete(name);
          });

        await Promise.all(deletePromises);

        // Take control of all pages
        await self.clients.claim();
        console.log("✅ Service Worker: Activation complete");
      } catch (error) {
        console.error("❌ Service Worker: Activation failed", error);
      }
    })(),
  );
});

// Fetch event - Handle network requests with offline support
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== "GET") {
    return;
  }

  // Handle different types of requests
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

// Check if request is to API endpoints
function isAPIRequest(url) {
  return API_CACHE_PATTERNS.some((pattern) => pattern.test(url.href));
}

// Check if request is navigation
function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html"))
  );
}

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
      console.log("📡 Service Worker: API response cached:", request.url);
    }

    return networkResponse;
  } catch (error) {
    console.log(
      "📱 Service Worker: Network failed, trying cache for:",
      request.url,
    );

    // Try cache as fallback
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log("💾 Service Worker: Serving from cache:", request.url);
      return cachedResponse;
    }

    // Return error response if no cache available
    return new Response(
      JSON.stringify({
        error: "Network unavailable and no cached data",
        offline: true,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log("📱 Service Worker: Navigation offline, serving app shell");

    // Try to serve the main app from cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse =
      (await cache.match("/")) || (await cache.match("/index.html"));

    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to offline page if available
    const offlineResponse = await cache.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }

    // Last resort - basic offline response
    return new Response(
      `<!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>مركز البدر - بدون اتصال</title>
          <style>
            body {
              font-family: 'Cairo', sans-serif;
              text-align: center;
              padding: 2rem;
              background: #f8fafc;
              color: #374151;
            }
            .offline-container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            .retry-btn {
              background: #2563eb;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 1rem;
              margin-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="icon">📱</div>
            <h1>مركز البدر</h1>
            <h2>العمل بدون اتصال</h2>
            <p>التطبيق يعمل حالياً بدون اتصال بالإنترنت</p>
            <p>جميع البيانات محفوظة محلياً وستتم المزامنة عند عودة الاتصال</p>
            <button class="retry-btn" onclick="window.location.reload()">
              إعادة المحاولة
            </button>
          </div>
        </body>
      </html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

// Handle static requests (images, CSS, JS)
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // Try cache first for static assets
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // Try network if not in cache
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache the response for future use
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("📱 Service Worker: Static resource unavailable:", request.url);

    // Return a basic response for failed static requests
    return new Response("", {
      status: 404,
      statusText: "Not Found",
    });
  }
}

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("🔄 Service Worker: Background sync triggered:", event.tag);

  if (event.tag === "background-sync-data") {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    console.log("🔄 Service Worker: Starting offline data sync...");

    // Send message to app to handle sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_OFFLINE_DATA",
        timestamp: new Date().toISOString(),
      });
    });

    console.log("✅ Service Worker: Offline sync initiated");
  } catch (error) {
    console.error("❌ Service Worker: Sync failed", error);
  }
}

// Handle messages from the app
self.addEventListener("message", (event) => {
  const { data } = event;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "CACHE_DATA") {
    // Cache important data for offline use
    cacheOfflineData(data.payload);
  }
});

// Cache data for offline use
async function cacheOfflineData(data) {
  try {
    const cache = await caches.open(DATA_CACHE_NAME);

    // Create a response with the data
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

    await cache.put("/offline-data", response);
    console.log("💾 Service Worker: Offline data cached");
  } catch (error) {
    console.error("❌ Service Worker: Failed to cache offline data", error);
  }
}

// Clean up old data cache entries
async function cleanupDataCache() {
  try {
    const cache = await caches.open(DATA_CACHE_NAME);
    const requests = await cache.keys();

    // Remove entries older than 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get("date");
        if (dateHeader && new Date(dateHeader).getTime() < oneWeekAgo) {
          await cache.delete(request);
          console.log(
            "🗑️ Service Worker: Cleaned up old cache entry:",
            request.url,
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ Service Worker: Cache cleanup failed", error);
  }
}

// Periodic cleanup (every 6 hours)
setInterval(cleanupDataCache, 6 * 60 * 60 * 1000);

console.log("🚀 Service Worker: Loaded and ready for مركز البدر");
