// UUID Error Fixer - Handles offline ID issues in sync queue
// This utility specifically fixes UUID errors related to offline customer IDs

interface QueuedOperation {
  id: string;
  type: string;
  table: string;
  data: any;
  retryCount: number;
  timestamp: number;
  processed?: boolean;
}

export class UUIDErrorFixer {
  private static QUEUE_KEY = "paw_sync_queue";

  // Get all queued operations
  static getQueue(): QueuedOperation[] {
    try {
      const queue = localStorage.getItem(this.QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error("Failed to get queue:", error);
      return [];
    }
  }

  // Save queue
  static saveQueue(queue: QueuedOperation[]): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Failed to save queue:", error);
    }
  }

  // Remove operations with offline customer IDs causing UUID errors
  static removeOfflineUUIDOperations(): number {
    const queue = this.getQueue();
    const originalLength = queue.length;

    const cleanedQueue = queue.filter((op) => {
      // Remove sales operations with offline customer IDs
      if (
        op.table === "sales" &&
        op.data.customerId &&
        op.data.customerId.startsWith("offline_")
      ) {
        console.log(
          `🆔 Removing sales operation with offline customer ID: ${op.id} (customer: ${op.data.customerId})`,
        );
        return false;
      }

      // Remove operations that have been retrying UUID errors
      if (op.retryCount > 5 && op.table === "sales") {
        console.log(
          `🔄 Removing high-retry sales operation: ${op.id} (${op.retryCount} retries)`,
        );
        return false;
      }

      return true;
    });

    this.saveQueue(cleanedQueue);
    const removedCount = originalLength - cleanedQueue.length;

    if (removedCount > 0) {
      console.log(
        `✅ UUID Error Fix: Removed ${removedCount} problematic operations`,
      );
    }

    return removedCount;
  }

  // Fix offline customer references in sales operations
  static fixOfflineCustomerReferences(): number {
    const queue = this.getQueue();
    let fixedCount = 0;

    // Get cached customers to find phone numbers
    const cachedCustomers = JSON.parse(
      localStorage.getItem("paw_cache_customers") || "[]",
    );

    const fixedQueue = queue.map((op) => {
      if (
        op.table === "sales" &&
        op.data.customerId &&
        op.data.customerId.startsWith("offline_")
      ) {
        // Find the customer data
        const customerData = cachedCustomers.find(
          (c: any) => c.id === op.data.customerId,
        );

        if (customerData) {
          // Look for an existing customer with the same phone
          const realCustomer = cachedCustomers.find(
            (c: any) =>
              c.phone === customerData.phone && !c.id.startsWith("offline_"),
          );

          if (realCustomer) {
            console.log(
              `🔄 Fixing customer reference: ${op.data.customerId} -> ${realCustomer.id}`,
            );

            fixedCount++;
            return {
              ...op,
              data: {
                ...op.data,
                customerId: realCustomer.id,
              },
              retryCount: 0, // Reset retry count
            };
          }
        }
      }

      return op;
    });

    if (fixedCount > 0) {
      this.saveQueue(fixedQueue);
      console.log(`🔧 Fixed ${fixedCount} offline customer references`);
    }

    return fixedCount;
  }

  // Comprehensive UUID error fix
  static fixAllUUIDErrors(): {
    removed: number;
    fixed: number;
    remaining: number;
  } {
    console.log("🔧 Starting comprehensive UUID error fix...");

    const originalQueue = this.getQueue();
    const originalCount = originalQueue.length;

    // Step 1: Try to fix offline customer references
    const fixedCount = this.fixOfflineCustomerReferences();

    // Step 2: Remove problematic operations that can't be fixed
    const removedCount = this.removeOfflineUUIDOperations();

    const finalQueue = this.getQueue();
    const remainingCount = finalQueue.length;

    console.log("📊 UUID Error Fix Results:");
    console.log(`- Original operations: ${originalCount}`);
    console.log(`- Fixed operations: ${fixedCount}`);
    console.log(`- Removed operations: ${removedCount}`);
    console.log(`- Remaining operations: ${remainingCount}`);

    return {
      removed: removedCount,
      fixed: fixedCount,
      remaining: remainingCount,
    };
  }

  // Find operations with UUID issues
  static findUUIDProblems(): {
    offlineCustomerSales: QueuedOperation[];
    highRetrySales: QueuedOperation[];
    total: number;
  } {
    const queue = this.getQueue();

    const offlineCustomerSales = queue.filter(
      (op) =>
        op.table === "sales" &&
        op.data.customerId &&
        op.data.customerId.startsWith("offline_"),
    );

    const highRetrySales = queue.filter(
      (op) => op.table === "sales" && op.retryCount > 3,
    );

    return {
      offlineCustomerSales,
      highRetrySales,
      total: offlineCustomerSales.length + highRetrySales.length,
    };
  }
}

// Auto-fix function that can be called immediately
export function fixUUIDErrors(): void {
  console.log("🆔 Fixing UUID errors in sync queue...");

  const problems = UUIDErrorFixer.findUUIDProblems();

  if (problems.total > 0) {
    console.log(`Found ${problems.total} potential UUID problems`);
    console.log(
      `- Offline customer sales: ${problems.offlineCustomerSales.length}`,
    );
    console.log(`- High retry sales: ${problems.highRetrySales.length}`);

    const result = UUIDErrorFixer.fixAllUUIDErrors();

    console.log("✅ UUID error fix completed:", result);
  } else {
    console.log("✅ No UUID problems found in sync queue");
  }
}

// Make functions available globally for console access
if (typeof window !== "undefined") {
  (window as any).fixUUIDErrors = fixUUIDErrors;
  (window as any).UUIDErrorFixer = UUIDErrorFixer;
}
