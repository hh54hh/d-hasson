// Direct Database Cleaner - منظف مباشر لقاعدة البيانات
// يتجاوز جميع أنظمة التحديد ويحذف البيانات مباشرة

import { supabase } from "./supabase";

class DirectCleaner {
  /**
   * حذف مباشر للبيانات الوهمية بدون أي تحديد
   */
  static async cleanNow(): Promise<{
    success: boolean;
    message: string;
    deletedProducts: number;
    deletedCustomers: number;
  }> {
    console.log("🚀 بدء الحذف المباشر للبيانات الوهمية...");

    let deletedProducts = 0;
    let deletedCustomers = 0;

    try {
      if (!supabase) {
        throw new Error("Supabase غير متاح");
      }

      // 1. حذف المنتجات الوهمية مباشرة
      console.log("🗑️ حذف المنتجات الوهمية مباشرة...");

      // قائمة أسماء المنتجات الوهمية للبحث والحذف
      const fakeProductNames = [
        "iPhone 15",
        "Samsung Galaxy",
        "Xiaomi",
        "منتج تجريبي",
        "test",
        "Test",
        "default",
      ];

      // جلب وحذف المنتجات الوهمية مباشرة
      for (const fakeName of fakeProductNames) {
        try {
          const { data: products, error: fetchError } = await supabase
            .from("products")
            .select("id, name")
            .ilike("name", `%${fakeName}%`);

          if (fetchError) {
            console.warn(`خطأ في جلب المنتجات لـ ${fakeName}:`, fetchError);
            continue;
          }

          if (products && products.length > 0) {
            for (const product of products) {
              const { error: deleteError } = await supabase
                .from("products")
                .delete()
                .eq("id", product.id);

              if (deleteError) {
                console.warn(`فشل حذف المنتج ${product.name}:`, deleteError);
              } else {
                console.log(`✅ حذف منتج وهمي: ${product.name}`);
                deletedProducts++;
              }
            }
          }
        } catch (error) {
          console.warn(`خطأ في معالجة ${fakeName}:`, error);
        }
      }

      // 2. حذف العملاء الوهميين مباشرة
      console.log("🗑️ حذف العملاء الوهميين مباشرة...");

      const fakeCustomerPatterns = ["تجريبي", "Test", "test"];

      for (const pattern of fakeCustomerPatterns) {
        try {
          const { data: customers, error: fetchError } = await supabase
            .from("customers")
            .select("id, name, phone")
            .ilike("name", `%${pattern}%`);

          if (fetchError) {
            console.warn(`خطأ في جلب العملاء لـ ${pattern}:`, fetchError);
            continue;
          }

          if (customers && customers.length > 0) {
            for (const customer of customers) {
              const { error: deleteError } = await supabase
                .from("customers")
                .delete()
                .eq("id", customer.id);

              if (deleteError) {
                console.warn(`فشل حذف العميل ${customer.name}:`, deleteError);
              } else {
                console.log(`✅ حذف عميل وهمي: ${customer.name}`);
                deletedCustomers++;
              }
            }
          }
        } catch (error) {
          console.warn(`خطأ في معالجة العملاء ${pattern}:`, error);
        }
      }

      // حذف العملاء بأرقام هواتف وهمية
      const fakePhones = ["1234567890", "0000000000", "test_123456789"];

      for (const phone of fakePhones) {
        try {
          const { data: customers, error: fetchError } = await supabase
            .from("customers")
            .select("id, name, phone")
            .eq("phone", phone);

          if (!fetchError && customers && customers.length > 0) {
            for (const customer of customers) {
              const { error: deleteError } = await supabase
                .from("customers")
                .delete()
                .eq("id", customer.id);

              if (!deleteError) {
                console.log(`✅ حذف عميل برقم وهمي: ${customer.name}`);
                deletedCustomers++;
              }
            }
          }
        } catch (error) {
          console.warn(`خطأ في معالجة رقم ${phone}:`, error);
        }
      }

      // 3. تنظيف الذاكرة المؤقتة
      console.log("🧹 تنظيف الذاكرة المؤقتة...");
      this.clearLocalStorage();

      const message = `تم التنظيف بنجاح! حذف ${deletedProducts} منتجات و ${deletedCustomers} عملاء وهميين`;

      console.log("🎉 " + message);

      return {
        success: true,
        message,
        deletedProducts,
        deletedCustomers,
      };
    } catch (error: any) {
      const errorMessage = `فشل التنظيف المباشر: ${error.message}`;
      console.error("💥 " + errorMessage, error);

      return {
        success: false,
        message: errorMessage,
        deletedProducts,
        deletedCustomers,
      };
    }
  }

  /**
   * تنظيف الذاكرة المحلية
   */
  private static clearLocalStorage(): void {
    const keys = [
      "paw_customers",
      "paw_products",
      "paw_sales",
      "paw_offline_data",
      "paw_cache_customers",
      "paw_cache_products",
      "paw_cache_sales",
      "last_data_update",
    ];

    keys.forEach((key) => {
      try {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`🗑️ حذف ${key} من LocalStorage`);
        }
      } catch (error) {
        console.warn(`تعذر حذف ${key}:`, error);
      }
    });
  }

  /**
   * فحص البيانات الوهمية الموجودة
   */
  static async checkFakeData(): Promise<{
    hasProducts: boolean;
    hasCustomers: boolean;
    productCount: number;
    customerCount: number;
  }> {
    let productCount = 0;
    let customerCount = 0;

    try {
      if (!supabase) {
        return {
          hasProducts: false,
          hasCustomers: false,
          productCount: 0,
          customerCount: 0,
        };
      }

      // فحص المنتجات الوهمية
      const { data: iPhones } = await supabase
        .from("products")
        .select("id")
        .ilike("name", "%iPhone%");

      const { data: samsungs } = await supabase
        .from("products")
        .select("id")
        .ilike("name", "%Samsung%");

      const { data: testProducts } = await supabase
        .from("products")
        .select("id")
        .ilike("name", "%تجريبي%");

      productCount =
        (iPhones?.length || 0) +
        (samsungs?.length || 0) +
        (testProducts?.length || 0);

      // فحص العملاء الوهميين
      const { data: testCustomers } = await supabase
        .from("customers")
        .select("id")
        .ilike("name", "%تجريبي%");

      const { data: testCustomers2 } = await supabase
        .from("customers")
        .select("id")
        .ilike("name", "%Test%");

      customerCount =
        (testCustomers?.length || 0) + (testCustomers2?.length || 0);

      return {
        hasProducts: productCount > 0,
        hasCustomers: customerCount > 0,
        productCount,
        customerCount,
      };
    } catch (error) {
      console.warn("خطأ في فحص البيانات الوهمية:", error);
      return {
        hasProducts: false,
        hasCustomers: false,
        productCount: 0,
        customerCount: 0,
      };
    }
  }
}

export default DirectCleaner;
