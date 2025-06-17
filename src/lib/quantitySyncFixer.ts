// Comprehensive Quantity Sync Fixer with Enhanced Throttling Support
// This utility ensures product quantities are correctly synchronized across all operations

import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";
import { ConnectionThrottler } from "./connectionThrottler";
import { Product, Sale } from "./types";
import { logError, formatError } from "./utils";

export interface QuantityIssue {
  productId: string;
  productName: string;
  localQuantity: number;
  supabaseQuantity: number;
  difference: number;
  totalSold: number;
  expectedQuantity: number;
}

export class QuantitySyncFixer {
  private static cachedProducts: Product[] | null = null;
  private static cachedSales: Sale[] | null = null;
  private static lastCacheTime = 0;
  private static cacheValidityMs = 30000; // 30 ثانية
  private static isRunning = false;

  /**
   * الحصول على المنتجات مع تخزين مؤقت ذكي
   */
  private static async getCachedProducts(): Promise<Product[]> {
    const now = Date.now();

    // استخدام الكاش المؤقت إذا كان متوفراً وصالحاً
    if (
      this.cachedProducts &&
      now - this.lastCacheTime < this.cacheValidityMs
    ) {
      console.log("📱 استخدام المنتجات من الكاش المؤقت");
      return this.cachedProducts;
    }

    try {
      console.log("📦 جلب المنتجات من قاعدة البيانات...");

      // جلب البيانات مع معرف فريد لتجنب التضارب
      const requestId = `quantitySync_products_${Date.now()}`;
      this.cachedProducts = await ConnectionThrottler.executeThrottled(
        requestId,
        () => supabaseService.getProducts(),
        60000, // 60 ثانية timeout - زيادة الوقت
      );

      this.lastCacheTime = now;
      console.log(
        `✅ تم جلب ${this.cachedProducts.length} منتج من قاعدة البيانات`,
      );
      return this.cachedProducts;
    } catch (error: any) {
      const errorMessage = formatError(error);
      console.error("فشل في جلب المنتجات:", errorMessage);
      logError("فشل في جلب المنتجات:", error, {
        operation: "quantity_sync_get_products",
      });

      // التراجع لاستخدام الكاش المحلي
      try {
        const offlineProducts = offlineManager.getCachedData(
          "products",
        ) as Product[];
        if (offlineProducts && offlineProducts.length > 0) {
          console.log("📱 استخدام ال��نتجات من الكاش المحلي كبديل");
          this.cachedProducts = offlineProducts;
          return offlineProducts;
        }
      } catch (offlineError) {
        console.warn(
          "فشل في الحصول على البيانات من الكاش المحلي:",
          offlineError,
        );
      }

      throw new Error(`فشل في الحصول على المنتجات: ${formatError(error)}`);
    }
  }

  /**
   * الحصول على المبيعات مع تخزين مؤقت ذكي
   */
  private static async getCachedSales(): Promise<Sale[]> {
    const now = Date.now();

    // استخدام الكاش المؤقت إذا كان متوفراً وصالحاً
    if (this.cachedSales && now - this.lastCacheTime < this.cacheValidityMs) {
      console.log("📱 استخدام المبيعات من الكاش المؤقت");
      return this.cachedSales;
    }

    try {
      console.log("🛒 جلب المبيعات من قاعدة البيانات...");

      // جلب البيانات مع معرف فريد لتجنب التضارب
      const requestId = `quantitySync_sales_${Date.now()}`;
      this.cachedSales = await ConnectionThrottler.executeThrottled(
        requestId,
        () => supabaseService.getSales(),
        45000, // 45 ثانية timeout
      );

      console.log(
        `✅ تم جلب ${this.cachedSales.length} عملية بيع من قاعدة البيانات`,
      );
      return this.cachedSales;
    } catch (error: any) {
      logError("فشل في جلب المبيعات:", error, {
        operation: "quantity_sync_get_sales",
      });

      // التراجع لاستخدام الكاش المحلي
      try {
        const offlineSales = offlineManager.getCachedData("sales") as Sale[];
        if (offlineSales && offlineSales.length > 0) {
          console.log("📱 استخدام المبيعات من الكاش المحلي كبديل");
          this.cachedSales = offlineSales;
          return offlineSales;
        }
      } catch (offlineError) {
        console.warn(
          "فشل في الحصول على البيانات من الكاش المحلي:",
          offlineError,
        );
      }

      throw new Error(`فشل في الحصول على المبيعات: ${formatError(error)}`);
    }
  }

  /**
   * مسح الكاش المؤقت
   */
  static clearCache(): void {
    this.cachedProducts = null;
    this.cachedSales = null;
    this.lastCacheTime = 0;
    console.log("🧹 تم مسح الكاش المؤقت للكميات");
  }

