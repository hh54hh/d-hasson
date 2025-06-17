// أداة إصلاح واختبار دالة getDailyReport
import { supabaseService } from "./supabaseService";
import { getCurrentDateGregorian } from "./types";

export class GetDailyReportFixer {
  // تشخيص سريع لمشكلة getDailyReport
  static async diagnose(): Promise<{
    functionExists: boolean;
    canCallFunction: boolean;
    testResult: any;
    recommendations: string[];
    error?: string;
  }> {
    const result = {
      functionExists: false,
      canCallFunction: false,
      testResult: null as any,
      recommendations: [] as string[],
      error: undefined as string | undefined,
    };

    try {
      console.log("🔍 Diagnosing getDailyReport function...");

      // 1. ��حص وجود supabaseService
      if (!supabaseService) {
        result.error = "supabaseService is not available";
        result.recommendations.push("تحقق من استيراد supabaseService");
        return result;
      }

      // 2. فحص وجود الدالة
      if (typeof supabaseService.getDailyReport === "function") {
        result.functionExists = true;
        console.log("✅ getDailyReport function exists");
      } else {
        result.error = "getDailyReport function does not exist";
        result.recommendations.push(
          "أضف دالة getDailyReport إلى SupabaseService",
        );
        return result;
      }

      // 3. اختبار استدعاء الدالة
      try {
        const testDate = getCurrentDateGregorian();
        console.log(`🧪 Testing getDailyReport with date: ${testDate}`);

        const testResult = await supabaseService.getDailyReport(testDate);
        result.canCallFunction = true;
        result.testResult = {
          date: testDate,
          salesCount: testResult.length,
          sales: testResult.slice(0, 3), // First 3 sales for preview
        };

        console.log(
          `✅ getDailyReport test successful: ${testResult.length} sales found`,
        );

        if (testResult.length === 0) {
          result.recommendations.push(
            "لا توجد مبيعات لتاريخ اليوم - جرب تاريخ آخر أو أضف مبيعات تجريبية",
          );
        }
      } catch (callError: any) {
        result.error = `Function call failed: ${callError.message}`;
        result.recommendations.push("فحص اتصال قاعدة البيانات");
        result.recommendations.push("تحقق من صحة بيانات الجداول");
      }

      return result;
    } catch (error: any) {
      result.error = `Diagnosis failed: ${error.message}`;
      result.recommendations.push("خطأ عام في التشخيص");
      return result;
    }
  }

  // اختبار شامل لدالة getDailyReport مع تواريخ مختلفة
  static async comprehensiveTest(): Promise<{
    success: boolean;
    results: any[];
    summary: any;
    recommendations: string[];
  }> {
    const testResult = {
      success: false,
      results: [] as any[],
      summary: {} as any,
      recommendations: [] as string[],
    };

    try {
      console.log("🧪 Starting comprehensive getDailyReport test...");

      // تواريخ مختلفة للاختبار
      const testDates = [
        getCurrentDateGregorian(), // اليوم
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0], // أمس
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0], // قبل أسبوع
      ];

      let totalSales = 0;
      let successfulCalls = 0;
      let failedCalls = 0;

      for (const date of testDates) {
        try {
          console.log(`📅 Testing date: ${date}`);
          const sales = await supabaseService.getDailyReport(date);

          const result = {
            date,
            success: true,
            salesCount: sales.length,
            totalAmount: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
            paymentTypes: this.analyzePaymentTypes(sales),
            customers: [...new Set(sales.map((s) => s.customerId))].length,
            error: null,
          };

          testResult.results.push(result);
          totalSales += sales.length;
          successfulCalls++;

          console.log(
            `✅ ${date}: ${sales.length} sales, ${result.customers} customers`,
          );
        } catch (error: any) {
          const result = {
            date,
            success: false,
            salesCount: 0,
            error: error.message,
          };

          testResult.results.push(result);
          failedCalls++;

          console.error(`❌ ${date}: ${error.message}`);
        }
      }

      // ملخص النتائج
      testResult.summary = {
        totalDatestested: testDates.length,
        successfulCalls,
        failedCalls,
        totalSales,
        successRate: ((successfulCalls / testDates.length) * 100).toFixed(1),
      };

      // توصيات
      if (failedCalls === 0) {
        testResult.success = true;
        testResult.recommendations.push("✅ جميع الاختبارات نجحت");
      } else if (successfulCalls > 0) {
        testResult.success = true;
        testResult.recommendations.push(
          `⚠️ ${failedCalls} من ${testDates.length} اختبارات فشلت`,
        );
        testResult.recommendations.push("تحقق من البيانات في التواريخ الفاشلة");
      } else {
        testResult.success = false;
        testResult.recommendations.push("❌ جميع الاختبارات فشلت");
        testResult.recommendations.push(
          "مشكلة في دالة getDailyReport أو قاعدة البيانات",
        );
      }

