// Real-time data synchronization service
import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";

export class DataSync {
  private static syncInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  // Start background data sync
  static startSync(intervalMinutes = 2): void {
    if (this.isRunning) {
      console.log("📡 Data sync already running");
      return;
    }

    this.isRunning = true;
    console.log(`📡 Starting data sync every ${intervalMinutes} minutes`);

    // Initial sync
    this.performSync();

    // Set up recurring sync
    this.syncInterval = setInterval(
      () => {
        this.performSync();
      },
      intervalMinutes * 60 * 1000,
    );
  }

  // Stop background sync
  static stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log("📡 Data sync stopped");
  }

  // Perform a single sync operation
  static async performSync(): Promise<boolean> {
    if (!navigator.onLine) {
      console.log("📱 Offline - skipping sync");
      return false;
    }

    try {
      console.log("🔄 Syncing data with Supabase...");

      // Sync all data types
      const [customers, products, sales] = await Promise.all([
        supabaseService.getCustomers().catch((err) => {
          console.warn("Failed to sync customers:", err);
          return offlineManager.getCachedData("customers");
        }),
        supabaseService.getProducts().catch((err) => {
          console.warn("Failed to sync products:", err);
          return offlineManager.getCachedData("products");
        }),
        supabaseService.getSales().catch((err) => {
          console.warn("Failed to sync sales:", err);
          return offlineManager.getCachedData("sales");
        }),
      ]);

      // Update cache with fresh data
      offlineManager.cacheData("customers", customers);
      offlineManager.cacheData("products", products);
      offlineManager.cacheData("sales", sales);

      console.log(
        `✅ Data synced: ${customers.length} customers, ${products.length} products, ${sales.length} sales`,
      );
      return true;
    } catch (error) {
      console.error("❌ Data sync failed:", error);
      return false;
    }
  }

  // Force immediate sync
  static async forceSync(): Promise<boolean> {
    console.log("🚀 Force syncing data...");
    return await this.performSync();
  }

  // Get sync status
  static getStatus(): {
    isRunning: boolean;
    lastSync: string;
  } {
    return {
      isRunning: this.isRunning,
      lastSync: new Date().toLocaleString("ar-SA"),
    };
  }

  // Sync specific customer data
  static async syncCustomerData(customerId: string): Promise<any> {
    try {
      console.log(`🔄 Syncing data for customer: ${customerId}`);

      // Get latest customer data
      const [customer, sales] = await Promise.all([
        supabaseService.getCustomerById(customerId),
        supabaseService.getSalesByCustomerId(customerId),
      ]);

      console.log(`✅ Customer ${customer.name}: ${sales.length} sales loaded`);

      return {
        customer,
        sales,
        success: true,
      };
    } catch (error) {
      console.error("❌ Failed to sync customer data:", error);
      return {
        customer: null,
        sales: [],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Auto-start sync when module loads (if online)
if (typeof window !== "undefined" && navigator.onLine) {
  // Start sync after a short delay to allow app to initialize
  setTimeout(() => {
    DataSync.startSync(2); // Sync every 2 minutes
  }, 5000);
}
