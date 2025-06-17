// Cleanup Fake Data Service - خدمة تنظيف البيانات الوهمية
// Removes all fake data and ensures only real Supabase data is used

import { RealDataLoader } from "./realDataLoader";
import { clearAllLocalData, initializeDefaultData } from "./storage";

export class CleanupFakeData {
  // Check if current data contains fake products (by checking for common fake product names)
  static hasFakeData(): boolean {
    try {
      const products = JSON.parse(localStorage.getItem("paw_products") || "[]");

      // Check for typical fake product names
      const fakeProductNames = [
        "iPhone 15 Pro Max 256GB",
        "iPhone 15 Pro 128GB",
        "iPhone 15 128GB",
        "Samsung Galaxy S24 Ultra",
        "Xiaomi 13 Pro",
        "Xiaomi Redmi Note 13",
      ];

      const hasFakeProducts = products.some((product: any) =>
        fakeProductNames.some((fakeName) =>
          product.name?.includes(fakeName.split(" ")[0]),
        ),
      );

      if (hasFakeProducts) {
        console.log("🚨 تم اكتشاف بيانات وهمية في النظام");
        return true;
      }

      return false;
    } catch (error) {
      console.warn("خطأ في فحص البيانات الوهمية:", error);
      return false;
    }
  }

  // Remove all fake data and load real data
  static async cleanupAndLoadRealData(): Promise<{
    success: boolean;
    message: string;
    realDataLoaded: {
      customers: number;
      products: number;
      sales: number;
    };
  }> {
    try {
      console.log("🧹 بدء تنظيف البيانات الوهمية...");

      // Step 1: Clear all local data
      clearAllLocalData();
      console.log("✅ تم مسح جميع البيانات المحلية");

      // Step 2: Initialize empty storage
      initializeDefaultData();
      console.log("✅ تم تهيئة التخزين للبيانات الحقيقية");

      // Step 3: Load real data from Supabase
      console.log("📊 تحميل البيانات الحقيقية من Supabase...");
      const realData = await RealDataLoader.loadAllRealData(true);

      const result = {
        success: true,
        message: "تم تنظيف البيانات الوهمية وتحميل البيانات الحقيقية بنجاح",
        realDataLoaded: {
          customers: realData.customers.length,
          products: realData.products.length,
          sales: realData.sales.length,
        },
      };

      console.log("🎉 تم التنظيف بنجاح:", result);
      return result;
    } catch (error) {
      console.error("❌ فشل في تنظيف البيانات:", error);
      return {
        success: false,
        message: `فشل في التنظيف: ${error}`,
        realDataLoaded: {
          customers: 0,
          products: 0,
          sales: 0,
        },
      };
    }
  }

  // Force reload all real data (refresh from Supabase)
  static async forceRefreshRealData(): Promise<{
    success: boolean;
    message: string;
    dataCount: {
      customers: number;
      products: number;
      sales: number;
    };
  }> {
    try {
      console.log("🔄 فرض تحديث البيانات الحقيقية...");

      const realData = await RealDataLoader.loadAllRealData(true);

      const result = {
        success: true,
        message: "تم تحديث البيانات الحقيقية بنجاح",
        dataCount: {
          customers: realData.customers.length,
          products: realData.products.length,
          sales: realData.sales.length,
        },
      };

      console.log("✅ تم التحديث بنجاح:", result);
      return result;
    } catch (error) {
      console.error("❌ فشل في تحديث البيانات:", error);
      return {
        success: false,
        message: `فشل في التحديث: ${error}`,
        dataCount: {
          customers: 0,
          products: 0,
          sales: 0,
        },
      };
    }
  }

  // Get current data status
  static getDataStatus(): {
    hasFakeData: boolean;
    isEmpty: boolean;
    counts: {
      customers: number;
      products: number;
      sales: number;
    };
    lastUpdate: string | null;
  } {
    try {
      const customers = JSON.parse(
        localStorage.getItem("paw_customers") || "[]",
      );
      const products = JSON.parse(localStorage.getItem("paw_products") || "[]");
      const sales = JSON.parse(localStorage.getItem("paw_sales") || "[]");

      const lastUpdate = localStorage.getItem("last_data_update");

      return {
        hasFakeData: this.hasFakeData(),
        isEmpty:
          customers.length === 0 && products.length === 0 && sales.length === 0,
        counts: {
          customers: customers.length,
          products: products.length,
          sales: sales.length,
        },
        lastUpdate: lastUpdate,
      };
    } catch (error) {
      console.error("خطأ في فحص حالة البيانات:", error);
      return {
        hasFakeData: false,
        isEmpty: true,
        counts: {
          customers: 0,
          products: 0,
          sales: 0,
        },
        lastUpdate: null,
      };
    }
  }

  // Auto cleanup on app start (if fake data detected)
  static async autoCleanupOnStart(): Promise<void> {
    try {
      const status = this.getDataStatus();

      if (status.hasFakeData) {
        console.log("🚨 تم اكتشاف بيانات وهمية - بدء التنظيف التلقائي...");
        const result = await this.cleanupAndLoadRealData();

        if (result.success) {
          console.log("✅ تم التنظيف التلقائي بنجاح");
          localStorage.setItem("last_data_update", new Date().toISOString());
        } else {
          console.warn("⚠️ فشل التنظيف التلقائي:", result.message);
        }
      } else if (status.isEmpty) {
        console.log("📊 لا توجد بيانات - تحميل البيانات الحقيقية...");
        await RealDataLoader.loadAllRealData(true);
        localStorage.setItem("last_data_update", new Date().toISOString());
      } else {
        console.log("✅ البيانات الحقيقية موجودة ومحدثة");
      }
    } catch (error) {
      console.error("❌ خطأ في التنظيف التلقائي:", error);
    }
  }
}
