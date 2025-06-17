import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Loader2,
} from "lucide-react";
import { ConnectionThrottler } from "../lib/connectionThrottler";

interface ThrottlerMonitorProps {
  className?: string;
}

export const ThrottlerMonitor: React.FC<ThrottlerMonitorProps> = ({
  className = "",
}) => {
  const [status, setStatus] = useState({
    activeRequests: 0,
    longestRunningRequest: 0,
    queuedRequests: 0,
    systemHealth: "healthy" as "healthy" | "warning" | "critical",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // تحديث الحالة
  const updateStatus = () => {
    try {
      const systemStatus = ConnectionThrottler.getSystemStatus();
      setStatus(systemStatus);
    } catch (error) {
      console.warn("فشل في الحصول على حالة النظام:", error);
    }
  };

  // تحديث تلقائي
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(updateStatus, 2000); // كل ثانيتين
      updateStatus(); // تحديث فوري

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // تحديث يدوي
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    updateStatus();
    setIsRefreshing(false);
  };

  // إعادة تعيين النظام
  const handleReset = () => {
    ConnectionThrottler.reset();
    updateStatus();
  };

  // تنظيف الطلبات المعلقة
  const handleCleanup = () => {
    ConnectionThrottler.cleanupStuckRequests();
    updateStatus();
  };

  // تنظيف قسري
  const handleForceCleanup = () => {
    ConnectionThrottler.forceCleanup();
    updateStatus();
  };

  // الحصول على لون الحالة
  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "critical":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  // الحصول على أيقونة الحالة
  const getHealthIcon = (health: string) => {
    switch (health) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // تحويل الوقت لصيغة قابلة للقراءة
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // حساب النسبة المئوية للاستخدام
  const usagePercentage = Math.round(
    (status.activeRequests / 3) * 100, // maxConcurrentRequests = 3
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            مراقب تنظيم الاتصال
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                status.systemHealth === "critical"
                  ? "destructive"
                  : status.systemHealth === "warning"
                    ? "secondary"
                    : "default"
              }
            >
              {status.systemHealth === "healthy"
                ? "سليم"
                : status.systemHealth === "warning"
                  ? "تحذير"
                  : "حرج"}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* الحالة العامة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {status.activeRequests}
            </div>
            <div className="text-sm text-muted-foreground">طلبات نشطة</div>
          </div>

          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {status.queuedRequests}
            </div>
            <div className="text-sm text-muted-foreground">طلبات منتظرة</div>
          </div>

          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {formatDuration(status.longestRunningRequest)}
            </div>
            <div className="text-sm text-muted-foreground">أطول طلب</div>
          </div>

          <div className="text-center p-3 border rounded-lg">
            <div
              className={`text-2xl font-bold ${getHealthColor(status.systemHealth)}`}
            >
              {usagePercentage}%
            </div>
            <div className="text-sm text-muted-foreground">الاستخدام</div>
          </div>
        </div>

        {/* شريط التقدم */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>استخدام النظام</span>
            <span>{status.activeRequests}/3 طلبات</span>
          </div>
          <Progress
            value={usagePercentage}
            className={`h-2 ${
              usagePercentage > 80
                ? "bg-red-100"
                : usagePercentage > 60
                  ? "bg-yellow-100"
                  : "bg-green-100"
            }`}
          />
        </div>

        {/* تحذيرات */}
        {status.systemHealth !== "healthy" && (
          <Alert>
            {getHealthIcon(status.systemHealth)}
            <AlertDescription>
              {status.systemHealth === "critical" && (
                <div>
                  <strong>حالة حرجة:</strong> النظام مزدحم أو هناك طلبات معلقة.
                  {status.longestRunningRequest > 15000 &&
                    " يوجد طلب يعمل منذ أكثر من 15 ثانية."}
                </div>
              )}
              {status.systemHealth === "warning" && (
                <div>
                  <strong>تحذير:</strong> النظام مشغول. قد تحدث تأخيرات في
                  الاستجابة.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* عناصر التحكم */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            تحديث
          </Button>

          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
            variant={autoRefresh ? "default" : "outline"}
          >
            <Clock className="mr-2 h-4 w-4" />
            {autoRefresh ? "إيقاف التحديث التلقائي" : "تشغيل التحديث التلقائي"}
          </Button>

          <Button onClick={handleCleanup} size="sm" variant="secondary">
            <Zap className="mr-2 h-4 w-4" />
            تنظيف الطلبات المعلقة
          </Button>

          <Button onClick={handleReset} size="sm" variant="destructive">
            <RefreshCw className="mr-2 h-4 w-4" />
            إعادة تعيين النظام
          </Button>

          {status.systemHealth === "critical" && (
            <Button
              onClick={handleForceCleanup}
              size="sm"
              variant="destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              تنظيف قسري
            </Button>
          )}
        </div>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>• الحد الأقصى للطلبات المتزامنة: 3</div>
          <div>• الحد الأدنى للتأخير: 500ms</div>
          <div>• مهلة انتظار الطلب: 30s</div>
          <div>• تنظيف تلقائي للطلبات المعلقة: 15s</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThrottlerMonitor;
