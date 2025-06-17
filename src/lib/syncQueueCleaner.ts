// Sync Queue Cleaner - منظف طابور المزامنة
// ينظف العمليات العالقة والمرتبطة بالبيانات المحذوفة

import { offlineManager } from "./offlineManager";
import { SyncErrorManager } from "./syncErrorManager";

export class SyncQueueCleaner {
  /**
   * تنظيف طابور المزامنة من العمليات المرتبطة بالبيانات المحذوفة
   */
  static async cleanCorruptedOperations(): Promise<{
    cleaned: number;
    blacklisted: number;
    details: string[];
  }> {
    console.log("🧹 بدء تنظيف طابور المزامنة...");

    const result = {
      cleaned: 0,
      blacklisted: 0,
      details: [] as string[],
    };

    try {
      const queue = offlineManager.getQueuedOperations();
      const corruptedOperations: string[] = [];

      for (const operation of queue) {
        let isCorrupted = false;

        // فحص العمليات المرتبطة بمنتجات محذوفة
        if (operation.type === "createSale" && operation.data?.cartItems) {
          for (const item of operation.data.cartItems) {
            const productName = item.product?.name || "";

            // فحص المنتجات المحذوفة المعروفة
            const deletedProductNames = [
              "شاشه",
              "iPhone 15",
              "Samsung Galaxy",
              "Xiaomi",
              "منتج تجريبي",
              "test product",
            ];

            if (
              deletedProductNames.some((deletedName) =>
                productName.toLowerCase().includes(deletedName.toLowerCase()),
              )
            ) {
              isCorrupted = true;
              result.details.push(
                `عملية بيع تحتوي على منتج محذوف: ${productName}`,
              );
              break;
            }
          }
        }

        // فحص العمليات القديمة العالقة (أكثر من ساعة)
        const operationAge = Date.now() - operation.timestamp;
        if (operationAge > 3600000) {
          // ساعة واحدة
          isCorrupted = true;
          result.details.push(
            `عملية قديمة عالقة: ${operation.type} (${Math.round(operationAge / 60000)} دقيقة)`,
          );
        }

        // فحص العمليات المتكررة الفاشلة
        if ((operation.retryCount || 0) >= 3) {
          isCorrupted = true;
          result.details.push(
            `عملية فاشلة متكررة: ${operation.type} (${operation.retryCount} محاولات)`,
          );
        }

        if (isCorrupted) {
          corruptedOperations.push(operation.id);
          SyncErrorManager.blacklistOperation(operation.id);
          result.blacklisted++;
        }
      }

      // إزالة العمليات الفاسدة من الطابور
      if (corruptedOperations.length > 0) {
        const cleanQueue = queue.filter(
          (op) => !corruptedOperations.includes(op.id),
        );
        offlineManager.saveQueue(cleanQueue);
        result.cleaned = corruptedOperations.length;

        console.log(
          `✅ تم تنظيف ${result.cleaned} عملية فاسدة من طابور المزامنة`,
        );
      } else {
        console.log("✅ طابور المزامنة نظيف");
      }

      return result;
    } catch (error) {
      console.error("❌ خطأ في تنظيف طابور المزامنة:", error);
      return result;
    }
  }

  /**
   * تنظيف شامل للنظام
   */
  static async fullSystemCleanup(): Promise<{
    success: boolean;
    message: string;
    details: {
      queueCleaned: number;
      blacklistCleared: number;
      localStorageCleared: boolean;
    };
  }> {
    console.log("🧹 بدء التنظيف الشامل للنظام...");

    try {
      // 1. تنظيف طابور المزامنة
      const queueResult = await this.cleanCorruptedOperations();

      // 2. مسح القائمة السوداء
      SyncErrorManager.clearBlacklist();

      // 3. تنظيف البيانات المؤقتة المرتبطة بالمزامنة
      const syncKeys = [
        "paw_sync_queue",
        "paw_offline_operations",
        "paw_last_sync",
        "paw_sync_errors",
        "paw_blacklisted_operations",
      ];

      let localStorageCleared = true;
      syncKeys.forEach((key) => {
        try {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`🗑️ حذف ${key}`);
          }
        } catch (error) {
          console.warn(`تعذر حذف ${key}:`, error);
          localStorageCleared = false;
        }
      });

      // 4. إعادة تهيئة نظام المزامنة
      offlineManager.clearAllCache();

      const message = `تم التنظيف الشامل بنجاح! تم تنظيف ${queueResult.cleaned} عملية فاسدة`;

      return {
        success: true,
        message,
        details: {
          queueCleaned: queueResult.cleaned,
          blacklistCleared: 1,
          localStorageCleared,
        },
      };
    } catch (error: any) {
      const errorMessage = `فشل التنظيف الشامل: ${error.message}`;
      console.error("❌ " + errorMessage);

      return {
        success: false,
        message: errorMessage,
        details: {
          queueCleaned: 0,
          blacklistCleared: 0,
          localStorageCleared: false,
        },
      };
    }
  }

  /**
   * تنظيف سريع لأخطاء المزامنة الحالية
   */
  static quickFixSyncErrors(): void {
    console.log("🔧 إصلاح سريع لأخطاء المزامنة...");

    try {
      // مسح طابور المزامنة بالكامل
      offlineManager.saveQueue([]);

      // مسح القائمة السوداء
      SyncErrorManager.clearBlacklist();

      // مسح بيانات المزامنة من LocalStorage
      const keysToRemove = [
        "paw_sync_queue",
        "paw_offline_operations",
        "paw_sync_errors",
      ];

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
      });

      console.log("✅ تم الإصلاح السريع لأخطاء المزامنة");

      // إظهار رسالة للمستخدم
      if (typeof window !== "undefined") {
        alert(
          "تم إصلاح أخطاء المزامنة!\n\nتم مسح طابور المزامنة وإعادة تهيئة النظام.",
        );
      }
    } catch (error) {
      console.error("❌ فشل الإصلاح السريع:", error);
    }
  }
}

// تشغيل تنظيف سريع عند تحميل الملف
(function autoCleanup() {
  console.log("🔧 تشغيل التنظيف التلقائي لطابور المزامنة...");

  setTimeout(async () => {
    try {
      const result = await SyncQueueCleaner.cleanCorruptedOperations();

      if (result.cleaned > 0) {
        console.log(
          `✅ تم تنظيف ${result.cleaned} عملية فاسدة من طابور المزامنة`,
        );

        if (typeof window !== "undefined") {
          setTimeout(() => {
            alert(
              `تم تنظيف طابور المزامنة!\n\nتم حذف ${result.cleaned} عملية فاسدة تسببت في أخطاء المزامنة.`,
            );
          }, 1000);
        }
      }
    } catch (error) {
      console.warn("⚠️ خطأ في التنظيف التلقائي:", error);
    }
  }, 2000);
})();

export default SyncQueueCleaner;
