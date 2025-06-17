import { supabaseService } from "./supabaseService";
import { CartItem, Product } from "./types";
import { logError, formatError } from "./utils";

/**
 * مراقب تحديثات المخزون - يتتبع ويراقب تغييرات الكميات
 * Inventory Update Monitor - Tracks and monitors quantity changes
 */
export class InventoryUpdateMonitor {
  private static snapshots: Map<string, number> = new Map();

  /**
   * أخذ لقطة من كميات المنتجات قبل البيع
   */
  static async takeSnapshot(cartItems: CartItem[]): Promise<void> {
    try {
      console.log("📸 أخذ لقطة من كميات المنتجات...");

      for (const item of cartItems) {
        const currentProducts = await supabaseService.getProducts();
        const product = currentProducts.find((p) => p.id === item.product.id);

        if (product) {
          this.snapshots.set(item.product.id, product.quantity);
          console.log(
            `📦 ${item.product.name}: الكمية الحالية = ${product.quantity}`,
          );
        }
      }

      console.log(`✅ تم حفظ لقطة لـ ${this.snapshots.size} منتج`);
    } catch (error: any) {
      logError("فشل في أخذ لقطة المخزون:", error, {
        operation: "take_inventory_snapshot",
        cartItemsCount: cartItems.length,
      });
    }
  }

  /**
   * مقارنة الكميات الحالية مع اللقطة
   */
  static async compareWithSnapshot(cartItems: CartItem[]): Promise<{
    isCorrect: boolean;
    issues: Array<{
      productId: string;
      productName: string;
      beforeQuantity: number;
      afterQuantity: number;
      expectedQuantity: number;
      soldQuantity: number;
      status: "correct" | "not_updated" | "double_updated" | "unexpected";
      message: string;
    }>;
  }> {
    const issues = [];
    let isCorrect = true;

    try {
      console.log("🔍 مقارنة الكميات مع اللقطة...");

      const currentProducts = await supabaseService.getProducts();

      for (const item of cartItems) {
        const beforeQuantity = this.snapshots.get(item.product.id) || 0;
        const currentProduct = currentProducts.find(
          (p) => p.id === item.product.id,
        );
        const afterQuantity = currentProduct?.quantity || 0;
        const expectedQuantity = beforeQuantity - item.quantity;

        let status:
          | "correct"
          | "not_updated"
          | "double_updated"
          | "unexpected" = "correct";
        let message = "";

        if (afterQuantity === expectedQuantity) {
          status = "correct";
          message = `✅ تحديث صحيح`;
        } else if (afterQuantity === beforeQuantity) {
          status = "not_updated";
          message = `❌ لم يتم التحديث`;
          isCorrect = false;
        } else if (afterQuantity === beforeQuantity - item.quantity * 2) {
          status = "double_updated";
          message = `❌ تحديث مزدوج (نقص مرتين)`;
          isCorrect = false;
        } else {
          status = "unexpected";
          message = `⚠️ تحديث غير متوقع`;
          isCorrect = false;
        }

        issues.push({
          productId: item.product.id,
          productName: item.product.name,
          beforeQuantity,
          afterQuantity,
          expectedQuantity,
          soldQuantity: item.quantity,
          status,
          message,
        });

        console.log(
          `📊 ${item.product.name}: ${beforeQuantity} → ${afterQuantity} (متوقع: ${expectedQuantity}) - ${message}`,
        );
      }

      return { isCorrect, issues };
    } catch (error: any) {
      logError("فشل في مقارنة اللقطة:", error, {
        operation: "compare_with_snapshot",
        cartItemsCount: cartItems.length,
      });

      return {
        isCorrect: false,
        issues: [
          {
            productId: "error",
            productName: "خطأ في المقارنة",
            beforeQuantity: 0,
            afterQuantity: 0,
            expectedQuantity: 0,
            soldQuantity: 0,
            status: "unexpected",
            message: `خطأ: ${formatError(error)}`,
          },
        ],
      };
    }
  }

  /**
   * إصلاح تحديثات المخزون الخاطئة
   */
  static async fixInventoryIssues(
    issues: Array<{
      productId: string;
      productName: string;
      beforeQuantity: number;
      afterQuantity: number;
      expectedQuantity: number;
      soldQuantity: number;
      status: "correct" | "not_updated" | "double_updated" | "unexpected";
      message: string;
    }>,
  ): Promise<{
    fixed: number;
    failed: number;
    results: Array<{
      productId: string;
      productName: string;
      action: string;
      success: boolean;
      message: string;
    }>;
  }> {
    let fixed = 0;
    let failed = 0;
    const results = [];

    try {
      console.log("🔧 بدء إصلاح مشاكل المخزون...");

      for (const issue of issues) {
        if (issue.status === "correct") {
          results.push({
            productId: issue.productId,
            productName: issue.productName,
            action: "لا يحتاج إصلاح",
            success: true,
            message: "الكمية صحيحة",
          });
          continue;
        }

        try {
          let targetQuantity = issue.expectedQuantity;
          let action = "";

          switch (issue.status) {
            case "not_updated":
              action = "تحديث الكمية المفقودة";
              break;
            case "double_updated":
              action = "إصلاح التحديث المزدوج";
              targetQuantity = issue.beforeQuantity - issue.soldQuantity;
              break;
            case "unexpected":
              action = "تصحيح الكمية للقيمة المتوقعة";
              break;
          }

          // تحديث الكمية للقيمة الصحيحة
          await supabaseService.updateProduct(issue.productId, {
            quantity: targetQuantity,
            updated_at: new Date().toISOString(),
          });

          console.log(
            `✅ ${issue.productName}: ${action} - ${issue.afterQuantity} → ${targetQuantity}`,
          );

          results.push({
            productId: issue.productId,
            productName: issue.productName,
            action,
            success: true,
            message: `تم التحديث إلى ${targetQuantity}`,
          });

          fixed++;
        } catch (error: any) {
          console.error(`❌ فشل إصلاح ${issue.productName}:`, error);

          results.push({
            productId: issue.productId,
            productName: issue.productName,
            action: "محاولة الإصلاح",
            success: false,
            message: formatError(error),
          });

          failed++;
        }
      }

      console.log(`🎯 تم إصلاح ${fixed} منتج، فشل ${failed} منتج`);

      return { fixed, failed, results };
    } catch (error: any) {
      logError("فشل في إصلاح مشاكل المخزون:", error, {
        operation: "fix_inventory_issues",
        issuesCount: issues.length,
      });

      return {
        fixed: 0,
        failed: issues.length,
        results: [
          {
            productId: "error",
            productName: "خطأ عام",
            action: "إصلاح المشاكل",
            success: false,
            message: formatError(error),
          },
        ],
      };
    }
  }

