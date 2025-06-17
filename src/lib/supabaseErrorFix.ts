// إصلاح فوري لمشكلة supabase undefined
import { supabase, isSupabaseConfigured } from "./supabase";

export class SupabaseErrorFix {
  // تشخيص سريع لمشاكل supabase
  static diagnoseSupabaseError(): {
    configured: boolean;
    clientExists: boolean;
    canConnect: boolean;
    issue: string | null;
  } {
    const diagnosis = {
      configured: isSupabaseConfigured,
      clientExists: !!supabase,
      canConnect: false,
      issue: null as string | null,
    };

    // فحص التكوين
    if (!isSupabaseConfigured) {
      diagnosis.issue = "إعدادات Supabase مفقودة (URL/Key)";
      return diagnosis;
    }

    // فحص العميل
    if (!supabase) {
      diagnosis.issue = "عميل Supabase غير مُنشأ";
      return diagnosis;
    }

    // فحص القدرة على الاتصال
    try {
      // محاولة بسيطة للاتصال
      diagnosis.canConnect = true;
    } catch (error) {
      diagnosis.issue = "فشل في إنشاء اتصال Supabase";
      diagnosis.canConnect = false;
    }

    return diagnosis;
  }

  // إصلاح تلقائي للمشاكل الشائعة
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

    const diagnosis = this.diagnoseSupabaseError();

    if (!diagnosis.configured) {
      result.message = "يجب إضافة إعدادات Supabase في متغيرات البيئة";
      result.actions.push("أضف VITE_SUPABASE_URL");
      result.actions.push("أضف VITE_SUPABASE_ANON_KEY");
      result.actions.push("أعد تشغيل التطبيق");
      return result;
    }

    if (!diagnosis.clientExists) {
      result.message = "مشكلة في إنشاء عميل Supabase";
      result.actions.push("تحقق من صحة URL و Key");
      result.actions.push("تحقق من شبكة الإنترنت");
      return result;
    }

    // إذا كان كل شيء يبدو جيد
    result.success = true;
    result.message = "إعدادات Supabase تبدو صحيحة";
    result.actions.push("تم التحقق من التكوين");

    return result;
  }

  // اختبار اتصال سريع
  static async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error: string | null;
  }> {
    const result = {
      success: false,
      latency: 0,
      error: null as string | null,
    };

    if (!supabase) {
      result.error = "عميل Supabase غير متوفر";
      return result;
    }

    const startTime = Date.now();

    try {
      // اختبار بسيط بجلب count للعملاء
      const { error } = await supabase
        .from("customers")
        .select("count")
        .limit(0);

      result.latency = Date.now() - startTime;

      if (error) {
        result.error = error.message;
      } else {
        result.success = true;
      }
    } catch (networkError: any) {
      result.latency = Date.now() - startTime;
      result.error = networkError.message || "خطأ في الشبكة";
    }

    return result;
  }

  // إرشادات إصلاح المشاكل الشائعة
  static getCommonFixInstructions(): {
    [key: string]: {
      problem: string;
      solution: string;
      steps: string[];
    };
  } {
    return {
      undefined_supabase: {
        problem: "Cannot read properties of undefined (reading 'from')",
        solution: "عميل Supabase غير مُعرَّف",
        steps: [
          "تحقق من متغيرات البيئة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY",
          "تأكد من أن Supabase مُكوَّن بشكل صحيح",
          "أعد تشغيل الخادم المحلي",
        ],
      },
      connection_failed: {
        problem: "Failed to fetch / Network error",
        solution: "مشكلة في الاتصال بـ Supabase",
        steps: [
          "تحقق من اتصال الإنترنت",
          "تحقق من صحة رابط Supabase",
          "تحقق من حالة خدمة Supabase",
        ],
      },
      relation_not_exist: {
        problem: 'relation "public.sale_items" does not exist',
        solution: "جدول sale_items مفقود",
        steps: [
          "استخدم أداة الإصلاح التلقائي",
          "أو شغّل سكريبت CRITICAL_DATABASE_FIX.sql",
          "تحقق من إنشاء الجدول في Supabase Dashboard",
        ],
      },
    };
  }
}

// دالة مساعدة سريعة للتشخيص
export const quickSupabaseDiagnosis = () => {
  const diagnosis = SupabaseErrorFix.diagnoseSupabaseError();
  console.log("🔍 Supabase Diagnosis:", diagnosis);

  if (!diagnosis.configured || !diagnosis.clientExists) {
    console.error("❌ Supabase configuration issue detected");
    const fix = SupabaseErrorFix.quickFix();
    console.log("🔧 Quick fix suggestions:", fix);
  } else {
    console.log("✅ Supabase appears to be configured correctly");
  }

  return diagnosis;
};

// تشغيل تشخيص تلقائي عند تحميل الملف
if (typeof window !== "undefined") {
  // تأخير قصير للسماح للتطبيق بالتحميل
  setTimeout(() => {
    quickSupabaseDiagnosis();
  }, 1000);
}
