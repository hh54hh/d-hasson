// إصلاح شامل لمشكلة مزامنة العملاء الأوف لاين
import { supabaseService } from "./supabaseService";
import { Customer, Sale, getCurrentDateGregorian } from "./types";
import { supabase } from "./supabase";

export class OfflineSyncFixer {
  private static readonly QUEUE_KEY = "offline_queue";
  private static readonly CACHE_KEYS = {
    customers: "cached_customers",
    products: "cached_products",
    sales: "cached_sales",
  };

  // إصلاح مشكلة العملاء الأوف لاين المفقودين
  static async fixMissingOfflineCustomers(): Promise<{
    success: boolean;
    message: string;
    details: any;
  }> {
    const result = {
      success: false,
      message: "",
      details: {} as any,
    };

    try {
      console.log("🔧 Starting offline customers fix...");

      // 1. فحص العمليات المتبقية في الطابور
      const queue = this.getQueue();
      const failedOperations = queue.filter(
        (op) => op.retryCount > 0 || op.processed === false,
      );

      result.details.queueSize = queue.length;
      result.details.failedOperations = failedOperations.length;

      console.log(
        `📋 Found ${queue.length} operations, ${failedOperations.length} failed`,
      );

      // 2. العثور على العملاء الأوف لاين المفقودين
      const offlineCustomerIds = new Set<string>();
      const missingCustomers: string[] = [];

      // جلب جميع العملاء الأوف لاين من العمليات
      queue.forEach((op) => {
        if (op.table === "sales" && op.data.customerId) {
          const customerId = op.data.customerId;
          if (customerId.startsWith("offline_")) {
            offlineCustomerIds.add(customerId);
          }
        }
      });

      // فحص أي عملاء أوف لاين مفقودين من الكاش
      const cachedCustomers = this.getCachedData("customers");
      offlineCustomerIds.forEach((offlineId) => {
        const customerInCache = cachedCustomers.find(
          (c: Customer) => c.id === offlineId,
        );
        if (!customerInCache) {
          missingCustomers.push(offlineId);
        }
      });

      result.details.offlineCustomers = offlineCustomerIds.size;
      result.details.missingCustomers = missingCustomers.length;

      console.log(
        `👥 Found ${offlineCustomerIds.size} offline customers, ${missingCustomers.length} missing`,
      );

      // 3. محاولة استعادة العملاء المفقودين
      const recoveredCustomers: Customer[] = [];

      for (const missingId of missingCustomers) {
        try {
          const recovered = await this.recoverMissingCustomer(missingId);
          if (recovered) {
            recoveredCustomers.push(recovered);
            console.log(`✅ Recovered customer: ${recovered.name}`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not recover customer ${missingId}:`, error);
        }
      }

      // 4. تحديث الكاش مع العملاء المستعادين
      if (recoveredCustomers.length > 0) {
        const updatedCustomers = [...cachedCustomers, ...recoveredCustomers];
        this.cacheData("customers", updatedCustomers);
        console.log(
          `💾 Added ${recoveredCustomers.length} recovered customers to cache`,
        );
      }

      // 5. تنظيف العمليات التالفة
      const cleanedOperations = await this.cleanCorruptedOperations(queue);

      result.details.recoveredCustomers = recoveredCustomers.length;
      result.details.cleanedOperations = cleanedOperations;

      if (missingCustomers.length === 0) {
        result.success = true;
        result.message = "✅ لا توجد مشاكل في مزامنة العملاء";
      } else if (recoveredCustomers.length > 0) {
        result.success = true;
        result.message = `✅ تم استعادة ${recoveredCustomers.length} عملاء`;
      } else {
        result.success = false;
        result.message = `❌ فشل في استعادة ${missingCustomers.length} عملاء`;
      }

      return result;
    } catch (error: any) {
      result.success = false;
      result.message = `❌ فشل الإصلاح: ${error.message}`;
      result.details.error = error;
      return result;
    }
  }

  // محاولة استعادة عم��ل مفقود
  private static async recoverMissingCustomer(
    offlineId: string,
  ): Promise<Customer | null> {
    try {
      // 1. البحث في العمليات عن بيانات العميل
      const queue = this.getQueue();
      let customerData: any = null;

      // البحث في عمليات إنشاء العملاء
      const customerCreationOp = queue.find(
        (op) =>
          op.table === "customers" &&
          op.type === "create" &&
          op.data.tempId === offlineId,
      );

      if (customerCreationOp) {
        customerData = customerCreationOp.data;
        console.log(`📋 Found customer creation operation for ${offlineId}`);
      } else {
        // البحث في عمليات المبيعات عن أي معلومات عن العميل
        const salesOps = queue.filter(
          (op) =>
            op.table === "sales" &&
            op.data.customerId === offlineId &&
            op.data.customerInfo,
        );

        if (salesOps.length > 0) {
          const latestSale = salesOps[salesOps.length - 1];
          customerData = latestSale.data.customerInfo;
          console.log(
            `📊 Found customer info from sales operation for ${offlineId}`,
          );
        }
      }

      if (!customerData) {
        console.warn(
          `⚠️ No customer data found in operations for ${offlineId}`,
        );
        return null;
      }

      // 2. إنشاء كائن العميل
      const recoveredCustomer: Customer = {
        id: offlineId,
        name: customerData.name || "عميل مجهول",
        phone: customerData.phone || "غير محدد",
        address: customerData.address || "غير محدد",
        paymentStatus: customerData.paymentStatus || "cash",
        lastSaleDate: customerData.lastSaleDate || getCurrentDateGregorian(),
        debtAmount: customerData.debtAmount || 0,
        sales: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return recoveredCustomer;
    } catch (error) {
      console.error(`❌ Error recovering customer ${offlineId}:`, error);
      return null;
    }
  }

  // تنظيف العمليات التالفة
  private static async cleanCorruptedOperations(queue: any[]): Promise<number> {
    try {
      let cleanedCount = 0;

      // 1. إزالة العمليات التي فشلت أكثر من 10 مرات
      const maxRetries = 10;
      const validOperations = queue.filter((op) => {
        if (op.retryCount > maxRetries) {
          console.warn(
            `🗑️ Removing operation after ${op.retryCount} retries: ${op.id}`,
          );
          cleanedCount++;
          return false;
        }
        return true;
      });

      // 2. إصلاح العمليات بـ customer IDs مفقودة
      const fixedOperations = validOperations.map((op) => {
        if (
          op.table === "sales" &&
          op.data.customerId &&
          op.data.customerId.startsWith("offline_")
        ) {
          // التأكد من وجود معلومات العميل في البيانات
          if (!op.data.customerInfo && op.data.customerData) {
            op.data.customerInfo = op.data.customerData;
            console.log(`🔧 Fixed customer info for operation ${op.id}`);
          }
        }
        return op;
      });

      // 3. حفظ الطابور المنظف
      this.saveQueue(fixedOperations);

      console.log(`🧹 Cleaned ${cleanedCount} corrupted operations`);
      return cleanedCount;
    } catch (error) {
      console.error("❌ Error cleaning operations:", error);
      return 0;
    }
  }

  // تحديث آلية مزامنة العملاء لتجنب المشكلة
  static async improvedCustomerSync(
    customerId: string,
    operation: any,
  ): Promise<string> {
    try {
      if (!customerId.startsWith("offline_")) {
        return customerId; // العميل موجود بالفعل
      }

      console.log(
        `🔄 Processing improved sync for offline customer: ${customerId}`,
      );

      // 1. البحث في الكاش أولاً
      const cachedCustomers = this.getCachedData("customers");
      let customerData = cachedCustomers.find(
        (c: Customer) => c.id === customerId,
      );

      // 2. إذا لم يوجد في الكاش، محاولة استعادته
      if (!customerData) {
        console.log(`🔍 Customer not in cache, attempting recovery...`);
        customerData = await this.recoverMissingCustomer(customerId);

        if (customerData) {
          // إضافة العميل المستعاد إلى الكاش
          const updatedCustomers = [...cachedCustomers, customerData];
          this.cacheData("customers", updatedCustomers);
          console.log(
            `💾 Recovered customer added to cache: ${customerData.name}`,
          );
        }
      }

      // 3. إذا لا يزال مفقود، إنشاء عميل افتراضي
      if (!customerData) {
        console.warn(`⚠️ Creating fallback customer for ${customerId}`);

        // البحث عن أي معلومات في العملية الحالية
        const fallbackData =
          operation.data.customerInfo || operation.data.customerData || {};

        customerData = {
          id: customerId,
          name: fallbackData.name || `عميل ${customerId.slice(-8)}`,
          phone: fallbackData.phone || "غير محدد",
          address: fallbackData.address || "غير محدد",
          paymentStatus: fallbackData.paymentStatus || "cash",
          lastSaleDate: getCurrentDateGregorian(),
          debtAmount: 0,
          sales: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // إضافة العميل الافتراضي إلى الكاش
        const updatedCustomers = [...cachedCustomers, customerData];
        this.cacheData("customers", updatedCustomers);
      }

      // 4. التحقق من وجود العميل في Supabase
      try {
        const existingCustomer = await supabaseService.getCustomerByPhone(
          customerData.phone,
        );
        if (existingCustomer) {
          console.log(`✅ Customer exists in Supabase: ${existingCustomer.id}`);
          return existingCustomer.id;
        }
      } catch (error) {
        console.warn("Could not check existing customer:", error);
      }

      // 5. إنشاء العميل في Supabase
      try {
        const newCustomer = await supabaseService.createCustomer({
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          paymentStatus: customerData.paymentStatus,
          lastSaleDate: customerData.lastSaleDate,
          debtAmount: customerData.debtAmount || 0,
        });

        console.log(`✅ Created customer in Supabase: ${newCustomer.id}`);

        // تحديث الكاش بالـ ID الجديد
        const cachedCustomersUpdated = this.getCachedData("customers");
        const updatedCustomers = cachedCustomersUpdated.map((c: Customer) => {
          if (c.id === customerId) {
            return { ...c, id: newCustomer.id };
          }
          return c;
        });
        this.cacheData("customers", updatedCustomers);

        return newCustomer.id;
      } catch (createError: any) {
        console.error("❌ Failed to create customer:", createError);

        // كحل أخير، حاول استخدام رقم الهاتف للبحث
        if (customerData.phone && customerData.phone !== "غير محدد") {
          try {
            const phoneCustomer = await supabaseService.getCustomerByPhone(
              customerData.phone,
            );
            if (phoneCustomer) {
              return phoneCustomer.id;
            }
          } catch (error) {
            console.warn("Final phone lookup failed:", error);
          }
        }

        throw createError;
      }
    } catch (error: any) {
      console.error(
        `❌ Improved customer sync failed for ${customerId}:`,
        error,
      );
      throw new Error(`فشل في مزامنة العميل: ${error.message}`);
    }
  }

  // دوال مساعدة لـ localStorage
  private static getQueue(): any[] {
    try {
      const queue = localStorage.getItem(this.QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error("Failed to get queue:", error);
      return [];
    }
  }

  private static saveQueue(queue: any[]): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Failed to save queue:", error);
    }
  }

  private static getCachedData(key: string): any[] {
    try {
      const cacheKey = this.CACHE_KEYS[key as keyof typeof this.CACHE_KEYS];
      const data = localStorage.getItem(cacheKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Failed to get cached ${key}:`, error);
      return [];
    }
  }

  private static cacheData(key: string, data: any[]): void {
    try {
      const cacheKey = this.CACHE_KEYS[key as keyof typeof this.CACHE_KEYS];
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to cache ${key}:`, error);
    }
  }

  // تشخيص سريع للمشاكل
  static async quickDiagnosis(): Promise<{
    queueSize: number;
    offlineCustomers: number;
    missingCustomers: string[];
    corruptedOperations: number;
    recommendations: string[];
  }> {
    const queue = this.getQueue();
    const cachedCustomers = this.getCachedData("customers");

    const offlineCustomerIds = new Set<string>();
    const missingCustomers: string[] = [];
    let corruptedOperations = 0;

    // فحص العمليات
    queue.forEach((op) => {
      if (op.retryCount > 5) {
        corruptedOperations++;
      }

      if (op.table === "sales" && op.data.customerId) {
        const customerId = op.data.customerId;
        if (customerId.startsWith("offline_")) {
          offlineCustomerIds.add(customerId);

          const customerInCache = cachedCustomers.find(
            (c: Customer) => c.id === customerId,
          );
          if (!customerInCache) {
            missingCustomers.push(customerId);
          }
        }
      }
    });

    const recommendations: string[] = [];

    if (missingCustomers.length > 0) {
      recommendations.push(`استعادة ${missingCustomers.length} عملاء مفقودين`);
    }

    if (corruptedOperations > 0) {
      recommendations.push(`تنظيف ${corruptedOperations} عمليات تالفة`);
    }

    if (queue.length > 50) {
      recommendations.push("تقليل حجم طابور المزامنة");
    }

    return {
      queueSize: queue.length,
      offlineCustomers: offlineCustomerIds.size,
      missingCustomers,
      corruptedOperations,
      recommendations,
    };
  }
}

// إصلاح تلقائي عند تحميل الملف
if (typeof window !== "undefined") {
  // تشغيل إصلاح تلقائي بعد تحميل الصفحة
  setTimeout(async () => {
    try {
      const diagnosis = await OfflineSyncFixer.quickDiagnosis();

      if (
        diagnosis.missingCustomers.length > 0 ||
        diagnosis.corruptedOperations > 0
      ) {
        console.warn("🔧 Offline sync issues detected, running auto-fix...");
        const fixResult = await OfflineSyncFixer.fixMissingOfflineCustomers();
        console.log("🔧 Auto-fix result:", fixResult);
      }
    } catch (error) {
      console.warn("Auto-fix failed:", error);
    }
  }, 3000);
}