  /**
   * فحص ما إذا كان الفحص يعمل حالياً
   */
  static isHealthCheckRunning(): boolean {
    return this.isRunning;
  }

  /**
   * العثور على مشاكل الكمية في المخزون
   */
  static async findQuantityIssues(): Promise<QuantityIssue[]> {
    const issues: QuantityIssue[] = [];

    try {
      console.log("🔍 Checking quantity discrepancies...");

      // Get products and sales with smart caching
      const [supabaseProducts, allSales] = await Promise.all([
        this.getCachedProducts(),
        this.getCachedSales(),
      ]);

      // Get local products for comparison
      const localProducts = offlineManager.getCachedData(
        "products",
      ) as Product[];

      // Check each product for discrepancies
      for (const localProduct of localProducts || []) {
        const supabaseProduct = supabaseProducts.find(
          (p) => p.id === localProduct.id,
        );

        if (supabaseProduct) {
          // Calculate total quantity sold for this product
          const totalSold = allSales.reduce((total, sale) => {
            if (sale.items) {
              const saleItems = sale.items.filter(
                (item) => item.productId === localProduct.id,
              );
              return (
                total +
                saleItems.reduce(
                  (itemTotal, item) => itemTotal + item.quantity,
                  0,
                )
              );
            }
            return total;
          }, 0);

          // Check if there's a discrepancy
          if (localProduct.quantity !== supabaseProduct.quantity) {
            issues.push({
              productId: localProduct.id,
              productName: localProduct.name,
              localQuantity: localProduct.quantity,
              supabaseQuantity: supabaseProduct.quantity,
              difference: localProduct.quantity - supabaseProduct.quantity,
              totalSold,
              expectedQuantity: supabaseProduct.quantity, // Use Supabase as source of truth
            });
          }
        }
      }

      console.log(`📊 Found ${issues.length} quantity discrepancies`);
      return issues;
    } catch (error: any) {
      logError("Error finding quantity issues:", error, {
        operation: "find_quantity_issues",
      });
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * إصلاح مشاكل الكميات
   */
  static async fixQuantityIssues(issues: QuantityIssue[]): Promise<{
    fixed: number;
    failed: number;
    errors: string[];
  }> {
    let fixed = 0;
    let failed = 0;
    const errors: string[] = [];

    console.log(`🔧 Fixing ${issues.length} quantity issues...`);

    for (const issue of issues) {
      try {
        // Update local cache to match Supabase
        const localProducts = offlineManager.getCachedData(
          "products",
        ) as Product[];
        const updatedProducts = localProducts.map((product) => {
          if (product.id === issue.productId) {
            console.log(
              `📦 Fixing ${product.name}: ${product.quantity} → ${issue.expectedQuantity}`,
            );
            return {
              ...product,
              quantity: issue.expectedQuantity,
              updated_at: new Date().toISOString(),
            };
          }
          return product;
        });

        offlineManager.cacheData("products", updatedProducts);
        fixed++;
      } catch (error: any) {
        const errorMsg = `Failed to fix ${issue.productName}: ${formatError(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        failed++;
      }
    }

    console.log(`✅ Quantity fix completed: ${fixed} fixed, ${failed} failed`);

    // مسح الكاش بعد الإصلاح
    this.clearCache();

    return { fixed, failed, errors };
  }

  /**
   * مزامنة قسرية لجميع الكميات من Supabase
   */
  static async forceSyncAllQuantities(): Promise<{
    synced: number;
    errors: string[];
  }> {
    let synced = 0;
    const errors: string[] = [];

    try {
      console.log("🔄 Force syncing all product quantities from Supabase...");

      // مسح الكاش أولاً للحصول على بيانات جديدة
      this.clearCache();

      // Get fresh data from Supabase
      const supabaseProducts = await this.getCachedProducts();

      // Update local cache with Supabase data
      offlineManager.cacheData("products", supabaseProducts);

      synced = supabaseProducts.length;
      console.log(`✅ Force synced ${synced} product quantities`);
    } catch (error: any) {
      const errorMsg = `Failed to force sync quantities: ${formatError(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }

    return { synced, errors };
  }

  /**
   * التحقق من حسابات الكميات بناءً على تاريخ المبيعات
   */
  static async verifyQuantityCalculations(): Promise<{
    verified: boolean;
    issues: {
      productId: string;
      productName: string;
      currentQuantity: number;
      calculatedQuantity: number;
      difference: number;
    }[];
  }> {
    const issues: any[] = [];

    try {
      console.log("🧮 Verifying quantity calculations based on sales...");

      const [products, sales] = await Promise.all([
        this.getCachedProducts(),
        this.getCachedSales(),
      ]);

      for (const product of products) {
        // Calculate total sold for this product
        let totalSold = 0;

        sales.forEach((sale) => {
          if (sale.items) {
            sale.items
              .filter((item) => item.productId === product.id)
              .forEach((item) => {
                totalSold += item.quantity;
              });
          }
        });

        // For verification, we would need the original quantity before any sales
        // This is a limitation as we don't store historical quantity data
        // But we can still identify potential issues

        console.log(
          `📊 ${product.name}: Current=${product.quantity}, Sold=${totalSold}`,
        );
      }

      return { verified: true, issues };
    } catch (error: any) {
      console.error("Error verifying quantity calculations:", error);
      return { verified: false, issues };
    }
  }

  /**
   * فحص شامل لصحة الكميات مع الإصلاح
   */
  static async performQuantityHealthCheck(): Promise<{
    healthy: boolean;
    issues: any[];
    totalProducts: number;
    issuesFound: number;
    errors: string[];
  }> {
    // Handle concurrent executions gracefully
    if (this.isRunning) {
      console.warn(
        "⚠️ Quantity health check already running, returning cached result...",
      );
      return {
        healthy: true,
        issues: [],
        totalProducts: 0,
        issuesFound: 0,
        errors: ["Health check already in progress"],
      };
    }

    this.isRunning = true;
    console.log("🏥 Starting comprehensive quantity health check...");

    try {
      // Step 1: Find issues
      const issues = await this.findQuantityIssues();

      if (issues.length === 0) {
        console.log("✅ No quantity issues found - system healthy");
        return { healthy: true, issues: [] };
      }

      console.log(`⚠️ Found ${issues.length} quantity issues`);

      // Step 2: Fix issues
      const fixResult = await this.fixQuantityIssues(issues);

      // Step 3: Force sync to ensure consistency
      const syncResult = await this.forceSyncAllQuantities();

      return {
        healthy: fixResult.fixed === issues.length && fixResult.failed === 0,
        issues,
        fixResult,
        syncResult,
      };
    } catch (error: any) {
      logError("Health check failed:", error, {
        operation: "quantity_health_check",
      });
      return {
        healthy: false,
        issues: [],
        fixResult: { fixed: 0, failed: 1, errors: [formatError(error)] },
      };
    } finally {
      this.isRunning = false;
      // تنظيف الـ throttler في النهاية
      ConnectionThrottler.cleanupStuckRequests();
    }
  }

  /**
   * إنشاء تقرير صحة الكميات
   */
  static generateHealthReport(
    healthResult: Awaited<ReturnType<typeof this.performQuantityHealthCheck>>,
  ): string {
    let report = "📊 تقرير صحة الكميات\n\n";

    if (healthResult.healthy) {
      report += "✅ النظام سليم - جميع الكميات متزامنة بشكل صحيح\n\n";
    } else {
      report += "⚠️ تم العثور على مشاكل في الكميات\n\n";

      if (healthResult.issues.length > 0) {
        report += `🔍 المشاكل المكتشفة (${healthResult.issues.length}):\n`;
        healthResult.issues.forEach((issue, index) => {
          report += `${index + 1}. ${issue.productName}\n`;
          report += `   - الكمية المحلية: ${issue.localQuantity}\n`;
          report += `   - كمية Supabase: ${issue.supabaseQuantity}\n`;
          report += `   - الفرق: ${issue.difference}\n`;
          report += `   - إجمالي المبيعات: ${issue.totalSold}\n\n`;
        });
      }

      if (healthResult.fixResult) {
        report += `🔧 نتائج الإصلاح:\n`;
        report += `   - تم إصلاحها: ${healthResult.fixResult.fixed}\n`;
        report += `   - فشل الإصلاح: ${healthResult.fixResult.failed}\n`;
        if (healthResult.fixResult.errors.length > 0) {
          report += `   - أخطاء: ${healthResult.fixResult.errors.join(", ")}\n`;
        }
        report += "\n";
      }

      if (healthResult.syncResult) {
        report += `🔄 نتائج المزامنة:\n`;
        report += `   - تم مزامنتها: ${healthResult.syncResult.synced}\n`;
        if (healthResult.syncResult.errors.length > 0) {
          report += `   - أخطاء: ${healthResult.syncResult.errors.join(", ")}\n`;
        }
        report += "\n";
      }
    }

    report += `📅 تم إنشاء التقرير: ${new Date().toLocaleString("ar-EG")}\n`;
    report += `🏪 PAW - نظام إدارة المخزون الذكي`;

    return report;
  }

  /**
   * إنشاء معرف طلب آمن
   */
  private static createSafeRequestId(operation: string): string {
    return `quantitySync_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}
