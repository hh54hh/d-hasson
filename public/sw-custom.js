// Custom Service Worker for Enhanced Offline Support - مركز البدر
// نظام Service Worker مخصص لدعم العمل بدون إنترنت

const CACHE_NAME = "badr-center-v1.2.0";
const DATA_CACHE_NAME = "badr-data-v1.2.0";
const OFFLINE_URL = "/offline.html";

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^https:\/\/pqemckhqlhzucmxxdmeo\.supabase\.co\/rest\/v1\//,
  /^https:\/\/pqemckhqlhzucmxxdmeo\.supabase\.co\/auth\/v1\//,
];

// Install event
self.addEventListener("install", (event) => {
  console.log("🔧 Custom Service Worker: Installing...");

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log("📦 Custom Service Worker: Caching static files");

        // Cache static files with error handling
        for (const url of STATIC_CACHE_URLS) {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn(`Failed to cache ${url}:`, error);
          }
        }

        self.skipWaiting();
        console.log("✅ Custom Service Worker: Installation complete");
      } catch (error) {
        console.error("❌ Custom Service Worker: Installation failed", error);
      }
    })(),
  );
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("🚀 Custom Service Worker: Activating...");

  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
          .map((name) => {
            console.log("🗑️ Custom Service Worker: Deleting old cache:", name);
            return caches.delete(name);
          });

        await Promise.all(deletePromises);
        await self.clients.claim();
        console.log("✅ Custom Service Worker: Activation complete");
      } catch (error) {
        console.error("❌ Custom Service Worker: Activation failed", error);
      }
    })(),
  );
});

// Fetch event
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
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
    // Try network first with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const networkResponse = await fetch(request, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
      console.log("📡 Custom SW: API response cached:", request.url);
    }

    return networkResponse;
  } catch (error) {
    console.log("📱 Custom SW: Network failed, trying cache for:", request.url);

    // Try cache as fallback
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log("💾 Custom SW: Serving from cache:", request.url);
      return cachedResponse;
    }

    // Return offline response
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
    console.log("📱 Custom SW: Navigation offline, serving app shell");

    // Try to serve the main app from cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse =
      (await cache.match("/")) || (await cache.match("/index.html"));

    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to offline page
    const offlineResponse = await cache.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }

    // Basic offline response
    return new Response(createOfflineHTML(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

// Handle static requests
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
      // Cache the response
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("📱 Custom SW: Static resource unavailable:", request.url);

    // Return basic response for failed static requests
    return new Response("", {
      status: 404,
      statusText: "Not Found",
    });
  }
}

// Create basic offline HTML
function createOfflineHTML() {
  return `<!DOCTYPE html>
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .container {
        background: white;
        color: #333;
        padding: 2rem;
        border-radius: 15px;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }
      .icon { font-size: 3rem; margin-bottom: 1rem; }
      .btn {
        background: #2563eb;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin: 10px 5px;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon">📱</div>
      <h1>مركز البدر</h1>
      <h2>العمل بدون اتصال</h2>
      <p>التطبيق يعمل حالياً بدون اتصال بالإنترنت</p>
      <p>جميع البيانات محفوظة محلياً</p>
      <button class="btn" onclick="window.location.href='/'">
        فتح التطبيق
      </button>
      <button class="btn" onclick="window.location.reload()">
        إعادة المحاولة
      </button>
    </div>
  </body>
</html>`;
}

// Background sync
self.addEventListener("sync", (event) => {
  console.log("🔄 Custom SW: Background sync triggered:", event.tag);

  if (event.tag === "background-sync-data") {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data
async function syncOfflineData() {
  try {
    console.log("🔄 Custom SW: Starting offline data sync...");

    // Send message to app to handle sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_OFFLINE_DATA",
        timestamp: new Date().toISOString(),
      });
    });

    console.log("✅ Custom SW: Offline sync initiated");
  } catch (error) {
    console.error("❌ Custom SW: Sync failed", error);
  }
}

// Handle messages from app
self.addEventListener("message", (event) => {
  const { data } = event;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "CACHE_DATA") {
    cacheOfflineData(data.payload);
  }
});

// Cache offline data
async function cacheOfflineData(data) {
  try {
    const cache = await caches.open(DATA_CACHE_NAME);
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

    await cache.put("/offline-data", response);
    console.log("💾 Custom SW: Offline data cached");
  } catch (error) {
    console.error("❌ Custom SW: Failed to cache offline data", error);
  }
}

console.log("🚀 Custom Service Worker: Loaded and ready for مركز البدر");
