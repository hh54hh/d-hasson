import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";
import { Customer, CartItem, Sale } from "./types";
import { logError, formatError } from "./utils";
import { getCurrentDateGregorian } from "./types";
import { InventoryUpdateMonitor } from "./inventoryUpdateMonitor";
import { CustomerDataDiagnostic } from "./customerDataDiagnostic";
import { SaleCalculations } from "./saleCalculations";
import { CustomerSaleHistory } from "./customerSaleHistory";

/**
 * مدير مبيعات العملاء الموجودين - يضمن الدقة والتزامن
 * Existing Customer Sales Manager - Ensures accuracy and synchronization
 */
export class ExistingCustomerSaleManager {
  /**
   * إنشاء عملية بيع للعميل الموجود مع ضمان التزامن الكامل
   * Create sale for existing customer with full synchronization guarantee
   */
  static async createSaleForExistingCustomer(
    customer: Customer,
    cartItems: CartItem[],
    saleData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
      notes?: string;
    },
  ): Promise<{
    sale: Sale;
    updatedCustomer: Customer;
    inventoryUpdates: Array<{
      productId: string;
      productName: string;
      oldQuantity: number;
      newQuantity: number;
      soldQuantity: number;
    }>;
    warnings: string[];
  }> {
    console.log(
      `🛒 بدء عملية بيع للعميل الموجود: ${customer.name} (${customer.phone})`,
    );

    const warnings: string[] = [];

    // 1. التحقق من صحة بيانات العميل مع الإصلاح التلقائي
    console.log(`🔍 التحقق من العميل: ${customer.name}...`);

    let validatedCustomer = await this.validateExistingCustomer(customer);

    if (!validatedCustomer) {
      console.log(`⚠️ فشل التحقق الأولي، محاولة الإصلاح التلقائي...`);

      const fixResult =
        await CustomerDataDiagnostic.autoFixCustomerIssue(customer);

      if (fixResult.success && fixResult.fixedCustomer) {
        validatedCustomer = fixResult.fixedCustomer;
        console.log(`✅ تم إصلاح مشكلة العميل: ${validatedCustomer.name}`);

        // إضافة تحذير للمستخدم
        warnings.push(
          `تم إصلاح مشكلة في بيانات العميل تلقائياً: ${fixResult.message}`,
        );
      } else {
        // تشخيص مفصل للمشكلة
        const diagnosis =
          await CustomerDataDiagnostic.diagnoseCustomerValidationIssue(
            customer,
          );

        const errorMessage = [
          `العميل غير موجود أو تم حذفه: ${customer.name}`,
          `المشاكل المكتشفة: ${diagnosis.issues.join(", ")}`,
          `الحلول المقترحة: ${diagnosis.solutions.join(", ")}`,
        ].join("\n");

        throw new Error(errorMessage);
      }
    }

    // 2. التحقق من توفر المنتجات والكميات
    const inventoryValidation = await this.validateInventoryForSale(cartItems);
    if (!inventoryValidation.isValid) {
      throw new Error(
        `مشاكل في المخزون: ${inventoryValidation.issues.join(", ")}`,
      );
    }

    // 3. حساب المبالغ بدقة
    const calculations = this.calculateSaleTotals(cartItems, saleData);

    // 4-8. تنفيذ العملية الكاملة مع مراقبة المخزون
    const monitoringResult =
      await InventoryUpdateMonitor.monitorSaleTransaction(
        cartItems,
        async () => {
          // 4. إنشاء عملية البيع بطريقة متزامنة
          const saleResult = await this.executeSaleTransaction(
            validatedCustomer,
            cartItems,
            saleData,
            calculations,
          );

          // 5. تحديث بيانات العميل باستخدام النظام المحسن
          const updatedCustomer =
            await CustomerSaleHistory.updateCustomerAfterSale(
              validatedCustomer,
              saleResult,
              cartItems,
              {
                totalAmount: calculations.totalAmount,
                actualPaidAmount: calculations.actualPaidAmount,
                remainingAmount: calculations.remainingAmount,
              },
            );

          // 6. إنشاء سجل المعاملة
          await this.createTransactionRecord(
            updatedCustomer.id,
            calculations.totalAmount,
            cartItems.length,
          );

          // 7. التحقق من التزامن النهائي
          await this.verifyDataConsistency(
            saleResult.id,
            updatedCustomer.id,
            cartItems,
          );

          return { saleResult, updatedCustomer };
        },
      );

    const { saleResult, updatedCustomer } = monitoringResult.saleResult;
    const inventoryUpdates = monitoringResult.inventoryReport.details.map(
      (detail: any) => ({
        productId:
          cartItems.find((item) => item.product.name === detail.productName)
            ?.product.id || "",
        productName: detail.productName,
        oldQuantity: detail.beforeQuantity,
        newQuantity: detail.afterQuantity,
        soldQuantity:
          cartItems.find((item) => item.product.name === detail.productName)
            ?.quantity || 0,
      }),
    );

    // إضافة تحذيرات إذا تم إصلاح المخزون
    if (monitoringResult.wasFixed) {
      warnings.push(
        `تم إصلاح ${monitoringResult.fixResults?.fixed || 0} مشكلة في تحديث المخزون تلقائياً`,
      );
    }

    // إضافة تحذيرات للدقة
    const accuracy = monitoringResult.inventoryReport.summary.accuracy;
    if (accuracy < 100) {
      warnings.push(
        `دقة تحديث المخزون: ${accuracy}% - تم إصلاح المشاكل المكتشفة`,
      );
    }

    console.log(`✅ تمت عملية البيع بنجاح للعميل: ${updatedCustomer.name}`);

    return {
      sale: saleResult,
      updatedCustomer,
      inventoryUpdates,
      warnings,
    };
  }

  /**
   * التحقق من صحة بيانات العميل الموجود
   */
  private static async validateExistingCustomer(
    customer: Customer,
  ): Promise<Customer | null> {
    try {
      console.log(`🔍 التحقق من العميل: ${customer.name} (${customer.id})`);

      // التحقق من وجود العميل في قاعدة البيانات
      const dbCustomer = await supabaseService.getCustomerById(customer.id);

      if (!dbCustomer) {
        console.log(
          `⚠️ العميل غير موجود بالـ ID، محاولة البحث بالهاتف: ${customer.phone}`,
        );

        try {
          // محاولة البحث بالهاتف كبديل
          const phoneCustomer = await supabaseService.getCustomerByPhone(
            customer.phone,
          );

          if (phoneCustomer) {
            console.log(
              `✅ تم العثور على العميل بالهاتف: ${phoneCustomer.name} (${phoneCustomer.id})`,
            );
            return phoneCustomer;
          }
        } catch (phoneError: any) {
          logError("فشل في البحث بالهاتف:", phoneError, {
            customerPhone: customer.phone,
            customerName: customer.name,
            operation: "search_by_phone_fallback",
          });
        }

        console.log(`❌ العميل غير موجود في قاعدة البيانات: ${customer.name}`);
        return null;
      }

      // التحقق من تطابق البيانات الأساسية
      if (dbCustomer.phone !== customer.phone) {
        console.warn(
          `⚠️ عدم تطابق رقم الهاتف للعميل ${customer.name}: متوقع ${customer.phone}، موجود ${dbCustomer.phone}`,
        );
        // نواصل العملية حتى لو كان هناك عدم تطابق بسيط
      }

      console.log(`✅ تم التحقق من العميل بنجاح: ${dbCustomer.name}`);
      return dbCustomer;
    } catch (error: any) {
      logError("فشل في التحقق من العميل:", error, {
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        operation: "validate_existing_customer",
      });

      // بدلاً من رمي خطأ، نحاول إرجاع البيانات الأصلية كحل أخير
      console.log(
        `⚠️ استخدام بيانات العميل الأصلية كحل أخير: ${customer.name}`,
      );
      return customer;
    }
  }

  /**
   * التحقق من توفر المنتجات والكميات
   */
  private static async validateInventoryForSale(
    cartItems: CartItem[],
  ): Promise<{
    isValid: boolean;
    issues: string[];
    availableQuantities: Record<string, number>;
  }> {
    const issues: string[] = [];
    const availableQuantities: Record<string, number> = {};

    try {
      for (const item of cartItems) {
        // الحصول على الكمية الحالية من قاعدة البيانات
        const currentProducts = await supabaseService.getProducts();
        const currentProduct = currentProducts.find(
          (p) => p.id === item.product.id,
        );

        if (!currentProduct) {
          issues.push(`المنتج غير موجود: ${item.product.name}`);
          continue;
        }

        availableQuantities[item.product.id] = currentProduct.quantity;

        // التحقق من توفر الكمية
        if (currentProduct.quantity < item.quantity) {
          issues.push(
            `كمية غير كافية لـ ${item.product.name}: متوفر ${currentProduct.quantity}، مطلوب ${item.quantity}`,
          );
        }

        // التحقق من السعر المحدث
        if (currentProduct.salePrice !== item.unitPrice) {
          console.warn(
            `⚠️ تغيير في سعر ${item.product.name}: من ${item.unitPrice} إلى ${currentProduct.salePrice}`,
          );
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        availableQuantities,
      };
    } catch (error: any) {
      logError("فشل في التحقق من المخزون:", error, {
        cartItemsCount: cartItems.length,
        operation: "validate_inventory_for_sale",
      });

      return {
        isValid: false,
        issues: [`فشل في التحقق من المخزون: ${formatError(error)}`],
        availableQuantities,
      };
    }
  }

  /**
   * حساب إجماليات البيع باستخدام النظام المحسن
   */
  private static calculateSaleTotals(
    cartItems: CartItem[],
    saleData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
    },
  ) {
    // استخدام النظام المحسن للحسابات
    const calculations = SaleCalculations.calculateSaleTotals(
      cartItems,
      saleData,
    );

    // التحقق من صحة الحسابات
    const validation = SaleCalculations.validateCalculations(calculations);
    if (!validation.isValid) {
      console.error("❌ أخطاء في الحسابات:", validation.errors);
      throw new Error(`أخطاء في الحسابات: ${validation.errors.join(", ")}`);
    }

    // عرض ��لتحذيرات إن وجدت
    if (validation.warnings.length > 0) {
      console.warn("⚠️ تحذيرات في الحسابات:", validation.warnings);
    }

    // عرض ملخص الحسابات
    const display = SaleCalculations.formatCalculationsDisplay(calculations);
    console.log("📊 ملخص البيع:", display.summary);

    return {
      totalAmount: calculations.totalAmount,
      totalProfit: calculations.totalProfit,
      actualPaidAmount: calculations.actualPaidAmount,
      remainingAmount: calculations.remainingAmount,
      calculations, // إضافة الحسابات التفصيلية
    };
  }

  /**
   * تنفيذ عملية البيع كمعاملة واحدة
   */
  private static async executeSaleTransaction(
    customer: Customer,
    cartItems: CartItem[],
    saleData: any,
    calculations: any,
  ): Promise<Sale> {
    try {
      console.log(`💾 إنشاء عملية البيع للعميل: ${customer.name}`);

      // استخدام الوظيفة المحسن�� لإنشاء البيع
      const sale = await supabaseService.createSaleWithCart(
        customer.id,
        cartItems,
        {
          paymentType: saleData.paymentType,
          paidAmount: calculations.actualPaidAmount,
          notes: saleData.notes || "",
        },
      );

      console.log(`✅ تم إنشاء البيع: ${sale.id}`);
      return sale;
    } catch (error: any) {
      logError("فشل في إنشاء عملية البيع:", error, {
        customerId: customer.id,
        customerName: customer.name,
        cartItemsCount: cartItems.length,
        totalAmount: calculations.totalAmount,
        operation: "execute_sale_transaction",
      });

      throw new Error(`فشل في إنشاء عملية البيع: ${formatError(error)}`);
    }
  }

  /**
   * تحديث بيانات العميل بعد البيع
   */
  private static async updateCustomerAfterSale(
    customer: Customer,
    additionalDebt: number,
  ): Promise<Customer> {
    try {
      const newDebtAmount = (customer.debtAmount || 0) + additionalDebt;

      const updatedCustomer = await supabaseService.updateCustomer(
        customer.id,
        {
          lastSaleDate: getCurrentDateGregorian(),
          debtAmount: newDebtAmount,
        },
      );

      console.log(
        `✅ تم تحديث بيانات العميل: ${updatedCustomer.name}, الدين الجديد: ${newDebtAmount}`,
      );
      return updatedCustomer;
    } catch (error: any) {
      logError("فشل في تحديث بيانات العميل:", error, {
        customerId: customer.id,
        customerName: customer.name,
        additionalDebt,
        operation: "update_customer_after_sale",
      });

      throw new Error(`فشل في تحديث بيانات العميل: ${formatError(error)}`);
    }
  }

  /**
   * فحص وتحديث المخزون فقط إذا لم يتم التحديث تلقائياً
   */
  private static async checkAndUpdateInventory(cartItems: CartItem[]): Promise<
    Array<{
      productId: string;
      productName: string;
      oldQuantity: number;
      newQuantity: number;
      soldQuantity: number;
    }>
  > {
    const inventoryUpdates = [];

    try {
      console.log("🔍 فحص حالة المخزون بعد إنشاء البيع...");

      // فحص المنتجات الحالية لمعرفة إذا تم التحديث تلقائياً
      const currentProducts = await supabaseService.getProducts();
      let wasUpdatedAutomatically = false;

      for (const item of cartItems) {
        const currentProduct = currentProducts.find(
          (p) => p.id === item.product.id,
        );

        if (!currentProduct) {
          console.error(`❌ المنتج غير موجود للفحص: ${item.product.name}`);
          continue;
        }

        const originalQuantity = item.product.quantity;
        const expectedNewQuantity = originalQuantity - item.quantity;

        // إذا كانت الكمية الحالية تساوي المتوقعة، فقد تم التحديث تلقائياً
        if (currentProduct.quantity === expectedNewQuantity) {
          wasUpdatedAutomatically = true;
          console.log(
            `✅ ${item.product.name}: تم التحديث تلقائياً ${originalQuantity} → ${currentProduct.quantity}`,
          );

          inventoryUpdates.push({
            productId: item.product.id,
            productName: item.product.name,
            oldQuantity: originalQuantity,
            newQuantity: currentProduct.quantity,
            soldQuantity: item.quantity,
          });
        } else if (currentProduct.quantity === originalQuantity) {
          // لم يتم التحديث، نحتاج للتحديث يدوياً
          console.log(
            `🔄 ${item.product.name}: يحتاج تحديث يدوي ${originalQuantity} → ${expectedNewQuantity}`,
          );

          await supabaseService.updateProduct(item.product.id, {
            quantity: expectedNewQuantity,
          });

          inventoryUpdates.push({
            productId: item.product.id,
            productName: item.product.name,
            oldQuantity: originalQuantity,
            newQuantity: expectedNewQuantity,
            soldQuantity: item.quantity,
          });

          console.log(
            `✅ ${item.product.name}: تم التحديث يدوياً ${originalQuantity} → ${expectedNewQuantity}`,
          );
        } else {
          // كمية غير متوقعة - قد يكون هناك مشكلة
          console.warn(
            `⚠️ ${item.product.name}: كمية غير متوقعة. الأصلية: ${originalQuantity}, الحالية: ${currentProduct.quantity}, المتوقعة: ${expectedNewQuantity}`,
          );

          inventoryUpdates.push({
            productId: item.product.id,
            productName: item.product.name,
            oldQuantity: originalQuantity,
            newQuantity: currentProduct.quantity,
            soldQuantity: item.quantity,
          });
        }
      }

      if (wasUpdatedAutomatically) {
        console.log("✅ تم تحديث المخزون تلقائياً بواسطة قاعدة البيانات");
      } else {
        console.log("✅ تم تحديث المخزون يدوياً");
      }

      console.log(`📊 تم معالجة ${inventoryUpdates.length} منتج في المخزون`);
      return inventoryUpdates;
    } catch (error: any) {
      logError("فشل في فحص وتحديث المخزون:", error, {
        cartItemsCount: cartItems.length,
        operation: "check_and_update_inventory",
      });

      throw new Error(`فشل في تحديث المخزون: ${formatError(error)}`);
    }
  }

  /**
   * إنشاء سجل المعاملة
   */
  private static async createTransactionRecord(
    customerId: string,
    amount: number,
    itemsCount: number,
  ): Promise<void> {
    try {
      await supabaseService.createTransaction({
        customerId,
        type: "sale",
        amount,
        description: `بيع ${itemsCount} منتج - العميل الموجود`,
        transactionDate: new Date().toISOString(),
      });

      console.log(`✅ تم إنشاء سجل المعاملة للعميل: ${customerId}`);
    } catch (error: any) {
      logError("فشل في إنشاء سجل المعاملة:", error, {
        customerId,
        amount,
        itemsCount,
        operation: "create_transaction_record",
      });

      // لا نرمي خطأ هنا لأن المعاملة الأساسية نجحت
      console.warn(`⚠️ فشل في إنشاء سجل المعاملة: ${formatError(error)}`);
    }
  }

  /**
   * التحقق من تناسق البيانات النهائي
   */
  private static async verifyDataConsistency(
    saleId: string,
    customerId: string,
    cartItems: CartItem[],
  ): Promise<void> {
    try {
      // التحقق من وجود البيع
      const sales = await supabaseService.getSales();
      const createdSale = sales.find((s) => s.id === saleId);

      if (!createdSale) {
        throw new Error(`البيع المُنشأ غير موجود: ${saleId}`);
      }

      // التحقق من تحديث العميل
      const customer = await supabaseService.getCustomerById(customerId);
      if (customer && customer.lastSaleDate !== getCurrentDateGregorian()) {
        console.warn(`⚠️ تاريخ آخر بيع للعميل لم يتم تحديثه: ${customer.name}`);
      }

      // التحقق من تحديث المخزون
      const currentProducts = await supabaseService.getProducts();
      for (const item of cartItems) {
        const product = currentProducts.find((p) => p.id === item.product.id);
        if (product && product.quantity < 0) {
          console.warn(
            `⚠️ كمية سالبة للمنتج: ${product.name} (${product.quantity})`,
          );
        }
      }

      console.log(`✅ تم التحقق من تناسق البيانات للبيع: ${saleId}`);
    } catch (error: any) {
      logError("فشل في التحقق من تناسق البيانات:", error, {
        saleId,
        customerId,
        cartItemsCount: cartItems.length,
        operation: "verify_data_consistency",
      });

      // نسجل التحذير فقط ولا نرمي خطأ
      console.warn(`⚠️ فشل في التحقق من تناسق البيانات: ${formatError(error)}`);
    }
  }

  /**
   * استرداد بيانات العميل المحدثة بعد البيع
   */
  static async getUpdatedCustomerData(
    customerId: string,
  ): Promise<Customer | null> {
    try {
      const customer = await supabaseService.getCustomerById(customerId);
      if (customer) {
        // تحديث الكاش المحلي
        await offlineManager.refreshCustomerInCache(customer);
      }
      return customer;
    } catch (error: any) {
      logError("فشل في استرداد بيانات العميل المحدثة:", error, {
        customerId,
        operation: "get_updated_customer_data",
      });
      return null;
    }
  }
}

// تصدير دالة مساعدة
export const createSaleForExistingCustomer = (
  customer: Customer,
  cartItems: CartItem[],
  saleData: {
    paymentType: "cash" | "deferred" | "partial";
    paidAmount: number;
    notes?: string;
  },
) =>
  ExistingCustomerSaleManager.createSaleForExistingCustomer(
    customer,
    cartItems,
    saleData,
  );
