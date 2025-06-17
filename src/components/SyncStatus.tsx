import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  Clock,
  Database,
  Upload,
} from "lucide-react";
import { syncStatus, forcSync, uploadLocalData } from "@/lib/offlineSync";

export const SyncStatus: React.FC = () => {
  const [status, setStatus] = useState(syncStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(syncStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleForceSync = async () => {
    setIsRefreshing(true);
    try {
      await forcSync();
      setStatus(syncStatus());
    } catch (error) {
      console.error("Sync failed:", error);
    }
    setIsRefreshing(false);
  };

  const handleUploadData = async () => {
    setIsRefreshing(true);
    try {
      await uploadLocalData();
      setStatus(syncStatus());
    } catch (error) {
      console.error("Upload failed:", error);
    }
    setIsRefreshing(false);
  };

  const getStatusColor = () => {
    if (!status.isOnline) return "destructive";
    if (!status.isConfigured) return "secondary";
    if (status.pending > 0) return "default";
    return "default";
  };

  const getStatusIcon = () => {
    if (!status.isOnline) return <WifiOff className="h-3 w-3" />;
    if (status.pending > 0) return <Clock className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (!status.isOnline) return "غير متصل";
    if (!status.isConfigured) return "قاعدة البيانات غير مفعلة";
    if (status.pending > 0) return `${status.pending} في الانتظار`;
    return "متزامن";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {getStatusIcon()}
          <Badge variant={getStatusColor()} className="text-xs">
            {getStatusText()}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" dir="rtl">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold">حالة المزامنة</h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">الاتصال:</span>
              <div className="flex items-center gap-1">
                {status.isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">
                  {status.isOnline ? "متصل" : "غير متصل"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">قاعدة البيانات:</span>
              <span className="text-sm">
                {status.isConfigured ? "مفعلة" : "غير مفعلة"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">العمليات المعلقة:</span>
              <Badge variant={status.pending > 0 ? "default" : "secondary"}>
                {status.pending}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">إجمالي العمليات:</span>
              <span className="text-sm">{status.total}</span>
            </div>
          </div>

          {status.isConfigured && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={handleForceSync}
                disabled={isRefreshing || !status.isOnline}
                className="flex-1"
              >
                {isRefreshing ? (
                  <RefreshCw className="h-3 w-3 animate-spin ml-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 ml-1" />
                )}
                مزامنة
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleUploadData}
                disabled={isRefreshing || !status.isOnline}
                className="flex-1"
              >
                {isRefreshing ? (
                  <RefreshCw className="h-3 w-3 animate-spin ml-1" />
                ) : (
                  <Upload className="h-3 w-3 ml-1" />
                )}
                رفع البيانات
              </Button>
            </div>
          )}

          {!status.isConfigured && (
            <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
              💡 لتفعيل المزامنة مع قاعدة البيانات، يرجى إعداد Supabase في ملف
              البيئة (.env)
            </div>
          )}

          {!status.isOnline && (
            <div className="text-xs text-gray-500 bg-red-50 p-2 rounded">
              📴 التطبيق يعمل في وضع عدم الاتصال. سيتم مزامنة البيانات عند
              استعادة الاتصال.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
