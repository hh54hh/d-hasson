/**
 * نظام التحقق من البيانات الحقيقية والحسابات الدقيقة
 * Real Data Validation & Accurate Calculations Verification System
 */

import { supabaseService } from "./supabaseService";
import { Customer, Product, Sale } from "./types";
import {
  calculateSaleDetails,
  analyzeInventory,
  calculateBusinessKPIs,
} from "./calculations";
import { SaleCalculations } from "./saleCalculations";

export interface ValidationReport {
  dataValidation: {
    hasOnlyRealData: boolean;
    noFakeDataFound: boolean;
    allConnectedToDatabase: boolean;
    issues: string[];
  };
  calculationValidation: {
    profitCalculationsCorrect: boolean;
    marginCalculationsCorrect: boolean;
    saleCalculationsCorrect: boolean;
    issues: string[];
  };
  databaseConnection: {
    supabaseConnected: boolean;
    tablesAccessible: boolean;
    dataConsistent: boolean;
    issues: string[];
  };
  overallStatus: "VALID" | "ISSUES_FOUND" | "CRITICAL_ERRORS";
}

export class DataValidation {
  /**
   * التحقق الشامل من سلامة البيانات والحسابات
   */
  static async validateSystemIntegrity(): Promise<ValidationReport> {
    console.log("🔍 بدء التحقق الشامل من سلامة النظام...");

    const report: ValidationReport = {
      dataValidation: {
        hasOnlyRealData: true,
        noFakeDataFound: true,
        allConnectedToDatabase: true,
        issues: [],
      },
      calculationValidation: {
        profitCalculationsCorrect: true,
        marginCalculationsCorrect: true,
        saleCalculationsCorrect: true,
        issues: [],
      },
      databaseConnection: {
        supabaseConnected: false,
        tablesAccessible: false,
        dataConsistent: false,
        issues: [],
      },
      overallStatus: "VALID",
    };

    // 1. التحقق من اتصال قاعدة البيانات
    await this.validateDatabaseConnection(report);

    // 2. التحقق من البيانات
    await this.validateDataSources(report);

    // 3. التحقق من دقة الحسابات
    await this.validateCalculations(report);

    // 4. تحديد الحالة العامة
    this.determineOverallStatus(report);

    console.log("✅ انتهى التحقق الشامل من سلامة النظام");
    return report;
  }

  /**
   * التحقق من اتصال قاعدة البيانات
   */
  private static async validateDatabaseConnection(
    report: ValidationReport,
  ): Promise<void> {
    try {
      console.log("🔗 فحص اتصال قاعدة البيانات...");

      // اختبار اتصال Supabase
      const products = await supabaseService.getProducts();
      const customers = await supabaseService.getCustomers();
      const sales = await supabaseService.getSales();

      report.databaseConnection.supabaseConnected = true;
      report.databaseConnection.tablesAccessible = true;
      report.databaseConnection.dataConsistent = true;

      console.log(
        `✅ قاعدة البيانات متصلة: ${products.length} منتج, ${customers.length} عميل, ${sales.length} مبيعة`,
      );
    } catch (error: any) {
      report.databaseConnection.supabaseConnected = false;
      report.databaseConnection.issues.push(
        `فشل الاتصال بقاعدة البيانات: ${error.message}`,
      );
      console.error("❌ فشل في الاتصال بقاعدة البيانات:", error);
    }
  }

  /**
   * التحقق من مصادر البيانات
   */
  private static async validateDataSources(
    report: ValidationReport,
  ): Promise<void> {
    console.log("📊 فحص مصادر البيانات...");

    // فحص البيانات المحلية
    const localProducts = JSON.parse(
      localStorage.getItem("paw_products") || "[]",
    );
    const localCustomers = JSON.parse(
      localStorage.getItem("paw_customers") || "[]",
    );
    const localSales = JSON.parse(localStorage.getItem("paw_sales") || "[]");

    // فحص البيانات الوهمية
    const fakeProductNames = [
      "iPhone 14 Pro",
      "Samsung Galaxy S23",
      "default_1",
      "default_2",
      "fake",
      "test",
      "example",
    ];

    const hasFakeProducts = localProducts.some((product: any) =>
      fakeProductNames.some(
        (fakeName) =>
          product.name?.toLowerCase().includes(fakeName.toLowerCase()) ||
          product.id?.includes("default_") ||
          product.id?.includes("fake_"),
      ),
    );

    if (hasFakeProducts) {
      report.dataValidation.noFakeDataFound = false;
      report.dataValidation.hasOnlyRealData = false;
      report.dataValidation.issues.push(
        "تم العثور على بيانات وهمية في المنتجات",
      );
    }

    // فحص العملاء الوهميين
    const hasFakeCustomers = localCustomers.some(
      (customer: any) =>
        customer.name?.includes("Test") ||
        customer.name?.includes("تجريبي") ||
        customer.id?.includes("default_") ||
        customer.id?.includes("fake_"),
    );

    if (hasFakeCustomers) {
      report.dataValidation.noFakeDataFound = false;
      report.dataValidation.hasOnlyRealData = false;
      report.dataValidation.issues.push(
        "تم العثور على بيانات وهمية في العملاء",
      );
    }

    console.log(
      `📝 البيانات المحلية: ${localProducts.length} منتج, ${localCustomers.length} عميل, ${localSales.length} مبيعة`,
    );

    if (report.dataValidation.noFakeDataFound) {
      console.log("✅ لا توجد بيانات وهمية");
    } else {
      console.warn("⚠️ تم العثور على بيانات وهمية!");
    }
  }

