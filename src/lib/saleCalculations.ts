// Sale Calculations - نظام الحسابات الدقيق للمبيعات
// Precise calculation system for sales with high accuracy

import { CartItem } from "./types";

export interface SaleCalculations {
  itemsTotal: number; // إجمالي المنتجات
  totalAmount: number; // الإجمالي النهائي
  totalProfit: number; // إجمالي الربح
  actualPaidAmount: number; // المبلغ المدفوع الفعلي
  remainingAmount: number; // المبلغ المتبقي
  profitMargin: number; // هامش الربح النسبي
  itemBreakdown: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unitCost: number;
    totalCost: number;
    profit: number;
    profitMargin: number;
  }>;
}

export class SaleCalculations {
  /**
   * حساب إجماليات البيع بدقة عالية
   * Calculate sale totals with high precision
   */
  static calculateSaleTotals(
    cartItems: CartItem[],
    paymentData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
    },
  ): SaleCalculations {
    console.log("🧮 بدء حسابات البيع الدقيقة...");

    // التحقق من صحة البيانات
    if (!cartItems || cartItems.length === 0) {
      throw new Error("لا توجد منتجات في السلة للحساب");
    }

    // حساب تفاصيل كل منتج
    const itemBreakdown = cartItems.map((item) => {
      const quantity = Math.abs(item.quantity || 0); // ضمان القيم الموجبة
      const unitPrice = Math.abs(item.product.salePrice || 0);
      const unitCost = Math.abs(item.product.wholesalePrice || 0);

      const totalPrice = this.roundCurrency(quantity * unitPrice);
      const totalCost = this.roundCurrency(quantity * unitCost);
      const profit = this.roundCurrency(totalPrice - totalCost);
      const profitMargin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;

      return {
        productId: item.product.id,
        productName: item.product.name,
        quantity,
        unitPrice,
        totalPrice,
        unitCost,
        totalCost,
        profit,
        profitMargin: this.roundPercentage(profitMargin),
      };
    });

    // حساب الإجماليات
    const itemsTotal = this.roundCurrency(
      itemBreakdown.reduce((sum, item) => sum + item.totalPrice, 0),
    );

    const totalAmount = itemsTotal; // يمكن إضافة ضرائب أو خصومات هنا

    const totalProfit = this.roundCurrency(
      itemBreakdown.reduce((sum, item) => sum + item.profit, 0),
    );

    const profitMargin =
      totalAmount > 0
        ? this.roundPercentage((totalProfit / totalAmount) * 100)
        : 0;

    // حساب المبالغ حسب نوع الدفع
    const paymentCalculations = this.calculatePaymentAmounts(
      totalAmount,
      paymentData,
    );

    const result: SaleCalculations = {
      itemsTotal,
      totalAmount,
      totalProfit,
      actualPaidAmount: paymentCalculations.actualPaidAmount,
      remainingAmount: paymentCalculations.remainingAmount,
      profitMargin,
      itemBreakdown,
    };

    console.log("📊 نتائج الحسابات:", {
      إجمالي_المنتجات: `${itemsTotal} د.ع`,
      الإجمالي_النهائي: `${totalAmount} د.ع`,
      إجمالي_الربح: `${totalProfit} د.ع`,
      المدفوع: `${result.actualPaidAmount} د.ع`,
      المتبقي: `${result.remainingAmount} د.ع`,
      هامش_الربح: `${profitMargin}%`,
    });

    return result;
  }

  /**
   * حساب مبالغ الدفع حسب النوع
   */
  private static calculatePaymentAmounts(
    totalAmount: number,
    paymentData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
    },
  ): {
    actualPaidAmount: number;
    remainingAmount: number;
  } {
    let actualPaidAmount = 0;
    let remainingAmount = 0;

    switch (paymentData.paymentType) {
      case "cash":
        // دفع نقدي - المبلغ المدفوع = الإجمالي
        actualPaidAmount = totalAmount;
        remainingAmount = 0;
        break;

      case "deferred":
        // دفع آجل - لا يوجد مبلغ مدفوع الآن
        actualPaidAmount = 0;
        remainingAmount = totalAmount;
        break;

      case "partial":
        // دفع جزئي - التحقق من صحة المبلغ
        const requestedPaidAmount = Math.abs(paymentData.paidAmount || 0);

        if (requestedPaidAmount > totalAmount) {
          // المبلغ المدفوع أكبر من الإجمالي - دفع نقدي كامل
          actualPaidAmount = totalAmount;
          remainingAmount = 0;
        } else {
          actualPaidAmount = requestedPaidAmount;
          remainingAmount = this.roundCurrency(totalAmount - actualPaidAmount);
        }
        break;

      default:
        throw new Error(`نوع دفع غير صحيح: ${paymentData.paymentType}`);
    }

    return {
      actualPaidAmount: this.roundCurrency(actualPaidAmount),
      remainingAmount: this.roundCurrency(remainingAmount),
    };
  }

  /**
   * تقريب العملة لأقرب وحدة (دينار عراقي)
   */
  private static roundCurrency(amount: number): number {
    // تقريب لأقرب دينار (لا كسور)
    return Math.round(Math.abs(amount));
  }

  /**
   * تقريب النسبة المئوية
   */
  private static roundPercentage(percentage: number): number {
    return Math.round(percentage * 100) / 100; // تقريب لمنزلتين عشريتين
  }

  /**
   * التحقق من صحة حسابات البيع
   */
  static validateCalculations(calculations: SaleCalculations): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // التحقق من الإجماليات
    if (calculations.totalAmount <= 0) {
      errors.push("الإجما��ي النهائي يجب أن يكون أكبر من صفر");
    }

    if (calculations.totalProfit < 0) {
      warnings.push("هامش الربح سالب - قد تكون هناك خسارة");
    }

    // التحقق من المبالغ
    if (calculations.actualPaidAmount < 0) {
      errors.push("المبلغ المدفوع لا يمكن أن يكون سالباً");
    }

    if (calculations.remainingAmount < 0) {
      errors.push("المبلغ المتبقي لا يمكن أن يكون سالباً");
    }

    // التحقق من التطابق
    const calculatedTotal =
      calculations.actualPaidAmount + calculations.remainingAmount;
    if (Math.abs(calculatedTotal - calculations.totalAmount) > 1) {
      errors.push(
        `عدم تطابق في الحسابات: ${calculatedTotal} ≠ ${calculations.totalAmount}`,
      );
    }

    // التحقق من تفاصيل المنتجات
    for (const item of calculations.itemBreakdown) {
      if (item.quantity <= 0) {
        errors.push(`كمية غير صحيحة للمنتج: ${item.productName}`);
      }

      if (item.unitPrice <= 0) {
        errors.push(`سعر غير صحيح للمنتج: ${item.productName}`);
      }

      if (item.totalPrice !== item.quantity * item.unitPrice) {
        errors.push(`خطأ في حساب إجمالي المنتج: ${item.productName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * تنسيق عرض الحسابات
   */
  static formatCalculationsDisplay(calculations: SaleCalculations): {
    summary: string;
    details: string[];
    warnings: string[];
  } {
    const validation = this.validateCalculations(calculations);

    const summary = [
      `💰 الإجمالي: ${calculations.totalAmount.toLocaleString()} د.ع`,
      `💸 المدفوع: ${calculations.actualPaidAmount.toLocaleString()} د.ع`,
      `⏳ المتبقي: ${calculations.remainingAmount.toLocaleString()} د.ع`,
      `📈 الربح: ${calculations.totalProfit.toLocaleString()} د.ع (${calculations.profitMargin}%)`,
    ].join(" | ");

    const details = calculations.itemBreakdown.map(
      (item) =>
        `${item.productName}: ${item.quantity} × ${item.unitPrice.toLocaleString()} = ${item.totalPrice.toLocaleString()} د.ع`,
    );

    return {
      summary,
      details,
      warnings: validation.warnings,
    };
  }

  /**
   * مقارنة حسابات قديمة وجديدة للتحقق من التغييرات
   */
  static compareCalculations(
    oldCalc: SaleCalculations,
    newCalc: SaleCalculations,
  ): {
    hasChanges: boolean;
    changes: string[];
  } {
    const changes: string[] = [];

    if (oldCalc.totalAmount !== newCalc.totalAmount) {
      changes.push(`الإجمالي: ${oldCalc.totalAmount} → ${newCalc.totalAmount}`);
    }

    if (oldCalc.actualPaidAmount !== newCalc.actualPaidAmount) {
      changes.push(
        `المدفوع: ${oldCalc.actualPaidAmount} → ${newCalc.actualPaidAmount}`,
      );
    }

    if (oldCalc.remainingAmount !== newCalc.remainingAmount) {
      changes.push(
        `المتبقي: ${oldCalc.remainingAmount} → ${newCalc.remainingAmount}`,
      );
    }

    if (oldCalc.totalProfit !== newCalc.totalProfit) {
      changes.push(`الربح: ${oldCalc.totalProfit} → ${newCalc.totalProfit}`);
    }

    return {
      hasChanges: changes.length > 0,
      changes,
    };
  }
}
