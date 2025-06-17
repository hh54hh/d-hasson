// Sync Fixer Utility - حل مشاكل المزامنة
import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";

export class SyncFixer {
  // إصلاح المزامنة المعطلة
  static async fixBrokenSync(): Promise<{
    fixed: number;
    skipped: number;
    errors: string[];
  }> {
    console.log("🔧 Starting sync repair process...");

    const results = {
      fixed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    try {
      // 1. تنظيف العمليات المكررة
      console.log("🧹 Cleaning duplicate operations...");
      offlineManager.cleanDuplicateOperations();

      // 2. الحصول على قائمة العمليات المعلقة
      const queuedOps = offlineManager.getQueuedOperations();
      console.log(`📋 Found ${queuedOps.length} queued operations`);

      // 3. فحص وإصلاح كل عملية
      for (const operation of queuedOps) {
        try {
          await this.fixSingleOperation(operation);
          results.fixed++;
        } catch (error) {
          console.error(`❌ Failed to fix operation ${operation.id}:`, error);
          results.errors.push(`Operation ${operation.id}: ${error}`);

          // تسجيل العملية كمعالجة لتجنب إعادة المحاولة
          this.markOperationAsProcessed(operation.id);
          results.skipped++;
        }
      }

      console.log(
        `✅ Sync repair completed: ${results.fixed} fixed, ${results.skipped} skipped`,
      );
      return results;
    } catch (error) {
      console.error("❌ Sync repair failed:", error);
      results.errors.push(`General error: ${error}`);
      return results;
    }
  }

  // إصلاح عملية واحدة
  private static async fixSingleOperation(operation: any): Promise<void> {
    console.log(
      `🔧 Fixing operation: ${operation.id} (${operation.type} ${operation.table})`,
    );

    switch (operation.table) {
      case "customers":
        await this.fixCustomerOperation(operation);
        break;
      case "sales":
        await this.fixSaleOperation(operation);
        break;
      case "products":
        await this.fixProductOperation(operation);
        break;
      default:
        console.log(`⏭️ Skipping unknown table: ${operation.table}`);
        this.markOperationAsProcessed(operation.id);
    }
  }

  // إصلاح عمليات العملاء
  private static async fixCustomerOperation(operation: any): Promise<void> {
    if (operation.type === "create") {
      const customerData = operation.data;

      // التحقق من وجود العميل بالهاتف
      try {
        const existingCustomer = await supabaseService.getCustomerByPhone(
          customerData.phone,
        );

        if (existingCustomer) {
          console.log(`✅ Customer already exists: ${existingCustomer.name}`);
          // تحديث الكاش المحلي
          this.updateLocalCustomerCache(
            customerData.tempId || customerData.id,
            existingCustomer,
          );
        } else {
          // إنشاء العميل
          const newCustomer = await supabaseService.createCustomer({
            name: customerData.name || "عميل مؤقت",
            phone: customerData.phone || `temp_${Date.now()}`,
            address: customerData.address || "عنوان مؤقت",
            paymentStatus: customerData.paymentStatus || "cash",
            debtAmount: customerData.debtAmount || 0,
          });

          console.log(`✅ Created new customer: ${newCustomer.name}`);
          this.updateLocalCustomerCache(
            customerData.tempId || customerData.id,
            newCustomer,
          );
        }
      } catch (error) {
        console.error("❌ Failed to fix customer operation:", error);
        throw error;
      }
    }

    // تسجيل العملية كمعالجة
    this.markOperationAsProcessed(operation.id);
  }

  // إصلاح عمليات البيع
  private static async fixSaleOperation(operation: any): Promise<void> {
    const saleData = operation.data;
    let customerId = saleData.customerId;

    // إصلاح معرف العميل إذا كان مؤقت
    if (customerId.startsWith("offline_")) {
      console.log(`🔍 Resolving offline customer ID: ${customerId}`);

      // البحث في الكاش المحلي
      const cachedCustomers = offlineManager.getCachedData("customers");
      const customerData = cachedCustomers.find(
        (c: any) => c.id === customerId,
      );

      if (customerData) {
        // البحث بالهاتف في Supabase
        const existingCustomer = await supabaseService.getCustomerByPhone(
          customerData.phone,
        );

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log(
            `✅ Resolved to existing customer: ${existingCustomer.id}`,
          );
        } else {
          // إنشاء العميل
          const newCustomer = await supabaseService.createCustomer({
            name: customerData.name,
            phone: customerData.phone,
            address: customerData.address,
            paymentStatus: customerData.paymentStatus || "cash",
            debtAmount: customerData.debtAmount || 0,
          });

          customerId = newCustomer.id;
          console.log(`✅ Created customer for sale: ${newCustomer.id}`);
        }
      } else {
        console.error(
          `❌ Customer data not found for offline ID: ${customerId}`,
        );
        throw new Error(
          `Customer data not found for offline ID: ${customerId}`,
        );
      }
    }

    // إنشاء البيعة
    try {
      await supabaseService.createSaleWithCart(
        customerId,
        saleData.cartItems,
        saleData.saleData,
      );
      console.log(`✅ Sale created successfully for customer: ${customerId}`);
    } catch (error) {
      console.error("❌ Failed to create sale:", error);
      throw error;
    }

    // تسجيل العملية كمعالجة
    this.markOperationAsProcessed(operation.id);
  }