  /**
   * تنظيف اللقطات المحفوظة
   */
  static clearSnapshots(): void {
    this.snapshots.clear();
    console.log("🗑️ تم حذف جميع اللقطات");
  }

  /**
   * عرض تقرير شامل عن حالة المخزون
   */
  static async generateInventoryReport(cartItems: CartItem[]): Promise<{
    summary: {
      totalProducts: number;
      correctUpdates: number;
      issues: number;
      accuracy: number;
    };
    details: Array<{
      productName: string;
      status: string;
      beforeQuantity: number;
      afterQuantity: number;
      expectedQuantity: number;
      message: string;
    }>;
  }> {
    try {
      const comparison = await this.compareWithSnapshot(cartItems);

      const correctUpdates = comparison.issues.filter(
        (issue) => issue.status === "correct",
      ).length;
      const totalProducts = comparison.issues.length;
      const issues = totalProducts - correctUpdates;
      const accuracy =
        totalProducts > 0 ? (correctUpdates / totalProducts) * 100 : 100;

      const summary = {
        totalProducts,
        correctUpdates,
        issues,
        accuracy: Math.round(accuracy * 100) / 100,
      };

      const details = comparison.issues.map((issue) => ({
        productName: issue.productName,
        status: issue.status,
        beforeQuantity: issue.beforeQuantity,
        afterQuantity: issue.afterQuantity,
        expectedQuantity: issue.expectedQuantity,
        message: issue.message,
      }));

      return { summary, details };
    } catch (error: any) {
      logError("فشل في توليد تقرير المخزون:", error, {
        operation: "generate_inventory_report",
        cartItemsCount: cartItems.length,
      });

      return {
        summary: {
          totalProducts: 0,
          correctUpdates: 0,
          issues: 1,
          accuracy: 0,
        },
        details: [
          {
            productName: "خطأ في التقرير",
            status: "error",
            beforeQuantity: 0,
            afterQuantity: 0,
            expectedQuantity: 0,
            message: formatError(error),
          },
        ],
      };
    }
  }

  /**
   * تشغيل مراقبة شاملة لعملية البيع
   */
  static async monitorSaleTransaction(
    cartItems: CartItem[],
    saleOperation: () => Promise<any>,
  ): Promise<{
    saleResult: any;
    inventoryReport: any;
    wasFixed: boolean;
    fixResults?: any;
  }> {
    try {
      console.log("🎬 بدء مراقبة عملية البيع...");

      // 1. أخذ لقطة قبل البيع
      await this.takeSnapshot(cartItems);

      // 2. تنفيذ عملية البيع
      console.log("💼 تنفيذ عملية البيع...");
      const saleResult = await saleOperation();

      // 3. مقارنة النتائج
      console.log("📊 تحليل نتائج تحديث المخزون...");
      const inventoryReport = await this.generateInventoryReport(cartItems);

      // 4. إصلاح المشاكل إذا وجدت
      let wasFixed = false;
      let fixResults;

      if (inventoryReport.summary.issues > 0) {
        console.log(
          `⚠️ تم اكتشاف ${inventoryReport.summary.issues} مشكلة، جاري الإصلاح...`,
        );

        const comparison = await this.compareWithSnapshot(cartItems);
        fixResults = await this.fixInventoryIssues(comparison.issues);
        wasFixed = fixResults.fixed > 0;

        if (wasFixed) {
          console.log(`✅ تم إصلاح ${fixResults.fixed} مشكلة`);
        }
      } else {
        console.log("✅ جميع تحديثات المخزون صحيحة");
      }

      // 5. تنظيف البيانات
      this.clearSnapshots();

      return {
        saleResult,
        inventoryReport,
        wasFixed,
        fixResults,
      };
    } catch (error: any) {
      const errorInfo = logError("فشل في مراقبة عملية البيع:", error, {
        operation: "monitor_sale_transaction",
        cartItemsCount: cartItems.length,
      });

      this.clearSnapshots();
      throw new Error(`فشل في مراقبة عملية البيع: ${errorInfo.message}`);
    }
  }
}

// تصدير دوال مساعدة
export const monitorSaleTransaction = (
  cartItems: CartItem[],
  saleOperation: () => Promise<any>,
) => InventoryUpdateMonitor.monitorSaleTransaction(cartItems, saleOperation);

export const takeInventorySnapshot = (cartItems: CartItem[]) =>
  InventoryUpdateMonitor.takeSnapshot(cartItems);

export const checkInventoryUpdates = (cartItems: CartItem[]) =>
  InventoryUpdateMonitor.compareWithSnapshot(cartItems);
