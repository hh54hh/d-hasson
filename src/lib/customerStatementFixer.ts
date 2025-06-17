// إصلاح شامل وعميق لنظام حفظ وعرض كشف الحساب
import { supabase } from "./supabase";
import { supabaseService } from "./supabaseService";
import { Customer, Product, Sale, SaleItem, CartItem } from "./types";

export class CustomerStatementFixer {
  // تشخيص عميق لمشاكل كشف الحساب
  static async deepDiagnosis(customerId: string): Promise<{
    customerExists: boolean;
    salesCount: number;
    saleItemsCount: number;
    missingItemsSales: any[];
    databaseIntegrity: boolean;
    recommendations: string[];
    detailedIssues: any;
  }> {
    console.log(`🔍 Running deep diagnosis for customer: ${customerId}`);

    const result = {
      customerExists: false,
      salesCount: 0,
      saleItemsCount: 0,
      missingItemsSales: [] as any[],
      databaseIntegrity: false,
      recommendations: [] as string[],
      detailedIssues: {} as any,
    };

    try {
      // 1. فحص وجود العميل
      const { data: customer, error: customerError } = await supabase!
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        result.detailedIssues.customerError =
          customerError?.message || "Customer not found";
        result.recommendations.push("العميل غير موجود في قاعدة البيانات");
        return result;
      }

      result.customerExists = true;
      console.log(`✅ Customer found: ${customer.name}`);

      // 2. فحص المبيعات
      const { data: sales, error: salesError } = await supabase!
        .from("sales")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (salesError) {
        result.detailedIssues.salesError = salesError.message;
        result.recommendations.push("خطأ في جلب بيانات المبيعات");
        return result;
      }

      result.salesCount = sales?.length || 0;
      console.log(`📊 Found ${result.salesCount} sales for customer`);

      if (result.salesCount === 0) {
        result.recommendations.push("العميل لم يقم بأي عمليات شراء");
        return result;
      }

      // 3. فحص تفاصيل المنتجات لكل بيعة
      for (const sale of sales || []) {
        const { data: saleItems, error: itemsError } = await supabase!
          .from("sale_items")
          .select("*")
          .eq("sale_id", sale.id);

        if (itemsError) {
          result.detailedIssues.saleItemsError = itemsError.message;
          if (itemsError.code === "42P01") {
            result.recommendations.push(
              "🚨 جدول sale_items مفقود - هذا سبب المشكلة الرئيسي",
            );
          } else {
            result.recommendations.push(
              `خطأ في جلب تفاصيل المنتجات: ${itemsError.message}`,
            );
          }
          continue;
        }

        const itemsCount = saleItems?.length || 0;
        result.saleItemsCount += itemsCount;

        if (itemsCount === 0) {
          result.missingItemsSales.push({
            saleId: sale.id,
            saleDate: sale.sale_date,
            totalAmount: sale.total_amount,
            itemsCount: sale.items_count || 0,
          });
        }
      }

      // 4. تحليل النتائج وإعطاء توصيات
      if (result.missingItemsSales.length > 0) {
        result.recommendations.push(
          `يوجد ${result.missingItemsSales.length} مبيعات بدون تفاصيل منتجات`,
        );
        result.recommendations.push(
          "السبب: لم يتم حفظ تفاصيل المنتجات في جدول sale_items",
        );
      }

      if (result.saleItemsCount === 0 && result.salesCount > 0) {
        result.recommendations.push(
          "🚨 جميع المبيعات بدون تفاصيل منتجات - مشكلة حرجة",
        );
        result.recommendations.push(
          "الحل: تشغيل سكريبت ULTIMATE_CUSTOMER_STATEMENT_FIX.sql",
        );
      }

      // 5. فحص سلامة قاعدة البيانات
      try {
        const { error: relationError } = await supabase!
          .from("sales")
          .select("id, sale_items(id)")
          .eq("customer_id", customerId)
          .limit(1);

        if (relationError) {
          if (relationError.code === "PGRST200") {
            result.recommendations.push(
              "العلاقات بين جداول sales و sale_items مفقودة",
            );
          }
        } else {
          result.databaseIntegrity = true;
        }
      } catch (error) {
        result.detailedIssues.relationshipError = error;
      }

      console.log(
        `🎯 Diagnosis complete: ${result.saleItemsCount} items found in ${result.salesCount} sales`,
      );
      return result;
    } catch (error: any) {
      result.detailedIssues.generalError = error.message;
      result.recommendations.push(`خطأ عام في التشخيص: ${error.message}`);
      return result;
    }
  }

  // إصلاح شامل لمشاكل كشف الحساب
  static async comprehensiveFix(): Promise<{
    success: boolean;
    message: string;
    steps: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      message: "",
      steps: [] as string[],
      errors: [] as string[],
    };

    console.log("🔧 Starting comprehensive customer statement fix...");

    try {
      // Step 1: فحص وجود جدول sale_items
      result.steps.push("فحص وجود جدول sale_items...");

      const { error: tableError } = await supabase!
        .from("sale_items")
        .select("id")
        .limit(1);

      if (tableError && tableError.code === "42P01") {
        result.errors.push("🚨 جدول sale_items مفقود");
        result.message =
          "يجب تشغيل سكريبت ULTIMATE_CUSTOMER_STATEMENT_FIX.sql في Supabase أولاً";
        return result;
      }

      result.steps.push("✅ جدول sale_items موجود");

      // Step 2: فحص العلاقات
      result.steps.push("فحص العلاقات بين الجداول...");

      const { error: relationError } = await supabase!
        .from("sales")
        .select("id, sale_items(id)")
        .limit(1);

      if (relationError && relationError.code === "PGRST200") {
        result.errors.push("العلاقات بين الجداول مفقودة");
      } else {
        result.steps.push("✅ العلاقات بين الجداول تعمل");
      }

      // Step 3: فحص المبيعات بدون تفاصيل
      result.steps.push("فحص المبيعات بدون تفاصيل منتجات...");

      const { data: salesWithoutItems } = await supabase!
        .from("sales")
        .select(
          `
          id,
          customer_id,
          sale_date,
          total_amount,
          sale_items!left(id)
        `,
        )
        .is("sale_items.id", null);

      const emptySalesCount = salesWithoutItems?.length || 0;

      if (emptySalesCount > 0) {
        result.steps.push(
          `⚠️ وجد ${emptySalesCount} مبيعات بدون تفاصيل منتجات`,
        );
        result.errors.push(`${emptySalesCount} مبيعات تحتاج إعادة إدخال`);
      } else {
        result.steps.push("✅ جميع المبيعات لها تفاصيل منتجات");
      }

      // Step 4: اختبار إنشاء عنصر تجريبي
      result.steps.push("اختبار إنشاء عنصر تجريبي...");

      try {
        // محاولة إنشاء واحذف عنصر تجريبي للتأكد من عمل المشغلات
        const testResult = await this.testSaleItemsInsertion();
        if (testResult.success) {
          result.steps.push("✅ اختبار إنشاء العناصر نجح");
        } else {
          result.errors.push(`فشل اختبار إنشاء العناصر: ${testResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`خطأ في اختبار إنشاء العناصر: ${error.message}`);
      }

      // Step 5: تحديث إحصائيات المبيعات
      result.steps.push("تحديث إحصائيات المبيعات...");

      try {
        const { error: updateError } = await supabase!.rpc(
          "update_sales_items_count",
        );

        if (!updateError) {
          result.steps.push("✅ تم تحديث إحصائيات المبيعات");
        }
      } catch (error) {
        result.steps.push(
          "ℹ️ لم يتم العثور على دالة تحديث الإحصائيات (غير ضروري)",
        );
      }

      // تقييم النتائج
      if (result.errors.length === 0) {
        result.success = true;
        result.message = "✅ جميع فحوصات كشف الحساب نجحت";
      } else if (
        result.errors.length === 1 &&
        result.errors[0].includes("تحتاج إعادة إدخال")
      ) {
        result.success = true;
        result.message = "✅ النظام يعمل، لكن يوجد مبيعات قديمة بدون تفاصيل";
      } else {
        result.success = false;
        result.message = "❌ يوجد مشاكل تحتاج إصل��ح";
      }

      return result;
    } catch (error: any) {
      result.success = false;
      result.message = `❌ فشل الإصلاح الشامل: ${error.message}`;
      result.errors.push(error.message);
      return result;
    }
  }

  // اختبار إنشاء وحذف عنصر تجريبي
  private static async testSaleItemsInsertion(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // البحث عن أول عميل ومنتج وبيعة للاختبار
      const { data: customer } = await supabase!
        .from("customers")
        .select("id")
        .limit(1)
        .single();

      const { data: product } = await supabase!
        .from("products")
        .select("id, name")
        .limit(1)
        .single();

      const { data: sale } = await supabase!
        .from("sales")
        .select("id")
        .eq("customer_id", customer?.id)
        .limit(1)
        .single();

      if (!customer || !product || !sale) {
        return { success: false, error: "لا توجد بيانات كافية للاختبار" };
      }

      // إنشاء عنصر تجريبي
      const { data: testItem, error: insertError } = await supabase!
        .from("sale_items")
        .insert({
          sale_id: sale.id,
          product_id: product.id,
          product_name: `${product.name} - اختبار`,
          quantity: 1,
          unit_price: 1.0,
          total_amount: 1.0,
          profit_amount: 0.5,
        })
        .select()
        .single();

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      // حذف العنصر التجريبي فوراً
      const { error: deleteError } = await supabase!
        .from("sale_items")
        .delete()
        .eq("id", testItem.id);

      if (deleteError) {
        console.warn("Failed to cleanup test item:", deleteError);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // إصلاح محسن لحفظ المبيعات مع التأكد من حفظ التفاصيل
  static async enhancedSaleCreation(
    customerId: string,
    cartItems: CartItem[],
    saleData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
      notes?: string;
    },
  ): Promise<{
    success: boolean;
    sale?: Sale;
    message: string;
    details: any;
  }> {
    console.log("🛒 Enhanced sale creation starting...");

    const result = {
      success: false,
      sale: undefined as Sale | undefined,
      message: "",
      details: {} as any,
    };

    try {
      // التحقق من صحة البيانات
      if (!cartItems || cartItems.length === 0) {
        result.message = "لا يمكن إنشاء بيعة بدون منتجات";
        return result;
      }

      if (!customerId) {
        result.message = "معرف العميل مطلوب";
        return result;
      }

      // حساب المجاميع
      const totalAmount = cartItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const profitAmount = cartItems.reduce(
        (sum, item) =>
          sum + (item.unitPrice - item.product.wholesalePrice) * item.quantity,
        0,
      );
      const remainingAmount = totalAmount - (saleData.paidAmount || 0);

      console.log(
        `💰 Sale totals: ${totalAmount}, profit: ${profitAmount}, remaining: ${remainingAmount}`,
      );

      // إنشاء البيعة الرئيسية
      const { data: saleRecord, error: saleError } = await supabase!
        .from("sales")
        .insert({
          customer_id: customerId,
          sale_date: new Date().toISOString().split("T")[0],
          total_amount: totalAmount,
          payment_type: saleData.paymentType,
          paid_amount: saleData.paidAmount,
          remaining_amount: remainingAmount,
          payment_date:
            saleData.paymentType === "cash"
              ? new Date().toISOString().split("T")[0]
              : null,
          profit_amount: profitAmount,
          notes: saleData.notes || "",
          items_count: cartItems.length,
        })
        .select()
        .single();

      if (saleError) {
        result.message = `فشل في إنشاء البيعة: ${saleError.message}`;
        result.details.saleError = saleError;
        return result;
      }

      console.log(`✅ Sale created with ID: ${saleRecord.id}`);
      result.details.saleId = saleRecord.id;

      // إنشاء تفاصيل المنتجات
      const saleItemsData = cartItems.map((item) => ({
        sale_id: saleRecord.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_amount: item.totalPrice,
        profit_amount:
          (item.unitPrice - item.product.wholesalePrice) * item.quantity,
      }));

      const { data: saleItems, error: itemsError } = await supabase!
        .from("sale_items")
        .insert(saleItemsData)
        .select();

      if (itemsError) {
        console.error("❌ Failed to create sale items:", itemsError);

        // حذف البيعة إذا فشل إنشاء التفاصيل
        await supabase!.from("sales").delete().eq("id", saleRecord.id);

        result.message = `فشل في إنشاء تفاصيل المنتجات: ${itemsError.message}`;
        result.details.itemsError = itemsError;
        return result;
      }

      console.log(`✅ Created ${saleItems.length} sale items`);
      result.details.itemsCount = saleItems.length;

      // تجميع النتيجة النهائية
      const completeSale: Sale = {
        id: saleRecord.id,
        customerId: saleRecord.customer_id,
        saleDate: saleRecord.sale_date,
        totalAmount: saleRecord.total_amount,
        paymentType: saleRecord.payment_type as any,
        paidAmount: saleRecord.paid_amount,
        remainingAmount: saleRecord.remaining_amount,
        paymentDate: saleRecord.payment_date,
        profitAmount: saleRecord.profit_amount,
        notes: saleRecord.notes,
        items: saleItems.map((item) => ({
          id: item.id,
          saleId: item.sale_id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalAmount: item.total_amount,
          profitAmount: item.profit_amount,
        })),
        created_at: saleRecord.created_at,
        updated_at: saleRecord.updated_at,
      };

      result.success = true;
      result.sale = completeSale;
      result.message = `✅ تم إنشاء البيعة بنجاح مع ${saleItems.length} منتج`;

      console.log("🎉 Enhanced sale creation completed successfully");
      return result;
    } catch (error: any) {
      console.error("❌ Enhanced sale creation failed:", error);
      result.message = `خطأ عام في إنشاء البيعة: ${error.message}`;
      result.details.generalError = error;
      return result;
    }
  }

  // جلب محسن لبيانات كشف الحساب
  static async enhancedCustomerStatement(customerId: string): Promise<{
    success: boolean;
    customer?: Customer;
    purchases: any[];
    summary: any;
    message: string;
  }> {
    console.log(`📋 Fetching enhanced customer statement for: ${customerId}`);

    const result = {
      success: false,
      customer: undefined as Customer | undefined,
      purchases: [] as any[],
      summary: {} as any,
      message: "",
    };

    try {
      // جلب بيانات العميل
      const { data: customer, error: customerError } = await supabase!
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        result.message = "العميل غير موجود";
        return result;
      }

      result.customer = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        paymentStatus: customer.payment_status,
        lastSaleDate: customer.last_sale_date,
        debtAmount: customer.debt_amount || 0,
        sales: [],
        created_at: customer.created_at,
        updated_at: customer.updated_at,
      };

      // جلب المشتريات مع التفاصيل باستخدام الدالة المحسنة
      try {
        const { data: purchases, error: purchasesError } = await supabase!.rpc(
          "get_customer_purchases_detailed",
          {
            customer_uuid: customerId,
          },
        );

        if (purchasesError) {
          console.warn("Custom function not available, using fallback query");

          // استعلام بديل مباشر
          const { data: fallbackPurchases, error: fallbackError } =
            await supabase!
              .from("sales")
              .select(
                `
              id,
              sale_date,
              total_amount,
              payment_type,
              paid_amount,
              remaining_amount,
              notes,
              created_at,
              sale_items (
                id,
                product_id,
                product_name,
                quantity,
                unit_price,
                total_amount,
                profit_amount
              )
            `,
              )
              .eq("customer_id", customerId)
              .order("sale_date", { ascending: false });

          if (fallbackError) {
            result.message = `خطأ في جلب المشتريات: ${fallbackError.message}`;
            return result;
          }

          // تحويل البيانات لصيغة موحدة
          result.purchases = [];

          for (const sale of fallbackPurchases || []) {
            for (const item of sale.sale_items || []) {
              result.purchases.push({
                sale_id: sale.id,
                sale_date: sale.sale_date,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_amount: item.total_amount,
                profit_amount: item.profit_amount,
                payment_type: sale.payment_type,
                paid_amount: sale.paid_amount,
                remaining_amount: sale.remaining_amount,
                notes: sale.notes || "",
                sale_created_at: sale.created_at,
              });
            }
          }
        } else {
          result.purchases = purchases || [];
        }

        // حساب الملخص
        const totalSales = [...new Set(result.purchases.map((p) => p.sale_id))]
          .length;
        const totalItems = result.purchases.length;
        const totalQuantity = result.purchases.reduce(
          (sum, p) => sum + (p.quantity || 0),
          0,
        );
        const totalAmount = result.purchases.reduce(
          (sum, p) => sum + (p.total_amount || 0),
          0,
        );
        const totalProfit = result.purchases.reduce(
          (sum, p) => sum + (p.profit_amount || 0),
          0,
        );

        result.summary = {
          totalSales,
          totalItems,
          totalQuantity,
          totalAmount,
          totalProfit,
          currentDebt: customer.debt_amount || 0,
        };

        result.success = true;
        result.message = `✅ تم جلب ${totalItems} منتج من ${totalSales} عملية شراء`;

        console.log(
          `📊 Customer statement loaded: ${totalItems} items from ${totalSales} sales`,
        );
        return result;
      } catch (purchasesError: any) {
        result.message = `خطأ في جلب تفاصيل المشتريات: ${purchasesError.message}`;
        return result;
      }
    } catch (error: any) {
      result.message = `خطأ عام في جلب كشف الحساب: ${error.message}`;
      return result;
    }
  }
}

// دوال مساعدة للاستخدام السريع
export const quickDiagnoseCustomer = async (customerId: string) => {
  return await CustomerStatementFixer.deepDiagnosis(customerId);
};

export const quickFixCustomerStatement = async () => {
  return await CustomerStatementFixer.comprehensiveFix();
};

export const enhancedCreateSale = async (
  customerId: string,
  cartItems: CartItem[],
  saleData: any,
) => {
  return await CustomerStatementFixer.enhancedSaleCreation(
    customerId,
    cartItems,
    saleData,
  );
};

export const enhancedGetCustomerStatement = async (customerId: string) => {
  return await CustomerStatementFixer.enhancedCustomerStatement(customerId);
};
