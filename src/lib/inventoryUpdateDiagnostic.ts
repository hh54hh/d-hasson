import { supabaseService } from "./supabaseService";
import { logError, formatError } from "./utils";

/**
 * Diagnostic tool for inventory update issues
 */
export class InventoryUpdateDiagnostic {
  /**
   * Test inventory update for a specific product
   */
  static async testInventoryUpdate(productId: string, quantityChange: number) {
    console.log("🔧 Starting inventory update diagnostic...");

    try {
      // Get current product state
      const products = await supabaseService.getProducts();
      const product = products.find((p) => p.id === productId);

      if (!product) {
        console.error(`❌ Product not found: ${productId}`);
        return false;
      }

      console.log(`📦 Current product state:`, {
        id: product.id,
        name: product.name,
        currentQuantity: product.quantity,
        requestedChange: quantityChange,
        newQuantity: product.quantity + quantityChange,
      });

      // Test the update
      const success = await this.performTestUpdate(product, quantityChange);

      if (success) {
        console.log("✅ Inventory update diagnostic: SUCCESS");
      } else {
        console.log("❌ Inventory update diagnostic: FAILED");
      }

      return success;
    } catch (error) {
      logError("🔧 Inventory update diagnostic failed:", error, {
        productId,
        quantityChange,
        operation: "inventory_diagnostic",
      });
      return false;
    }
  }

  /**
   * Perform test inventory update
   */
  private static async performTestUpdate(
    product: any,
    quantityChange: number,
  ): Promise<boolean> {
    try {
      const newQuantity = product.quantity + quantityChange;

      // Simulate the same update that happens in sales
      const updateResult = await supabaseService.updateProduct(product.id, {
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      });

      console.log("✅ Test inventory update successful");

      // Verify the update worked
      const updatedProducts = await supabaseService.getProducts();
      const updatedProduct = updatedProducts.find((p) => p.id === product.id);

      if (updatedProduct && updatedProduct.quantity === newQuantity) {
        console.log("✅ Inventory update verification: SUCCESS");

        // Revert the test change
        await supabaseService.updateProduct(product.id, {
          quantity: product.quantity,
          updated_at: product.updated_at,
        });

        console.log("✅ Test change reverted");
        return true;
      } else {
        console.error("❌ Inventory update verification failed");
        return false;
      }
    } catch (error) {
      logError("❌ Test inventory update failed:", error, {
        productId: product.id,
        productName: product.name,
        quantityChange,
        operation: "test_inventory_update",
      });
      return false;
    }
  }

