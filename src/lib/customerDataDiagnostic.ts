import { supabaseService } from "./supabaseService";
import { offlineManager } from "./offlineManager";
import { Customer } from "./types";
import { logError, formatError } from "./utils";

/**
 * أداة تشخيص مشاكل بيانات العملاء
 * Customer Data Diagnostic Tool
 */
export class CustomerDataDiagnostic {
  /**
   * تشخيص شامل لمشكلة التحقق من العملاء
   */
  static async diagnoseCustomerValidationIssue(customer: Customer): Promise<{
    success: boolean;
    issues: string[];
    solutions: string[];
    customerData: {
      originalCustomer: Customer;
      databaseCustomer: Customer | null;
      phoneSearchResult: Customer | null;
      offlineCustomer: Customer | null;
    };
    recommendations: string[];
  }> {
    console.log(`🔍 بدء تشخيص مشكلة العميل: ${customer.name}`);

    const issues: string[] = [];
    const solutions: string[] = [];
    const recommendations: string[] = [];

    try {
      // 1. اختبار الاتصال بقاعدة البيانات
      console.log("📡 فحص الاتصال بقاعدة البيانات...");
      let connectionOk = false;
      try {
        await supabaseService.ensureConnection();
        connectionOk = true;
        console.log("✅ الاتصال مع قاعدة البيانات يعمل");
      } catch (connectionError: any) {
        connectionOk = false;
        issues.push(`مشكلة في الاتصال: ${formatError(connectionError)}`);
        solutions.push("تحقق من اتصال الإنترنت وإعدادات Supabase");
      }

      // 2. البحث عن العميل بالـ ID
      console.log(`🔍 البحث عن العميل بالـ ID: ${customer.id}`);
      let databaseCustomer: Customer | null = null;
      if (connectionOk) {
        try {
          databaseCustomer = await supabaseService.getCustomerById(customer.id);
          if (databaseCustomer) {
            console.log(
              `✅ تم العثور على العميل بالـ ID: ${databaseCustomer.name}`,
            );
          } else {
            console.log(`❌ العميل غير موجود بالـ ID: ${customer.id}`);
            issues.push(
              `العميل غير موجود في قاعدة البيانات بالـ ID: ${customer.id}`,
            );
          }
        } catch (idError: any) {
          issues.push(`فشل في البحث بالـ ID: ${formatError(idError)}`);
          solutions.push("تحقق من صحة ID العميل وصلاحيات قاعدة البيانات");
        }
      }

      // 3. البحث عن العميل بالهاتف
      console.log(`📱 البحث عن العميل بالهاتف: ${customer.phone}`);
      let phoneSearchResult: Customer | null = null;
      if (connectionOk) {
        try {
          phoneSearchResult = await supabaseService.getCustomerByPhone(
            customer.phone,
          );
          if (phoneSearchResult) {
            console.log(
              `✅ تم العثور على العميل بالهاتف: ${phoneSearchResult.name} (${phoneSearchResult.id})`,
            );
            if (phoneSearchResult.id !== customer.id) {
              issues.push(
                `عدم تطابق ID: العميل موجود بهاتف ${customer.phone} لكن بـ ID مختلف`,
              );
              solutions.push(
                "استخدام البيانات المكتشفة بالهاتف بدلاً من ID القديم",
              );
            }
          } else {
            console.log(`❌ العميل غير موجود بالهاتف: ${customer.phone}`);
            issues.push(
              `العميل غير موجود في قاعدة البيانات بالهاتف: ${customer.phone}`,
            );
          }
        } catch (phoneError: any) {
          issues.push(`فشل في البحث بالهاتف: ${formatError(phoneError)}`);
          solutions.push("تحقق من صحة رقم الهاتف وجدول العملاء");
        }
      }

      // 4. البحث في الكاش المحلي
      console.log(`💾 البحث في الكاش المحلي...`);
      let offlineCustomer: Customer | null = null;
      try {
        const offlineCustomers = await offlineManager.getCustomers();
        offlineCustomer =
          offlineCustomers.find(
            (c: Customer) => c.id === customer.id || c.phone === customer.phone,
          ) || null;

        if (offlineCustomer) {
          console.log(
            `✅ تم العثور على العميل في الكاش المحلي: ${offlineCustomer.name}`,
          );
          if (!connectionOk) {
            solutions.push("استخدام بيانات الكاش المحلي في حالة عدم الاتصال");
          }
        } else {
          console.log(`❌ العميل غير موجود في الكاش المحلي`);
          if (!connectionOk) {
            issues.push("العميل غير موجود في الكاش المحلي ولا يوجد اتصال");
          }
        }
      } catch (offlineError: any) {
        issues.push(
          `فشل في البحث في الكاش المحلي: ${formatError(offlineError)}`,
        );
      }

      // 5. تحليل البيانات وإنشاء التوصيات
      if (issues.length === 0) {
        recommendations.push(
          "✅ جميع الفحوصات نجحت - العميل موجود ويمكن التحقق منه",
        );
      } else {
        // توصيات حسب المشاكل المكتشفة
        if (!connectionOk) {
          recommendations.push(
            "🌐 أولوية: إصلاح مشكلة الاتصال مع قاعدة البيانات",
          );
        }

        if (!databaseCustomer && !phoneSearchResult) {
          recommendations.push("👤 العميل غير موجود - يحتاج إعادة إنشاء");
          solutions.push("إنشاء العميل في قاعدة البيانات مرة أخرى");
        }

        if (phoneSearchResult && phoneSearchResult.id !== customer.id) {
          recommendations.push("🔄 استخدام ID الصحيح المكتشف بالهاتف");
          solutions.push(
            `استخدام ID: ${phoneSearchResult.id} بدلاً من ${customer.id}`,
          );
        }

        if (offlineCustomer && !connectionOk) {
          recommendations.push("📱 استخدام البيانات المحلية مؤقتاً");
          solutions.push("العمل بالوضع الأوف لاين حتى استعادة الاتصال");
        }
      }

      return {
        success: issues.length === 0,
        issues,
        solutions,
        customerData: {
          originalCustomer: customer,
          databaseCustomer,
          phoneSearchResult,
          offlineCustomer,
        },
        recommendations,
      };
    } catch (error: any) {
      logError("فشل في تشخيص مشكلة العميل:", error, {
        customerId: customer.id,
        customerName: customer.name,
        operation: "diagnose_customer_validation",
      });

      return {
        success: false,
        issues: [`فشل في التشخيص: ${formatError(error)}`],
        solutions: ["محاولة إعادة تشغيل التطبيق أو تحديث الصفحة"],
        customerData: {
          originalCustomer: customer,
          databaseCustomer: null,
          phoneSearchResult: null,
          offlineCustomer: null,
        },
        recommendations: ["اتصل بالدعم التقني إذا استمرت المشكلة"],
      };
    }
  }

