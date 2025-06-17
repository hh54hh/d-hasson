// Comprehensive Fake Data Cleanup - تنظيف شامل للبيانات الوهمية
import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";

export class ComprehensiveFakeDataCleanup {
  /**
   * تنظيف شامل لجميع البيانات الوهمية
   */
  static async cleanupAllFakeData(): Promise<{
    success: boolean;
    message: string;
    details: {
      localStorageCleared: boolean;
      offlineCacheCleared: boolean;
      realDataReloaded: boolean;
      fakeProductsRemoved: number;
      fakeCustomersRemoved: number;
    };
  }> {
    console.log("🧹 بدء التنظيف الشامل للبيانات الوهمية...");

    const result = {
      success: false,
      message: "",
      details: {
        localStorageCleared: false,
        offlineCacheCleared: false,
        realDataReloaded: false,
        fakeProductsRemoved: 0,
        fakeCustomersRemoved: 0,
      },
    };

    try {
      // 1. تنظيف LocalStorage
      this.clearLocalStorage();
      result.details.localStorageCleared = true;
      console.log("✅ تم تنظيف LocalStorage");

      // 2. تنظيف Offline Cache
      offlineManager.clearAllCache();
      result.details.offlineCacheCleared = true;
      console.log("✅ تم تنظيف Offline Cache");

      // 3. إزالة البيانات الوهمية من قاعدة البيانات
      const cleanupResults = await this.removeFakeDataFromDatabase();
      result.details.fakeProductsRemoved = cleanupResults.productsRemoved;
      result.details.fakeCustomersRemoved = cleanupResults.customersRemoved;

      // 4. إعادة تحميل البيانات الحقيقية
      try {
        await this.reloadRealData();
        result.details.realDataReloaded = true;
        console.log("✅ تم تحميل البيانات الحقيقية");
      } catch (reloadError) {
        console.warn("⚠️ فشل في إعادة تحميل البيانات:", reloadError);
      }

      result.success = true;
      result.message =
        "تم تنظيف جميع البيانات الوهمية بنجاح. النظام الآن يستخدم البيانات الحقيقية فقط.";

      console.log("🎉 اكتمل التنظيف الشامل بنجاح");
      return result;
    } catch (error: any) {
      console.error("❌ خطأ في التنظيف الشامل:", error);
      result.message = `فشل في التنظيف: ${error.message}`;
      return result;
    }
  }

