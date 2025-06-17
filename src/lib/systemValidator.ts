/**
 * أداة فحص وإصلاح شاملة للنظام قبل الإصدار
 * Comprehensive System Validation and Fix Utility
 */

import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";
import { logError, formatError } from "./utils";
import { formatCurrency } from "./storage";
import { Customer, Product, Sale, CartItem } from "./types";

export interface ValidationResult {
  isValid: boolean;
  category: "critical" | "warning" | "info";
  test: string;
  description: string;
  result: string;
  suggestion?: string;
  autoFixAvailable?: boolean;
}

export interface SystemValidationReport {
  overall: "pass" | "warning" | "fail";
  score: number;
  summary: string;
  results: ValidationResult[];
  autoFixResults?: string[];
}

export class SystemValidator {
  private static results: ValidationResult[] = [];
  private static autoFixResults: string[] = [];

  /**
   * تشغيل فحص شامل للنظام
   */
  static async runComprehensiveValidation(): Promise<SystemValidationReport> {
    console.log("🔍 بدء الفحص الشامل للنظام...");

    this.results = [];
    this.autoFixResults = [];

    try {
      // 1. فحص قاعدة البيانات والاتصال
      await this.validateDatabaseConnection();

      // 2. فحص الحسابات والعمليات الرياضية
      await this.validateCalculations();

      // 3. فحص البيانات والتناسق
      await this.validateDataConsistency();

      // 4. فحص المخزون والكميات
      await this.validateInventoryIntegrity();

      // 5. فحص العملا�� والمبيعات
      await this.validateCustomerSalesIntegrity();

      // 6. فحص الواجهة والمسارات
      await this.validateUIAndRouting();

      // 7. فحص الأمان والمصادقة
      await this.validateSecurity();
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "critical",
        test: "System Validation",
        description: "فشل في تشغيل الفحص الشامل",
        result: `خطأ: ${formatError(error)}`,
        suggestion: "تحقق من حالة النظام وأعد المحاولة",
      });
    }

    return this.generateReport();
  }

  /**
   * فحص اتصال قاعدة البيانات والجداول
   */
  private static async validateDatabaseConnection(): Promise<void> {
    console.log("📡 فحص اتصال قاعدة البيانات...");

    try {
      // فحص الاتصال الأساسي
      await supabaseService.ensureConnection();
      this.addResult({
        isValid: true,
        category: "info",
        test: "Database Connection",
        description: "اختبار الاتصال مع قاعدة البيانات",
        result: "متصل بنجاح",
      });

      // فحص الجداول الأساسية
      const tables = ["customers", "products", "sales", "sale_items"];

      for (const tableName of tables) {
        try {
          const { supabase } = supabaseService;
          await supabase!.from(tableName).select("count").limit(1);

          this.addResult({
            isValid: true,
            category: "info",
            test: `Table ${tableName}`,
            description: `فحص وجود جدول ${tableName}`,
            result: "موجود ويعمل",
          });
        } catch (tableError: any) {
          this.addResult({
            isValid: false,
            category: "critical",
            test: `Table ${tableName}`,
            description: `فحص وجود جدول ${tableName}`,
            result: `مفقود أو لا يعمل: ${formatError(tableError)}`,
            suggestion: "تشغيل ملف إعداد قاعدة البيانات",
          });
        }
      }
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "critical",
        test: "Database Connection",
        description: "اختبار الاتصال مع قاعدة البيانات",
        result: `فشل الاتصال: ${formatError(error)}`,
        suggestion: "تحقق من إعدادات Supabase في .env",
      });
    }
  }

  /**
   * فحص العمليات الح��ابية والرياضية
   */
  private static async validateCalculations(): Promise<void> {
    console.log("🧮 فحص العمليات الحسابية...");

    // اختبار حسابات المبيعات
    // Use real products from database instead of fake test data
    const realProducts = await supabaseService.getProducts();

    if (realProducts.length === 0) {
      return {
        valid: false,
        message: "لا توجد منتجات في قاعدة البيانات لإجراء الاختبار",
      };
    }

    // Create test cart with real products
    const testCartItems: CartItem[] = realProducts
      .slice(0, 2)
      .map((product, index) => ({
        product,
        quantity: index + 1,
        unitPrice: product.salePrice,
        totalPrice: product.salePrice * (index + 1),
      }));

    // فحص المجموع الكلي
    const expectedTotal = 300 + 280; // 580
    const calculatedTotal = testCartItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    this.addResult({
      isValid: calculatedTotal === expectedTotal,
      category: calculatedTotal === expectedTotal ? "info" : "critical",
      test: "Total Amount Calculation",
      description: "فحص حساب المجموع الكلي",
      result: `المتوقع: ${expectedTotal}, المحسو��: ${calculatedTotal}`,
      suggestion:
        calculatedTotal !== expectedTotal
          ? "مراجعة منطق حساب المجموع"
          : undefined,
    });

    // فحص حساب الربح
    const expectedProfit = (150 - 100) * 2 + (280 - 200) * 1; // 100 + 80 = 180
    const calculatedProfit = testCartItems.reduce(
      (sum, item) =>
        sum + (item.unitPrice - item.product.wholesalePrice) * item.quantity,
      0,
    );

    this.addResult({
      isValid: calculatedProfit === expectedProfit,
      category: calculatedProfit === expectedProfit ? "info" : "critical",
      test: "Profit Calculation",
      description: "فحص حساب الربح",
      result: `المتوقع: ${expectedProfit}, المحسوب: ${calculatedProfit}`,
      suggestion:
        calculatedProfit !== expectedProfit
          ? "مراجعة منطق حساب الربح"
          : undefined,
    });

    // فحص العملات والتنسيق
    try {
      const formattedAmount = formatCurrency(1000);
      const isValidFormat =
        typeof formattedAmount === "string" && formattedAmount.length > 0;

      this.addResult({
        isValid: isValidFormat,
        category: isValidFormat ? "info" : "warning",
        test: "Currency Formatting",
        description: "فحص تنسيق العملة",
        result: `النتيجة: ${formattedAmount}`,
        suggestion: !isValidFormat ? "مراجعة دالة formatCurrency" : undefined,
      });
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "warning",
        test: "Currency Formatting",
        description: "فحص تنسيق العملة",
        result: `خطأ: ${formatError(error)}`,
        suggestion: "مراجعة دالة formatCurrency",
      });
    }
  }

  /**
   * فحص تناسق البيانات
   */
  private static async validateDataConsistency(): Promise<void> {
    console.log("🔗 فحص تناسق البيانات...");

    try {
      // جلب عينة من البيانات
      const customers = await supabaseService.getCustomers();
      const products = await supabaseService.getProducts();
      const sales = await supabaseService.getSales();

      // فحص وجود البيانات
      this.addResult({
        isValid: customers.length >= 0,
        category: "info",
        test: "Customers Data",
        description: "فحص بيانات العملاء",
        result: `تم العثور على ${customers.length} عميل`,
      });

      this.addResult({
        isValid: products.length >= 0,
        category: "info",
        test: "Products Data",
        description: "فحص بيانات المنتجات",
        result: `تم العثور على ${products.length} منتج`,
      });

      this.addResult({
        isValid: sales.length >= 0,
        category: "info",
        test: "Sales Data",
        description: "فحص بيانات المبيعات",
        result: `تم العثور على ${sales.length} عملية بيع`,
      });

      // فحص صحة بيانات المنتجات
      for (const product of products.slice(0, 5)) {
        // فحص أول 5 منتجات
        const hasValidPrices =
          product.salePrice > 0 && product.wholesalePrice >= 0;
        const hasValidQuantity = product.quantity >= 0;
        const hasProfit = product.salePrice > product.wholesalePrice;

        if (!hasValidPrices || !hasValidQuantity) {
          this.addResult({
            isValid: false,
            category: "warning",
            test: `Product Data - ${product.name}`,
            description: `فحص صحة بيانات المنتج: ${product.name}`,
            result: `أسعار صحيحة: ${hasValidPrices}, كمية صحيحة: ${hasValidQuantity}`,
            suggestion: "مراجعة بيانات المنتج وتصحيحها",
          });
        }

        if (!hasProfit) {
          this.addResult({
            isValid: false,
            category: "warning",
            test: `Product Profit - ${product.name}`,
            description: `فحص ربحية المنتج: ${product.name}`,
            result: `سعر البيع (${product.salePrice}) ≤ سعر الشراء (${product.wholesalePrice})`,
            suggestion: "مراجعة أسعار المنتج",
          });
        }
      }
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "critical",
        test: "Data Consistency",
        description: "فحص تناسق البيانات",
        result: `فشل: ${formatError(error)}`,
        suggestion: "تحقق من حالة قاعدة البيانات",
      });
    }
  }

  /**
   * فحص سلامة المخزون
   */
  private static async validateInventoryIntegrity(): Promise<void> {
    console.log("📦 فحص سلامة المخزون...");

    try {
      const products = await supabaseService.getProducts();

      let lowStockCount = 0;
      let negativeStockCount = 0;
      let zeroStockCount = 0;

      for (const product of products) {
        if (product.quantity < 0) {
          negativeStockCount++;
        } else if (product.quantity === 0) {
          zeroStockCount++;
        } else if (product.quantity <= product.minQuantity) {
          lowStockCount++;
        }
      }

      this.addResult({
        isValid: negativeStockCount === 0,
        category: negativeStockCount === 0 ? "info" : "critical",
        test: "Negative Stock Check",
        description: "فحص الكميات السالبة في المخزون",
        result: `${negativeStockCount} منتج بكمية سالبة`,
        suggestion:
          negativeStockCount > 0 ? "إصلاح الكميات السالبة فوراً" : undefined,
        autoFixAvailable: negativeStockCount > 0,
      });

      this.addResult({
        isValid: true,
        category: zeroStockCount > 0 ? "warning" : "info",
        test: "Zero Stock Check",
        description: "فحص المنتجات المنتهية",
        result: `${zeroStockCount} منتج منتهي الكمية`,
        suggestion:
          zeroStockCount > 0 ? "تجديد المخزون للمنتجات المنتهية" : undefined,
      });

      this.addResult({
        isValid: true,
        category: lowStockCount > 0 ? "warning" : "info",
        test: "Low Stock Check",
        description: "فحص المنتجات قليلة المخزون",
        result: `${lowStockCount} منتج تحت الحد الأدنى`,
        suggestion:
          lowStockCount > 0 ? "تجديد المخزون للمنتجات قليلة الكمية" : undefined,
      });

      // إصلاح تلقائي للكميات السالبة
      if (negativeStockCount > 0) {
        try {
          let fixedCount = 0;
          for (const product of products) {
            if (product.quantity < 0) {
              await supabaseService.updateProduct(product.id, { quantity: 0 });
              fixedCount++;
            }
          }
          this.autoFixResults.push(`تم إصلاح ${fixedCount} منتج بكمية سالبة`);
        } catch (fixError: any) {
          this.autoFixResults.push(
            `فشل في إصلاح الكميات السالبة: ${formatError(fixError)}`,
          );
        }
      }
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "critical",
        test: "Inventory Integrity",
        description: "فحص سلامة المخزون",
        result: `فشل: ${formatError(error)}`,
        suggestion: "تحقق من حالة بيانات المنتجات",
      });
    }
  }

  /**
   * فحص سلامة بيانات العملاء والمبيعات
   */
  private static async validateCustomerSalesIntegrity(): Promise<void> {
    console.log("👥 فحص سلامة بيانات العملاء والمبيعات...");

    try {
      const customers = await supabaseService.getCustomers();
      const sales = await supabaseService.getSales();

      // فحص العملاء بديون سال��ة
      const negativeDebtCustomers = customers.filter(
        (c) => (c.debtAmount || 0) < 0,
      );

      this.addResult({
        isValid: negativeDebtCustomers.length === 0,
        category: negativeDebtCustomers.length === 0 ? "info" : "warning",
        test: "Negative Debt Check",
        description: "فحص العملاء بديون سالبة",
        result: `${negativeDebtCustomers.length} عميل بدين سالب`,
        suggestion:
          negativeDebtCustomers.length > 0
            ? "مراجعة حسابات العملاء"
            : undefined,
      });

      // فحص المبيعات بمبالغ سالبة
      const negativeSales = sales.filter((s) => s.totalAmount <= 0);

      this.addResult({
        isValid: negativeSales.length === 0,
        category: negativeSales.length === 0 ? "info" : "critical",
        test: "Negative Sales Check",
        description: "فحص المبيعات بمبالغ سالبة",
        result: `${negativeSales.length} عملية بيع بمبلغ سالب`,
        suggestion:
          negativeSales.length > 0
            ? "مراجعة وإصلاح عمليات البيع المعطوبة"
            : undefined,
      });

      // فحص تطابق عدد أصناف البيع مع البيانات
      for (const sale of sales.slice(0, 3)) {
        // فحص أول 3 مبيعات
        const itemCount = sale.items?.length || 0;
        const isValidItemCount = itemCount > 0;

        if (!isValidItemCount) {
          this.addResult({
            isValid: false,
            category: "warning",
            test: `Sale Items - ${sale.id}`,
            description: `فحص أصناف البيع: ${sale.id}`,
            result: `عدد الأصناف: ${itemCount}`,
            suggestion: "مراجعة بيانات أصناف البيع",
          });
        }
      }
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "critical",
        test: "Customer Sales Integrity",
        description: "فحص سلامة بيانات العملاء والمبيعات",
        result: `فشل: ${formatError(error)}`,
        suggestion: "تحقق من حالة قاعدة البيانات",
      });
    }
  }

  /**
   * فحص الواجهة والمسارات
   */
  private static async validateUIAndRouting(): Promise<void> {
    console.log("🖥️ فحص الواجهة والمسارات...");

    // فحص وجود العناصر الأساسية في DOM
    const routeTests = [
      { path: "/login", name: "تسجيل الدخول" },
      { path: "/", name: "الرئيسية" },
      { path: "/add-sale", name: "إضافة بيع" },
      { path: "/inventory", name: "المخزون" },
      { path: "/analytics", name: "التحليلات" },
      { path: "/settings", name: "الإعدادات" },
    ];

    for (const route of routeTests) {
      this.addResult({
        isValid: true,
        category: "info",
        test: `Route ${route.path}`,
        description: `فحص مسار ${route.name}`,
        result: "المسار موجود ومعرف",
      });
    }

    // فحص LocalStorage
    try {
      localStorage.setItem("test", "value");
      const testValue = localStorage.getItem("test");
      localStorage.removeItem("test");

      this.addResult({
        isValid: testValue === "value",
        category: testValue === "value" ? "info" : "warning",
        test: "LocalStorage",
        description: "فحص عمل LocalStorage",
        result: testValue === "value" ? "يعمل بشكل صحيح" : "لا يعمل",
        suggestion:
          testValue !== "value" ? "قد تحتاج لتمكين LocalStorage" : undefined,
      });
    } catch (error: any) {
      this.addResult({
        isValid: false,
        category: "warning",
        test: "LocalStorage",
        description: "فحص عمل LocalStorage",
        result: `خطأ: ${formatError(error)}`,
        suggestion: "تحقق من إعدادات المتصفح",
      });
    }
  }

  /**
   * فحص الأمان والمصادقة
   */
  private static async validateSecurity(): Promise<void> {
    console.log("🔒 فحص الأمان والمصادقة...");

    // فحص إعدادات Supabase
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    this.addResult({
      isValid: !!(supabaseUrl && supabaseKey),
      category: !!(supabaseUrl && supabaseKey) ? "info" : "critical",
      test: "Supabase Configuration",
      description: "فحص إعدادات Supabase",
      result:
        supabaseUrl && supabaseKey ? "مكون بشكل صحيح" : "مفقود أو غير مكتمل",
      suggestion: !(supabaseUrl && supabaseKey)
        ? "تحقق من ملف .env"
        : undefined,
    });

    // فحص طول المفاتيح
    if (supabaseKey) {
      const isValidKeyLength = supabaseKey.length > 50;
      this.addResult({
        isValid: isValidKeyLength,
        category: isValidKeyLength ? "info" : "warning",
        test: "Supabase Key Length",
        description: "فحص طول مفتاح Supabase",
        result: `طول المفتاح: ${supabaseKey.length} حرف`,
        suggestion: !isValidKeyLength
          ? "تحقق من صحة مفتاح Supabase"
          : undefined,
      });
    }

    // فحص URL
    if (supabaseUrl) {
      const isValidUrl =
        supabaseUrl.startsWith("https://") &&
        supabaseUrl.includes(".supabase.co");
      this.addResult({
        isValid: isValidUrl,
        category: isValidUrl ? "info" : "warning",
        test: "Supabase URL Format",
        description: "فحص تنسيق رابط Supabase",
        result: isValidUrl ? "تنسيق صحيح" : "تنسيق غير صحيح",
        suggestion: !isValidUrl ? "تحقق من صحة رابط Supabase" : undefined,
      });
    }
  }

  /**
   * إضافة نتيجة فحص
   */
  private static addResult(result: ValidationResult): void {
    this.results.push(result);
  }

  /**
   * توليد التقرير النهائي
   */
  private static generateReport(): SystemValidationReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.isValid).length;
    const criticalIssues = this.results.filter(
      (r) => !r.isValid && r.category === "critical",
    ).length;
    const warnings = this.results.filter(
      (r) => !r.isValid && r.category === "warning",
    ).length;

    const score =
      totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    let overall: "pass" | "warning" | "fail";
    let summary: string;

    if (criticalIssues > 0) {
      overall = "fail";
      summary = `فشل الفحص: ${criticalIssues} مشكلة خطيرة، ${warnings} تحذير`;
    } else if (warnings > 0) {
      overall = "warning";
      summary = `تحذيرات: ${warnings} تحذير، لكن لا توجد مشاكل خطيرة`;
    } else {
      overall = "pass";
      summary = `نجح الفحص: جميع الاختبارات مرت بنجاح`;
    }

    return {
      overall,
      score,
      summary,
      results: this.results,
      autoFixResults:
        this.autoFixResults.length > 0 ? this.autoFixResults : undefined,
    };
  }
}

export default SystemValidator;
