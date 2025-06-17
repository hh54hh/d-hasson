// Sync Queue Debugger and Fixer
// This utility helps debug and fix problematic sync operations

interface QueuedOperation {
  id: string;
  type: string;
  table: string;
  data: any;
  retryCount: number;
  timestamp: number;
  processed?: boolean;
}

export class SyncDebugger {
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

  // Find problematic operations (the ones that keep failing)
  static findProblematicOperations(): QueuedOperation[] {
    const queue = this.getQueue();
    return queue.filter((op) => op.retryCount > 3);
  }

  // Fix operations that have old sale structure
  static fixOldSaleOperations(): number {
    const queue = this.getQueue();
    let fixedCount = 0;

    const fixedQueue = queue.map((operation) => {
      // Check if this is a sale operation with old structure
      if (operation.table === "sales" && operation.type === "create") {
        const data = operation.data;

        // If the data has the old structure (contains productName directly), fix it
        if (data.productName || data.product_name) {
          console.log(
            "🔧 Fixing old sale structure for operation:",
            operation.id,
          );

          // Convert old structure to new cart-based structure
          const fixedData = {
            customerId: data.customerId || data.customer_id,
            cartItems: [
              {
                id: `fixed_${Date.now()}`,
                product: {
                  id: data.productId || data.product_id || "unknown",
                  name:
                    data.productName || data.product_name || "منتج غير معروف",
                  salePrice: data.unitPrice || data.unit_price || 0,
                  wholesalePrice: 0,
                  quantity: 100,
                  minQuantity: 1,
                },
                quantity: data.quantity || 1,
                unitPrice: data.unitPrice || data.unit_price || 0,
                totalPrice: data.totalAmount || data.total_amount || 0,
              },
            ],
            saleData: {
              paymentType: data.paymentType || data.payment_type || "cash",
              paidAmount: data.paidAmount || data.paid_amount || 0,
              notes: data.notes || "",
            },
          };

          fixedCount++;
          return {
            ...operation,
            data: fixedData,
            retryCount: 0, // Reset retry count
          };
        }
      }

      return operation;
    });

    if (fixedCount > 0) {
      this.saveQueue(fixedQueue);
      console.log(`🎉 Fixed ${fixedCount} operations with old sale structure`);
    }

    return fixedCount;
  }

  // Remove operations that are failing with database constraint errors
  static removeConstraintErrorOperations(): number {
    const queue = this.getQueue();
    const originalLength = queue.length;

    // Remove operations that have failed more than 5 times (likely constraint errors)
    const cleanedQueue = queue.filter((op) => {
      if (op.retryCount > 5) {
        console.log(
          `🗑️ Removing problematic operation: ${op.id} (${op.retryCount} retries)`,
        );
        return false;
      }
      return true;
    });

    this.saveQueue(cleanedQueue);
    const removedCount = originalLength - cleanedQueue.length;

    if (removedCount > 0) {
      console.log(`🧹 Removed ${removedCount} problematic operations`);
    }

    return removedCount;
  }

  // Get detailed info about the queue
  static getQueueInfo(): {
    total: number;
    byTable: Record<string, number>;
    byType: Record<string, number>;
    problematic: number;
    oldStructure: number;
  } {
    const queue = this.getQueue();

    const info = {
      total: queue.length,
      byTable: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      problematic: 0,
      oldStructure: 0,
    };

    queue.forEach((op) => {
      // Count by table
      info.byTable[op.table] = (info.byTable[op.table] || 0) + 1;

      // Count by type
      info.byType[op.type] = (info.byType[op.type] || 0) + 1;

      // Count problematic (high retry count)
      if (op.retryCount > 3) {
        info.problematic++;
      }

      // Count old structure sales
      if (
        op.table === "sales" &&
        (op.data.productName || op.data.product_name)
      ) {
        info.oldStructure++;
      }
    });

    return info;
  }

  // Clear entire queue (nuclear option)
  static clearQueue(): void {
    localStorage.removeItem(this.QUEUE_KEY);
    console.log("🧹 Sync queue cleared completely");
  }

  // Export queue for debugging
  static exportQueue(): string {
    const queue = this.getQueue();
    return JSON.stringify(queue, null, 2);
  }

  // Find specific operation by ID
  static findOperation(id: string): QueuedOperation | null {
    const queue = this.getQueue();
    return queue.find((op) => op.id === id) || null;
  }

  // Remove specific operation by ID
  static removeOperation(id: string): boolean {
    const queue = this.getQueue();
    const filteredQueue = queue.filter((op) => op.id !== id);

    if (filteredQueue.length < queue.length) {
      this.saveQueue(filteredQueue);
      console.log(`🗑️ Removed operation: ${id}`);
      return true;
    }

    return false;
  }
}

// Auto-fix function that can be called from anywhere
export function autoFixSyncIssues(): void {
  console.log("🔧 Starting auto-fix for sync issues...");

  const info = SyncDebugger.getQueueInfo();
  console.log("📊 Queue info:", info);

  // Fix old sale structures
  const fixedOld = SyncDebugger.fixOldSaleOperations();

  // Remove problematic operations
  const removedProblematic = SyncDebugger.removeConstraintErrorOperations();

  console.log("✅ Auto-fix completed:", {
    fixedOldStructures: fixedOld,
    removedProblematic: removedProblematic,
  });
}
