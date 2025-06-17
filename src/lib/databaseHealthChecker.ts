import { supabaseService } from "./supabaseService";
import { logError, formatError } from "./utils";

/**
 * أداة فحص صحة قاعدة البيانات الشاملة
 * Comprehensive Database Health Checker
 */
export class DatabaseHealthChecker {
  /**
   * فحص شامل لصحة قاعدة البيانات
   */
  static async performComprehensiveCheck(): Promise<{
    success: boolean;
    overallHealth: "excellent" | "good" | "poor" | "critical";
    checks: {
      connection: {
        success: boolean;
        latency: number;
        error?: string;
      };
      tables: {
        customers: { exists: boolean; count: number; error?: string };
        products: { exists: boolean; count: number; error?: string };
        sales: { exists: boolean; count: number; error?: string };
        sale_items: { exists: boolean; count: number; error?: string };
        transactions: { exists: boolean; count: number; error?: string };
      };
      permissions: {
        canRead: boolean;
        canWrite: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        errors: string[];
      };
      relationships: {
        intact: boolean;
        issues: string[];
      };
    };
    summary: string;
    recommendations: string[];
  }> {
    console.log("🔍 بدء الفحص الشامل لصحة قاعدة البيانات...");

    const checks = {
      connection: { success: false, latency: 0 },
      tables: {
        customers: { exists: false, count: 0 },
        products: { exists: false, count: 0 },
        sales: { exists: false, count: 0 },
        sale_items: { exists: false, count: 0 },
        transactions: { exists: false, count: 0 },
      },
      permissions: {
        canRead: false,
        canWrite: false,
        canUpdate: false,
        canDelete: false,
        errors: [] as string[],
      },
      relationships: {
        intact: false,
        issues: [] as string[],
      },
    };

    const recommendations: string[] = [];

    try {
      // 1. فحص الاتصال
      console.log("📡 فحص الاتصال مع قاعدة البيانات...");
      const connectionResult = await this.testConnection();
      checks.connection = connectionResult;

      if (!connectionResult.success) {
        return {
          success: false,
          overallHealth: "critical",
          checks,
          summary: `فشل في الاتصال مع قاعدة البيانات: ${connectionResult.error}`,
          recommendations: ["تحقق من اتصال الإنترنت وإعدادات Supabase"],
        };
      }

      // 2. فحص الجداول
      console.log("🗃️ فحص الجداول...");
      await this.checkTables(checks.tables);

      // 3. فحص الصلاحيات
      console.log("🔐 فحص الصلاحيات...");
      await this.checkPermissions(checks.permissions);

      // 4. فحص العلاقات
      console.log("🔗 فحص العلاقات بين الجداول...");
      await this.checkRelationships(checks.relationships);

      // 5. تحليل النتائج وتحديد الصحة العامة
      const { overallHealth, summary } = this.analyzeResults(checks);

      // 6. إنشاء التوصيات
      this.generateRecommendations(checks, recommendations);

      console.log(
        `${overallHealth === "excellent" || overallHealth === "good" ? "✅" : "⚠️"} فحص قاعدة البيانات مكتمل: ${summary}`,
      );

      return {
        success: overallHealth !== "critical",
        overallHealth,
        checks,
        summary,
        recommendations,
      };
    } catch (error: any) {
      const errorMsg = formatError(error);
      logError("فشل في الفحص الشامل لقاعدة البيانات:", error, {
        operation: "comprehensive_database_check",
      });

      return {
        success: false,
        overallHealth: "critical",
        checks,
        summary: `فشل في الفحص الشامل: ${errorMsg}`,
        recommendations: ["تحقق من حالة الخدمة وأعد المحاولة"],
      };
    }
  }

