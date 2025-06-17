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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wrench,
  Database,
  RefreshCw,
  FileText,
  Copy,
  ExternalLink,
  AlertCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { emergencyRepair } from "@/lib/emergencyRepair";
import { supabaseService } from "@/lib/supabaseService";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseErrorFix } from "@/lib/supabaseErrorFix";

const EmergencyFix: React.FC = () => {
  const navigate = useNavigate();
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [fixInstructions, setFixInstructions] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    // تشخيص سريع لـ Supabase أولاً
    const supabaseDiagnosis = SupabaseErrorFix.diagnoseSupabaseError();
    console.log("🔍 Supabase diagnosis:", supabaseDiagnosis);

    if (!supabaseDiagnosis.configured || !supabaseDiagnosis.clientExists) {
      console.warn("⚠️ Supabase configuration issues detected");
    }

    runDiagnosis();
  }, []);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const result = await emergencyRepair.runQuickCheck();
      setDiagnosis(result.diagnosis);
      setFixInstructions(result.fixInstructions);
      setCanProceed(result.canProceed);
    } catch (error: any) {
      console.error("Diagnosis failed:", error);
      setDiagnosis({
        problem: `فشل في التشخيص: ${error.message}`,
        severity: "critical",
        canAutoFix: false,
        details: { error },
      });
    } finally {
      setLoading(false);
    }
  };

  const runEmergencyFix = async () => {
    setFixing(true);
    setFixResult(null);
    try {
      const result = await emergencyRepair.emergencyFix();
      setFixResult(result);
      if (result.success) {
        setTimeout(() => {
          runDiagnosis(); // إعادة تشخيص بعد الإصلاح
        }, 1000);
      }
    } catch (error: any) {
      setFixResult({
        success: false,
        message: `فشل الإصلاح: ${error.message}`,
        details: [],
        errors: [error.message],
      });
    } finally {
      setFixing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("تم نسخ الكود! الصقه في Supabase SQL Editor");
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case "medium":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
              <Database className="h-8 w-8 text-red-600" />
              إصلاح الحالات الطارئة
            </h1>
            <p className="text-gray-600 mt-2">
              إصلاح مشاكل قاعدة البيانات والمبيعات
            </p>
          </div>

          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                إعدادات قاعدة البيانات مفقودة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700 mb-4">
                لا يمكن تشغيل أدوات الإصلاح بدون إعدادات Supabase. يرجى:
              </p>
              <ul className="list-disc list-inside space-y-2 text-red-700">
                <li>التأكد من وجود VITE_SUPABASE_URL</li>
                <li>التأكد من وجود VITE_SUPABASE_ANON_KEY</li>
                <li>إعادة تشغيل التطبيق بعد إضافة الإعدادات</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
            <Wrench className="h-8 w-8 text-blue-600" />
            إصلاح مشكلة عدم ظهور المشتريات
          </h1>
          <p className="text-gray-600 mt-2">
            تشخيص وإصلاح مشاكل قاعدة البيانات تلقائياً
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={runDiagnosis}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {loading ? "جاري التشخيص..." : "إعادة التشخيص"}
          </Button>

          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            العودة للرئيسية
          </Button>
        </div>

        {/* Diagnosis Results */}
        {diagnosis && (
          <Card
            className={cn(
              "border-2",
              diagnosis.severity === "critical"
                ? "border-red-200 bg-red-50"
                : diagnosis.severity === "high"
                  ? "border-orange-200 bg-orange-50"
                  : diagnosis.severity === "medium"
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-green-200 bg-green-50",
            )}
          >
            <CardHeader>
              <CardTitle
                className={cn(
                  "flex items-center gap-3",
                  diagnosis.severity === "critical"
                    ? "text-red-800"
                    : diagnosis.severity === "high"
                      ? "text-orange-800"
                      : diagnosis.severity === "medium"
                        ? "text-yellow-800"
                        : "text-green-800",
                )}
              >
                {getSeverityIcon(diagnosis.severity)}
                نتائج التشخيص
                <Badge variant={getSeverityColor(diagnosis.severity)}>
                  {diagnosis.severity === "critical"
                    ? "حرج"
                    : diagnosis.severity === "high"
                      ? "عالي"
                      : diagnosis.severity === "medium"
                        ? "متوسط"
                        : "عادي"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className={cn(
                    "p-4 rounded-lg border text-lg font-semibold",
                    diagnosis.severity === "critical"
                      ? "bg-red-100 border-red-300 text-red-800"
                      : diagnosis.severity === "high"
                        ? "bg-orange-100 border-orange-300 text-orange-800"
                        : diagnosis.severity === "medium"
                          ? "bg-yellow-100 border-yellow-300 text-yellow-800"
                          : "bg-green-100 border-green-300 text-green-800",
                  )}
                >
                  🔍 المشكلة: {diagnosis.problem}
                </div>

                {diagnosis.details && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">تفاصيل المشكلة:</h4>
                    <ul className="space-y-1 text-sm">
                      {diagnosis.details.missingTable && (
                        <li className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          جدول sale_items مفقود
                        </li>
                      )}
                      {diagnosis.details.missingRelations && (
                        <li className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          العلاقات بين الجداول مفقودة
                        </li>
                      )}
                      {diagnosis.details.emptySaleItems && (
                        <li className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          لا توجد تفاصيل منتجات مرتبطة بالمبيعات
                        </li>
                      )}
                      {diagnosis.details.hasOldSales && (
                        <li className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                          يوجد مبيعات قديمة لكن بدون تفاصيل
                        </li>
                      )}
                      {diagnosis.details.healthy && (
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          البنية تبدو سليمة
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Auto Fix Section */}
                {diagnosis.canAutoFix && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      إصلاح تلقائي متاح
                    </h4>
                    <p className="text-blue-700 mb-3">
                      يمكن محاولة إصلاح هذه المشكلة تلقائياً
                    </p>
                    <Button
                      onClick={runEmergencyFix}
                      disabled={fixing}
                      className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                    >
                      {fixing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                      {fixing ? "جاري الإصلاح..." : "بدء ��لإصلاح التلقائي"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fix Results */}
        {fixResult && (
          <Card
            className={
              fixResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <CardHeader>
              <CardTitle
                className={
                  fixResult.success ? "text-green-800" : "text-red-800"
                }
              >
                {fixResult.success ? (
                  <CheckCircle className="h-5 w-5 inline mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 inline mr-2" />
                )}
                نتائج الإصلاح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className={cn(
                    "p-4 rounded-lg border font-semibold",
                    fixResult.success
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-red-100 border-red-300 text-red-800",
                  )}
                >
                  {fixResult.message}
                </div>

                {fixResult.details.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">خطوات مكتملة:</h4>
                    <ul className="space-y-1">
                      {fixResult.details.map(
                        (detail: string, index: number) => (
                          <li key={index} className="text-sm text-green-700">
                            {detail}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {fixResult.errors.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="font-semibold mb-2 text-red-800">
                      مشاكل متبقية:
                    </h4>
                    <ul className="space-y-1">
                      {fixResult.errors.map((error: string, index: number) => (
                        <li key={index} className="text-sm text-red-700">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fixResult.success && (
                  <div className="bg-green-100 p-4 rounded-lg border border-green-300">
                    <p className="text-green-800 font-semibold">
                      🎉 تم الإصلاح بنجاح!
                    </p>
                    <p className="text-green-700 mt-1">
                      يمكنك الآن إضافة المبيعات وستظهر في كشف حساب العميل
                    </p>
                    <Button
                      onClick={() => navigate("/add-sale")}
                      className="mt-3 bg-green-600 hover:bg-green-700"
                    >
                      جرب إضافة بيعة جديدة
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Fix Instructions */}
        {fixInstructions && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-800 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                إرشادات الإصلاح اليدوي
              </CardTitle>
              <CardDescription className="text-yellow-700">
                إذا فشل الإصلاح التلقائي، اتبع هذه الخطوات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Steps */}
                <div>
                  <h4 className="font-semibold mb-3 text-yellow-800">
                    الخطوات:
                  </h4>
                  <ol className="list-decimal list-inside space-y-2">
                    {fixInstructions.steps.map(
                      (step: string, index: number) => (
                        <li key={index} className="text-sm text-yellow-700">
                          {step}
                        </li>
                      ),
                    )}
                  </ol>
                </div>

                <Separator />

                {/* SQL Script */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-yellow-800">
                      الكود المطلوب:
                    </h4>
                    <Button
                      onClick={() => copyToClipboard(fixInstructions.sqlScript)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      نسخ الكود
                    </Button>
                  </div>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                    {fixInstructions.sqlScript}
                  </pre>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    📋 تعليمات مهمة:
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• انسخ الكود كاملاً والصقه في Supabase SQL Editor</li>
                    <li>• تأكد من تشغيل الكود بنجاح قبل إغلاق المحرر</li>
                    <li>• أعد تحميل هذه الصفحة للتحقق من الإصلاح</li>
                    <li>• إذا استمرت المشكلة، تواصل مع المطور</li>
                  </ul>
                </div>

                <div className="text-center">
                  <Button
                    onClick={() =>
                      window.open("https://supabase.com/dashboard", "_blank")
                    }
                    className="bg-green-600 hover:bg-green-700 flex items-center gap-2 mx-auto"
                  >
                    <ExternalLink className="h-4 w-4" />
                    فتح Supabase Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {canProceed && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                النظام يعمل بشكل صحيح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-700 mb-4">
                🎉 تم إصلاح جميع المشاكل! يمكنك الآن:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => navigate("/add-sale")}
                  className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  إضافة بيعة جديدة
                </Button>
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  عرض لوحة التحكم
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default EmergencyFix;