  /**
   * إصلاح تلقائي لمشكلة العميل
   */
  static async autoFixCustomerIssue(customer: Customer): Promise<{
    success: boolean;
    fixedCustomer: Customer | null;
    actions: string[];
    message: string;
  }> {
    console.log(`🔧 بدء الإصلاح التلقائي للعميل: ${customer.name}`);

    const actions: string[] = [];

    try {
      // أولاً: تشخيص المشكلة
      const diagnosis = await this.diagnoseCustomerValidationIssue(customer);

      if (diagnosis.success) {
        return {
          success: true,
          fixedCustomer: diagnosis.customerData.databaseCustomer || customer,
          actions: ["✅ لا توجد مشاكل للإصلاح"],
          message: "العميل يعمل بشكل طبيعي",
        };
      }

      // ثانياً: محاولة الإصلاحات
      let fixedCustomer: Customer | null = null;

      // محاولة 1: استخدام النتيجة من البحث بالهاتف
      if (diagnosis.customerData.phoneSearchResult) {
        fixedCustomer = diagnosis.customerData.phoneSearchResult;
        actions.push(
          `✅ تم استخدام العميل المكتشف بالهاتف: ${fixedCustomer.name} (${fixedCustomer.id})`,
        );
      }

      // محاولة 2: استخدام البيانات من الكاش المحلي
      else if (diagnosis.customerData.offlineCustomer) {
        fixedCustomer = diagnosis.customerData.offlineCustomer;
        actions.push(
          `✅ تم استخدام العميل من الكاش المحلي: ${fixedCustomer.name}`,
        );
      }

      // محاولة 3: إنشاء العميل مرة أخرى
      else {
        try {
          console.log(`🆕 محاولة إنشاء العميل مرة أخرى: ${customer.name}`);
          fixedCustomer = await supabaseService.createCustomer({
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            paymentStatus: customer.paymentStatus || "cash",
            lastSaleDate:
              customer.lastSaleDate || new Date().toISOString().split("T")[0],
            debtAmount: customer.debtAmount || 0,
          });
          actions.push(
            `✅ تم إنشاء العميل مرة أخرى: ${fixedCustomer.name} (${fixedCustomer.id})`,
          );
        } catch (createError: any) {
          actions.push(`❌ فشل في إنشاء العميل: ${formatError(createError)}`);

          // محاولة أخيرة: استخدام البيانات الأصلية
          fixedCustomer = customer;
          actions.push(`⚠️ استخدام البيانات الأصلية كحل أخير`);
        }
      }

      const success = fixedCustomer !== null;
      const message = success
        ? `تم إصلاح مشكلة العميل: ${fixedCustomer.name}`
        : "فشل في إصلاح مشكلة العميل";

      console.log(`${success ? "✅" : "❌"} ${message}`);

      return {
        success,
        fixedCustomer,
        actions,
        message,
      };
    } catch (error: any) {
      logError("فشل في الإصلاح التلقائي للعميل:", error, {
        customerId: customer.id,
        customerName: customer.name,
        operation: "auto_fix_customer",
      });

      return {
        success: false,
        fixedCustomer: null,
        actions: [`❌ فشل في الإصلاح: ${formatError(error)}`],
        message: "فشل في الإصلاح التلقائي",
      };
    }
  }

