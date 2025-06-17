// Comprehensive Database Sync Helper
// This utility ensures proper synchronization between local data and Supabase

import { offlineManager } from "./offlineManager";
import { supabaseService } from "./supabaseService";
import { emergencyFixConstraintErrors } from "./emergencyFix";
import { autoFixSyncIssues } from "./syncDebugger";

export class SyncHelper {
  // Comprehensive sync that fixes issues and ensures data consistency
  static async comprehensiveSync(): Promise<{
    success: boolean;
    customersCount: number;
    salesCount: number;
    productsCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log("🔄 Starting comprehensive sync...");

      // Step 1: Fix any constraint errors
      try {
        emergencyFixConstraintErrors();
        autoFixSyncIssues();
      } catch (fixError) {
        console.warn("Fix operations failed:", fixError);
        errors.push("Fix operations failed");
      }

      // Step 2: Force sync with Supabase
      if (navigator.onLine) {
        try {
          await offlineManager.forcSync();
          console.log("✅ Force sync completed");
        } catch (syncError) {
          console.error("Force sync failed:", syncError);
          errors.push("Force sync failed");
        }
      } else {
        errors.push("Device is offline");
      }

      // Step 3: Reload fresh data
      const [customers, products, sales] = await Promise.all([
        offlineManager.getCustomers().catch(() => []),
        offlineManager.getProducts().catch(() => []),
        offlineManager.getSales().catch(() => []),
      ]);

      console.log(
        `📊 Sync completed: ${customers.length} customers, ${products.length} products, ${sales.length} sales`,
      );

      return {
        success: errors.length === 0,
        customersCount: customers.length,
        salesCount: sales.length,
        productsCount: products.length,
        errors,
      };
    } catch (error) {
      console.error("Comprehensive sync failed:", error);
      errors.push(error instanceof Error ? error.message : "Unknown error");

      return {
        success: false,
        customersCount: 0,
        salesCount: 0,
        productsCount: 0,
        errors,
      };
    }
  }

  // Check if customer exists and ensure it's in both local cache and Supabase
  static async ensureCustomerExists(phone: string): Promise<boolean> {
    try {
      // Check local cache first
      const cachedCustomers = offlineManager.getCachedData("customers");
      const localCustomer = cachedCustomers.find((c: any) => c.phone === phone);

      if (navigator.onLine) {
        // Check Supabase
        const supabaseCustomer =
          await supabaseService.getCustomerByPhone(phone);

        if (supabaseCustomer) {
          // Ensure customer is in local cache
          if (!localCustomer) {
            const updatedCustomers = [...cachedCustomers, supabaseCustomer];
            offlineManager.cacheData("customers", updatedCustomers);
          }
          return true;
        }
      }

      return !!localCustomer;
    } catch (error) {
      console.error("Error checking customer existence:", error);
      return false;
    }
  }

  // Force refresh all data and notify user
  static async forceRefreshWithNotification(): Promise<void> {
    try {
      const result = await this.comprehensiveSync();

      const message =
        `تم تحديث البيانات!\n\n` +
        `📊 العملاء: ${result.customersCount}\n` +
        `📦 المنتجات: ${result.productsCount}\n` +
        `🛒 المبيعات: ${result.salesCount}\n\n` +
        `${result.success ? "✅ تم التزامن بنجاح" : "⚠️ تم التحديث مع بعض الأخطاء"}\n` +
        `${result.errors.length > 0 ? `\nأخطاء: ${result.errors.join(", ")}` : ""}`;

      alert(message);
    } catch (error) {
      alert("فشل في تحديث البيانات. يرجى المحاولة مرة أخرى.");
      console.error("Force refresh failed:", error);
    }
  }

  // Validate data integrity
  static async validateDataIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const [customers, products, sales] = await Promise.all([
        offlineManager.getCustomers(),
        offlineManager.getProducts(),
        offlineManager.getSales(),
      ]);

      // Check for customers without proper IDs
      const invalidCustomers = customers.filter(
        (c) => !c.id || !c.phone || !c.name,
      );
      if (invalidCustomers.length > 0) {
        issues.push(`${invalidCustomers.length} عملاء بعض بيانات مفقودة`);
      }

      // Check for sales with invalid customer references
      const invalidSales = sales.filter((s) => !s.customerId);
      if (invalidSales.length > 0) {
        issues.push(`${invalidSales.length} مبيعات بدون مرجع عميل`);
      }

      // Check for products with invalid quantities
      const invalidProducts = products.filter((p) => p.quantity < 0);
      if (invalidProducts.length > 0) {
        issues.push(`${invalidProducts.length} منتجات بكميات سالبة`);
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      console.error("Data validation failed:", error);
      return {
        valid: false,
        issues: ["فشل في التحقق من سلامة البيانات"],
      };
    }
  }

  // Auto-fix data integrity issues
  static async autoFixDataIntegrity(): Promise<void> {
    console.log("🔧 Auto-fixing data integrity issues...");

    try {
      const customers = offlineManager.getCachedData("customers");
      const sales = offlineManager.getCachedData("sales");
      const products = offlineManager.getCachedData("products");

      // Fix customers with missing data
      const fixedCustomers = customers.filter(
        (c: any) => c.id && c.phone && c.name,
      );
      if (fixedCustomers.length < customers.length) {
        console.log(
          `🧹 Removed ${customers.length - fixedCustomers.length} invalid customers`,
        );
        offlineManager.cacheData("customers", fixedCustomers);
      }

      // Fix products with negative quantities
      const fixedProducts = products.map((p: any) => ({
        ...p,
        quantity: Math.max(0, p.quantity),
      }));
      offlineManager.cacheData("products", fixedProducts);

      // Fix sales with invalid customer references
      const validCustomerIds = new Set(fixedCustomers.map((c: any) => c.id));
      const fixedSales = sales.filter((s: any) =>
        validCustomerIds.has(s.customerId),
      );
      if (fixedSales.length < sales.length) {
        console.log(
          `🧹 Removed ${sales.length - fixedSales.length} orphaned sales`,
        );
        offlineManager.cacheData("sales", fixedSales);
      }

      console.log("✅ Data integrity auto-fix completed");
    } catch (error) {
      console.error("Auto-fix failed:", error);
    }
  }
}