  /**
   * اختبار الاتصال مع قاعدة البيانات
   */
  private static async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // اختبار بسيط للاتصال
      await supabaseService.ensureConnection();

      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
      };
    } catch (error: any) {
      return {
        success: false,
        latency: 0,
        error: formatError(error),
      };
    }
  }

  /**
   * فحص وجود الجداول وعدد السجلات
   */
  private static async checkTables(tables: any): Promise<void> {
    const tableNames = [
      "customers",
      "products",
      "sales",
      "sale_items",
      "transactions",
    ];

    for (const tableName of tableNames) {
      try {
        const { supabase } = supabaseService;
        const { data, error } = await supabase!
          .from(tableName)
          .select("count", { count: "exact" })
          .limit(0);

        if (error) {
          tables[tableName].exists = false;
          tables[tableName].error = formatError(error);
        } else {
          tables[tableName].exists = true;
          tables[tableName].count = data?.length || 0;
        }
      } catch (error: any) {
        tables[tableName].exists = false;
        tables[tableName].error = formatError(error);
      }
    }
  }

  /**
   * فحص صلاحيات العمليات
   */
  private static async checkPermissions(permissions: any): Promise<void> {
    try {
      // اختبار القراءة
      try {
        await supabaseService.getProducts();
        permissions.canRead = true;
      } catch (readError: any) {
        permissions.canRead = false;
        permissions.errors.push(`فشل في القراءة: ${formatError(readError)}`);
      }

      // اختبار الكتابة (محاولة إنشاء منتج تجريبي)
      try {
        const testProduct = await supabaseService.createProduct({
          name: `test_product_${Date.now()}`,
          wholesalePrice: 1,
          salePrice: 2,
          quantity: 1,
          minQuantity: 1,
        });

        permissions.canWrite = true;

        // اختبار التحديث
        try {
          await supabaseService.updateProduct(testProduct.id, {
            name: `updated_test_product_${Date.now()}`,
          });
          permissions.canUpdate = true;
        } catch (updateError: any) {
          permissions.canUpdate = false;
          permissions.errors.push(
            `فشل في التحديث: ${formatError(updateError)}`,
          );
        }

        // اختبار الحذف
        try {
          await supabaseService.deleteProduct(testProduct.id);
          permissions.canDelete = true;
        } catch (deleteError: any) {
          permissions.canDelete = false;
          permissions.errors.push(`فشل في الحذف: ${formatError(deleteError)}`);
        }
      } catch (writeError: any) {
        permissions.canWrite = false;
        permissions.canUpdate = false;
        permissions.canDelete = false;
        permissions.errors.push(`فشل في الكتابة: ${formatError(writeError)}`);
      }
    } catch (error: any) {
      permissions.errors.push(`فشل في فحص الصلاحيات: ${formatError(error)}`);
    }
  }

  /**
   * فحص العلاقات بين الجداول
   */
  private static async checkRelationships(relationships: any): Promise<void> {
    try {
      const { supabase } = supabaseService;

      // فحص العلاقة بين sales و customers
      try {
        const { error: salesCustomersError } = await supabase!
          .from("sales")
          .select("customer_id, customers(name)")
          .limit(1);

        if (salesCustomersError) {
          relationships.issues.push(
            `مشكلة في العلاقة بين sales و customers: ${formatError(salesCustomersError)}`,
          );
        }
      } catch (error: any) {
        relationships.issues.push(
          `فشل في فحص علاقة sales-customers: ${formatError(error)}`,
        );
      }

      // فحص العلاقة بين sale_items و sales
      try {
        const { error: saleItemsError } = await supabase!
          .from("sale_items")
          .select("sale_id, sales(id)")
          .limit(1);

        if (saleItemsError) {
          relationships.issues.push(
            `مشكلة في العلاقة بين sale_items و sales: ${formatError(saleItemsError)}`,
          );
        }
      } catch (error: any) {
        relationships.issues.push(
          `فشل في فحص علاقة sale_items-sales: ${formatError(error)}`,
        );
      }

      // فحص العلاقة بين sale_items و products
      try {
        const { error: saleItemsProductsError } = await supabase!
          .from("sale_items")
          .select("product_id, products(name)")
          .limit(1);

        if (saleItemsProductsError) {
          relationships.issues.push(
            `مشكلة في العلاقة بين sale_items و products: ${formatError(saleItemsProductsError)}`,
          );
        }
      } catch (error: any) {
        relationships.issues.push(
          `فشل في فحص علاقة sale_items-products: ${formatError(error)}`,
        );
      }

      relationships.intact = relationships.issues.length === 0;
    } catch (error: any) {
      relationships.issues.push(
        `فشل عام في فحص العلاقات: ${formatError(error)}`,
      );
      relationships.intact = false;
    }
  }

  /**
   * تحليل النتائج وتحديد الصحة العامة
   */
  private static analyzeResults(checks: any): {
    overallHealth: "excellent" | "good" | "poor" | "critical";
    summary: string;
  } {
    const issues = [];
    let score = 100;

    // تقييم الاتصال
    if (!checks.connection.success) {
      score -= 50;
      issues.push("فشل الاتصال");
    } else if (checks.connection.latency > 5000) {
      score -= 10;
      issues.push("بطء في الاتصال");
    }

    // تقييم الجداول
    const tablesCount = Object.keys(checks.tables).length;
    const existingTables = Object.values(checks.tables).filter(
      (table: any) => table.exists,
    ).length;

    if (existingTables < tablesCount) {
      const missingTables = tablesCount - existingTables;
      score -= missingTables * 15;
      issues.push(`${missingTables} جدول مفقود`);
    }

    // تقييم الصلاحيات
    if (!checks.permissions.canRead) {
      score -= 20;
      issues.push("لا يمكن القراءة");
    }
    if (!checks.permissions.canWrite) {
      score -= 15;
      issues.push("لا يمكن الكتابة");
    }
    if (!checks.permissions.canUpdate) {
      score -= 10;
      issues.push("لا يمكن التحديث");
    }

    // تقييم العلاقات
    if (!checks.relationships.intact) {
      score -= 20;
      issues.push("مشاكل في العلاقات");
    }

    let overallHealth: "excellent" | "good" | "poor" | "critical";
    let summary: string;

    if (score >= 90) {
      overallHealth = "excellent";
      summary = "قاعدة البيانات تعمل بشكل ممتاز";
    } else if (score >= 70) {
      overallHealth = "good";
      summary = `قاعدة البيانات تعمل بشكل جيد (${issues.length} مشكلة بسيطة)`;
    } else if (score >= 40) {
      overallHealth = "poor";
      summary = `قاعدة البيانات تحتاج تحسين (مشاكل: ${issues.join(", ")})`;
    } else {
      overallHealth = "critical";
      summary = `قاعدة البيانات في حالة حرجة (مشاكل: ${issues.join(", ")})`;
    }

    return { overallHealth, summary };
  }

  /**
   * إنشاء التوصيات بناءً على النتائج
   */
  private static generateRecommendations(
    checks: any,
    recommendations: string[],
  ): void {
    // توصيات للاتصال
    if (!checks.connection.success) {
      recommendations.push("🌐 تحقق من اتصال الإنترنت وإعدادات Supabase");
    } else if (checks.connection.latency > 5000) {
      recommendations.push("⚡ الاتصال بطيء - تحقق من جودة الشبكة");
    }

    // توصيات للجداول
    const missingTables = Object.entries(checks.tables)
      .filter(([name, table]: [string, any]) => !table.exists)
      .map(([name]) => name);

    if (missingTables.length > 0) {
      recommendations.push(
        `🗃️ إنشاء الجداول المفقودة: ${missingTables.join(", ")}`,
      );
      recommendations.push("📄 تشغيل ملف CRITICAL_DATABASE_FIX.sql");
    }

    // توصيات للصلاحيات
    if (checks.permissions.errors.length > 0) {
      recommendations.push("🔐 مراجعة صلاحيات المستخدم في Supabase");
      recommendations.push("🛡️ تحقق من Row Level Security policies");
    }

    // توصيات للعلاقات
    if (!checks.relationships.intact) {
      recommendations.push("🔗 إصلاح العلاقات بين الجداول");
      recommendations.push("🔧 تشغيل سكريبت إصلاح قاعدة البيانات");
    }

    // توصيات عامة
    if (recommendations.length === 0) {
      recommendations.push(
        "✅ قاعدة البيانات تعمل بشكل طبيعي - لا توجد إجراءات مطلوبة",
      );
    }
  }

  /**
   * فحص سريع لصحة قاعدة البيانات
   */
  static async quickHealthCheck(): Promise<{
    healthy: boolean;
    score: number;
    message: string;
    criticalIssues: string[];
  }> {
    try {
      console.log("⚡ فحص سريع لصحة قاعدة البيانات...");

      let score = 100;
      const criticalIssues: string[] = [];

      // فحص الاتصال
      try {
        await supabaseService.ensureConnection();
      } catch (connectionError: any) {
        score -= 50;
        criticalIssues.push("فشل الاتصال");
      }

      // فحص الجداول الأساسية
      const essentialTables = ["customers", "products", "sales"];
      for (const tableName of essentialTables) {
        try {
          const { supabase } = supabaseService;
          await supabase!.from(tableName).select("count").limit(0);
        } catch (tableError: any) {
          score -= 25;
          criticalIssues.push(`جدول ${tableName} مفقود`);
        }
      }

      const healthy = score >= 75;
      let message = "";

      if (score >= 90) {
        message = "ممتاز";
      } else if (score >= 75) {
        message = "جيد";
      } else if (score >= 50) {
        message = "يحتاج تحسين";
      } else {
        message = "حالة حرجة";
      }

      return {
        healthy,
        score,
        message,
        criticalIssues,
      };
    } catch (error: any) {
      logError("فشل في الفحص السريع:", error, {
        operation: "quick_health_check",
      });

      return {
        healthy: false,
        score: 0,
        message: "فشل في الفحص",
        criticalIssues: [formatError(error)],
      };
    }
  }
}

// دوال مساعدة للتصدير
export const checkDatabaseHealth = () =>
  DatabaseHealthChecker.performComprehensiveCheck();
export const quickDatabaseCheck = () =>
  DatabaseHealthChecker.quickHealthCheck();
