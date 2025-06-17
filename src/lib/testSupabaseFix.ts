// اختبار سريع لإصلاح مشكلة supabase undefined
import { supabase, isSupabaseConfigured } from "./supabase";
import { supabaseService } from "./supabaseService";
import { SupabaseErrorFix } from "./supabaseErrorFix";

export const testSupabaseFix = async (): Promise<{
  success: boolean;
  message: string;
  details: any;
}> => {
  console.log("🧪 Testing Supabase fix...");

  const result = {
    success: false,
    message: "",
    details: {} as any,
  };

  try {
    // 1. تشخيص أساسي
    const diagnosis = SupabaseErrorFix.diagnoseSupabaseError();
    result.details.diagnosis = diagnosis;

    if (!diagnosis.configured) {
      result.message = "❌ إعدادات Supabase مفقودة";
      return result;
    }

    if (!diagnosis.clientExists) {
      result.message = "❌ عميل Supabase غير موجود";
      return result;
    }

    // 2. اختبار الاتصال
    console.log("🔌 Testing connection...");
    const connectionTest = await SupabaseErrorFix.testConnection();
    result.details.connection = connectionTest;

    if (!connectionTest.success) {
      result.message = `❌ فشل الاتصال: ${connectionTest.error}`;
      return result;
    }

    // 3. اختبار supabaseService.supabase
    console.log("🔧 Testing supabaseService.supabase access...");
    if (!supabaseService.supabase) {
      result.message = "❌ supabaseService.supabase غير متوفر";
      return result;
    }

    // 4. اختبار استعلام بسيط
    console.log("📋 Testing simple query...");
    const { error: queryError } = await supabaseService.supabase
      .from("customers")
      .select("count")
      .limit(0);

    if (queryError) {
      result.message = `❌ فشل الاستعلام: ${queryError.message}`;
      result.details.queryError = queryError;
      return result;
    }

    // 5. اختبار getSalesByCustomerId (المسبب للخطأ الأصلي)
    console.log("🛒 Testing getSalesByCustomerId...");
    try {
      // استخدام معرف وهمي للاختبار
      const testSales =
        await supabaseService.getSalesByCustomerId("test-customer-id");
      result.details.testSales = { count: testSales.length };
      console.log("✅ getSalesByCustomerId works correctly");
    } catch (salesError) {
      // إذا كان الخطأ معرف العميل غير موجود، فهذا طبيعي
      if (salesError instanceof Error) {
        if (
          salesError.message.includes("Cannot read properties of undefined")
        ) {
          result.message = "❌ مشكلة supabase undefined ما زالت موجودة";
          result.details.salesError = salesError.message;
          return result;
        }
        // أخطاء أخرى مقبولة (مثل عدم وجود العميل)
        console.log(
          "ℹ️ Expected error (customer not found):",
          salesError.message,
        );
      }
    }

    // إذا وصلنا هنا، كل شيء يعمل بشكل جيد
    result.success = true;
    result.message = "✅ جميع اختبارات Supabase نجحت!";
    result.details.allTests = {
      configuration: "✅ Pass",
      connection: "✅ Pass",
      serviceAccess: "✅ Pass",
      simpleQuery: "✅ Pass",
      getSalesByCustomerId: "✅ Pass",
    };

    console.log("🎉 Supabase fix verification completed successfully!");
    return result;
  } catch (error: any) {
    result.message = `❌ فشل الاختبار: ${error.message}`;
    result.details.error = error;
    console.error("❌ Supabase fix verification failed:", error);
    return result;
  }
};

// دالة للاختبار السريع من Console
export const quickTest = () => {
  console.log("🚀 Running quick Supabase test...");
  testSupabaseFix()
    .then((result) => {
      console.log("📊 Test Result:", result);
    })
    .catch((error) => {
      console.error("❌ Test failed:", error);
    });
};

// تشغيل اختبار تلقائي في development mode
if (typeof window !== "undefined" && import.meta.env.DEV) {
  console.log("🔧 Development mode detected, running Supabase test...");
  setTimeout(() => {
    quickTest();
  }, 2000);
}