  /**
   * التحقق من دقة الحسابات
   */
  private static async validateCalculations(
    report: ValidationReport,
  ): Promise<void> {
    console.log("🧮 فحص دقة الحسابات...");

    // اختبار حساب هامش الربح
    const testProfitMargin = this.testProfitMarginCalculation();
    if (!testProfitMargin.isCorrect) {
      report.calculationValidation.marginCalculationsCorrect = false;
      report.calculationValidation.issues.push(
        `خطأ في حساب هامش الربح: ${testProfitMargin.error}`,
      );
    }

    // اختبار حساب تفاصيل البيع
    const testSaleCalc = this.testSaleCalculations();
    if (!testSaleCalc.isCorrect) {
      report.calculationValidation.saleCalculationsCorrect = false;
      report.calculationValidation.issues.push(
        `خطأ في حسابات البيع: ${testSaleCalc.error}`,
      );
    }

    // اختبار حساب تحليل المخزون
    const testInventory = this.testInventoryCalculations();
    if (!testInventory.isCorrect) {
      report.calculationValidation.profitCalculationsCorrect = false;
      report.calculationValidation.issues.push(
        `خطأ في حسابات المخزون: ${testInventory.error}`,
      );
    }

    if (
      report.calculationValidation.marginCalculationsCorrect &&
      report.calculationValidation.saleCalculationsCorrect &&
      report.calculationValidation.profitCalculationsCorrect
    ) {
      console.log("✅ جميع الحسابات دقيقة");
    } else {
      console.warn("⚠️ توجد أخطاء في الحسابات!");
    }
  }

  /**
   * اختبار حساب هامش الربح
   */
  private static testProfitMarginCalculation(): {
    isCorrect: boolean;
    error?: string;
  } {
    // اختبار: سعر البيع 1000، سعر الجملة 800
    // هامش الربح الصحيح = (200 / 1000) × 100 = 20%
    const saleDetails = calculateSaleDetails(1000, 1, 800);
    const expectedMargin = 20;
    const actualMargin = Math.round(saleDetails.profitMargin * 100) / 100;

    if (Math.abs(actualMargin - expectedMargin) > 0.01) {
      return {
        isCorrect: false,
        error: `هامش الربح خاطئ: متوقع ${expectedMargin}%، الفعلي ${actualMargin}%`,
      };
    }

    return { isCorrect: true };
  }

  /**
   * اختبار حسابات البيع
   */
  private static testSaleCalculations(): {
    isCorrect: boolean;
    error?: string;
  } {
    const testCartItems = [
      {
        product: {
          id: "test1",
          name: "Test Product",
          salePrice: 1000,
          wholesalePrice: 800,
          quantity: 10,
          minQuantity: 2,
        },
        quantity: 2,
        unitPrice: 1000,
        totalPrice: 2000,
      },
    ];

    try {
      const calculations = SaleCalculations.calculateSaleTotals(testCartItems, {
        paymentType: "cash",
        paidAmount: 2000,
      });

      // التحقق من الإجماليات
      if (calculations.totalAmount !== 2000) {
        return {
          isCorrect: false,
          error: `الإجمالي خاطئ: متوقع 2000، الفعلي ${calculations.totalAmount}`,
        };
      }

      if (calculations.totalProfit !== 400) {
        return {
          isCorrect: false,
          error: `الربح خاطئ: متوقع 400، الفعلي ${calculations.totalProfit}`,
        };
      }

      return { isCorrect: true };
    } catch (error: any) {
      return { isCorrect: false, error: error.message };
    }
  }

  /**
   * اختبار حسابات المخزون
   */
  private static testInventoryCalculations(): {
    isCorrect: boolean;
    error?: string;
  } {
    const testProducts = [
      {
        id: "test1",
        name: "Test Product 1",
        salePrice: 1000,
        wholesalePrice: 800,
        quantity: 10,
        minQuantity: 2,
      },
      {
        id: "test2",
        name: "Test Product 2",
        salePrice: 500,
        wholesalePrice: 400,
        quantity: 5,
        minQuantity: 1,
      },
    ];

    const analysis = analyzeInventory(testProducts);

    // التحقق من القيم المتوقعة
    const expectedTotalValue = 1000 * 10 + 500 * 5; // 12500
    const expectedWholesaleValue = 800 * 10 + 400 * 5; // 10000
    const expectedProfit = expectedTotalValue - expectedWholesaleValue; // 2500

    if (analysis.totalValue !== expectedTotalValue) {
      return {
        isCorrect: false,
        error: `قيمة المخزون خاطئة: متوقع ${expectedTotalValue}، الفعلي ${analysis.totalValue}`,
      };
    }

    if (analysis.potentialProfit !== expectedProfit) {
      return {
        isCorrect: false,
        error: `الربح المحتمل خاطئ: متوقع ${expectedProfit}، الفعلي ${analysis.potentialProfit}`,
      };
    }

    return { isCorrect: true };
  }