  // إصلاح عمليات المنتجات
  private static async fixProductOperation(operation: any): Promise<void> {
    // معظم عمليات المنتجات لا تحتاج إصلاح معقد
    console.log(`⏭️ Skipping product operation: ${operation.id}`);
    this.markOperationAsProcessed(operation.id);
  }

  // تحديث كاش العميل المحلي
  private static updateLocalCustomerCache(
    tempId: string,
    realCustomer: any,
  ): void {
    try {
      const cachedCustomers = offlineManager.getCachedData("customers");
      const updatedCustomers = cachedCustomers.map((c: any) => {
        if (c.id === tempId) {
          return { ...c, id: realCustomer.id };
        }
        return c;
      });

      offlineManager.cacheData("customers", updatedCustomers);
      console.log(`✅ Updated local cache: ${tempId} → ${realCustomer.id}`);
    } catch (error) {
      console.warn("⚠️ Failed to update local cache:", error);
    }
  }

  // تسجيل العملية كمعالجة
  private static markOperationAsProcessed(operationId: string): void {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      const updatedQueue = queue.map((op: any) => {
        if (op.id === operationId) {
          return { ...op, processed: true };
        }
        return op;
      });

      localStorage.setItem("offline_queue", JSON.stringify(updatedQueue));
      console.log(`✅ Marked operation as processed: ${operationId}`);
    } catch (error) {
      console.error("❌ Failed to mark operation as processed:", error);
    }
  }

  // تنظيف شامل للعمليات المعطلة
  static cleanBrokenOperations(): number {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");

      // إزالة العمليات القديمة (أكثر من 7 أيام)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cleanQueue = queue.filter((op: any) => {
        return op.timestamp > sevenDaysAgo && !op.processed;
      });

      const removedCount = queue.length - cleanQueue.length;
      localStorage.setItem("offline_queue", JSON.stringify(cleanQueue));

      console.log(`🧹 Cleaned ${removedCount} old/processed operations`);
      return removedCount;
    } catch (error) {
      console.error("❌ Failed to clean operations:", error);
      return 0;
    }
  }

  // إعادة تعيين كامل لنظام المزامنة
  static resetSyncSystem(): void {
    try {
      // مسح قائمة العمليات
      localStorage.removeItem("offline_queue");

      // مسح آخر وقت مزامنة
      localStorage.removeItem("last_sync_time");

      // إعادة تعيين حالة المزامنة
      offlineManager.resetSyncState();

      console.log("🔄 Sync system reset successfully");
    } catch (error) {
      console.error("❌ Failed to reset sync system:", error);
    }
  }

  // تشخيص حالة المزامنة
  static diagnoseSyncStatus(): {
    queuedOperations: number;
    oldOperations: number;
    processedOperations: number;
    cacheSize: {
      customers: number;
      products: number;
      sales: number;
    };
  } {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const queuedOperations = queue.filter((op: any) => !op.processed).length;
      const oldOperations = queue.filter(
        (op: any) => op.timestamp < sevenDaysAgo,
      ).length;
      const processedOperations = queue.filter(
        (op: any) => op.processed,
      ).length;

      const customers = offlineManager.getCachedData("customers");
      const products = offlineManager.getCachedData("products");
      const sales = offlineManager.getCachedData("sales");

      return {
        queuedOperations,
        oldOperations,
        processedOperations,
        cacheSize: {
          customers: customers.length,
          products: products.length,
          sales: sales.length,
        },
      };
    } catch (error) {
      console.error("❌ Failed to diagnose sync status:", error);
      return {
        queuedOperations: 0,
        oldOperations: 0,
        processedOperations: 0,
        cacheSize: { customers: 0, products: 0, sales: 0 },
      };
    }
  }
}

// تصدير مثيل للاستخدام المباشر
export const syncFixer = SyncFixer;