  /**
   * Check database permissions and table structure
   */
  static async checkDatabaseHealth(): Promise<{
    success: boolean;
    issues: string[];
    details: {
      canReadProducts: boolean;
      canUpdateProducts: boolean;
      saleItemsTableExists: boolean;
      productsCount: number;
    };
  }> {
    console.log("🔧 Checking database health for inventory updates...");

    const issues: string[] = [];
    const details = {
      canReadProducts: false,
      canUpdateProducts: false,
      saleItemsTableExists: false,
      productsCount: 0,
    };

    try {
      // Test 1: Basic connection and product reading
      console.log("📊 Testing product reading...");
      try {
        const products = await supabaseService.getProducts();
        details.canReadProducts = true;
        details.productsCount = products.length;
        console.log(`✅ Can read products: ${products.length} found`);

        if (products.length === 0) {
          issues.push("لا توجد منتجات في قاعدة البيانات");
          console.warn("⚠️ No products found in database");
        }

        // Test 2: Product update permissions (only if we have products)
        if (products.length > 0) {
          console.log("🔧 Testing product update permissions...");
          try {
            const testProduct = products[0];

            // اختبار تحديث بسيط وآمن
            const originalUpdatedAt = testProduct.updated_at;
            const newUpdatedAt = new Date().toISOString();

            console.log(
              `🧪 اختبار تحديث المنتج: ${testProduct.name} (${testProduct.id})`,
            );

            const updatedProduct = await supabaseService.updateProduct(
              testProduct.id,
              {
                updated_at: newUpdatedAt,
              },
            );

            if (updatedProduct && updatedProduct.id === testProduct.id) {
              details.canUpdateProducts = true;
              console.log("✅ Can update products");
              console.log(
                `📝 تم تحديث ${testProduct.name} من ${originalUpdatedAt} إلى ${updatedProduct.updated_at}`,
              );
            } else {
              throw new Error("لم يتم إرجاع بيانات صحيحة بعد التحديث");
            }
          } catch (updateError: any) {
            details.canUpdateProducts = false;
            const updateErrorMsg =
              updateError?.message || formatError(updateError);

            // تحسين معالجة أنواع الأخطاء المختلفة
            if (
              updateErrorMsg.includes(
                "JSON object requested, multiple (or no) rows returned",
              )
            ) {
              issues.push(
                "⚠️ مشكلة في استعلام التحديث - قد يكون هناك منتجات مكررة",
              );
              console.error(
                "❌ Product update query issue - possible duplicate products",
              );
            } else if (updateErrorMsg.includes("لا يمكن العثور على المنتج")) {
              issues.push("⚠️ المنتج المختبر غير موجود في قاعدة البيانات");
              console.error("❌ Test product not found in database");
            } else {
              issues.push(`فشل في تحديث المنتجات: ${updateErrorMsg}`);
              console.error("❌ Cannot update products:", updateErrorMsg);
            }
          }
        }
      } catch (readError: any) {
        details.canReadProducts = false;
        const readErrorMsg = readError?.message || formatError(readError);

        // تحسين التعامل مع أخطاء الاتصال
        if (
          readErrorMsg.includes("الاتصال مؤقتاً غير متوفر") ||
          readErrorMsg.includes("Connection timeout") ||
          readErrorMsg.includes("لا يوجد اتصال بالإنترنت")
        ) {
          issues.push(
            "⚠️ مشكلة في الاتصال بقاعدة البيانات - سيتم المحاولة لاحقاً",
          );
          console.warn(
            "⚠️ Database connection issue detected - retrying later",
          );

          // محاولة إضافية بعد تأخير قصير
          setTimeout(async () => {
            try {
              console.log("🔄 إعادة محاولة قراءة المنتجات...");
              const retryProducts = await supabaseService.getProducts();
              console.log(
                "✅ نجحت إعادة المحاولة - تم العثور على",
                retryProducts.length,
                "منتج",
              );
            } catch (retryError: any) {
              console.warn("❌ فشلت إعادة المحاولة:", formatError(retryError));
            }
          }, 3000);
        } else {
          issues.push(`فشل في قراءة المنتجات: ${readErrorMsg}`);
        }

        console.error("❌ Cannot read products:", readErrorMsg);
      }

      // Test 3: sale_items table existence
      console.log("🗃️ Testing sale_items table...");
      try {
        const { supabase } = supabaseService;
        await supabase!.from("sale_items").select("count").limit(1);

        details.saleItemsTableExists = true;
        console.log("✅ sale_items table exists");
      } catch (tableError: any) {
        details.saleItemsTableExists = false;

        if (tableError.code === "42P01") {
          issues.push("جدول sale_items مفقود - هذا خطير!");
          console.error("❌ sale_items table missing - this is critical!");
          console.error("🔧 Run CRITICAL_DATABASE_FIX.sql to fix this");
        } else {
          const tableErrorMsg = tableError?.message || formatError(tableError);
          issues.push(`مشكلة في جدول sale_items: ${tableErrorMsg}`);
          console.error("❌ sale_items table issue:", tableErrorMsg);
        }
      }

      const success =
        details.canReadProducts &&
        details.saleItemsTableExists &&
        issues.length === 0;

      if (success) {
        console.log("✅ Database health check passed");
      } else {
        console.log(
          `⚠️ Database health check completed with ${issues.length} issues`,
        );
      }

      return {
        success,
        issues,
        details,
      };
    } catch (generalError: any) {
      const errorMsg = formatError(generalError);
      issues.push(`فشل عام في فحص قاعدة البيانات: ${errorMsg}`);

      logError("❌ Database health check failed:", generalError, {
        operation: "database_health_check",
      });

      console.error("❌ Database health check failed:", errorMsg);

      return {
        success: false,
        issues,
        details,
      };
    }
  }

  /**
   * Run comprehensive inventory diagnostic
   */
  static async runFullDiagnostic(): Promise<{
    success: boolean;
    healthCheck: any;
    inventoryTest: {
      tested: boolean;
      success: boolean;
      productId?: string;
      error?: string;
    };
    summary: string;
  }> {
    console.log("🔧 Running full inventory update diagnostic...");

    // تشغيل فحص صحة قاعدة البيانات
    const healthCheck = await this.checkDatabaseHealth();

    const inventoryTest = {
      tested: false,
      success: false,
    };

    let summary = "";

    if (!healthCheck.success) {
      summary = `فحص قاعدة البيانات فشل: ${healthCheck.issues.join(", ")}`;
      console.error("❌ Database health check failed - cannot proceed");
      return {
        success: false,
        healthCheck,
        inventoryTest,
        summary,
      };
    }

    // اختبار تحديث المخزون إذا نجح فحص قاعدة البيانات
    try {
      if (healthCheck.details.productsCount > 0) {
        console.log("🧪 Testing inventory update...");
        const products = await supabaseService.getProducts();
        const testProduct = products[0];

        inventoryTest.tested = true;
        inventoryTest.success = await this.testInventoryUpdate(
          testProduct.id,
          -1,
        );

        if (inventoryTest.success) {
          summary = "جميع الاختبارات نجحت - النظام يعمل بشكل طبيعي";
        } else {
          summary = "فحص قاعدة البيانات نجح لكن اختبار تحديث المخزون فشل";
        }
      } else {
        summary = "لا توجد منتجات متاحة لاختبار تحديث المخزون";
        console.warn("⚠️ No products available for testing");
      }
    } catch (error: any) {
      inventoryTest.tested = true;
      inventoryTest.success = false;
      inventoryTest.error = formatError(error);
      summary = `فشل في اختبار تحديث المخزون: ${inventoryTest.error}`;

      logError("❌ Inventory test failed:", error, {
        operation: "full_inventory_diagnostic_test",
      });
    }

    const overallSuccess = healthCheck.success && inventoryTest.success;

    console.log(`${overallSuccess ? "✅" : "❌"} Full diagnostic: ${summary}`);

    return {
      success: overallSuccess,
      healthCheck,
      inventoryTest,
      summary,
    };
  }
}

// Export convenience function
export const diagnoseInventoryUpdates = () =>
  InventoryUpdateDiagnostic.runFullDiagnostic();
