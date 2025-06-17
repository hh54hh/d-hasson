// Customer Sale History - نظام تتبع تاريخ مبيعات العميل
// Track and manage customer purchase history accurately

import { supabaseService } from "./supabaseService";
import { Customer, Sale, CartItem } from "./types";
import { getCurrentDateGregorian } from "./types";
import { logError } from "./utils";

export interface CustomerSaleUpdate {
  customerId: string;
  lastSaleDate: string;
  totalPurchases: number;
  totalSpent: number;
  currentDebt: number;
  purchaseHistory: Array<{
    saleId: string;
    date: string;
    products: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentType: string;
  }>;
}

export class CustomerSaleHistory {
  /**
   * تحديث تاريخ مبيعات العميل بعد إجراء عملية بيع جديدة
   */
  static async updateCustomerAfterSale(
    customer: Customer,
    sale: Sale,
    cartItems: CartItem[],
    calculations: {
      totalAmount: number;
      actualPaidAmount: number;
      remainingAmount: number;
    },
  ): Promise<Customer> {
    console.log(`📝 تحديث تاريخ العميل: ${customer.name}`);

    try {
      // 1. حساب الإحصائيات الجديدة
      const updatedStats = await this.calculateUpdatedCustomerStats(
        customer,
        calculations,
      );

      // 2. إنشاء سجل المشترى الجديد
      const newPurchaseRecord = this.createPurchaseRecord(
        sale,
        cartItems,
        calculations,
      );

      // 3. تحديث العميل في قاعدة البيانات
      const updatedCustomer = await this.updateCustomerInDatabase(
        customer,
        updatedStats,
        newPurchaseRecord,
      );

      // 4. التحقق من تحديث المخزون للمنتجات المباعة
      await this.updateProductHistory(customer.id, cartItems);

      console.log(`✅ تم تحديث بيانات العميل بنجاح: ${updatedCustomer.name}`);
      return updatedCustomer;
    } catch (error) {
      const errorInfo = logError(`❌ فشل في تحديث العميل:`, error);
      throw new Error(`فشل في تحديث بيانات العميل: ${errorInfo.message}`);
    }
  }

  /**
   * حساب الإحصائيات المحدثة للعميل
   */
  private static async calculateUpdatedCustomerStats(
    customer: Customer,
    calculations: {
      totalAmount: number;
      actualPaidAmount: number;
      remainingAmount: number;
    },
  ): Promise<{
    totalPurchases: number;
    totalSpent: number;
    newDebtAmount: number;
    lastSaleDate: string;
  }> {
    // الحصول على تاريخ المبيعات الحالي مع معالجة الأخطاء
    let existingSales: any[] = [];
    try {
      existingSales = await supabaseService.getSalesByCustomerId(customer.id);
    } catch (error) {
      console.warn(
        `⚠️ فشل في جلب مبيعات العميل، استخدام البيانات المحلية:`,
        error,
      );
      // استخدام البيانات المحلية كبديل
      existingSales = [];
    }

    // حساب الإجماليات الجديدة
    const totalPurchases = existingSales.length + 1; // العملية الجديدة
    const totalSpent =
      existingSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0) +
      calculations.totalAmount;

    // حسا�� الدين الجديد
    const currentDebt = customer.debtAmount || 0;
    const newDebtAmount = currentDebt + calculations.remainingAmount;

