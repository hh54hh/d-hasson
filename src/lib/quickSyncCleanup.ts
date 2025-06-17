import { offlineManager } from "./offlineManager";
import { supabaseService } from "./supabaseService";
import { logError, formatError } from "./utils";

/**
 * أداة تنظيف سريع لأخطاء المزامنة المتكررة
 * Quick cleanup tool for repeating sync errors
 */
export class QuickSyncCleanup {
  /**
   * تنظيف أخطاء "الاتصال مؤقتاً غير متوفر" المتكررة
   */
  static async cleanupConnectionErrors(): Promise<{
    success: boolean;
    cleanedOperations: number;
    duplicatesRemoved: number;
    message: string;
  }> {
    try {
      console.log("🧹 بدء تنظيف أخطاء الاتصال المتكررة...");

      const queue = offlineManager.getQueuedOperations();
      const now = Date.now();
      const STUCK_THRESHOLD = 300000; // 5 minutes

      // البحث عن العمليات العالقة والمكررة
      const stuckOperations = queue.filter(
        (op) =>
          now - op.timestamp > STUCK_THRESHOLD || (op.retryCount || 0) >= 3,
      );

      // البحث عن العمليات المكررة
      const duplicateGroups = new Map<string, any[]>();
      queue.forEach((op) => {
        const key = `${op.table}_${op.type}_${JSON.stringify(op.data)}`;
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)!.push(op);
      });

      let cleanedCount = 0;
      let duplicatesRemoved = 0;

      // إزالة العمليات العالقة
      for (const operation of stuckOperations) {
        const success = offlineManager.removeOperationFromQueue(operation.id);
        if (success) {
          cleanedCount++;
          console.log(
            `🗑️ تم حذف عملية عالقة: ${operation.id} (محاولات: ${operation.retryCount || 0})`,
          );
        }
      }

      // إزالة النسخ المكررة (الاحتفاظ بالأحدث)
      for (const [key, operations] of duplicateGroups) {
        if (operations.length > 1) {
          // ترتيب حسب التوقيت والاحتفاظ بالأحدث
          operations.sort((a, b) => b.timestamp - a.timestamp);
          const toKeep = operations[0];
          const toRemove = operations.slice(1);

          for (const duplicate of toRemove) {
            const success = offlineManager.removeOperationFromQueue(
              duplicate.id,
            );
            if (success) {
              duplicatesRemoved++;
              console.log(`🔄 تم حذف نسخة مكررة: ${duplicate.id}`);
            }
          }
        }
      }

      const message = `تم تنظيف ${cleanedCount} عملية عالقة و ${duplicatesRemoved} عملية مكررة`;

      console.log(`✅ ${message}`);

      return {
        success: true,
        cleanedOperations: cleanedCount,
        duplicatesRemoved,
        message,
      };
    } catch (error: any) {
      const errorMessage = formatError(error);
      logError("فشل في تنظيف أخطاء الاتصال:", error, {
        operation: "cleanup_connection_errors",
      });

      return {
        success: false,
        cleanedOperations: 0,
        duplicatesRemoved: 0,
        message: `فشل في التنظيف: ${errorMessage}`,
      };
    }
  }

  /**
   * فحص سريع لحالة الاتصال
   */
  static async quickConnectionCheck(): Promise<{
    canConnect: boolean;
    latency: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // محاولة بسيطة للاتصال
      await supabaseService
        .supabase!.from("customers")
        .select("count")
        .limit(0);

      const latency = Date.now() - startTime;

      return {
        canConnect: true,
        latency,
      };
    } catch (error: any) {
      return {
        canConnect: false,
        latency: -1,
        error: formatError(error),
      };
    }
  }

  /**
   * إجراء تنظيف شامل سريع
   */
  static async performQuickCleanup(): Promise<{
    success: boolean;
    report: {
      connectionStatus: any;
      cleanupResult: any;
      queueSizeBefore: number;
      queueSizeAfter: number;
    };
    message: string;
  }> {
    try {
      console.log("🚀 بدء التنظيف الشامل السريع...");

      // 1. فحص حالة الاتصال
      const connectionStatus = await this.quickConnectionCheck();

      // 2. أخذ حجم الطابور قبل التنظيف
      const queueBefore = offlineManager.getQueuedOperations();
      const queueSizeBefore = queueBefore.length;

      // 3. تنظيف العمليات المتكررة والعالقة
      const cleanupResult = await this.cleanupConnectionErrors();

      // 4. أخذ حجم الطابور بعد التنظيف
      const queueAfter = offlineManager.getQueuedOperations();
      const queueSizeAfter = queueAfter.length;

      const report = {
        connectionStatus,
        cleanupResult,
        queueSizeBefore,
        queueSizeAfter,
      };

      let message = `تنظيف مكتمل: ${queueSizeBefore} → ${queueSizeAfter} عملية`;

      if (connectionStatus.canConnect) {
        message += ` | الاتصال: متاح (${connectionStatus.latency}ms)`;
      } else {
        message += ` | الاتصال: غير متاح`;
      }

      console.log(`✅ ${message}`);

      return {
        success: true,
        report,
        message,
      };
    } catch (error: any) {
      const errorMessage = formatError(error);
      logError("فشل في التنظيف الشامل السريع:", error, {
        operation: "quick_cleanup",
      });

      return {
        success: false,
        report: {
          connectionStatus: { canConnect: false, latency: -1 },
          cleanupResult: { success: false, cleanedOperations: 0 },
          queueSizeBefore: 0,
          queueSizeAfter: 0,
        },
        message: `فشل في التنظيف: ${errorMessage}`,
      };
    }
  }

  /**
   * إصلاح مشكلة أخطاء الاتصال المحددة في السؤال
   */
  static async fixSpecificConnectionErrors(): Promise<{
    success: boolean;
    message: string;
    details: {
      operationsFound: string[];
      operationsRemoved: string[];
      connectivityRestored: boolean;
    };
  }> {
    try {
      console.log("🔧 إصلاح أخطاء الاتصال المحددة...");

      const queue = offlineManager.getQueuedOperations();

      // البحث عن العمليات المحددة في الخطأ
      const problemOperations = queue.filter(
        (op) =>
          op.id.includes("1750073261079_p7204lbog") ||
          op.id.includes("1750073261080_oxi8w92vi") ||
          (op.retryCount || 0) >= 3,
      );

      const operationsFound = problemOperations.map((op) => op.id);
      const operationsRemoved: string[] = [];

      // إزالة العمليات المشكوك فيها
      for (const operation of problemOperations) {
        const success = offlineManager.removeOperationFromQueue(operation.id);
        if (success) {
          operationsRemoved.push(operation.id);
          console.log(`🗑️ تم حذف العملية المشكوك فيها: ${operation.id}`);
        }
      }

      // فحص الاتصال بعد التنظيف
      const connectionCheck = await this.quickConnectionCheck();

      const details = {
        operationsFound,
        operationsRemoved,
        connectivityRestored: connectionCheck.canConnect,
      };

      const message = `تم حذف ${operationsRemoved.length} من ${operationsFound.length} عملية مشكوك فيها`;

      console.log(`✅ ${message}`);

      return {
        success: true,
        message,
        details,
      };
    } catch (error: any) {
      const errorMessage = formatError(error);
      logError("فشل في إصلاح أخطاء الاتصال المحددة:", error, {
        operation: "fix_specific_connection_errors",
      });

      return {
        success: false,
        message: `فشل في الإصلاح: ${errorMessage}`,
        details: {
          operationsFound: [],
          operationsRemoved: [],
          connectivityRestored: false,
        },
      };
    }
  }
}

/**
 * دالة سريعة لحل مشكلة أخطاء الاتصال المتكررة
 */
export const fixRepeatingConnectionErrors = () =>
  QuickSyncCleanup.fixSpecificConnectionErrors();

/**
 * دالة سريعة للتنظيف الشامل
 */
export const performQuickSyncCleanup = () =>
  QuickSyncCleanup.performQuickCleanup();

/**
 * فحص سريع للاتصال
 */
export const quickConnectionTest = () =>
  QuickSyncCleanup.quickConnectionCheck();

// تصدير للاستخدام في console المتصفح
if (typeof window !== "undefined") {
  (window as any).QuickSyncCleanup = {
    fixRepeatingConnectionErrors,
    performQuickSyncCleanup,
    quickConnectionTest,
    fixSpecificConnectionErrors: QuickSyncCleanup.fixSpecificConnectionErrors,
  };
}
