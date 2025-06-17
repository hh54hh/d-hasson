import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  RefreshCw,
  Copy,
  ExternalLink,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface DiagnosticResult {
  name: string;
  status: "success" | "error" | "warning";
  message: string;
  details?: string;
}

const DatabaseDiagnostic: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [overallStatus, setOverallStatus] = useState<
    "healthy" | "issues" | "critical"
  >("healthy");

  const runDiagnostic = async () => {
    setLoading(true);
    const diagnosticResults: DiagnosticResult[] = [];

    try {
      // 1. فحص تكوين Supabase
      if (!isSupabaseConfigured) {
        diagnosticResults.push({
          name: "تكوين Supabase",
          status: "error",
          message: "إعدادات Supabase مفقودة",
          details: "يجب إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY",
        });
        setResults(diagnosticResults);
        setOverallStatus("critical");
        setLoading(false);
        return;
      }

      diagnosticResults.push({
        name: "تكوين Supabase",
        status: "success",
        message: "إعدادات Supabase موجودة",
      });

      // 2. فحص الاتصال
      try {
        const { error: connectionError } = await supabase!
          .from("customers")
          .select("count")
          .limit(0);

        if (connectionError) {
          diagnosticResults.push({
            name: "الاتصال بـ Supabase",
            status: "error",
            message: "فشل الاتصال",
            details: connectionError.message,
          });
        } else {
          diagnosticResults.push({
            name: "الاتصال بـ Supabase",
            status: "success",
            message: "الاتصال يعمل بشكل صحيح",
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: "الاتصال بـ Supabase",
          status: "error",
          message: "خطأ في الشبكة",
          details: error.message,
        });
      }

      // 3. فحص وجود جدول sale_items (السبب الرئيسي للمشكلة)
      try {
        const { error: saleItemsError } = await supabase!
          .from("sale_items")
          .select("id")
          .limit(1);

        if (saleItemsError) {
          if (saleItemsError.code === "42P01") {
            diagnosticResults.push({
              name: "جدول sale_items",
              status: "error",
              message: "🚨 جدول sale_items مفقود - هذا سبب المشكلة!",
              details: "هذا الجدول مطلوب لحفظ تفاصيل المنتجات في كل عملية بيع",
            });
          } else {
            diagnosticResults.push({
              name: "جدول sale_items",
              status: "error",
              message: "مشكلة في جدول sale_items",
              details: saleItemsError.message,
            });
          }
        } else {
          diagnosticResults.push({
            name: "جدول sale_items",
            status: "success",
            message: "جدول sale_items موجود",
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: "جدول sale_items",
          status: "error",
          message: "فشل فحص جدول sale_items",
          details: error.message,
        });
      }

      // 4. فحص العلاقات بين الجداول
      try {
        const { error: relationError } = await supabase!
          .from("sales")
          .select("id, sale_items(id)")
          .limit(1);

        if (relationError) {
          if (relationError.code === "PGRST200") {
            diagnosticResults.push({
              name: "علاقات الجداول",
              status: "error",
              message: "العلاقة بين sales و sale_items مفقودة",
              details: "يجب ربط الجداول بـ Foreign Keys",
            });
          } else {
            diagnosticResults.push({
              name: "علاقات الجداول",
              status: "warning",
              message: "مشكلة في العلاقات",
              details: relationError.message,
            });
          }
        } else {
          diagnosticResults.push({
            name: "علاقات الجداول",
            status: "success",
            message: "العلاقات تعمل بشكل صحيح",
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: "علاقات الجداول",
          status: "warning",
          message: "فشل فحص العلاقات",
          details: error.message,
        });
      }

      // 5. فحص بيانات العينة
      try {
        const { data: salesData, error: salesError } = await supabase!
          .from("sales")
          .select("id")
          .limit(5);

        if (salesError) {
          diagnosticResults.push({
            name: "بيانات المبيعات",
            status: "error",
            message: "فشل في جلب بيانات المبيعات",
            details: salesError.message,
          });
        } else {
          const salesCount = salesData?.length || 0;
          if (salesCount === 0) {
            diagnosticResults.push({
              name: "بيانات المبيعات",
              status: "warning",
              message: "لا توجد مبيعات مسجلة",
              details: "يمكنك إضافة عملية بيع لاختبار النظام",
            });
          } else {
            // فحص إذا كانت المبيعات لها تفاصيل منتجات
            const { data: itemsData } = await supabase!
              .from("sale_items")
              .select("id")
              .limit(5);

            const itemsCount = itemsData?.length || 0;
            if (itemsCount === 0) {
              diagnosticResults.push({
                name: "بيانات المبيعات",
                status: "error",
                message: `يوجد ${salesCount} مبيعات لكن بدون تفاصيل منتجات`,
                details: "هذا سبب عدم ظهور المنتجات في كشف الحساب",
              });
            } else {
              diagnosticResults.push({
                name: "بيانات المبيعات",
                status: "success",
                message: `يوجد ${salesCount} مبيعات مع ${itemsCount} منتج`,
              });
            }
          }
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: "بيانات المبيعات",
          status: "warning",
          message: "فشل فحص بيانات المبيعات",
          details: error.message,
        });
      }

      // تحديد الحالة العامة
      const hasErrors = diagnosticResults.some((r) => r.status === "error");
      const hasWarnings = diagnosticResults.some((r) => r.status === "warning");

      if (hasErrors) {
        setOverallStatus("critical");
      } else if (hasWarnings) {
        setOverallStatus("issues");
      } else {
        setOverallStatus("healthy");
      }

      setResults(diagnosticResults);
    } catch (error: any) {
      diagnosticResults.push({
        name: "فحص عام",
        status: "error",
        message: "فشل التشخيص العام",
        details: error.message,
      });
      setResults(diagnosticResults);
      setOverallStatus("critical");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "border-green-200 bg-green-50";
      case "error":
        return "border-red-200 bg-red-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  const copyFixScript = () => {
    const script = `-- نسخ هذا الكود وتشغيله في Supabase SQL Editor
-- هذا سيحل مشكلة عدم ظهور المنتجات في كشف الحساب

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    profit_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- إضافة العلاقات
ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_id_fkey
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- إضافة الفهارس
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

SELECT '✅ تم إصلاح قاعدة البيانات!' as message;`;

    navigator.clipboard.writeText(script);
    alert("تم نسخ السكريبت! الصقه في Supabase SQL Editor");
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          تشخيص مشكلة كشف الحساب
        </CardTitle>
        <CardDescription>
          فحص سبب عدم ظهور المنتجات في كشف حساب العميل
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <Alert
          className={
            overallStatus === "critical"
              ? "border-red-200 bg-red-50"
              : overallStatus === "issues"
                ? "border-yellow-200 bg-yellow-50"
                : "border-green-200 bg-green-50"
          }
        >
          <AlertDescription className="flex items-center gap-2">
            {overallStatus === "critical" ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : overallStatus === "issues" ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <span className="font-semibold">
              {overallStatus === "critical"
                ? "🚨 مشاكل حرجة موجودة"
                : overallStatus === "issues"
                  ? "⚠️ بعض المشاكل موجودة"
                  : "✅ النظام يعمل بشكل صحيح"}
            </span>
          </AlertDescription>
        </Alert>

        {/* Refresh Button */}
        <div className="flex justify-between items-center">
          <Button
            onClick={runDiagnostic}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "جاري الفحص..." : "إعادة الفحص"}
          </Button>

          {overallStatus === "critical" && (
            <div className="flex gap-2">
              <Button
                onClick={copyFixScript}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                نسخ كود الإصلاح
              </Button>
              <Button
                onClick={() =>
                  window.open("https://supabase.com/dashboard", "_blank")
                }
                variant="outline"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                فتح Supabase
              </Button>
            </div>
          )}
        </div>

        {/* Diagnostic Results */}
        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">
                      {result.name}
                    </span>
                    <Badge
                      variant={
                        result.status === "success"
                          ? "secondary"
                          : result.status === "error"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {result.status === "success"
                        ? "نجح"
                        : result.status === "error"
                          ? "فشل"
                          : "تحذير"}
                    </Badge>
                  </div>
                  <p className="text-gray-700 mb-2">{result.message}</p>
                  {result.details && (
                    <p className="text-sm text-gray-600 bg-white/50 p-2 rounded">
                      {result.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Fix Instructions */}
        {overallStatus === "critical" && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription>
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800">
                  🔧 خطوات الإصلاح السريع:
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
                  <li>اضغط "نسخ كود الإصلاح" أعلاه</li>
                  <li>انتقل إلى Supabase Dashboard</li>
                  <li>افتح SQL Editor</li>
                  <li>الصق الكود واضغط RUN</li>
                  <li>ارجع هنا واضغط "إعادة الفحص"</li>
                  <li>جرب إضافة عملية بيع جديدة</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseDiagnostic;
