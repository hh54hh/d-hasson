// Offline Status Indicator for مركز البدر
// مؤشر حالة الاتصال والعمل بدون إنترنت

import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, Database, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { offlineDataManager } from "../lib/offlineDataManager";
import { appInitializer } from "../lib/appInitializer";

interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastSync: string;
  pendingSync: number;
  dataCount: {
    customers: number;
    products: number;
    sales: number;
  };
}

const OfflineIndicator: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isConnected: false,
    lastSync: "لم يتم",
    pendingSync: 0,
    dataCount: { customers: 0, products: 0, sales: 0 },
  });
  const [showDetails, setShowDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Simple status update without heavy operations
  const updateStatus = () => {
    try {
      setStatus((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
        isConnected: navigator.onLine,
      }));
    } catch (error) {
      console.warn("Failed to update status:", error);
    }
  };

  // Lightweight status monitoring
  useEffect(() => {
    updateStatus();

    // Listen to online/offline events only
    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        isConnected: true,
      }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isConnected: false,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Simple manual sync
  const handleSync = async () => {
    try {
      setSyncing(true);
      // Just reload the page for now - simple and effective
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      setSyncing(false);
    }
  };

  // Get status color and icon
  const getStatusInfo = () => {
    if (status.isOnline && status.isConnected) {
      return {
        color: "bg-green-500",
        icon: <Wifi className="w-4 h-4 text-white" />,
        text: "متصل",
        description: "متصل بالإنترنت",
      };
    } else if (status.isOnline && !status.isConnected) {
      return {
        color: "bg-yellow-500",
        icon: <Wifi className="w-4 h-4 text-white" />,
        text: "محدود",
        description: "اتصال محدود",
      };
    } else {
      return {
        color: "bg-gray-500",
        icon: <WifiOff className="w-4 h-4 text-white" />,
        text: "بدون اتصال",
        description: "العمل بدون إنترنت",
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Compact Status Indicator */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-all duration-200 hover:scale-110 ${statusInfo.color}`}
        onClick={() => setShowDetails(!showDetails)}
        title={`${statusInfo.text} - ${statusInfo.description}`}
      >
        {statusInfo.icon}
      </div>

      {/* Detailed Status Panel */}
      {showDetails && (
        <Card className="mt-2 shadow-xl border-2 max-w-sm">
          <CardContent className="p-4 space-y-4">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">حالة الاتصال</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {/* Connection Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">الحالة:</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${statusInfo.color}`}
                  ></div>
                  <span className="font-medium">{statusInfo.text}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">آخر مزامنة:</span>
                <span className="text-xs text-gray-500">{status.lastSync}</span>
              </div>

              {status.pendingSync > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">في الانتظار:</span>
                  <Badge variant="outline" className="text-xs">
                    {status.pendingSync} عنصر
                  </Badge>
                </div>
              )}
            </div>

            {/* Data Count */}
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                البيانات المحلية
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-medium text-blue-600">
                    {status.dataCount.customers}
                  </div>
                  <div className="text-gray-500">عملاء</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-green-600">
                    {status.dataCount.products}
                  </div>
                  <div className="text-gray-500">منتجات</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-purple-600">
                    {status.dataCount.sales}
                  </div>
                  <div className="text-gray-500">مبيعات</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-3 space-y-2">
              {/* Sync Button */}
              {status.isOnline && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="w-full text-xs"
                >
                  {syncing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></div>
                      جاري المزامنة...
                    </>
                  ) : (
                    <>
                      <Database className="w-3 h-3 mr-2" />
                      مزامنة الآن
                    </>
                  )}
                </Button>
              )}

              {/* Force Refresh */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
                className="w-full text-xs"
              >
                إعادة تحميل التطبيق
              </Button>
            </div>

            {/* Offline Mode Alert */}
            {!status.isOnline && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-xs text-blue-800">
                  <div className="flex items-start gap-2">
                    <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">العمل بدون إنترنت</div>
                      <div className="mt-1">
                        جميع التغييرات محفوظة محلياً وستتم المزامنة عند عودة
                        الاتصال
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Sync Success Alert */}
            {status.isOnline && status.pendingSync === 0 && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-xs text-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <div>
                      <div className="font-medium">تمت المزامنة</div>
                      <div>جميع البيانات متزامنة مع الخادم</div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OfflineIndicator;