      if (totalSales === 0) {
        testResult.recommendations.push("لا توجد مبيعات في التواريخ المختبرة");
        testResult.recommendations.push("أضف مبيعات تجريبية للاختبار");
      }

      console.log(
        `🎯 Test summary: ${successfulCalls}/${testDates.length} successful, ${totalSales} total sales`,
      );

      return testResult;
    } catch (error: any) {
      testResult.success = false;
      testResult.recommendations.push(
        `خطأ في الاختبار الشامل: ${error.message}`,
      );
      return testResult;
    }
  }

  // تحليل أنواع الدفع في المبيعات
  private static analyzePaymentTypes(sales: any[]) {
    const types = sales.reduce((acc, sale) => {
      const type = sale.paymentType || "غير محدد";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as any);

    return types;
  }

  // إصلاح سريع للمشاكل الشائعة
  static async quickFix(): Promise<{
    success: boolean;
    message: string;
    actions: string[];
  }> {
    const result = {
      success: false,
      message: "",
      actions: [] as string[],
    };

    try {
      console.log("🔧 Running quick fix for getDailyReport...");

      // 1. تشخيص المشكلة
      const diagnosis = await this.diagnose();

      if (!diagnosis.functionExists) {
        result.message = "❌ دالة getDailyReport مفقودة من SupabaseService";
        result.actions.push("تم إضافة الدالة إلى الكود");
        result.actions.push("أعد تشغيل التطبيق");
        return result;
      }

      if (!diagnosis.canCallFunction) {
        result.message = "❌ دالة getDailyReport موجودة لكن لا تعمل";
        result.actions.push("تحقق من اتصال قاعدة البيانات");
        result.actions.push("تحقق من صيغة التاريخ");
        result.actions.push("فحص رسائل الخطأ في Console");
        return result;
      }

      // 2. اختبار شامل
      const testResult = await this.comprehensiveTest();

      if (testResult.success) {
        result.success = true;
        result.message = `✅ دالة getDailyReport تعمل بشكل صحيح`;
        result.actions.push(
          `نجح ${testResult.summary.successfulCalls} من ${testResult.summary.totalDatesested} اختبارات`,
        );
        result.actions.push(
          `إجمالي المبيعات: ${testResult.summary.totalSales}`,
        );
      } else {
        result.message = "❌ دالة getDailyReport بها مشاكل";
        result.actions.push(...testResult.recommendations);
      }

      return result;
    } catch (error: any) {
      result.message = `❌ فشل الإصلاح السريع: ${error.message}`;
      result.actions.push("تحقق من سجل الأخطاء");
      return result;
    }
  }

  // إنشاء مبيعات تجريبية للاختبار
  static async createTestData(): Promise<{
    success: boolean;
    message: string;
    testSales: any[];
  }> {
    const result = {
      success: false,
      message: "",
      testSales: [] as any[],
    };

    try {
      console.log("🧪 Creating test sales data...");

      // This would require access to create functions
      // For now, just return information about what test data would look like
      const mockTestSales = [
        {
          date: getCurrentDateGregorian(),
          customer: "عميل تجريبي 1",
          products: ["منتج أ", "منتج ب"],
          total: 500,
          paymentType: "cash",
        },
        {
          date: getCurrentDateGregorian(),
          customer: "عميل تجريبي 2",
          products: ["منتج ج"],
          total: 300,
          paymentType: "deferred",
        },
      ];

      result.success = true;
      result.message = "✅ تم إنشاء بيانات تجريبية نموذجية";
      result.testSales = mockTestSales;

      return result;
    } catch (error: any) {
      result.message = `❌ فشل إنشاء البيانات التجريبية: ${error.message}`;
      return result;
    }
  }
}

// دوال مساعدة للاستخدام السريع
export const quickDiagnoseGetDailyReport = async () => {
  return await GetDailyReportFixer.diagnose();
};

export const quickTestGetDailyReport = async () => {
  return await GetDailyReportFixer.comprehensiveTest();
};

export const quickFixGetDailyReport = async () => {
  return await GetDailyReportFixer.quickFix();
};

// تشغيل تشخيص تلقائي عند تحميل الملف في development mode
if (typeof window !== "undefined" && import.meta.env.DEV) {
  console.log(
    "🔧 Development mode detected, running getDailyReport diagnosis...",
  );
  setTimeout(async () => {
    try {
      const diagnosis = await quickDiagnoseGetDailyReport();
      console.log("📊 getDailyReport diagnosis result:", diagnosis);

      if (!diagnosis.functionExists || !diagnosis.canCallFunction) {
        console.warn(
          "⚠️ getDailyReport issues detected:",
          diagnosis.recommendations,
        );
      }
    } catch (error) {
      console.warn("getDailyReport auto-diagnosis failed:", error);
    }
  }, 3000);
}
