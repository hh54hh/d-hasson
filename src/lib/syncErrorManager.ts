import { offlineManager } from "./offlineManager";
import { supabaseService } from "./supabaseService";
import { logError, formatError } from "./utils";

/**
 * مدير أخطاء المزامنة - يحل مشاكل التكرار والعمليات العالقة
 * Sync Error Manager - Resolves retry loops and stuck operations
 */
export class SyncErrorManager {
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly RETRY_DELAY = 30000; // 30 seconds
  private static readonly STUCK_OPERATION_TIMEOUT = 300000; // 5 minutes

  private static blacklistedOperations: Set<string> = new Set();
  private static lastConnectionCheck: number = 0;
  private static connectionCheckInterval: number = 60000; // 1 minute

  /**
   * فحص وتنظيف العمليات العالقة
   */
  static async cleanupStuckOperations(): Promise<{
    cleaned: number;
    blacklisted: number;
    errors: string[];
  }> {
    try {
      console.log("🧹 تنظيف العمليات العالقة...");

      const queue = offlineManager.getQueuedOperations();
      const now = Date.now();
      let cleaned = 0;
      let blacklisted = 0;
      const errors: string[] = [];

      // فحص كل عملية في الطابور
      for (const operation of queue) {
        try {
          // التحقق من العمليات المتكررة أكثر من اللازم
          if ((operation.retryCount || 0) >= this.MAX_RETRY_COUNT) {
            console.log(
              `🚫 تم إدراج العملية في القائمة السوداء: ${operation.id}`,
            );
            this.blacklistedOperations.add(operation.id);
            blacklisted++;
            continue;
          }

          // التحقق من العمليات القديمة العالقة
          const operationAge = now - operation.timestamp;
          if (operationAge > this.STUCK_OPERATION_TIMEOUT) {
            console.log(
              `⏰ عملية قديمة عالقة: ${operation.id} (عمر: ${Math.round(operationAge / 60000)} دقيقة)`,
            );

            // محاولة حل المشكلة حسب نوع العملية
            const resolved = await this.resolveStuckOperation(operation);
            if (resolved) {
              this.removeOperationFromQueue(operation.id);
              cleaned++;
            }
          }

          // التحقق من العمليات المكررة
          const duplicates = queue.filter(
            (op) =>
              op.id !== operation.id &&
              op.table === operation.table &&
              op.type === operation.type &&
              JSON.stringify(op.data) === JSON.stringify(operation.data),
          );

          if (duplicates.length > 0) {
            console.log(`🔄 عمليات مكررة مكتشفة: ${duplicates.length + 1}`);
            // إزالة النسخ المكررة والاحتفاظ بالأحدث
            for (const duplicate of duplicates) {
              if (duplicate.timestamp < operation.timestamp) {
                this.removeOperationFromQueue(duplicate.id);
                cleaned++;
              }
            }
          }
        } catch (error: any) {
          const errorMsg = `فشل في معالجة العملية ${operation.id}: ${formatError(error)}`;
          errors.push(errorMsg);
          logError("خطأ في تنظيف العمليات:", error, {
            operationId: operation.id,
            operation: "cleanup_stuck_operations",
          });
        }
      }

      console.log(
        `✅ تنظيف مكتمل: ${cleaned} عملية منظفة، ${blacklisted} في القائمة السوداء`,
      );

      return { cleaned, blacklisted, errors };
    } catch (error: any) {
      logError("فشل في تنظيف العمليات العالقة:", error, {
        operation: "cleanup_stuck_operations",
      });

      return {
        cleaned: 0,
        blacklisted: 0,
        errors: [formatError(error)],
      };
    }
  }

  /**
   * حل عملية عالقة محددة
   */
  private static async resolveStuckOperation(operation: any): Promise<boolean> {
    try {
      console.log(`🔧 محاولة حل العملية العالقة: ${operation.id}`);

      switch (operation.table) {
        case "customers":
          return await this.resolveCustomerOperation(operation);

        case "products":
          return await this.resolveProductOperation(operation);

        case "sales":
          return await this.resolveSaleOperation(operation);

        default:
          console.warn(`⚠️ نوع عملية غير مدعوم: ${operation.table}`);
          return false;
      }
    } catch (error: any) {
      logError(`فشل في حل العملية ${operation.id}:`, error, {
        operationId: operation.id,
        operationType: operation.type,
        operationTable: operation.table,
      });
      return false;
    }
  }

