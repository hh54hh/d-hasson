import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { ConnectionManager } from "../lib/connectionManager";
import { supabaseService } from "../lib/supabaseService";
import { NetworkStatusDetector } from "../lib/networkStatusDetector";
import { logError, formatError } from "../lib/utils";

interface ConnectionDiagnosticProps {
  className?: string;
}

export const ConnectionDiagnostic: React.FC<ConnectionDiagnosticProps> = ({
  className = "",
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    lastCheck: 0,
    retryAttempts: 0,
  });
  const [testResults, setTestResults] = useState({
    networkOnline: navigator.onLine,
    networkQuality: "good" as "good" | "poor" | "offline",
    supabaseConfigured: false,
    databaseConnection: false,
    productsReadable: false,
    lastError: "",
  });

  useEffect(() => {
    // مراقبة حالة الشبكة
    const handleOnline = () => {
      setTestResults((prev) => ({ ...prev, networkOnline: true }));
    };

    const handleOffline = () => {
      setTestResults((prev) => ({ ...prev, networkOnline: false }));
    };

    const handleNetworkStatusChange = (isOnline: boolean) => {
      const status = NetworkStatusDetector.getStatus();
      setTestResults((prev) => ({
        ...prev,
        networkOnline: isOnline,
        networkQuality: status.quality,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    NetworkStatusDetector.addListener(handleNetworkStatusChange);

    // فحص أولي
    runDiagnostics();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      NetworkStatusDetector.removeListener(handleNetworkStatusChange);
    };
  }, []);

  const runDiagnostics = async () => {
    setIsChecking(true);
    setTestResults((prev) => ({ ...prev, lastError: "" }));

    try {
      // 1. فحص حالة الشبكة المتقدم
      const networkStatus = NetworkStatusDetector.getStatus();
      console.log("🌐 حالة الشبكة:", {
        online: networkStatus.isOnline,
        quality: networkStatus.quality,
        stable: NetworkStatusDetector.isConnectionStable(),
      });

      // 2. فحص إعدادات Supabase
      const supabaseConfigured = !!(
        import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      console.log(
        "⚙️ إعدادات Supabase:",
        supabaseConfigured ? "موجودة" : "مفقودة",
      );

      // 3. فحص الاتصال بقاعدة البيانات
      let databaseConnection = false;
      try {
        await ConnectionManager.ensureConnectionWithRetry();
        databaseConnection = true;
        console.log("✅ الاتصال بقاعدة البيانات ناجح");
      } catch (dbError: any) {
        console.warn("❌ فشل الاتصال بقاعدة البيانات:", formatError(dbError));
        setTestResults((prev) => ({
          ...prev,
          lastError: formatError(dbError),
        }));
      }

      // 4. فحص قراءة المنتجات
      let productsReadable = false;
      if (databaseConnection) {
        try {
          const products = await supabaseService.getProducts();
          productsReadable = true;
          console.log("📦 تم قراءة المنتجات بنجاح:", products.length, "منتج");
        } catch (productsError: any) {
          console.warn("❌ فشل في قراءة المنتجات:", formatError(productsError));
          if (!testResults.lastError) {
            setTestResults((prev) => ({
              ...prev,
              lastError: formatError(productsError),
            }));
          }
        }
      }

      // 5. الحصول على حالة الاتصال من ConnectionManager
      const status = ConnectionManager.getConnectionStatus();

      setConnectionStatus(status);
      setTestResults({
        networkOnline: networkStatus.isOnline,
        networkQuality: networkStatus.quality,
        supabaseConfigured,
        databaseConnection,
        productsReadable,
        lastError: testResults.lastError,
      });
    } catch (error: any) {
      logError("فشل في تشخيص الاتصال:", error);
      setTestResults((prev) => ({
        ...prev,
        lastError: formatError(error),
      }));
    } finally {
      setIsChecking(false);
    }
  };

  const fixConnection = async () => {
    setIsChecking(true);
    try {
      // إعادة تعيين حالة الاتصال
      ConnectionManager.resetConnectionState();
      console.log("🔄 تم إعادة تعيين حالة الاتصال");

      // إعادة المحاولة
      await runDiagnostics();

      console.log("✅ تم إنعاش الاتصال");
    } catch (error: any) {
      logError("فشل في إصلاح الاتصال:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (
    status: boolean,
    successText: string,
    failText: string,
  ) => {
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? successText : failText}
      </Badge>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {testResults.networkOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          تشخيص الاتصال
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* حالة الاتصال العامة */}
        <div className="flex items-center justify-between">
          <span>حالة الاتصال العامة:</span>
          {getStatusBadge(
            testResults.databaseConnection && testResults.productsReadable,
            "يعمل بشكل طبيعي",
            "يوجد مشاكل",
          )}
        </div>

        {/* تفاصيل الفحوصات */}
        <div className="space-y-2 border rounded-lg p-3">
          <h4 className="font-medium text-sm">تفاصيل الفحص:</h4>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {getStatusIcon(testResults.networkOnline)}
              اتصال الإنترنت
            </span>
            {getStatusBadge(testResults.networkOnline, "متصل", "غير متصل")}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {getStatusIcon(testResults.supabaseConfigured)}
              إعدادات قاعدة البيانات
            </span>
            {getStatusBadge(testResults.supabaseConfigured, "موجودة", "مفقودة")}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {getStatusIcon(testResults.databaseConnection)}
              الاتصال بقاعدة البيانات
            </span>
            {getStatusBadge(
              testResults.databaseConnection,
              "متصل",
              "فشل الاتصال",
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {getStatusIcon(testResults.productsReadable)}
              قراءة المنتجات
            </span>
            {getStatusBadge(testResults.productsReadable, "تعمل", "لا تعمل")}
          </div>
        </div>

        {/* إحصائيات الاتصال */}
        {connectionStatus.lastCheck > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-sm">إحصائيات الاتصال:</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>آخر فحص:</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(connectionStatus.lastCheck).toLocaleTimeString(
                    "ar-SA",
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>محاولات إعادة الاتصال:</span>
                <span>{connectionStatus.retryAttempts}</span>
              </div>
            </div>
          </div>
        )}

        {/* رسالة الخطأ */}
        {testResults.lastError && (
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>آخر خطأ:</strong> {testResults.lastError}
            </AlertDescription>
          </Alert>
        )}

        {/* أزرار التحكم */}
        <div className="flex gap-2">
          <Button
            onClick={runDiagnostics}
            disabled={isChecking}
            size="sm"
            variant="outline"
          >
            {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            إعادة الفحص
          </Button>

          <Button
            onClick={fixConnection}
            disabled={isChecking || testResults.databaseConnection}
            size="sm"
          >
            {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            إصلاح الاتصال
          </Button>
        </div>

        {/* نصائح للإصلاح */}
        {!testResults.databaseConnection && (
          <Alert>
            <AlertDescription className="text-sm space-y-2">
              <div>
                <strong>خطوات الإصلاح المقترحة:</strong>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {!testResults.networkOnline && <li>تحقق من اتصال الإنترنت</li>}
                {!testResults.supabaseConfigured && (
                  <li>تحقق من إعدادات قاعدة البيانات في ملف .env</li>
                )}
                {testResults.networkOnline &&
                  testResults.supabaseConfigured && (
                    <>
                      <li>انتظر قليلاً ثم أعد المحاولة</li>
                      <li>تحقق من حالة خدمة Supabase</li>
                      <li>أعد تشغيل التطبيق</li>
                    </>
                  )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionDiagnostic;
