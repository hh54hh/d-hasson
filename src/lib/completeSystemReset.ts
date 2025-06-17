// Complete System Reset - إعادة تعيين النظام بالكامل
import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";
import { ComprehensiveFakeDataCleanup } from "./comprehensiveFakeDataCleanup";

export class CompleteSystemReset {
  /**
   * تفريغ النظام بالكامل - حذف جميع البيانات
   */
  static async resetEverything(): Promise<{
    success: boolean;
    message: string;
    details: {
      customersDeleted: number;
      productsDeleted: number;
      salesDeleted: number;
      saleItemsDeleted: number;
      debtPaymentsDeleted: number;
      transactionsDeleted: number;
      localStorageCleared: boolean;
      offlineCacheCleared: boolean;
    };
  }> {
    console.log("🔥 بدء إعادة تعيين النظام بالكامل...");

    const result = {
      success: false,
      message: "",
      details: {
        customersDeleted: 0,
        productsDeleted: 0,
        salesDeleted: 0,
        saleItemsDeleted: 0,
        debtPaymentsDeleted: 0,
        transactionsDeleted: 0,
        localStorageCleared: false,
        offlineCacheCleared: false,
      },
    };

    try {
      // 1. حذف جميع البيانات من قاعدة البيانات
      console.log("🗑️ حذف جميع البيانات من قاعدة البيانات...");

      // حذف العلاقات أولاً (sale_items, debt_payments, transactions)
      await this.deleteSaleItems();
      result.details.saleItemsDeleted = await this.countDeleted("sale_items");

      await this.deleteDebtPayments();
      result.details.debtPaymentsDeleted =
        await this.countDeleted("debt_payments");

      await this.deleteTransactions();
      result.details.transactionsDeleted =
        await this.countDeleted("transactions");

      // ثم حذف المبيعات
      const salesCount = await this.deleteSales();
      result.details.salesDeleted = salesCount;

      // حذف العملاء
      const customersCount = await this.deleteAllCustomers();
      result.details.customersDeleted = customersCount;

      // حذف المنتجات
      const productsCount = await this.deleteAllProducts();
      result.details.productsDeleted = productsCount;

      // 2. تنظيف الذاكرة المحلية
      this.clearLocalStorage();
      result.details.localStorageCleared = true;

      // 3. تنظيف Offline Cache
      offlineManager.clearAllCache();
      result.details.offlineCacheCleared = true;

      // 4. إعادة تعيين إعدادات النظام
      this.resetSystemSettings();

      result.success = true;
      result.message =
        `تم تفريغ النظام بالكامل بنجاح! ` +
        `حُذف ${result.details.customersDeleted} عميل، ` +
        `${result.details.productsDeleted} منتج، و ` +
        `${result.details.salesDeleted} عملية بيع.`;

      console.log("🎉 اكتملت إعادة تعيين النظام بنجاح");
      return result;
    } catch (error: any) {
      console.error("❌ خطأ في إعادة تعيين النظام:", error);
      result.message = `فشل في إعادة التعيين: ${error.message}`;
      return result;
    }
  }

  /**
   * حذف جميع العملاء
   */
  private static async deleteAllCustomers(): Promise<number> {
    try {
      const customers = await supabaseService.getCustomers();
      console.log(`🗑️ حذف ${customers.length} عميل...`);

      let deletedCount = 0;
      for (const customer of customers) {
        try {
          await supabaseService.deleteCustomer(customer.id);
          deletedCount++;
        } catch (error) {
          console.warn(`⚠️ فشل حذف العميل ${customer.name}:`, error);
        }
      }

      console.log(`✅ تم حذف ${deletedCount} عميل`);
      return deletedCount;
    } catch (error) {
      console.error("❌ خطأ في حذف العملاء:", error);
      return 0;
    }
  }

  /**
   * حذف جميع المنتجات
   */
  private static async deleteAllProducts(): Promise<number> {
    try {
      const products = await supabaseService.getProducts();
      console.log(`🗑️ حذف ${products.length} منتج...`);

      let deletedCount = 0;
      for (const product of products) {
        try {
          await supabaseService.deleteProduct(product.id);
          deletedCount++;
        } catch (error) {
          console.warn(`⚠️ فشل حذف المنتج ${product.name}:`, error);
        }
      }

      console.log(`✅ تم حذف ${deletedCount} منتج`);
      return deletedCount;
    } catch (error) {
      console.error("❌ خطأ في حذف المنتجات:", error);
      return 0;
    }
  }

  /**
   * حذف جميع المبيعات
   */
  private static async deleteSales(): Promise<number> {
    try {
      const sales = await supabaseService.getSales();
      console.log(`🗑️ حذف ${sales.length} عملية بيع...`);

      // استخدام Supabase لحذف جميع المبيعات
      if (!supabaseService.supabase) return 0;

      const { error } = await supabaseService.supabase
        .from("sales")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // حذف كل شيء ما عدا ID وهمي

      if (error) {
        console.error("❌ خطأ في حذف المبيعات:", error);
        return 0;
      }

      console.log(`✅ تم حذف جميع المبيعات`);
      return sales.length;
    } catch (error) {
      console.error("❌ خطأ في حذف المبيعات:", error);
      return 0;
    }
  }

