// Execute Cleaning - تنفيذ التنظيف الشامل
// ينفذ عملية تنظيف شاملة وفورية

import DirectCleaner from "./directCleaner";

// تنفيذ فوري للتنظيف
(async function immediateExecution() {
  console.log("🚀 تنفيذ فوري للتنظيف الشامل...");

  try {
    // انتظار قصير للتأكد من تحميل النظام
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // فحص البيانات الوهمية أولاً
    const check = await DirectCleaner.checkFakeData();

    if (check.hasProducts || check.hasCustomers) {
      console.log(
        `🔍 تم اكتشاف بيانات وهمية: ${check.productCount} منتجات، ${check.customerCount} عملاء`,
      );

      // تنفيذ التنظيف
      const result = await DirectCleaner.cleanNow();

      if (result.success) {
        console.log(`🎉 تم التنظيف بنجاح!`);
        console.log(
          `📊 تم حذف: ${result.deletedProducts} منتجات، ${result.deletedCustomers} عملاء`,
        );

        // عرض رسالة للمستخدم
        if (typeof window !== "undefined") {
          setTimeout(() => {
            const message =
              `تم تنظيف النظام بنجاح!\n\n` +
              `المحذوف:\n` +
              `🗑️ ${result.deletedProducts} منتجات وهمية\n` +
              `🗑️ ${result.deletedCustomers} عملاء وهميين\n\n` +
              `النظام الآن نظيف من جميع البيانات الوهمية والتجريبية.`;

            alert(message);

            // تحديث الصفحة بعد 3 ثوان
            setTimeout(() => {
              console.log("🔄 تحديث الصفحة لعرض النظام النظيف...");
              window.location.reload();
            }, 3000);
          }, 1000);
        }
      } else {
        console.error(`❌ فشل التنظيف: ${result.message}`);
      }
    } else {
      console.log("✅ النظام نظيف بالفعل - لا توجد بيانات وهمية");
    }
  } catch (error) {
    console.error("💥 خطأ في التنفيذ الفوري:", error);
  }
})();

// تصدير للاستخدام اليدوي
export { DirectCleaner };
