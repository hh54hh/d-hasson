// App Initializer for Enhanced Offline Support
// مهيئ التطبيق لدعم العمل بدون إنترنت

import { offlineDataManager } from "./offlineDataManager";
import { OfflineModeHandler } from "./offlineModeHandler";
import { ConnectionManager } from "./connectionManager";
import { logError } from "./utils";

export interface AppInitStatus {
  isInitialized: boolean;
  isOnline: boolean;
  hasStoredData: boolean;
  serviceWorkerReady: boolean;
  initializationTime: number;
  errors: string[];
}

export class AppInitializer {
  private static instance: AppInitializer;
  private initStatus: AppInitStatus = {
    isInitialized: false,
    isOnline: navigator.onLine,
    hasStoredData: false,
    serviceWorkerReady: false,
    initializationTime: 0,
    errors: [],
  };

  private constructor() {}

  static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  // Simple and fast initialization
  async initialize(): Promise<AppInitStatus> {
    const startTime = Date.now();
    console.log("🚀 App Initializer: Starting fast initialization...");

    try {
      // Reset errors
      this.initStatus.errors = [];

      // Simple network check
      this.initStatus.isOnline = navigator.onLine;

      // Basic connection monitoring
      this.setupConnectionMonitoring();

      // Simple offline handlers
      this.setupOfflineHandlers();

      // Calculate initialization time
      this.initStatus.initializationTime = Date.now() - startTime;
      this.initStatus.isInitialized = true;

      console.log(
        `✅ App Initializer: Fast initialization complete in ${this.initStatus.initializationTime}ms`,
      );

      return this.initStatus;
    } catch (error) {
      this.initStatus.errors.push(String(error));
      console.warn("⚠️ App initialization had issues:", error);

      // Continue anyway
      this.initStatus.isInitialized = true;
      this.initStatus.initializationTime = Date.now() - startTime;

      return this.initStatus;
    }
  }

  // Check and monitor network status
  private async checkNetworkStatus(): Promise<void> {
    try {
      console.log("🌐 Checking network status...");

      this.initStatus.isOnline = navigator.onLine;

      if (this.initStatus.isOnline) {
        console.log("✅ Network: Online");

        // Test actual connectivity
        try {
          await ConnectionManager.testConnection();
          console.log("✅ Network: Connectivity verified");
        } catch (error) {
          console.warn(
            "⚠️ Network: Connection test failed, but navigator.onLine is true",
          );
          this.initStatus.isOnline = false;
        }
      } else {
        console.log("📱 Network: Offline mode detected");
      }
    } catch (error) {
      logError("Failed to check network status:", error);
      this.initStatus.errors.push("Network status check failed");
    }
  }

