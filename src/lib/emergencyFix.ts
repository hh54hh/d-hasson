// Emergency fix for constraint violation errors
// This can be executed immediately from the browser console

export const emergencyFixConstraintErrors = (): void => {
  console.log("🚨 Emergency fix for constraint errors starting...");

  try {
    const queueKey = "paw_sync_queue";
    const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");

    console.log(`📊 Found ${queue.length} operations in queue`);

    // Remove the specific problematic operation
    const problematicId = "1750025898612_6w8ws0cd9";
    let removed = 0;

    const cleanedQueue = queue.filter((op: any) => {
      // Remove the specific failing operation
      if (op.id === problematicId) {
        console.log(`🗑️ Removing specific problematic operation: ${op.id}`);
        removed++;
        return false;
      }

      // Remove any operations with high retry counts
      if (op.retryCount > 5) {
        console.log(
          `🗑️ Removing high-retry operation: ${op.id} (${op.retryCount} retries)`,
        );
        removed++;
        return false;
      }

      // Remove sales operations with old structure
      if (op.table === "sales" && op.type === "create") {
        const data = op.data;

        // Check for old structure (direct product fields in sales)
        if (
          data.productName ||
          data.product_name ||
          data.productId ||
          data.product_id
        ) {
          console.log(`🗑️ Removing old-structure sales operation: ${op.id}`);
          removed++;
          return false;
        }

        // Check for invalid cart structure
        if (
          !data.cartItems ||
          !Array.isArray(data.cartItems) ||
          data.cartItems.length === 0
        ) {
          console.log(`🗑️ Removing invalid cart structure operation: ${op.id}`);
          removed++;
          return false;
        }
      }

      return true;
    });

    // Save the cleaned queue
    localStorage.setItem(queueKey, JSON.stringify(cleanedQueue));

    console.log(`✅ Emergency fix completed:`);
    console.log(`   - Original operations: ${queue.length}`);
    console.log(`   - Remaining operations: ${cleanedQueue.length}`);
    console.log(`   - Removed operations: ${removed}`);

    // Reload the page to apply changes
    if (removed > 0) {
      console.log("🔄 Reloading page to apply fixes...");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch (error) {
    console.error("❌ Emergency fix failed:", error);
  }
};

// Function to inspect current queue
export const inspectSyncQueue = (): void => {
  try {
    const queueKey = "paw_sync_queue";
    const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");

    console.log("📊 Sync Queue Inspection:");
    console.log(`Total operations: ${queue.length}`);

    const stats = {
      byTable: {} as Record<string, number>,
      byRetryCount: {} as Record<string, number>,
      problematic: 0,
      oldStructure: 0,
    };

    queue.forEach((op: any) => {
      // Count by table
      stats.byTable[op.table] = (stats.byTable[op.table] || 0) + 1;

      // Count by retry count
      const retryBucket = op.retryCount > 5 ? "5+" : op.retryCount.toString();
      stats.byRetryCount[retryBucket] =
        (stats.byRetryCount[retryBucket] || 0) + 1;

      // Count problematic
      if (op.retryCount > 3) {
        stats.problematic++;
      }

      // Count old structure
      if (
        op.table === "sales" &&
        (op.data.productName || op.data.product_name)
      ) {
        stats.oldStructure++;
      }
    });

    console.table(stats);

    // Show some sample operations
    if (queue.length > 0) {
      console.log("Sample operations:");
      queue.slice(0, 3).forEach((op: any) => {
        console.log(
          `- ${op.id}: ${op.type} ${op.table} (retries: ${op.retryCount})`,
        );
      });
    }
  } catch (error) {
    console.error("Failed to inspect queue:", error);
  }
};

// Make functions available globally for console access
if (typeof window !== "undefined") {
  (window as any).emergencyFixConstraintErrors = emergencyFixConstraintErrors;
  (window as any).inspectSyncQueue = inspectSyncQueue;
}
