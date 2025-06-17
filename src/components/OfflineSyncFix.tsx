import React, { useState, useEffect } from "react";
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
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Users,
  Trash2,
  Wrench,
} from "lucide-react";
import { offlineManager } from "@/lib/offlineManager";
import { OfflineSyncFixer } from "@/lib/offlineSyncFixer";

const OfflineSyncFix: React.FC = () => {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runDiagnosis();
  }, []);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const result = await OfflineSyncFixer.quickDiagnosis();
      setDiagnosis(result);
    } catch (error) {
      console.error("Diagnosis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const runFix = async () => {
    setFixing(true);
    setFixResult(null);
    try {
      const result = await OfflineSyncFixer.fixMissingOfflineCustomers();
      setFixResult(result);

      // إعادة التشخيص بعد الإصلاح
      setTimeout(() => {
        runDiagnosis();
      }, 1000);
    } catch (error: any) {
      setFixResult({
        success: false,
        message: `فشل الإصلاح: ${error.message}`,
        details: { error },
      });
    } finally {
      setFixing(false);
    }
  };

  const cleanupQueue = async () => {
    try {
      setLoading(true);
      const cleaned = await offlineManager.cleanupFailedOperations();
      alert(`✅ تم تنظيف ${cleaned} عملية تالفة`);
      runDiagnosis();
    } catch (error: any) {
      alert(`❌ فشل التنظيف: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const forceSync = async () => {
    try {
      setLoading(true);
      await offlineManager.forceSync();
      alert("✅ تم فرض المزامنة");
      runDiagnosis();
    } catch (error: any) {
      alert(`❌ فشل المزامنة: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAllCache = () => {
    if (
      window.confirm(
        "⚠️ هل أنت متأكد من حذف جميع البيانات المحلية؟\nهذا سيمحو جميع البيانات غير المُزامنة!",
      )
    ) {
      offlineManager.clearCache();
      alert("🗑️ تم حذف جميع البيانات المحلية");
      runDiagnosis();
    }
  };

  const getSeverityColor = (count: number, threshold: number) => {
    if (count === 0) return "border-green-200 bg-green-50";
    if (count <= threshold) return "border-yellow-200 bg-yellow-50";
    return "border-red-200 bg-red-50";
  };

  const getSeverityIcon = (count: number, threshold: number) => {
    if (count === 0) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (count <= threshold)
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          إصلاح مشاكل المزامنة الأوف لاين
        </CardTitle>
        <CardDescription>
          تشخيص وإصلاح مشاكل العملاء الأوف لاين المفقودين
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={runDiagnosis}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            إعادة التشخيص
          </Button>

          {diagnosis && diagnosis.missingCustomers.length > 0 && (
            <Button
              onClick={runFix}
              disabled={fixing}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <Wrench className={`h-4 w-4 ${fixing ? "animate-spin" : ""}`} />
              {fixing ? "جاري الإصلاح..." : "إصلاح العملاء المفقودين"}
            </Button>
          )}

          <Button
            onClick={cleanupQueue}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            تنظيف الطابور
          </Button>

          <Button
            onClick={forceSync}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            فرض المزامنة
          </Button>

          <Button
            onClick={clearAllCache}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            حذف جميع البيانات
          </Button>
        </div>

        {/* Diagnosis Results */}
        {diagnosis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-lg border ${getSeverityColor(diagnosis.queueSize, 20)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getSeverityIcon(diagnosis.queueSize, 20)}
                <span className="font-semibold">طابور العمليات</span>
              </div>
              <div className="text-2xl font-bold">{diagnosis.queueSize}</div>
              <div className="text-sm opacity-70">عملية في الانتظار</div>
            </div>

            <div
              className={`p-4 rounded-lg border ${getSeverityColor(diagnosis.offlineCustomers, 5)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getSeverityIcon(diagnosis.offlineCustomers, 5)}
                <span className="font-semibold">عملاء أوف لاين</span>
              </div>
              <div className="text-2xl font-bold">
                {diagnosis.offlineCustomers}
              </div>
              <div className="text-sm opacity-70">عميل مؤقت</div>
            </div>

            <div
              className={`p-4 rounded-lg border ${getSeverityColor(diagnosis.missingCustomers.length, 0)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getSeverityIcon(diagnosis.missingCustomers.length, 0)}
                <span className="font-semibold">عملاء مفقودين</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {diagnosis.missingCustomers.length}
              </div>
              <div className="text-sm opacity-70">يحتاج إصلاح</div>
            </div>

            <div
              className={`p-4 rounded-lg border ${getSeverityColor(diagnosis.corruptedOperations, 3)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getSeverityIcon(diagnosis.corruptedOperations, 3)}
                <span className="font-semibold">عمليات تالفة</span>
              </div>
              <div className="text-2xl font-bold">
                {diagnosis.corruptedOperations}
              </div>
              <div className="text-sm opacity-70">فشلت عدة مرات</div>
            </div>
          </div>
        )}

        {/* Missing Customers Details */}
        {diagnosis && diagnosis.missingCustomers.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <h4 className="font-semibold text-red-800">
                  🚨 عملاء مفقودين من الكاش:
                </h4>
                <div className="space-y-1">
                  {diagnosis.missingCustomers.slice(0, 5).map((id: string) => (
                    <div
                      key={id}
                      className="text-sm text-red-700 font-mono bg-red-100 p-1 rounded"
                    >
                      {id}
                    </div>
                  ))}
                  {diagnosis.missingCustomers.length > 5 && (
                    <div className="text-sm text-red-600">
                      و {diagnosis.missingCustomers.length - 5} عملاء آخرين...
                    </div>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Recommendations */}
        {diagnosis && diagnosis.recommendations.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-800">💡 توصيات:</h4>
                <ul className="space-y-1">
                  {diagnosis.recommendations.map(
                    (rec: string, index: number) => (
                      <li key={index} className="text-sm text-blue-700">
                        • {rec}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Fix Result */}
        {fixResult && (
          <Alert
            className={
              fixResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            {fixResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <h4
                  className={`font-semibold ${fixResult.success ? "text-green-800" : "text-red-800"}`}
                >
                  نتيجة الإصلاح:
                </h4>
                <p
                  className={
                    fixResult.success ? "text-green-700" : "text-red-700"
                  }
                >
                  {fixResult.message}
                </p>
                {fixResult.details && (
                  <div className="text-sm bg-white/50 p-2 rounded">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(fixResult.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Summary */}
        {diagnosis &&
          diagnosis.missingCustomers.length === 0 &&
          diagnosis.corruptedOperations === 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="text-green-800">
                  <h4 className="font-semibold">✅ النظام يعمل بشكل صحيح</h4>
                  <p className="text-sm">
                    لا توجد مشاكل في المزامنة الأوف لاين
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
      </CardContent>
    </Card>
  );
};

export default OfflineSyncFix;