  // Initialize service worker for offline caching
  private async initializeServiceWorker(): Promise<void> {
    try {
      if ("serviceWorker" in navigator) {
        console.log("⚙️ Initializing Service Worker...");

        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("✅ Service Worker registered:", registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        this.initStatus.serviceWorkerReady = true;

        console.log("✅ Service Worker ready");

        // Setup message handling
        navigator.serviceWorker.addEventListener(
          "message",
          this.handleServiceWorkerMessage.bind(this),
        );

        // Check for updates
        if (registration.waiting) {
          console.log("🔄 Service Worker update available");
          this.handleServiceWorkerUpdate(registration);
        }

        registration.addEventListener("updatefound", () => {
          console.log("🔄 Service Worker update found");
          this.handleServiceWorkerUpdate(registration);
        });
      } else {
        console.warn("⚠️ Service Worker not supported");
        this.initStatus.errors.push("Service Worker not supported");
      }
    } catch (error) {
      logError("Service Worker initialization failed:", error);
      this.initStatus.errors.push("Service Worker initialization failed");
    }
  }

  // Initialize offline data management
  private async initializeOfflineData(): Promise<void> {
    try {
      console.log("💾 Initializing offline data...");

      await offlineDataManager.initialize();

      const data = offlineDataManager.getData();
      this.initStatus.hasStoredData =
        data.isInitialized &&
        (data.customers.length > 0 ||
          data.products.length > 0 ||
          data.sales.length > 0);

      console.log("✅ Offline data initialized");
      console.log(
        `📊 Data status: ${data.customers.length} customers, ${data.products.length} products, ${data.sales.length} sales`,
      );
    } catch (error) {
      logError("Offline data initialization failed:", error);
      this.initStatus.errors.push("Offline data initialization failed");
    }
  }

  // Setup connection monitoring
  private setupConnectionMonitoring(): void {
    try {
      console.log("📡 Setting up connection monitoring...");

      // Listen for online/offline events
      window.addEventListener("online", this.handleOnline.bind(this));
      window.addEventListener("offline", this.handleOffline.bind(this));

      // Setup periodic connection check
      setInterval(async () => {
        const wasOnline = this.initStatus.isOnline;
        this.initStatus.isOnline = navigator.onLine;

        if (wasOnline !== this.initStatus.isOnline) {
          if (this.initStatus.isOnline) {
            await this.handleOnline();
          } else {
            await this.handleOffline();
          }
        }
      }, 10000); // Check every 10 seconds

      console.log("✅ Connection monitoring setup complete");
    } catch (error) {
      logError("Failed to setup connection monitoring:", error);
      this.initStatus.errors.push("Connection monitoring setup failed");
    }
  }

  // Handle online event
  private async handleOnline(): Promise<void> {
    try {
      console.log("🌐 Connection restored - going online");
      this.initStatus.isOnline = true;

      // Reset offline mode handler
      OfflineModeHandler.resetAttempts();

      // Trigger sync
      setTimeout(async () => {
        try {
          const syncResult = await offlineDataManager.syncWithServer();
          console.log("🔄 Auto-sync result:", syncResult);

          if (syncResult.success) {
            this.showNotification("✅ تم مزامنة البيانات بنجاح", "success");
          } else {
            this.showNotification("⚠️ بعض البيانات لم تتم مزامنتها", "warning");
          }
        } catch (error) {
          console.warn("Auto-sync failed:", error);
        }
      }, 2000); // Wait 2 seconds before syncing
    } catch (error) {
      logError("Failed to handle online event:", error);
    }
  }

  // Handle offline event
  private async handleOffline(): Promise<void> {
    try {
      console.log("📱 Connection lost - going offline");
      this.initStatus.isOnline = false;

      // Show offline mode notification
      this.showNotification(
        "📱 العمل بدون اتصال - البيانات محفوظة محلياً",
        "info",
      );

      OfflineModeHandler.showOfflineMessage();
    } catch (error) {
      logError("Failed to handle offline event:", error);
    }
  }

  // Setup offline mode handlers
  private setupOfflineHandlers(): void {
    try {
      console.log("📱 Setting up offline handlers...");

      // Handle app focus/blur for better offline experience
      window.addEventListener("focus", this.handleAppFocus.bind(this));
      window.addEventListener("blur", this.handleAppBlur.bind(this));

      // Handle page visibility change
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this),
      );

      console.log("✅ Offline handlers setup complete");
    } catch (error) {
      logError("Failed to setup offline handlers:", error);
      this.initStatus.errors.push("Offline handlers setup failed");
    }
  }

  // Handle app focus
  private handleAppFocus(): void {
    console.log("👁️ App focused - checking for updates...");

    // Check network status
    this.initStatus.isOnline = navigator.onLine;

    // Refresh data if online
    if (this.initStatus.isOnline) {
      setTimeout(() => {
        offlineDataManager.forceRefresh().catch(console.warn);
      }, 1000);
    }
  }

  // Handle app blur
  private handleAppBlur(): void {
    console.log("💤 App blurred - saving state...");

    // Ensure data is saved
    try {
      const data = offlineDataManager.getData();
      localStorage.setItem(
        "badr_app_state",
        JSON.stringify({
          timestamp: Date.now(),
          online: this.initStatus.isOnline,
          dataCount: {
            customers: data.customers.length,
            products: data.products.length,
            sales: data.sales.length,
          },
        }),
      );
    } catch (error) {
      console.warn("Failed to save app state:", error);
    }
  }

  // Handle visibility change
  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log("🙈 App hidden");
    } else {
      console.log("👁️ App visible - refreshing...");

      // Check if we need to refresh data
      try {
        const savedState = localStorage.getItem("badr_app_state");
        if (savedState) {
          const state = JSON.parse(savedState);
          const timeSinceBlur = Date.now() - state.timestamp;

          // If app was hidden for more than 30 seconds, refresh
          if (timeSinceBlur > 30000) {
            console.log("🔄 App was hidden for a while, refreshing data...");
            setTimeout(() => {
              offlineDataManager.forceRefresh().catch(console.warn);
            }, 500);
          }
        }
      } catch (error) {
        console.warn("Failed to check app state:", error);
      }
    }
  }

  // Register background sync
  private async registerBackgroundSync(): Promise<void> {
    try {
      if (
        "serviceWorker" in navigator &&
        "sync" in window.ServiceWorkerRegistration.prototype
      ) {
        console.log("🔄 Registering background sync...");

        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register("background-sync-data");

        console.log("✅ Background sync registered");
      } else {
        console.warn("⚠️ Background sync not supported");
      }
    } catch (error) {
      logError("Background sync registration failed:", error);
      this.initStatus.errors.push("Background sync registration failed");
    }
  }

  // Setup app lifecycle handlers
  private setupAppLifecycleHandlers(): void {
    try {
      console.log("🔄 Setting up app lifecycle handlers...");

      // Handle beforeunload
      window.addEventListener("beforeunload", (event) => {
        console.log("👋 App closing - final save...");

        // Quick save of critical data
        try {
          const data = offlineDataManager.getData();
          localStorage.setItem(
            "badr_final_state",
            JSON.stringify({
              timestamp: Date.now(),
              dataCount: {
                customers: data.customers.length,
                products: data.products.length,
                sales: data.sales.length,
              },
              syncPending: data.syncQueue.length,
            }),
          );
        } catch (error) {
          console.warn("Failed to save final state:", error);
        }
      });

      // Handle unhandled errors
      window.addEventListener("error", (event) => {
        logError("Unhandled error:", event.error);
        this.showNotification("⚠️ حدث خطأ غير متوقع", "error");
      });

      // Handle unhandled promise rejections
      window.addEventListener("unhandledrejection", (event) => {
        logError("Unhandled promise rejection:", event.reason);
        event.preventDefault(); // Prevent console error
      });

      console.log("✅ App lifecycle handlers setup complete");
    } catch (error) {
      logError("Failed to setup app lifecycle handlers:", error);
      this.initStatus.errors.push("App lifecycle handlers setup failed");
    }
  }

  // Handle service worker messages
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { data } = event;

    switch (data.type) {
      case "SYNC_OFFLINE_DATA":
        console.log("📡 Service Worker requested sync");
        offlineDataManager.syncWithServer().catch(console.warn);
        break;

      case "CACHE_UPDATE":
        console.log("💾 Service Worker updated cache");
        break;

      default:
        console.log("📨 Service Worker message:", data);
    }
  }

  // Handle service worker updates
  private handleServiceWorkerUpdate(
    registration: ServiceWorkerRegistration,
  ): void {
    if (registration.waiting) {
      console.log("🔄 Service Worker update available");

      // Show update notification
      this.showNotification(
        "🔄 تحديث متوفر - إعادة تحميل للحصول على آخر المميزات",
        "info",
        {
          persistent: true,
          action: () => {
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          },
        },
      );
    }
  }

  // Fallback initialization for critical errors
  private async fallbackInitialization(): Promise<void> {
    try {
      console.log("🆘 Running fallback initialization...");

      // Minimal initialization
      this.initStatus.isOnline = navigator.onLine;

      // Try to initialize basic offline data
      try {
        await offlineDataManager.initialize();
        this.initStatus.hasStoredData = true;
      } catch (error) {
        console.warn("Fallback: Failed to initialize offline data");
        this.initStatus.hasStoredData = false;
      }

      this.initStatus.isInitialized = true;
      console.log("✅ Fallback initialization complete");
    } catch (error) {
      logError("Fallback initialization failed:", error);
      this.initStatus.errors.push("Fallback initialization failed");
    }
  }

  // Announce initialization complete
  private announceInitializationComplete(): void {
    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent("app-initialized", {
        detail: this.initStatus,
      }),
    );

    // Show success notification
    if (this.initStatus.isOnline) {
      this.showNotification("✅ التطبيق جاهز - متصل بالإنترنت", "success");
    } else {
      this.showNotification("📱 التطبيق جاهز - العمل بدون اتصال", "info");
    }
  }

  // Show notification to user
  private showNotification(
    message: string,
    type: "success" | "error" | "warning" | "info",
    options?: {
      persistent?: boolean;
      action?: () => void;
    },
  ): void {
    console.log(`📢 Notification [${type}]: ${message}`);

    // You can integrate with your toast/notification system here
    // For now, just log to console

    if (options?.persistent) {
      console.log("📌 Persistent notification shown");
    }
  }

  // Get current initialization status
  getStatus(): AppInitStatus {
    return { ...this.initStatus };
  }

  // Reinitialize app (useful for recovery)
  async reinitialize(): Promise<AppInitStatus> {
    console.log("🔄 Reinitializing app...");

    this.initStatus = {
      isInitialized: false,
      isOnline: navigator.onLine,
      hasStoredData: false,
      serviceWorkerReady: false,
      initializationTime: 0,
      errors: [],
    };

    return await this.initialize();
  }

  // Check if app is ready
  isReady(): boolean {
    return this.initStatus.isInitialized;
  }

  // Get detailed status report
  getDetailedStatus(): string {
    const status = this.getStatus();
    return `
🚀 App Initialization Status:
- Initialized: ${status.isInitialized ? "✅" : "❌"}
- Online: ${status.isOnline ? "🌐" : "📱"}
- Has Data: ${status.hasStoredData ? "💾" : "📭"}
- Service Worker: ${status.serviceWorkerReady ? "⚙️" : "❌"}
- Init Time: ${status.initializationTime}ms
- Errors: ${status.errors.length > 0 ? "⚠️ " + status.errors.join(", ") : "✅ None"}
    `.trim();
  }
}

// Export singleton instance
export const appInitializer = AppInitializer.getInstance();
