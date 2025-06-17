import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/ui/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  FileText,
  Copy,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import DatabaseDiagnostic from "@/components/DatabaseDiagnostic";
import { supabase } from "@/lib/supabase";

const FixCustomerStatement: React.FC = () => {
  const navigate = useNavigate();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details: any;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const testCustomerStatement = async () => {
    setTesting(true);
    try {
      // 1. فحص وجود جدول sale_items
      const { error: tableError } = await supabase!
        .from("sale_items")
        .select("id")
        .limit(1);

      if (tableError && tableError.code === "42P01") {
        setTestResult({
          success: false,
          message: "🚨 جدول sale_items مفقود - هذا سبب المشكلة!",
          details: {
            problem: "جدول sale_items مطلوب لحفظ تفاصيل المنتجات",
            solution: "قم بتشغيل سكريبت الإصلاح في Supabase",
          },
        });
        setTesting(false);
        return;
      }

      // 2. فحص العلاقات
      const { error: relationError } = await supabase!
        .from("sales")
        .select("id, sale_items(id)")
        .limit(1);

      if (relationError && relationError.code === "PGRST200") {
        setTestResult({
          success: false,
          message: "❌ العلاقات بين الجداول مفقودة",
          details: {
            problem: "لا يمكن ربط المبيعات بتفاصيل المنتجات",
            solution: "يجب إنشاء Foreign Keys بين الجداول",
          },
        });
        setTesting(false);
        return;
      }

      // 3. فحص البيانات
      const { data: salesData } = await supabase!
        .from("sales")
        .select("id")
        .limit(5);

      const { data: itemsData } = await supabase!
        .from("sale_items")
        .select("id")
        .limit(5);

      const salesCount = salesData?.length || 0;
      const itemsCount = itemsData?.length || 0;

      if (salesCount > 0 && itemsCount === 0) {
        setTestResult({
          success: false,
          message: `⚠️ يوجد ${salesCount} مبيعات لكن بدون تفاصيل منتجات`,
          details: {
            problem: "البيانات القديمة لا تحتوي على تفاصيل المنتجات",
            solution: "المبيعات الجديدة ستعمل بشكل صحيح بعد الإصلاح",
          },
        });
      } else {
        setTestResult({
          success: true,
          message: "✅ النظام يعمل بشكل صحيح",
          details: {
            sales: salesCount,
            items: itemsCount,
            status: "جميع الإعدادات صحيحة",
          },
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: "❌ فشل الاختبار",
        details: {
          error: error.message,
          suggestion: "تحقق من الاتصال بـ Supabase",
        },
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    testCustomerStatement();
  }, []);

  const copyQuickFix = () => {
    const quickFixSQL = `-- 🚨 إصلاح سريع لمشكلة كشف الحساب
-- انسخ والصق في Supabase SQL Editor

-- إنشاء جدول sale_items المفقود
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    profit_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة العلاقات
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sale_items_sale_id_fkey') THEN
        ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_id_fkey
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sale_items_product_id_fkey') THEN
        ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- إضافة الفهارس للأداء
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- اختبار النجاح
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sale_items')
        THEN '✅ تم إصلاح المشكلة بنجاح!'
        ELSE '❌ فشل الإصلاح'
    END as result;`;

    navigator.clipboard.writeText(quickFixSQL);
    alert(
      "✅ تم نسخ سكريبت الإصلاح!\n\nالآن:\n1. افتح Supabase Dashboard\n2. انتقل إلى SQL Editor\n3. الصق الكود\n4. اضغط RUN",
    );
  };

  const copyCompleteFix = () => {
    // Reference to the complete SQL file
    alert(
      "📄 سيتم فتح الملف الكامل QUICK_FIX_SALE_ITEMS.sql\n\nانسخ محتوى الملف كاملاً وشغله في Supabase",
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-red-600" />
            إصلاح مشكلة كشف الحساب
          </h1>
          <p className="text-gray-600 mt-2">
            حل مشكلة عدم ظهور المنتجات في كشف حساب العميل
          </p>
        </div>

        {/* Problem Description */}
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <h4 className="font-semibold text-red-800">🚨 المشكلة:</h4>
              <ul className="text-red-700 text-sm space-y-1">
                <li>• عند الضغط على "كشف الحساب" لأي عميل</li>
                <li>• لا تظهر المنتجات التي اشتراها العميل</li>
                <li>• يظهر "0 عملية شراء" أو قائمة فا��غة</li>
                <li>• السبب: جدول sale_items مفقود من قاعدة البيانات</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Test Result */}
        {testResult && (
          <Card
            className={
              testResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <CardHeader>
              <CardTitle
                className={`flex items-center gap-2 ${
                  testResult.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                نتيجة الفحص السريع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p
                  className={`font-semibold ${
                    testResult.success ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {testResult.message}
                </p>
                {testResult.details && (
                  <div className="bg-white/50 p-3 rounded-lg text-sm">
                    <pre className="whitespace-pre-wrap">
                      {typeof testResult.details === "object"
                        ? JSON.stringify(testResult.details, null, 2)
                        : testResult.details}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={testCustomerStatement}
            disabled={testing}
            variant="outline"
            className="flex items-center gap-2 h-16"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />
            <div>
              <div className="font-semibold">إعادة الفحص</div>
              <div className="text-xs opacity-70">تحديث النتائج</div>
            </div>
          </Button>

          <Button
            onClick={copyQuickFix}
            variant="destructive"
            className="flex items-center gap-2 h-16"
          >
            <Copy className="h-4 w-4" />
            <div>
              <div className="font-semibold">نسخ الإصلاح السريع</div>
              <div className="text-xs opacity-70">كود SQL مختصر</div>
            </div>
          </Button>

          <Button
            onClick={() =>
              window.open("https://supabase.com/dashboard", "_blank")
            }
            variant="outline"
            className="flex items-center gap-2 h-16"
          >
            <ExternalLink className="h-4 w-4" />
            <div>
              <div className="font-semibold">فتح Supabase</div>
              <div className="text-xs opacity-70">SQL Editor</div>
            </div>
          </Button>

          <Button
            onClick={() => navigate("/add-sale")}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2 h-16"
          >
            <ShoppingCart className="h-4 w-4" />
            <div>
              <div className="font-semibold">تجربة بيعة جديدة</div>
              <div className="text-xs opacity-70">اختبار الإصلاح</div>
            </div>
          </Button>
        </div>

        {/* Step by Step Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              خطوات الإصلاح خ��وة بخطوة
            </CardTitle>
            <CardDescription>
              اتبع هذه الخطوات بالترتيب لحل المشكلة نهائياً
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 min-w-[24px] justify-center">
                  1
                </Badge>
                <div>
                  <h4 className="font-semibold">اضغط "نسخ الإصلاح السريع"</h4>
                  <p className="text-sm text-gray-600">
                    سيتم نسخ الكود المطلوب إلى الحافظة
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 min-w-[24px] justify-center">
                  2
                </Badge>
                <div>
                  <h4 className="font-semibold">افتح Supabase Dashboard</h4>
                  <p className="text-sm text-gray-600">
                    اضغط "فتح Supabase" أو اذهب إلى supabase.com/dashboard
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 min-w-[24px] justify-center">
                  3
                </Badge>
                <div>
                  <h4 className="font-semibold">انتقل إلى SQL Editor</h4>
                  <p className="text-sm text-gray-600">
                    في القائمة الجانبية، اختر "SQL Editor"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800 min-w-[24px] justify-center">
                  4
                </Badge>
                <div>
                  <h4 className="font-semibold">الصق الكود واضغط RUN</h4>
                  <p className="text-sm text-gray-600">
                    الصق الكود المنسوخ واضغط الزر الأخضر "RUN"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge className="bg-green-100 text-green-800 min-w-[24px] justify-center">
                  5
                </Badge>
                <div>
                  <h4 className="font-semibold">اختبر النتيجة</h4>
                  <p className="text-sm text-gray-600">
                    ارجع هنا واضغط "إعادة الفحص" ثم جرب إضافة بيعة جديدة
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Diagnostic */}
        <DatabaseDiagnostic />

        {/* After Fix Instructions */}
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <h4 className="font-semibold text-green-800">
                ✅ بعد تطبيق الإصلاح:
              </h4>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• ستظهر جميع المنتجات في كشف حساب العميل</li>
                <li>• ستظهر الكمية وسعر الوحدة لكل منتج</li>
                <li>• ستحفظ تفاصيل كل عملية بيع بشكل صحيح</li>
                <li>• ستتقلل كميات المنتجات من المخزن تلقائياً</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Navigation */}
        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate("/")} variant="outline">
            <Users className="h-4 w-4 mr-2" />
            العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default FixCustomerStatement;