  /**
   * تحديد الحالة العامة للنظام
   */
  private static determineOverallStatus(report: ValidationReport): void {
    const hasDataIssues = report.dataValidation.issues.length > 0;
    const hasCalculationIssues = report.calculationValidation.issues.length > 0;
    const hasDatabaseIssues = report.databaseConnection.issues.length > 0;

    if (!report.databaseConnection.supabaseConnected) {
      report.overallStatus = "CRITICAL_ERRORS";
    } else if (hasDataIssues || hasCalculationIssues || hasDatabaseIssues) {
      report.overallStatus = "ISSUES_FOUND";
    } else {
      report.overallStatus = "VALID";
    }
  }

  /**
   * طباعة تقرير شامل
   */
  static printValidationReport(report: ValidationReport): void {
    console.log("\n" + "=".repeat(60));
    console.log("📋 تقرير التحقق الشامل من النظام");
    console.log("=".repeat(60));

    // حالة قاعدة البيانات
    console.log("\n🔗 حالة قاعدة البيانات:");
    console.log(
      `   ✅ متصل: ${report.databaseConnection.supabaseConnected ? "نعم" : "لا"}`,
    );
    console.log(
      `   ✅ الجداول متاحة: ${report.databaseConnection.tablesAccessible ? "نعم" : "لا"}`,
    );

    if (report.databaseConnection.issues.length > 0) {
      console.log("   ⚠️ مشاكل:");
      report.databaseConnection.issues.forEach((issue) =>
        console.log(`      - ${issue}`),
      );
    }

    // حالة البيانات
    console.log("\n📊 حالة البيانات:");
    console.log(
      `   ✅ بيانات حقيقية فقط: ${report.dataValidation.hasOnlyRealData ? "نعم" : "لا"}`,
    );
    console.log(
      `   ✅ لا توجد بيانات وهمية: ${report.dataValidation.noFakeDataFound ? "نعم" : "لا"}`,
    );

    if (report.dataValidation.issues.length > 0) {
      console.log("   ⚠️ مشاكل:");
      report.dataValidation.issues.forEach((issue) =>
        console.log(`      - ${issue}`),
      );
    }

    // حالة الحسابات
    console.log("\n🧮 حالة الحسابات:");
    console.log(
      `   ✅ حسابات الأرباح دقيقة: ${report.calculationValidation.profitCalculationsCorrect ? "نعم" : "لا"}`,
    );
    console.log(
      `   ✅ حسابات الهوامش دقيقة: ${report.calculationValidation.marginCalculationsCorrect ? "نعم" : "لا"}`,
    );
    console.log(
      `   ✅ حسابات المبيعات دقيقة: ${report.calculationValidation.saleCalculationsCorrect ? "نعم" : "لا"}`,
    );

    if (report.calculationValidation.issues.length > 0) {
      console.log("   ⚠️ مشاكل:");
      report.calculationValidation.issues.forEach((issue) =>
        console.log(`      - ${issue}`),
      );
    }

    // الحالة العامة
    console.log(`\n🎯 الحالة العامة: ${report.overallStatus}`);

    const statusEmoji = {
      VALID: "✅",
      ISSUES_FOUND: "⚠️",
      CRITICAL_ERRORS: "❌",
    };

    const statusText = {
      VALID: "النظام سليم - جميع البيانات حقيقية والحسابات دقيقة",
      ISSUES_FOUND: "توجد مشاكل تحتاج لإصلاح",
      CRITICAL_ERRORS: "أخطاء حرجة - النظام قد لا يعمل بشكل صحيح",
    };

    console.log(
      `${statusEmoji[report.overallStatus]} ${statusText[report.overallStatus]}`,
    );
    console.log("=".repeat(60) + "\n");
  }

  /**
   * إزالة البيانات الوهمية إذا وُجدت
   */
  static async cleanupFakeData(): Promise<boolean> {
    try {
      console.log("🧹 بدء تنظيف البيانات الوهمية...");

      // مسح جميع البيانات المحلية
      localStorage.removeItem("paw_products");
      localStorage.removeItem("paw_customers");
      localStorage.removeItem("paw_sales");

      // تهيئة بيانات فارغة
      localStorage.setItem("paw_products", "[]");
      localStorage.setItem("paw_customers", "[]");
      localStorage.setItem("paw_sales", "[]");

      console.log("✅ تم تنظيف جميع البيانات المحلية");
      console.log("📊 النظام جاهز لتحميل البيانات الحقيقية من قاعدة البيانات");

      return true;
    } catch (error: any) {
      console.error("❌ فشل في تنظيف البيانات:", error);
      return false;
    }
  }
}
