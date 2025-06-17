import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Trash2,
  Settings,
  Wifi,
  WifiOff,
  Clock,
  Database,
  Loader2,
} from "lucide-react";
import { SyncErrorManager } from "@/lib/syncErrorManager";
import { offlineManager } from "@/lib/offlineManager";
import { QuickSyncCleanup } from "@/lib/quickSyncCleanup";

interface SyncReport {
  queueSize: number;
  blacklistedCount: number;
  oldestOperation: string | null;
  connectionStatus: {
    isOnline: boolean;
    canReachSupabase: boolean;
    latency: number;
    error?: string;
  };
  recommendations: string[];
}

const SyncErrorManagerComponent: React.FC = () => {
  const [report, setReport] = useState<SyncReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const syncReport = await SyncErrorManager.getSyncReport();
      setReport(syncReport);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error loading sync report:", error);
    } finally {
      setLoading(false);
    }
  };

  const performCleanup = async () => {
    try {
      setCleaning(true);
      setProgress(0);

      // محاكاة تقدم العملية
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const result = await SyncErrorManager.performSystemCleanup();

      clearInterval(progressInterval);
      setProgress(100);

      // عرض النتائج
      if (result.success) {
        alert(
          `✅ تم التنظيف بنجاح!\n\n` +
            `🔧 عمليات مُصلحة: ${result.report.stuckOperationsFixed}\n` +
            `🗑️ مكررات محذوفة: ${result.report.duplicatesRemoved}\n` +
            `🚫 عمليات محظورة: ${result.report.blacklistedOperations}\n` +
            `📶 حالة الاتصال: ${result.report.connectionStatus.canReachSupabase ? "متصل" : "غير متصل"}`,
        );
      } else {
        alert(`❌ فشل في التنظيف:\n\n${result.errors.join("\n")}`);
      }

      // تحديث التقرير
      await loadReport();

      setTimeout(() => {
        setCleaning(false);
        setProgress(0);
      }, 1000);
    } catch (error: any) {
      console.error("Error during cleanup:", error);
      alert(`❌ خطأ في التنظيف: ${error.message}`);
      setCleaning(false);
      setProgress(0);
    }
  };

  const clearAllQueue = async () => {
    if (
      !confirm(
        "⚠️ هل أنت متأكد؟\n\nسيتم حذف جميع العمليات المحفوظة محلياً. هذا الإجراء لا يمكن التراجع عنه.",
      )
    ) {
      return;
    }

    try {
      offlineManager.clearQueue();
      await loadReport();
      alert("✅ تم حذف جميع العمليات من الطابور");
    } catch (error: any) {
      console.error("Error clearing queue:", error);
      alert(`❌ فشل في حذف الطابور: ${error.message}`);
    }
  };

  const forceSync = async () => {
    try {
      setLoading(true);
      await offlineManager.forceSync();
      await loadReport();
      alert("✅ تمت المزامنة بنجاح");
    } catch (error: any) {
      console.error("Error during force sync:", error);
      alert(`❌ فشل في المزامنة: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const quickFix = async () => {
    try {
      setCleaning(true);
      setProgress(20);

      const result = await QuickSyncCleanup.fixSpecificConnectionErrors();

      setProgress(100);

      if (result.success) {
        alert(
          `✅ ${result.message}\n\n` +
            `🔍 عمليات مكتشفة: ${result.details.operationsFound.length}\n` +
            `🗑️ عمليات محذوفة: ${result.details.operationsRemoved.length}\n` +
            `📶 الاتصال مستعاد: ${result.details.connectivityRestored ? "نعم" : "لا"}`,
        );
      } else {
        alert(`❌ ${result.message}`);
      }

      await loadReport();

      setTimeout(() => {
        setCleaning(false);
        setProgress(0);
      }, 1000);
    } catch (error: any) {
      console.error("Error during quick fix:", error);
      alert(`❌ فشل في الحل السريع: ${error.message}`);
      setCleaning(false);
      setProgress(0);
    }
  };

  const getConnectionStatusColor = () => {
    if (!report) return "bg-gray-100 text-gray-800";

    if (report.connectionStatus.canReachSupabase) {
      return "bg-green-100 text-green-800 border-green-300";
    } else if (report.connectionStatus.isOnline) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    } else {
      return "bg-red-100 text-red-800 border-red-300";
    }
  };

  const getConnectionIcon = () => {
    if (!report) return <Wifi className="h-4 w-4" />;

    if (report.connectionStatus.canReachSupabase) {
      return <Wifi className="h-4 w-4 text-green-600" />;
    } else {
      return <WifiOff className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">مدير أخطاء المزامنة</h3>
          <p className="text-sm text-gray-600">
            إدارة وحل مشاكل المزامنة مع قاعدة البيانات
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadReport}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`}
            />
            تحديث
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {cleaning && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">جاري تنظيف النظام...</span>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getConnectionIcon()}
            حالة الاتصال
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>حالة الشبكة:</span>
                <Badge
                  className={
                    report.connectionStatus.isOnline
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {report.connectionStatus.isOnline ? "متصل" : "غير متصل"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>الوصول لقاعدة البيانات:</span>
                <Badge className={getConnectionStatusColor()}>
                  {report.connectionStatus.canReachSupabase
                    ? "متاح"
                    : "غير متاح"}
                </Badge>
              </div>
              {report.connectionStatus.latency > 0 && (
                <div className="flex items-center justify-between">
                  <span>زمن الاستجابة:</span>
                  <span className="text-sm">
                    {report.connectionStatus.latency}ms
                  </span>
                </div>
              )}
              {report.connectionStatus.error && (
                <div className="text-sm text-red-600">
                  <strong>الخطأ:</strong> {report.connectionStatus.error}
                </div>
              )}
              {lastUpdate && (
                <div className="text-xs text-gray-500">
                  آخر فحص: {lastUpdate.toLocaleTimeString("ar-SA")}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            حالة طابور المزامنة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {report.queueSize}
                  </div>
                  <div className="text-sm text-blue-700">عمليات في الطابور</div>
                </div>
                <div className="text-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {report.blacklistedCount}
                  </div>
                  <div className="text-sm text-red-700">عمليات محظورة</div>
                </div>
              </div>

              {report.oldestOperation && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">أقدم عملية:</span>
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">
                    {report.oldestOperation}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              التوصيات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.recommendations.map((recommendation, index) => (
                <Alert key={index}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>الإجراءات المتاحة</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Quick Fix Button - Featured */}
          {report && (report.queueSize > 0 || report.blacklistedCount > 0) && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                حل سريع لأخطاء الاتصال المتكررة
              </h4>
              <p className="text-sm text-orange-700 mb-3">
                يحل مشكلة "الاتصال مؤقتاً غير متوفر" والعمليات العالقة تلقائياً
              </p>
              <Button
                onClick={quickFix}
                disabled={cleaning || loading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {cleaning ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 ml-2" />
                )}
                إصلاح سريع الآن
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={performCleanup}
              disabled={cleaning || loading}
              className="flex flex-col items-center gap-2 h-auto p-4"
            >
              {cleaning ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Settings className="h-6 w-6" />
              )}
              <span>تنظيف شامل</span>
              <span className="text-xs opacity-75">إصلاح العمليات العالقة</span>
            </Button>

            <Button
              onClick={forceSync}
              disabled={cleaning || loading}
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto p-4"
            >
              <RefreshCw className="h-6 w-6" />
              <span>فرض المزامنة</span>
              <span className="text-xs opacity-75">محاولة مزامنة فورية</span>
            </Button>

            <Button
              onClick={clearAllQueue}
              disabled={cleaning || loading}
              variant="destructive"
              className="flex flex-col items-center gap-2 h-auto p-4"
            >
              <Trash2 className="h-6 w-6" />
              <span>حذف الطابور</span>
              <span className="text-xs opacity-75">حذف جميع العمليات</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      {report && (
        <Alert
          className={
            report.queueSize === 0 && report.blacklistedCount === 0
              ? "border-green-200 bg-green-50"
              : "border-yellow-200 bg-yellow-50"
          }
        >
          {report.queueSize === 0 && report.blacklistedCount === 0 ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          )}
          <AlertDescription>
            {report.queueSize === 0 && report.blacklistedCount === 0 ? (
              <span className="text-green-800">
                ✅ النظام يعمل بشكل طبيعي - لا توجد مشاكل في المزامنة
              </span>
            ) : (
              <span className="text-yellow-800">
                ⚠️ توجد بعض المشاكل في المزامنة - يُنصح بالتنظيف
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SyncErrorManagerComponent;