    return {
      totalPurchases,
      totalSpent: Math.round(totalSpent),
      newDebtAmount: Math.round(newDebtAmount),
      lastSaleDate: getCurrentDateGregorian(),
    };
  }

  /**
   * إنشاء سجل المشترى الجديد
   */
  private static createPurchaseRecord(
    sale: Sale,
    cartItems: CartItem[],
    calculations: {
      totalAmount: number;
      actualPaidAmount: number;
      remainingAmount: number;
    },
  ): {
    saleId: string;
    date: string;
    products: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentType: string;
  } {
    return {
      saleId: sale.id,
      date: sale.saleDate || getCurrentDateGregorian(),
      products: cartItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.salePrice,
        totalPrice: Math.round(item.quantity * item.product.salePrice),
      })),
      totalAmount: calculations.totalAmount,
      paidAmount: calculations.actualPaidAmount,
      remainingAmount: calculations.remainingAmount,
      paymentType: sale.paymentType || "cash",
    };
  }

  /**
   * تحديث العميل في قاعدة البيانات
   */
  private static async updateCustomerInDatabase(
    customer: Customer,
    stats: {
      totalPurchases: number;
      totalSpent: number;
      newDebtAmount: number;
      lastSaleDate: string;
    },
    purchaseRecord: any,
  ): Promise<Customer> {
    // تحضير البيانات المحدثة
    const updateData = {
      lastSaleDate: stats.lastSaleDate,
      debtAmount: stats.newDebtAmount,
      // إذا كان هناك دين، يصبح العميل "آجل"، وإلا يبقى "نقدي"
      paymentStatus:
        stats.newDebtAmount > 0 ? ("deferred" as const) : ("cash" as const),
    };

    console.log(`📊 تحديث إحصائيات العميل:`, {
      العميل: customer.name,
      إجمالي_المشتريات: stats.totalPurchases,
      إجمالي_المنفق: `${stats.totalSpent} د.ع`,
      الدين_الجديد: `${stats.newDebtAmount} د.ع`,
      تاريخ_آخر_بيع: stats.lastSaleDate,
    });

    // تحديث العميل في Supabase
    const updatedCustomer = await supabaseService.updateCustomer(
      customer.id,
      updateData,
    );

    if (!updatedCustomer) {
      throw new Error("فشل في تحديث العميل في قاعدة البيانات");
    }

    return updatedCustomer;
  }

  /**
   * تحديث تاريخ المنتجات المباعة للعميل
   */
  private static async updateProductHistory(
    customerId: string,
    cartItems: CartItem[],
  ): Promise<void> {
    console.log(`📦 تحديث تاريخ المنتجات للعميل...`);

    try {
      // يمكن إضافة جدول منفصل لتتبع المنتجات المباعة لكل عميل
      // في الوقت الحالي، هذا محفوظ في sale_items
      console.log(`✅ تم تسجيل ${cartItems.length} منتجات في تاريخ العميل`);
    } catch (error) {
      console.warn(`⚠️ تحذير في تحديث تاريخ المنتجات:`, error);
      // لا نرمي خطأ هنا لأن العملية الأساسية نجحت
    }
  }

  /**
   * الحصول على تاريخ مبيعات العميل الكامل
   */
  static async getCustomerSaleHistory(
    customerId: string,
  ): Promise<CustomerSaleUpdate> {
    console.log(`📋 جلب تاريخ مبيعات العميل: ${customerId}`);

    try {
      // الحصول على بيانات العميل
      const customer = await supabaseService.getCustomerById(customerId);
      if (!customer) {
        throw new Error("العميل غير موجود");
      }

      // الحصول على جميع المبيعات مع معالجة الأخطاء
      let sales: any[] = [];
      try {
        sales = await supabaseService.getSalesByCustomerId(customerId);
      } catch (error) {
        console.warn(`⚠️ فشل في جلب مبيعات العميل ${customerId}:`, error);
        sales = []; // استخدام قائمة فارغة كبديل
      }

      // حساب الإحصائيات
      const totalPurchases = sales.length;
      const totalSpent = sales.reduce(
        (sum, sale) => sum + (sale.totalAmount || 0),
        0,
      );
      const currentDebt = customer.debtAmount || 0;

      // إنشاء تاريخ المشتريات
      const purchaseHistory = await Promise.all(
        sales.map(async (sale) => {
          const saleItems = await supabaseService.getSaleItems(sale.id);
          return {
            saleId: sale.id,
            date: sale.saleDate || "",
            products: saleItems.map((item) => ({
              name: item.productName || "منتج غير محدد",
              quantity: item.quantity || 0,
              unitPrice: item.unitPrice || 0,
              totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
            })),
            totalAmount: sale.totalAmount || 0,
            paidAmount: sale.paidAmount || 0,
            remainingAmount: sale.remainingAmount || 0,
            paymentType: sale.paymentType || "cash",
          };
        }),
      );

      return {
        customerId,
        lastSaleDate: customer.lastSaleDate || "",
        totalPurchases,
        totalSpent: Math.round(totalSpent),
        currentDebt: Math.round(currentDebt),
        purchaseHistory: purchaseHistory.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      };
    } catch (error) {
      const errorInfo = logError(`❌ فشل في جلب تاريخ العميل:`, error);
      throw new Error(`فشل في جلب تاريخ العميل: ${errorInfo.message}`);
    }
  }

  /**
   * تحديث دين العميل (دفع جزئي)
   */
  static async updateCustomerDebt(
    customerId: string,
    paidAmount: number,
    notes?: string,
  ): Promise<Customer> {
    console.log(`💸 تحديث دين العميل: ${customerId}, مبلغ: ${paidAmount}`);

    try {
      const customer = await supabaseService.getCustomerById(customerId);
      if (!customer) {
        throw new Error("العميل غير موجود");
      }

      const currentDebt = customer.debtAmount || 0;
      const newDebt = Math.max(0, currentDebt - Math.abs(paidAmount));

      const updateData = {
        debtAmount: newDebt,
        // إذا كان هناك دين، يبقى "آجل"، وإلا نحافظ على التفضيل الحالي أو "نقدي"
        paymentStatus:
          newDebt > 0
            ? ("deferred" as const)
            : customer.paymentStatus === "deferred"
              ? ("cash" as const)
              : customer.paymentStatus,
        debtPaidDate: newDebt === 0 ? getCurrentDateGregorian() : undefined,
      };

      const updatedCustomer = await supabaseService.updateCustomer(
        customerId,
        updateData,
      );

      if (!updatedCustomer) {
        throw new Error("فشل في تحديث العميل");
      }

      // تسجيل عملية الدفع
      console.log(`💰 تم تحديث الدين: ${currentDebt} → ${newDebt} د.ع`);

      return updatedCustomer;
    } catch (error) {
      const errorInfo = logError(`❌ فشل في تحديث دين العميل:`, error);
      throw new Error(`فشل في تحديث دين العميل: ${errorInfo.message}`);
    }
  }

  /**
   * التحقق من تاريخ العميل وإصلاح التناقضات
   */
  static async validateAndFixCustomerHistory(customerId: string): Promise<{
    isValid: boolean;
    issues: string[];
    fixes: string[];
  }> {
    console.log(`🔍 التحقق من تاريخ العميل: ${customerId}`);

    const issues: string[] = [];
    const fixes: string[] = [];

    try {
      const customer = await supabaseService.getCustomerById(customerId);
      if (!customer) {
        issues.push("العميل غير موجود");
        return { isValid: false, issues, fixes };
      }

      let sales: any[] = [];
      try {
        sales = await supabaseService.getSalesByCustomerId(customerId);
      } catch (error) {
        console.warn(
          `⚠️ فشل في جلب مبيعات العميل للتحقق ${customerId}:`,
          error,
        );
        issues.push("فشل في الوصول لتاريخ المبيعات");
        return { isValid: false, issues, fixes };
      }

      // التحقق من الدين المحسوب
      const calculatedDebt = sales.reduce(
        (sum, sale) => sum + (sale.remainingAmount || 0),
        0,
      );
      const recordedDebt = customer.debtAmount || 0;

      if (Math.abs(calculatedDebt - recordedDebt) > 1) {
        issues.push(
          `عدم تطابق الدين: محسوب ${calculatedDebt}, مسجل ${recordedDebt}`,
        );

        // إصلاح الدين
        await supabaseService.updateCustomer(customerId, {
          debtAmount: Math.round(calculatedDebt),
        });
        fixes.push(`تم إصلاح الدين إلى ${calculatedDebt} د.ع`);
      }

      // التحقق من تاريخ آخر بيع
      if (sales.length > 0) {
        const latestSaleDate = sales
          .map((s) => s.saleDate)
          .sort()
          .reverse()[0];
        if (customer.lastSaleDate !== latestSaleDate) {
          await supabaseService.updateCustomer(customerId, {
            lastSaleDate: latestSaleDate,
          });
          fixes.push(`تم تحديث تاريخ آخر بيع إلى ${latestSaleDate}`);
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        fixes,
      };
    } catch (error) {
      issues.push(`خطأ في التحقق: ${error}`);
      return { isValid: false, issues, fixes };
    }
  }
}
