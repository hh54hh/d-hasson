import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Settings, RefreshCw } from "lucide-react";
import { InventoryUpdateDiagnostic } from "@/lib/inventoryUpdateDiagnostic";
import { SchemaValidator } from "@/lib/schemaValidator";

interface DiagnosticResult {
  status: "success" | "error" | "warning";
  message: string;
  details?: string;
}

const InventoryDiagnostic: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      console.log("🔧 Starting inventory diagnostic...");

      // Test schema validation first
      setResults((prev) => [
        ...prev,
        { status: "warning", message: "فحص تطابق هيكل قاعدة البيانات..." },
      ]);

      const schemaValidation = await SchemaValidator.validateProductsSchema();

      if (schemaValidation.isValid) {
        setResults((prev) => [
          ...prev.slice(0, -1),
          { status: "success", message: "✅ هيكل قاعدة البيانات صحيح" },
        ]);
      } else {
        setResults((prev) => [
          ...prev.slice(0, -1),
          {
            status: "error",
            message: "❌ مشكلة في هيكل قاعدة البيانات",
            details: `المشاكل: ${schemaValidation.issues.join(", ")}. الحلول: ${schemaValidation.recommendations.join(", ")}`,
          },
        ]);
        return;
      }

      // Test database health
      setResults((prev) => [
        ...prev,
        { status: "warning", message: "فحص حالة قاعدة البيانات..." },
      ]);

      const healthCheck = await InventoryUpdateDiagnostic.checkDatabaseHealth();

      if (healthCheck.success) {
        setResults((prev) => [
          ...prev.slice(0, -1),
          {
            status: "success",
            message: `✅ قاعدة البيانات تعمل بشكل صحيح (${healthCheck.details.productsCount} منتج)`,
          },
        ]);
      } else {
        setResults((prev) => [
          ...prev.slice(0, -1),
          {
            status: "error",
            message: "❌ مشكلة في قاعدة البيانات",
            details: `المشاكل: ${healthCheck.issues.join(", ")}`,
          },
        ]);
        return;
      }

      // Test inventory update
      setResults((prev) => [
        ...prev,
        { status: "warning", message: "اختبار تحديث المخزون..." },
      ]);

      const diagnosticResult =
        await InventoryUpdateDiagnostic.runFullDiagnostic();

      if (diagnosticResult.success) {
        setResults((prev) => [
          ...prev.slice(0, -1),
          { status: "success", message: "✅ تحديث المخزون يعمل بشكل صحيح" },
        ]);
      } else {
        setResults((prev) => [
          ...prev.slice(0, -1),
          {
            status: "error",
            message: "❌ فشل في اختبار تحديث المخزون",
            details: diagnosticResult.summary,
          },
        ]);
      }

      setLastRun(new Date());
    } catch (error: any) {
      console.error("Diagnostic error:", error);
      setResults((prev) => [
        ...prev,
        {
          status: "error",
          message: "❌ فشل في تشغيل التشخيص",
          details: error.message || "خطأ غير معروف",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            نجح
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">فشل</Badge>
        );
      case "warning":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            قيد التشغيل
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
            غير معروف
          </Badge>
        );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            تشخيص أخطاء المخزون
          </CardTitle>
          <Button
            onClick={runDiagnostic}
            disabled={isRunning}
            size="sm"
            variant="outline"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Settings className="h-4 w-4 ml-2" />
            )}
            {isRunning ? "جاري التشخيص..." : "تشغيل التشخيص"}
          </Button>
        </div>
        {lastRun && (
          <p className="text-sm text-gray-600">
            آخر تشغيل: {lastRun.toLocaleString("ar-SA")}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>لم يتم تشغيل التشخيص بعد</p>
            <p className="text-sm">اضغط على "تشغيل التشخيص" لفحص النظام</p>
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg border"
          >
            {getStatusIcon(result.status)}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">{result.message}</p>
                {getStatusBadge(result.status)}
              </div>
              {result.details && (
                <p className="text-sm text-gray-600 mt-1">{result.details}</p>
              )}
            </div>
          </div>
        ))}

        {results.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              💡 <strong>نصيحة:</strong> إذا كانت هناك أخطاء، تحقق من console
              المتصفح (F12) للحصول على تفاصيل أكثر. يمكن أيضاً تشغيل سكريبت{" "}
              <code>CRITICAL_DATABASE_FIX.sql</code> في Supabase لإصلاح مشاكل
              قاعدة البيانات.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryDiagnostic;