  /**
   * حذف جميع عناصر المبيعات
   */
  private static async deleteSaleItems(): Promise<void> {
    try {
      if (!supabaseService.supabase) return;

      const { error } = await supabaseService.supabase
        .from("sale_items")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        console.warn("⚠️ خطأ في حذف عناصر المبيعات:", error);
      } else {
        console.log("✅ تم حذف جميع عناصر المبيعات");
      }
    } catch (error) {
      console.warn("⚠️ خطأ في حذف عناصر المبيعات:", error);
    }
  }

  /**
   * حذف جميع دفعات الديون
   */
  private static async deleteDebtPayments(): Promise<void> {
    try {
      if (!supabaseService.supabase) return;

      const { error } = await supabaseService.supabase
        .from("debt_payments")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        console.warn("⚠️ خطأ في حذف دفعات الديون:", error);
      } else {
        console.log("✅ تم حذف جميع دفعات الديون");
      }
    } catch (error) {
      console.warn("⚠️ خطأ في حذف دفعات الديون:", error);
    }
  }

  /**
   * حذف جميع المعاملات
   */
  private static async deleteTransactions(): Promise<void> {
    try {
      if (!supabaseService.supabase) return;

      const { error } = await supabaseService.supabase
        .from("transactions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        console.warn("⚠️ خطأ في حذف المعاملات:", error);
      } else {
        console.log("✅ تم حذف جميع المعاملات");
      }
    } catch (error) {
      console.warn("⚠️ خطأ في حذف المعاملات:", error);
    }
  }

  /**
   * عد العناصر المحذوفة
   */
  private static async countDeleted(tableName: string): Promise<number> {
    try {
      if (!supabaseService.supabase) return 0;

      const { count } = await supabaseService.supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * تنظيف الذاكرة المحلية
   */
  private static clearLocalStorage(): void {
    console.log("🧹 تنظيف الذاكرة المحلية...");

    // قائمة جميع المفاتيح المحتملة
    const allKeys = [
      "paw_customers",
      "paw_products",
      "paw_sales",
      "paw_offline_data",
      "paw_cache_customers",
      "paw_cache_products",
      "paw_cache_sales",
      "paw_sync_queue",
      "paw_user_data",
      "paw_settings",
      "paw_last_sync",
      "paw_app_state",
    ];

    allKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`🗑️ حذف ${key} من الذاكرة المحلية`);
      }
    });

    // تنظيف شامل - حذف أي مفتاح يبدأ بـ paw_
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("paw_")) {
        localStorage.removeItem(key);
        console.log(`🗑️ حذف ${key} من الذاكرة المحلية`);
      }
    }

    console.log("✅ تم تنظيف ال��اكرة المحلية");
  }

  /**
   * إعادة تعيين إعدادات النظام
   */
  private static resetSystemSettings(): void {
    console.log("⚙️ إعادة تعيين إعدادات النظام...");

    // إعادة تعيين ConnectionThrottler
    try {
      const { ConnectionThrottler } = require("./connectionThrottler");
      ConnectionThrottler.reset();
    } catch (error) {
      console.warn("⚠️ فشل في إعادة تعيين ConnectionThrottler:", error);
    }

    // إعادة تعيين OfflineManager
    try {
      offlineManager.clearAllCache();
      offlineManager.reset && offlineManager.reset();
    } catch (error) {
      console.warn("⚠️ فشل في إعادة تعيين OfflineManager:", error);
    }

    console.log("✅ تم إعادة تعيين إعدادات النظام");
  }

  /**
   * تحقق سريع من حالة النظام بعد التفريغ
   */
  static async verifySystemEmpty(): Promise<{
    isEmpty: boolean;
    details: {
      customers: number;
      products: number;
      sales: number;
      localStorageKeys: number;
    };
  }> {
    try {
      const [customers, products, sales] = await Promise.all([
        supabaseService.getCustomers(),
        supabaseService.getProducts(),
        supabaseService.getSales(),
      ]);

      // عد مفاتيح الذاكرة المحلية المتبقية
      let localStorageKeys = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("paw_")) {
          localStorageKeys++;
        }
      }

      const details = {
        customers: customers.length,
        products: products.length,
        sales: sales.length,
        localStorageKeys,
      };

      const isEmpty =
        details.customers === 0 &&
        details.products === 0 &&
        details.sales === 0 &&
        details.localStorageKeys === 0;

      return { isEmpty, details };
    } catch (error) {
      console.error("❌ خطأ في التحقق من حالة النظام:", error);
      return {
        isEmpty: false,
        details: {
          customers: -1,
          products: -1,
          sales: -1,
          localStorageKeys: -1,
        },
      };
    }
  }
}