  /**
   * فحص سريع لصحة بيانات العميل
   */
  static async quickCustomerCheck(customer: Customer): Promise<{
    isValid: boolean;
    customer: Customer | null;
    issues: string[];
  }> {
    try {
      console.log(`⚡ فحص سريع للعميل: ${customer.name}`);

      // محاولة البحث السريع بالـ ID
      let dbCustomer = await supabaseService.getCustomerById(customer.id);

      if (dbCustomer) {
        return {
          isValid: true,
          customer: dbCustomer,
          issues: [],
        };
      }

      // إذا لم يوجد بالـ ID، جرب بالهاتف
      dbCustomer = await supabaseService.getCustomerByPhone(customer.phone);

      if (dbCustomer) {
        return {
          isValid: true,
          customer: dbCustomer,
          issues: [`تم العثور على العميل بالهاتف بدلاً من ID`],
        };
      }

      // لم يتم العثور على العميل
      return {
        isValid: false,
        customer: null,
        issues: [`العميل غير موجود في قاعدة البيانات`],
      };
    } catch (error: any) {
      logError("فشل في الفحص السريع للعميل:", error, {
        customerId: customer.id,
        customerName: customer.name,
        operation: "quick_customer_check",
      });

      return {
        isValid: false,
        customer: null,
        issues: [`فشل في الفحص: ${formatError(error)}`],
      };
    }
  }
}

// دوال مساعدة للتصدير
export const diagnoseCustomerIssue = (customer: Customer) =>
  CustomerDataDiagnostic.diagnoseCustomerValidationIssue(customer);

export const autoFixCustomer = (customer: Customer) =>
  CustomerDataDiagnostic.autoFixCustomerIssue(customer);

export const quickCheckCustomer = (customer: Customer) =>
  CustomerDataDiagnostic.quickCustomerCheck(customer);
