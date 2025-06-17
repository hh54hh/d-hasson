// Background Sync Manager - Silent updates without interrupting user
import { offlineManager } from "./offlineManager";
import { supabaseService } from "./supabaseService";

export class BackgroundSync {
  private static instance: BackgroundSync;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;

  static getInstance(): BackgroundSync {
    if (!BackgroundSync.instance) {
      BackgroundSync.instance = new BackgroundSync();
    }
    return BackgroundSync.instance;
  }

  constructor() {
    // Listen to online/offline events
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.startSilentSync();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.stopSilentSync();
    });

    // Start silent sync if online
    if (this.isOnline) {
      this.startSilentSync();
    }
  }

  // Start silent background sync
  startSilentSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 60 seconds silently
    this.syncInterval = setInterval(() => {
      this.performSilentSync();
    }, 60000); // 1 minute

    console.log("🔄 Background sync started (every 60 seconds)");
  }

  // Stop background sync
  stopSilentSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log("⏹️ Background sync stopped");
  }

  // Perform silent sync without user notification
  private async performSilentSync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      console.log("🔇 Performing silent background sync...");

      // Get queue status
      const queueStatus = offlineManager.getStatus();

      if (queueStatus.queuedOperations > 0) {
        // Sync queued operations silently
        await offlineManager.forceSync();
        console.log(
          `✅ Silent sync: ${queueStatus.queuedOperations} operations synced`,
        );
      }

      // Update last sync time
      this.lastSyncTime = Date.now();
      localStorage.setItem("bg_last_sync", this.lastSyncTime.toString());
    } catch (error) {
      console.warn("⚠️ Silent sync failed:", error);
      // Don't show error to user - this is background operation
    } finally {
      this.isSyncing = false;
    }
  }

  // Force immediate silent sync
  async forceSilentSync(): Promise<boolean> {
    if (!this.isOnline) {
      return false;
    }

    try {
      await this.performSilentSync();
      return true;
    } catch (error) {
      console.warn("Force silent sync failed:", error);
      return false;
    }
  }

  // Get sync status for debugging
  getStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncTime: string;
    nextSyncIn: number;
  } {
    const nextSyncTime = this.lastSyncTime + 60000; // 1 minute from last sync
    const nextSyncIn = Math.max(0, nextSyncTime - Date.now());

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
        ? new Date(this.lastSyncTime).toLocaleString("ar-EG")
        : "لم يتم التزامن بعد",
      nextSyncIn: Math.round(nextSyncIn / 1000), // seconds
    };
  }

  // Silent data refresh for specific page
  async silentRefreshData(
    dataType: "customers" | "products" | "sales" | "all",
  ): Promise<{
    success: boolean;
    updated: boolean;
    data?: any;
  }> {
    if (!this.isOnline) {
      return { success: false, updated: false };
    }

    try {
      console.log(`🔇 Silent refresh: ${dataType}`);

      let data;
      let updated = false;

      switch (dataType) {
        case "customers":
          data = await supabaseService.getCustomers();
          const cachedCustomers = offlineManager.getCachedData("customers");
          if (JSON.stringify(data) !== JSON.stringify(cachedCustomers)) {
            offlineManager.cacheData("customers", data);
            updated = true;
          }
          break;

        case "products":
          data = await supabaseService.getProducts();
          const cachedProducts = offlineManager.getCachedData("products");
          if (JSON.stringify(data) !== JSON.stringify(cachedProducts)) {
            offlineManager.cacheData("products", data);
            updated = true;
          }
          break;

        case "sales":
          data = await supabaseService.getSales();
          const cachedSales = offlineManager.getCachedData("sales");
          if (JSON.stringify(data) !== JSON.stringify(cachedSales)) {
            offlineManager.cacheData("sales", data);
            updated = true;
          }
          break;

        case "all":
          // Fetch data sequentially to avoid overwhelming the connection
          console.log("📊 Fetching customers...");
          const customers = await supabaseService.getCustomers();

          // Small delay between requests to avoid overwhelming the connection
          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log("📦 Fetching products...");
          const products = await supabaseService.getProducts();

          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log("🛒 Fetching sales...");
          const sales = await supabaseService.getSales();

          const currentCustomers = offlineManager.getCachedData("customers");
          const currentProducts = offlineManager.getCachedData("products");
          const currentSales = offlineManager.getCachedData("sales");

          if (
            JSON.stringify(customers) !== JSON.stringify(currentCustomers) ||
            JSON.stringify(products) !== JSON.stringify(currentProducts) ||
            JSON.stringify(sales) !== JSON.stringify(currentSales)
          ) {
            offlineManager.cacheData("customers", customers);
            offlineManager.cacheData("products", products);
            offlineManager.cacheData("sales", sales);
            updated = true;
          }

          data = { customers, products, sales };
          break;
      }

      if (updated) {
        console.log(`✅ Silent refresh: ${dataType} updated`);
      } else {
        console.log(`ℹ️ Silent refresh: ${dataType} no changes`);
      }

      return { success: true, updated, data };
    } catch (error) {
      console.warn(`Silent refresh failed for ${dataType}:`, error);
      return { success: false, updated: false };
    }
  }

  // Cleanup on app close
  cleanup(): void {
    this.stopSilentSync();
  }
}

// Global instance
export const backgroundSync = BackgroundSync.getInstance();

// Auto-start background sync
if (typeof window !== "undefined") {
  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    backgroundSync.cleanup();
  });
}
