// Quick Sync Fix - حل سريع لمشاكل المزامنة
import { supabaseService } from "./supabaseService";

export async function quickFixSyncErrors(): Promise<void> {
  console.log("🚑 Starting quick sync error fix...");

  try {
    // Safety check - if localStorage is corrupted, clear and start fresh
    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
    } catch (storageError) {
      console.error("⚠️ localStorage is not available or corrupted");
      return Promise.resolve();
    }
    // 1. Clear problematic operations from queue
    let queue;
    try {
      queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");

      // Ensure it's an array
      if (!Array.isArray(queue)) {
        console.warn("⚠️ Queue is not an array, resetting...");
        queue = [];
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse queue, resetting...");
      queue = [];
    }

    console.log(`📋 Found ${queue.length} queued operations`);

    // 2. Filter out operations that are causing the getCustomerByPhone error
    const problemOperations = queue.filter((op: any) => {
      return (
        op.retryCount > 3 || // Too many retries
        (op.data &&
          op.data.customerId &&
          op.data.customerId.startsWith("offline_")) // Offline customer issues
      );
    });

    console.log(`🗑️ Found ${problemOperations.length} problematic operations`);

    // 3. Remove problematic operations
    const cleanQueue = queue.filter((op: any) => {
      return !(
        op.retryCount > 3 ||
        (op.data &&
          op.data.customerId &&
          op.data.customerId.startsWith("offline_"))
      );
    });

    // 4. Save clean queue
    localStorage.setItem("offline_queue", JSON.stringify(cleanQueue));

    // 5. Clear any offline customer cache that might be corrupted
    let cachedCustomers = [];
    try {
      const customersData = localStorage.getItem("paw_customers");
      if (customersData) {
        cachedCustomers = JSON.parse(customersData);
      }

      // Multiple safety checks to ensure it's an array
      if (!cachedCustomers || !Array.isArray(cachedCustomers)) {
        console.warn("⚠️ Cached customers is not an array, resetting...");
        cachedCustomers = [];
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse cached customers, resetting...", error);
      cachedCustomers = [];
    }

    // Final safety check before filter
    if (!Array.isArray(cachedCustomers)) {
      console.error(
        "⚠️ Critical: cachedCustomers is still not an array, forcing to empty array",
      );
      cachedCustomers = [];
    }

    const cleanCustomers = cachedCustomers.filter((customer: any) => {
      return customer && customer.id && !customer.id.startsWith("offline_");
    });
    localStorage.setItem("paw_customers", JSON.stringify(cleanCustomers));

    // 6. Reset last sync time to force fresh sync
    localStorage.removeItem("last_sync_time");

    console.log("✅ Quick sync fix completed!");
    console.log(
      `📊 Removed ${problemOperations.length} problematic operations`,
    );
    console.log(`📋 ${cleanQueue.length} operations remaining in queue`);

    return Promise.resolve();
  } catch (error) {
    console.error("❌ Quick sync fix failed:", error);

    // If all else fails, clear everything and start fresh
    console.log("🔄 Performing emergency clean...");

    try {
      const keysToClean = [
        "offline_queue",
        "cached_customers",
        "cached_products",
        "cached_sales",
        "last_sync_time",
      ];

      keysToClean.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (cleanError) {
          console.warn(`⚠️ Failed to remove ${key}:`, cleanError);
        }
      });

      console.log("✅ Emergency clean completed");
    } catch (emergencyError) {
      console.error("❌ Emergency clean also failed:", emergencyError);
    }

    return Promise.resolve();
  }
}

// دالة للتنظيف الشامل
export function emergencyCleanup(): void {
  console.log("🚨 Emergency cleanup initiated...");

  const keysToRemove = [
    "offline_queue",
    "cached_customers",
    "cached_products",
    "cached_sales",
    "cached_transactions",
    "last_sync_time",
  ];

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed: ${key}`);
  });

  console.log("✅ Emergency cleanup completed - system reset");
}

// دالة للتحقق من حالة النظام
export function checkSyncHealth(): {
  healthy: boolean;
  issues: string[];
  queueLength: number;
  offlineCustomers: number;
} {
  const issues: string[] = [];

  try {
    // Check queue
    let queue;
    try {
      queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");

      // Ensure it's an array
      if (!Array.isArray(queue)) {
        queue = [];
      }
    } catch (error) {
      queue = [];
    }

    const problematicOps = queue.filter((op: any) => op && op.retryCount > 3);

    if (problematicOps.length > 0) {
      issues.push(`${problematicOps.length} operations with too many retries`);
    }

    // Check offline customers
    let cachedCustomers = [];
    try {
      const customersData = localStorage.getItem("paw_customers");
      if (customersData) {
        cachedCustomers = JSON.parse(customersData);
      }

      // Multiple safety checks
      if (!cachedCustomers || !Array.isArray(cachedCustomers)) {
        cachedCustomers = [];
      }
    } catch (error) {
      console.warn("⚠️ Error parsing customers for diagnosis:", error);
      cachedCustomers = [];
    }

    // Final safety check
    if (!Array.isArray(cachedCustomers)) {
      cachedCustomers = [];
    }

    const offlineCustomers = cachedCustomers.filter(
      (c: any) => c && c.id && c.id.startsWith("offline_"),
    );

    if (offlineCustomers.length > 0) {
      issues.push(`${offlineCustomers.length} unresolved offline customers`);
    }

    // Check for very old operations
    const oldOps = queue.filter((op: any) => {
      const ageInHours = (Date.now() - op.timestamp) / (1000 * 60 * 60);
      return ageInHours > 24;
    });

    if (oldOps.length > 0) {
      issues.push(`${oldOps.length} operations older than 24 hours`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      queueLength: queue.length,
      offlineCustomers: offlineCustomers.length,
    };
  } catch (error) {
    return {
      healthy: false,
      issues: ["Failed to check sync health"],
      queueLength: 0,
      offlineCustomers: 0,
    };
  }
}
