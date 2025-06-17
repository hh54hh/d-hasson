import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Play,
  Shield,
  Database,
  Calculator,
  Package,
  Users,
  Monitor,
  Settings,
} from "lucide-react";
import {
  SystemValidator,
  ValidationResult,
  SystemValidationReport,
} from "../lib/systemValidator";

interface SystemValidationProps {
  className?: string;
}

export const SystemValidation: React.FC<SystemValidationProps> = ({
  className = "",
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SystemValidationReport | null>(null);
  const [progress, setProgress] = useState(0);

  const runValidation = async () => {
    setIsRunning(true);
    setProgress(0);
    setReport(null);

    try {
      // محاكاة التقدم
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const validationReport =
        await SystemValidator.runComprehensiveValidation();

      clearInterval(progressInterval);
      setProgress(100);
      setReport(validationReport);
    } catch (error) {
      console.error("فشل في تشغيل الفحص:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (result: ValidationResult) => {
    if (result.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (result.category === "critical") {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (overall: "pass" | "warning" | "fail") => {
    const variants = {
      pass: "default",
      warning: "secondary",
      fail: "destructive",
    };

    const labels = {
      pass: "نجح",
      warning: "تحذيرات",
      fail: "فشل",
    };

    return <Badge variant={variants[overall] as any}>{labels[overall]}</Badge>;
  };

  const getCategoryIcon = (test: string) => {
    if (test.includes("Database") || test.includes("Table"))
      return <Database className="h-4 w-4" />;
    if (test.includes("Calculation") || test.includes("Currency"))
      return <Calculator className="h-4 w-4" />;
    if (
      test.includes("Inventory") ||
      test.includes("Stock") ||
      test.includes("Product")
    )
      return <Package className="h-4 w-4" />;
    if (test.includes("Customer") || test.includes("Sales"))
      return <Users className="h-4 w-4" />;
    if (test.includes("Route") || test.includes("LocalStorage"))
      return <Monitor className="h-4 w-4" />;
    if (test.includes("Security") || test.includes("Supabase"))
      return <Shield className="h-4 w-4" />;
    return <Settings className="h-4 w-4" />;
  };

  const groupResultsByCategory = (results: ValidationResult[]) => {
    const groups: { [key: string]: ValidationResult[] } = {
      "قاعدة البيانات": [],
      الحسابات: [],
      المخزون: [],
      "العملاء والمبيعات": [],
      الواجهة: [],
      الأمان: [],
      أخرى: [],
    };

    results.forEach((result) => {
      if (result.test.includes("Database") || result.test.includes("Table")) {
        groups["قاعدة البيانات"].push(result);
      } else if (
        result.test.includes("Calculation") ||
        result.test.includes("Currency")
      ) {
        groups["الحسابات"].push(result);
      } else if (
        result.test.includes("Inventory") ||
        result.test.includes("Stock") ||
        result.test.includes("Product")
      ) {
        groups["ال��خزون"].push(result);
      } else if (
        result.test.includes("Customer") ||
        result.test.includes("Sales")
      ) {
        groups["العملاء والمبيعات"].push(result);
      } else if (
        result.test.includes("Route") ||
        result.test.includes("LocalStorage")
      ) {
        groups["الواجهة"].push(result);
      } else if (
        result.test.includes("Security") ||
        result.test.includes("Supabase")
      ) {
        groups["الأمان"].push(result);
      } else {
        groups["أخرى"].push(result);
      }
    });

    return groups;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          فحص النظام قبل الإصدار
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* زر التشغيل */}
        <div className="flex items-center gap-4">
          <Button
            onClick={runValidation}
            disabled={isRunning}
            size="lg"
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "جاري الفحص..." : "بدء الفحص الشامل"}
          </Button>

          {isRunning && (
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-1">
                {progress}% مكتمل
              </p>
            </div>
          )}
        </div>

        {/* النتائج */}
        {report && (
          <div className="space-y-4">
            {/* الملخص العام */}
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon({
                    isValid: report.overall === "pass",
                    category:
                      report.overall === "fail" ? "critical" : "warning",
                  } as ValidationResult)}
                  <span className="font-medium">{report.summary}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(report.overall)}
                  <Badge variant="outline">النتيجة: {report.score}%</Badge>
                </div>
              </AlertDescription>
            </Alert>

            {/* نتائج الإصلاح التلقائي */}
            {report.autoFixResults && report.autoFixResults.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">
                    تم تطبيق إصلاحات تلقائية:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {report.autoFixResults.map((fix, index) => (
                      <li key={index}>{fix}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* النتائج المجمعة */}
            <div className="space-y-4">
              {Object.entries(groupResultsByCategory(report.results)).map(
                ([category, results]) => {
                  if (results.length === 0) return null;

                  const categoryPassed = results.filter(
                    (r) => r.isValid,
                  ).length;
                  const categoryTotal = results.length;
                  const categoryScore = Math.round(
                    (categoryPassed / categoryTotal) * 100,
                  );

                  return (
                    <Card key={category} className="border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-lg">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon(category)}
                            {category}
                          </span>
                          <Badge variant="outline">
                            {categoryPassed}/{categoryTotal} ({categoryScore}%)
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {results.map((result, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-2 rounded border"
                          >
                            {getStatusIcon(result)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                  {result.description}
                                </span>
                                <Badge
                                  variant={
                                    result.category === "critical"
                                      ? "destructive"
                                      : result.category === "warning"
                                        ? "secondary"
                                        : "default"
                                  }
                                  size="sm"
                                >
                                  {result.category === "critical"
                                    ? "خطير"
                                    : result.category === "warning"
                                      ? "تحذير"
                                      : "معلومات"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {result.result}
                              </p>
                              {result.suggestion && (
                                <p className="text-sm text-blue-600 mt-1">
                                  💡 {result.suggestion}
                                </p>
                              )}
                              {result.autoFixAvailable && (
                                <p className="text-sm text-green-600 mt-1">
                                  🔧 إصلاح تلقائي متوفر
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                },
              )}
            </div>

            {/* تقييم الاستعداد للإصدار */}
            <Alert>
              <AlertDescription>
                <div className="font-medium mb-2">تقييم الاستعداد للإصدار:</div>
                {report.overall === "pass" && (
                  <div className="text-green-600">
                    ✅ النظام جاهز للإصدار! جميع الفحوصات نجحت.
                  </div>
                )}
                {report.overall === "warning" && (
                  <div className="text-yellow-600">
                    ⚠️ النظام يحتاج مراجعة بعض التحذيرات قبل الإصدار.
                  </div>
                )}
                {report.overall === "fail" && (
                  <div className="text-red-600">
                    ❌ النظام غير جاهز للإصدار! يجب إصلاح المشاكل الخطيرة أولاً.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemValidation;