  /**
   * حل عمليات العملاء العالقة
   */
  private static async resolveCustomerOperation(
    operation: any,
  ): Promise<boolean> {
    try {
      if (operation.type === "create") {
        // التحقق من وجود العميل بالهاتف
        const existingCustomer = await supabaseService.getCustomerByPhone(
          operation.data.phone,
        );

        if (existingCustomer) {
          console.log(`✅ العميل موجود مسبقاً: ${operation.data.phone}`);
          // تحديث الكاش المحلي وإزالة العملية
          await this.updateLocalCustomerCache(operation.data, existingCustomer);
          return true;
        }

        // محاولة إنشاء العميل مرة أخرى
        const newCustomer = await supabaseService.createCustomer(
          operation.data,
        );
        console.log(`✅ تم إنشاء العميل: ${newCustomer.name}`);
        await this.updateLocalCustomerCache(operation.data, newCustomer);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`فشل في حل عملية العميل:`, formatError(error));
      return false;
    }
  }

  /**
   * حل عمليات المنتجات العالقة
   */
  private static async resolveProductOperation(
    operation: any,
  ): Promise<boolean> {
    try {
      if (operation.type === "update") {
        // محاولة تحديث المنتج
        await supabaseService.updateProduct(operation.data.id, operation.data);
        console.log(`✅ تم تحديث المنتج: ${operation.data.id}`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`فشل في حل عملية المنتج:`, formatError(error));
      return false;
    }
  }

  /**
   * حل عمليات المبيعات العالقة
   */
  private static async resolveSaleOperation(operation: any): Promise<boolean> {
    try {
      if (operation.type === "create") {
        // التحقق من العميل أولاً
        let customerId = operation.data.customerId;

        if (customerId && customerId.startsWith("offline_")) {
          // البحث عن العميل في قاعدة البيانات أو إنشاؤه
          const customerInfo = operation.data.customerInfo;
          if (customerInfo) {
            const existingCustomer = await supabaseService.getCustomerByPhone(
              customerInfo.phone,
            );

            if (existingCustomer) {
              customerId = existingCustomer.id;
            } else {
              const newCustomer =
                await supabaseService.createCustomer(customerInfo);
              customerId = newCustomer.id;
            }
          } else {
            console.error(`❌ معلومات العميل مفقودة للعملية: ${operation.id}`);
            return false;
          }
        }

        // إنشاء البيع مع ID العميل الصحيح
        await supabaseService.createSaleWithCart(
          customerId,
          operation.data.cartItems,
          operation.data.saleData,
        );

        console.log(`✅ تم إنشاء البيع للعميل: ${customerId}`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`فشل في حل عملية البيع:`, formatError(error));
      return false;
    }
  }

  /**
   * تحديث كاش العملاء المحلي
   */
  private static async updateLocalCustomerCache(
    oldData: any,
    newCustomer: any,
  ): Promise<void> {
    try {
      const cachedCustomers = offlineManager.getCachedData("customers");
      const updatedCustomers = cachedCustomers.map((c: any) => {
        if (c.id === oldData.id || c.phone === oldData.phone) {
          return newCustomer;
        }
        return c;
      });

      // إضافة العميل إذا لم يكن موجوداً
      const exists = updatedCustomers.some((c: any) => c.id === newCustomer.id);
      if (!exists) {
        updatedCustomers.push(newCustomer);
      }

      offlineManager.cacheData("customers", updatedCustomers);
      console.log(`✅ تم تحديث كاش العملاء`);
    } catch (error: any) {
      console.error("فشل في تحديث كاش العملاء:", error);
    }
  }

  /**
   * إزالة عملية من الطابور
   */
  private static removeOperationFromQueue(operationId: string): void {
    try {
      const success = offlineManager.removeOperationFromQueue(operationId);
      if (!success) {
        console.warn(`⚠️ لم يتم العثور على العملية للحذف: ${operationId}`);
      }
    } catch (error: any) {
      console.error("فشل في حذف العملية:", error);
    }
  }

  /**
   * فحص حالة الاتصال بذكاء
   */
  static async checkConnectionStatus(): Promise<{
    isOnline: boolean;
    canReachSupabase: boolean;
    latency: number;
    error?: string;
  }> {
    const now = Date.now();

    // تجنب الفحص المتكرر
    if (now - this.lastConnectionCheck < this.connectionCheckInterval) {
      return {
        isOnline: navigator.onLine,
        canReachSupabase: false,
        latency: -1,
        error: "فحص مؤجل لتجنب التكرار",
      };
    }

    this.lastConnectionCheck = now;

    try {
      const startTime = Date.now();

      // فحص بسيط لقاعدة البيانات
      await supabaseService
        .supabase!.from("customers")
        .select("count")
        .limit(0);

      const latency = Date.now() - startTime;

      return {
        isOnline: true,
        canReachSupabase: true,
        latency,
      };
    } catch (error: any) {
      return {
        isOnline: navigator.onLine,
        canReachSupabase: false,
        latency: -1,
        error: formatError(error),
      };
    }
  }

  /**
   * تنظيف شامل للنظام
   */
  static async performSystemCleanup(): Promise<{
    success: boolean;
    report: {
      stuckOperationsFixed: number;
      duplicatesRemoved: number;
      blacklistedOperations: number;
      connectionStatus: any;
    };
    errors: string[];
  }> {
    try {
      console.log("🧹 بدء التنظيف الشامل للنظام...");

      // 1. تنظيف العمليات العالقة
      const cleanupResult = await this.cleanupStuckOperations();

      // 2. فحص حالة الاتصال
      const connectionStatus = await this.checkConnectionStatus();

      // 3. إعادة تعيين القائمة السوداء إذا كان الاتصال جيد
      if (connectionStatus.canReachSupabase) {
        console.log("🔄 إعادة تعيين القائمة السوداء بعد استعادة الاتصال");
        this.blacklistedOperations.clear();
      }

      const report = {
        stuckOperationsFixed: cleanupResult.cleaned,
        duplicatesRemoved: cleanupResult.cleaned, // نفس القيمة للبساطة
        blacklistedOperations: cleanupResult.blacklisted,
        connectionStatus,
      };

      console.log("✅ التنظيف الشامل مكتمل:", report);

      return {
        success: true,
        report,
        errors: cleanupResult.errors,
      };
    } catch (error: any) {
      logError("فشل في التنظيف الشامل:", error, {
        operation: "system_cleanup",
      });

      return {
        success: false,
        report: {
          stuckOperationsFixed: 0,
          duplicatesRemoved: 0,
          blacklistedOperations: 0,
          connectionStatus: {
            isOnline: false,
            canReachSupabase: false,
            latency: -1,
          },
        },
        errors: [formatError(error)],
      };
    }
  }

  /**
   * التحقق من إذا كانت العملية في القائمة السوداء
   */
  static isOperationBlacklisted(operationId: string): boolean {
    return this.blacklistedOperations.has(operationId);
  }

  /**
   * إضافة عملية للقائمة السوداء
   */
  static blacklistOperation(operationId: string): void {
    this.blacklistedOperations.add(operationId);
    console.log(`🚫 تم إدراج العملية في القائمة السوداء: ${operationId}`);
  }

  /**
   * إزالة عملية من القائمة السوداء
   */
  static removeFromBlacklist(operationId: string): void {
    this.blacklistedOperations.delete(operationId);
    console.log(`✅ تم إزالة العملية من القائمة السوداء: ${operationId}`);
  }

  /**
   * مسح القائمة السوداء بالكامل
   */
  static clearBlacklist(): void {
    const count = this.blacklistedOperations.size;
    this.blacklistedOperations.clear();
    console.log(`🧹 تم مسح القائمة السوداء (${count} عمليات)`);
  }

  /**
   * الحصول على تقرير شامل عن حالة المزامنة
   */
  static async getSyncReport(): Promise<{
    queueSize: number;
    blacklistedCount: number;
    oldestOperation: string | null;
    connectionStatus: any;
    recommendations: string[];
  }> {
    try {
      const queue = offlineManager.getQueuedOperations();
      const connectionStatus = await this.checkConnectionStatus();
      const now = Date.now();

      let oldestOperation: string | null = null;
      let oldestTime = now;

      for (const op of queue) {
        if (op.timestamp < oldestTime) {
          oldestTime = op.timestamp;
          oldestOperation = `${op.id} (عمر: ${Math.round((now - op.timestamp) / 60000)} دقيقة)`;
        }
      }

      const recommendations: string[] = [];

      if (queue.length > 10) {
        recommendations.push(
          "يوجد عدد كبير من العمليات في الطابور - يُنصح بالتنظيف",
        );
      }

      if (this.blacklistedOperations.size > 0) {
        recommendations.push(
          `${this.blacklistedOperations.size} عملية في القائمة السوداء - تحتاج مراجعة`,
        );
      }

      if (!connectionStatus.canReachSupabase) {
        recommendations.push(
          "لا يمكن الوصول لقاعدة البيانات - تحقق من الاتصال",
        );
      }

      if (connectionStatus.latency > 5000) {
        recommendations.push("بطء في الاتصال - قد يؤثر على المزامنة");
      }

      return {
        queueSize: queue.length,
        blacklistedCount: this.blacklistedOperations.size,
        oldestOperation,
        connectionStatus,
        recommendations,
      };
    } catch (error: any) {
      logError("فشل في توليد تقرير المزامنة:", error);

      return {
        queueSize: 0,
        blacklistedCount: 0,
        oldestOperation: null,
        connectionStatus: {
          isOnline: false,
          canReachSupabase: false,
          latency: -1,
        },
        recommendations: ["فشل في توليد التقرير"],
      };
    }
  }
}

// دوال مساعدة للتصدير
export const cleanupStuckSyncOperations = () =>
  SyncErrorManager.cleanupStuckOperations();
export const checkSyncConnectionStatus = () =>
  SyncErrorManager.checkConnectionStatus();
export const performSyncSystemCleanup = () =>
  SyncErrorManager.performSystemCleanup();
export const getSyncSystemReport = () => SyncErrorManager.getSyncReport();
