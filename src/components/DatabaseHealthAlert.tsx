import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  Wrench,
  RefreshCw,
  X,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { emergencyRepair } from "@/lib/emergencyRepair";
import { isSupabaseConfigured } from "@/lib/supabase";

interface DatabaseHealthAlertProps {
  className?: string;
}

const DatabaseHealthAlert: React.FC<DatabaseHealthAlertProps> = ({
  className,
}) => {
  const [healthStatus, setHealthStatus] = useState<{
    hasIssues: boolean;
    severity: "critical" | "high" | "medium" | null;
    problem: string;
    canAutoFix: boolean;
    loading: boolean;
    dismissed: boolean;
  }>({
    hasIssues: false,
    severity: null,
    problem: "",
    canAutoFix: false,
    loading: true,
    dismissed: false,
  });

  useEffect(() => {
    checkDatabaseHealth();
  }, []);

  const checkDatabaseHealth = async () => {
    if (!isSupabaseConfigured) {
      setHealthStatus({
        hasIssues: true,
        severity: "critical",
        problem: "إعدادات قاعدة البيانات مفقودة",
        canAutoFix: false,
        loading: false,
        dismissed: false,
      });
      return;
    }

    try {
      const diagnosis = await emergencyRepair.quickDiagnosis();

      // Only show alert for critical and high severity issues
      const shouldAlert =
        diagnosis.severity === "critical" || diagnosis.severity === "high";

      setHealthStatus({
        hasIssues: shouldAlert,
        severity: shouldAlert ? diagnosis.severity : null,
        problem: diagnosis.problem,
        canAutoFix: diagnosis.canAutoFix,
        loading: false,
        dismissed: false,
      });
    } catch (error) {
      console.warn("Health check failed:", error);
      setHealthStatus({
        hasIssues: false,
        severity: null,
        problem: "",
        canAutoFix: false,
        loading: false,
        dismissed: false,
      });
    }
  };

  const dismissAlert = () => {
    setHealthStatus((prev) => ({ ...prev, dismissed: true }));
  };

  const refreshCheck = () => {
    setHealthStatus((prev) => ({ ...prev, loading: true }));
    checkDatabaseHealth();
  };

  // Don't render if no issues, loading failed, or dismissed
  if (!healthStatus.hasIssues || healthStatus.dismissed) {
    return null;
  }

  if (healthStatus.loading) {
    return (
      <div
        className={cn(
          "bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3",
          className,
        )}
      >
        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
        <span className="text-blue-800 text-sm">
          فحص حالة قاعدة البيانات...
        </span>
      </div>
    );
  }

  const severityConfig = {
    critical: {
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-800",
      badgeVariant: "destructive" as const,
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      badgeText: "حرج",
    },
    high: {
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      textColor: "text-orange-800",
      badgeVariant: "destructive" as const,
      icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
      badgeText: "عالي",
    },
    medium: {
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      textColor: "text-yellow-800",
      badgeVariant: "secondary" as const,
      icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
      badgeText: "متوسط",
    },
  };

  const config = severityConfig[healthStatus.severity!];

  return (
    <div
      className={cn(
        "rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-top-2",
        config.bgColor,
        config.borderColor,
        "border",
        className,
      )}
    >
      {/* Icon */}
      {config.icon}

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("font-semibold text-sm", config.textColor)}>
            مشكلة في قاعدة البيانات
          </span>
          <Badge variant={config.badgeVariant} className="text-xs">
            {config.badgeText}
          </Badge>
        </div>
        <p className={cn("text-xs", config.textColor)}>
          {healthStatus.problem}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Refresh Button */}
        <Button
          onClick={refreshCheck}
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={healthStatus.loading}
        >
          <RefreshCw
            className={cn(
              "h-3 w-3",
              healthStatus.loading && "animate-spin",
              config.textColor,
            )}
          />
        </Button>

        {/* Fix Button */}
        <Link to="/emergency-fix">
          <Button
            size="sm"
            className={cn(
              "h-8 text-xs",
              healthStatus.severity === "critical"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-600 hover:bg-orange-700",
            )}
          >
            <Wrench className="h-3 w-3 mr-1" />
            إصلاح
          </Button>
        </Link>

        {/* Dismiss Button */}
        <Button
          onClick={dismissAlert}
          variant="ghost"
          size="sm"
          className="h-8 px-2"
        >
          <X className={cn("h-3 w-3", config.textColor)} />
        </Button>
      </div>
    </div>
  );
};

export default DatabaseHealthAlert;
