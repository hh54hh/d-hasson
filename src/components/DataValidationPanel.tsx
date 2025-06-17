import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  Calculator,
  FileText,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { DataValidation, ValidationReport } from "@/lib/dataValidation";

const DataValidationPanel: React.FC = () => {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleValidation = async () => {
    setIsValidating(true);
    try {
      const validationReport = await DataValidation.validateSystemIntegrity();
      setReport(validationReport);
      DataValidation.printValidationReport(validationReport);
    } catch (error) {
      console.error("فشل في التحقق:", error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const success = await DataValidation.cleanupFakeData();
      if (success) {
        alert("تم تنظيف البيانات الوهمية بنجاح!");
        // إعادة التحقق بعد التنظيف
        setTimeout(() => {
          handleValidation();
        }, 1000);
      } else {
        alert("فشل في تنظيف البيانات");
      }
    } catch (error) {
      console.error("خطأ في التنظيف:", error);
      alert("حدث خطأ أثناء التنظيف");
    } finally {
      setIsCleaning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VALID":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "ISSUES_FOUND":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "CRITICAL_ERRORS":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VALID":
        return "bg-green-100 text-green-800";
      case "ISSUES_FOUND":
        return "bg-yellow-100 text-yellow-800";
      case "CRITICAL_ERRORS":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "VALID":
        return "سليم";
      case "ISSUES_FOUND":
        return "توجد مشاكل";
      case "CRITICAL_ERRORS":
        return "أخطاء حرجة";
      default:
        return "غير محدد";
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            التحقق من سلامة البيانات والحسابات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleValidation}
              disabled={isValidating}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`}
              />
              {isValidating ? "جاري التحقق..." : "فحص النظام"}
            </Button>

            {report && !report.dataValidation.noFakeDataFound && (
              <Button
                onClick={handleCleanup}
                disabled={isCleaning}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isCleaning ? "جاري التنظيف..." : "إزالة البيانات الوهمية"}
              </Button>
            )}
          </div>

          {report && (
            <div className="space-y-4">
              {/* الحالة العامة */}
              <Alert>
                <div className="flex items-center gap-2">
                  {getStatusIcon(report.overallStatus)}
                  <AlertDescription className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>الحالة العامة للنظام</span>
                      <Badge className={getStatusColor(report.overallStatus)}>
                        {getStatusText(report.overallStatus)}
                      </Badge>
                    </div>
                  </AlertDescription>
                </div>
              </Alert>

              {/* تفاصيل قاعدة البيانات */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    قاعدة البيانات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>الاتصال</span>
                    <Badge
                      className={
                        report.databaseConnection.supabaseConnected
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.databaseConnection.supabaseConnected
                        ? "متصل"
                        : "غير متصل"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>الجداول متاحة</span>
                    <Badge
                      className={
                        report.databaseConnection.tablesAccessible
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.databaseConnection.tablesAccessible
                        ? "نعم"
                        : "لا"}
                    </Badge>
                  </div>
                  {report.databaseConnection.issues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-red-600">مشاكل:</p>
                      {report.databaseConnection.issues.map((issue, index) => (
                        <p key={index} className="text-sm text-red-600">
                          • {issue}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* تفاصيل البيانات */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    البيانات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>بيانات حقيقية فقط</span>
                    <Badge
                      className={
                        report.dataValidation.hasOnlyRealData
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.dataValidation.hasOnlyRealData ? "نعم" : "لا"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>لا توجد بيانات وهمية</span>
                    <Badge
                      className={
                        report.dataValidation.noFakeDataFound
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.dataValidation.noFakeDataFound ? "نعم" : "لا"}
                    </Badge>
                  </div>
                  {report.dataValidation.issues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-red-600">مشاكل:</p>
                      {report.dataValidation.issues.map((issue, index) => (
                        <p key={index} className="text-sm text-red-600">
                          • {issue}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* تفاصيل الحسابات */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    الحسابات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>حسابات الأرباح</span>
                    <Badge
                      className={
                        report.calculationValidation.profitCalculationsCorrect
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.calculationValidation.profitCalculationsCorrect
                        ? "دقيقة"
                        : "خاطئة"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>حسابات الهوامش</span>
                    <Badge
                      className={
                        report.calculationValidation.marginCalculationsCorrect
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.calculationValidation.marginCalculationsCorrect
                        ? "دقيقة"
                        : "خاطئة"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>حسابات المبيعات</span>
                    <Badge
                      className={
                        report.calculationValidation.saleCalculationsCorrect
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {report.calculationValidation.saleCalculationsCorrect
                        ? "دقيقة"
                        : "خاطئة"}
                    </Badge>
                  </div>
                  {report.calculationValidation.issues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-red-600">مشاكل:</p>
                      {report.calculationValidation.issues.map(
                        (issue, index) => (
                          <p key={index} className="text-sm text-red-600">
                            • {issue}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataValidationPanel;
