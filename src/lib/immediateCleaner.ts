// Immediate Data Cleaner - حذف فوري للبيانات الوهمية
// يستخدم المنظف المباشر لتجاوز جميع التحديدات

import DirectCleaner from "./directCleaner";

class ImmediateCleaner {
  static async executeNow() {
    console.log("🚀 بدء الحذف الفوري للبيانات الوهمية (بدون تحديدات)...");

    try {
      // استخدام المنظف المباشر
      const result = await DirectCleaner.cleanNow();

      if (result.success) {
        // إظهار تنبيه للمستخدم
        if (
          typeof window !== "undefined" &&
          (result.deletedProducts > 0 || result.deletedCustomers > 0)
        ) {
          alert(
            `تم تنظيف النظام بنجاح!\n\n` +
              `تم حذف:\n` +
              `• ${result.deletedProducts} منتجات وهمية\n` +
              `• ${result.deletedCustomers} عملاء وهميين\n\n` +
              `النظام الآن نظيف تماماً من البيانات الوهمية.`,
          );

          // تحديث الصفحة لإظهار النتائج النظيفة
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } else {
        if (typeof window !== "undefined") {
          alert(`فشل التنظيف: ${result.message}`);
        }
      }

      return result;
    } catch (error) {
      console.error("💥 خطأ حرج في التنظيف:", error);

      if (typeof window !== "undefined") {
        alert(`خطأ حرج في التنظيف: ${error}`);
      }

      return {
        success: false,
        deletedProducts: 0,
        deletedCustomers: 0,
      };
    }
  }
}

// تنفيذ فوري عند تحميل الملف
let executed = false;

const runCleanup = async () => {
  if (!executed) {
    executed = true;

    // انتظار ثانيتين للتأكد من تحميل النظام
    setTimeout(async () => {
      console.log("🧹 تنفيذ التنظيف الفوري...");
      await ImmediateCleaner.executeNow();
    }, 2000);
  }
};

// تشغيل فوري
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runCleanup);
  } else {
    runCleanup();
  }
} else {
  runCleanup();
}

export default ImmediateCleaner;