  /**
   * تنظيف LocalStorage من البيانات الوهمية
   */
  private static clearLocalStorage(): void {
    const keysToRemove = [
      "paw_customers",
      "paw_products",
      "paw_sales",
      "paw_offline_data",
      "paw_cache_customers",
      "paw_cache_products",
      "paw_cache_sales",
    ];

    keysToRemove.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`🗑️ حذف ${key} من LocalStorage`);
      }
    });
  }

  /**
   * إزالة البيانات الوهمية من قاعدة البيانات
   */
  private static async removeFakeDataFromDatabase(): Promise<{
    productsRemoved: number;
    customersRemoved: number;
  }> {
    const result = { productsRemoved: 0, customersRemoved: 0 };

    try {
      // قائمة الأسماء الوهمية للمنتجات
      const fakeProductNames = [
        "iPhone 15 Pro Max 256GB",
        "iPhone 15 Pro 128GB",
        "iPhone 15 128GB",
        "Samsung Galaxy S24 Ultra",
        "Samsung Galaxy A54",
        "Xiaomi 13 Pro",
        "منتج تجريبي",
        "test product",
      ];

      // حذف المنتجات الوهمية
      const products = await supabaseService.getProducts();
      for (const product of products) {
        const isFake = fakeProductNames.some(
          (fakeName) =>
            product.name.toLowerCase().includes(fakeName.toLowerCase()) ||
            product.id.includes("test") ||
            product.id.includes("fake") ||
            product.id.includes("default"),
        );

        if (isFake) {
          try {
            await supabaseService.deleteProduct(product.id);
            result.productsRemoved++;
            console.log(`🗑️ حذف منتج وهمي: ${product.name}`);
          } catch (deleteError) {
            console.warn(`⚠️ فشل حذف المنتج ${product.name}:`, deleteError);
          }
        }
      }

      // حذف العملاء الوهميين
      const customers = await supabaseService.getCustomers();
      for (const customer of customers) {
        const isFake =
          customer.name.includes("تجريبي") ||
          customer.name.includes("Test") ||
          customer.name.includes("test") ||
          customer.phone === "1234567890" ||
          customer.id.includes("test") ||
          customer.id.includes("fake") ||
          customer.id.includes("default");

        if (isFake) {
          try {
            await supabaseService.deleteCustomer(customer.id);
            result.customersRemoved++;
            console.log(`🗑️ حذف عميل وهمي: ${customer.name}`);
          } catch (deleteError) {
            console.warn(`⚠️ فشل حذف العميل ${customer.name}:`, deleteError);
          }
        }
      }

      console.log(
        `✅ تم حذف ${result.productsRemoved} منتج وهمي و ${result.customersRemoved} عميل وهمي`,
      );
    } catch (error) {
      console.error("❌ خطأ في حذف البيانات الوهمية من قاعدة البيانات:", error);
    }

    return result;
  }

  /**
   * إعادة تحميل البيانات الحقيقية
   */
  private static async reloadRealData(): Promise<void> {
    try {
      // تحميل البيانات من قاعدة البيانات
      const [products, customers, sales] = await Promise.all([
        supabaseService.getProducts(),
        supabaseService.getCustomers(),
        supabaseService.getSales(),
      ]);

      // حفظ في الـ cache
      offlineManager.cacheData("products", products);
      offlineManager.cacheData("customers", customers);
      offlineManager.cacheData("sales", sales);

      console.log(`📊 تم تحميل البيانات الحقيقية:`);
      console.log(`   📦 ${products.length} منتجات`);
      console.log(`   👥 ${customers.length} عملاء`);
      console.log(`   🛒 ${sales.length} عمليات بيع`);
    } catch (error) {
      console.error("❌ خطأ في إعادة تحميل البيانات:", error);
      throw error;
    }
  }

  /**
   * فحص وجود بيانات وهمية
   */
  static async checkForFakeData(): Promise<{
    hasFakeData: boolean;
    fakeProducts: number;
    fakeCustomers: number;
    details: string[];
  }> {
    const result = {
      hasFakeData: false,
      fakeProducts: 0,
      fakeCustomers: 0,
      details: [] as string[],
    };

    try {
      // فحص المنتجات الوهمية
      const products = await supabaseService.getProducts();
      const fakeProductNames = [
        "iPhone 15 Pro Max 256GB",
        "iPhone 15 Pro 128GB",
        "Samsung Galaxy S24 Ultra",
        "منتج تجريبي",
      ];

      result.fakeProducts = products.filter((product) =>
        fakeProductNames.some((fakeName) =>
          product.name.toLowerCase().includes(fakeName.toLowerCase()),
        ),
      ).length;

      // فحص العملاء الوهميين
      const customers = await supabaseService.getCustomers();
      result.fakeCustomers = customers.filter(
        (customer) =>
          customer.name.includes("تجريبي") ||
          customer.name.includes("Test") ||
          customer.phone === "1234567890",
      ).length;

      result.hasFakeData = result.fakeProducts > 0 || result.fakeCustomers > 0;

      if (result.fakeProducts > 0) {
        result.details.push(`${result.fakeProducts} منتجات وهمية`);
      }
      if (result.fakeCustomers > 0) {
        result.details.push(`${result.fakeCustomers} عملاء وهميين`);
      }

      console.log(
        result.hasFakeData
          ? `⚠️ تم العثور على بيانات وهمية: ${result.details.join(", ")}`
          : "✅ لا توجد بيانات وهمية",
      );
    } catch (error) {
      console.error("❌ خطأ في فحص البيانات الوهمية:", error);
    }

    return result;
  }
}
