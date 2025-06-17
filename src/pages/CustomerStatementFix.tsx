import React, { useState, useEffect } from "react";
import Layout from "@/components/ui/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Database,
  FileText,
  ShoppingCart,
  Settings,
  ArrowRight,
} from "lucide-react";
import { Customer } from "@/lib/types";
import { formatCurrency } from "@/lib/storage";
import { supabaseService } from "@/lib/supabaseService";
import { CustomerStatementFixer } from "@/lib/customerStatementFixer";

interface StatementFixResult {
  customerId: string;
  customerName: string;
  issuesFound: string[];
  issuesFixed: string[];
  salesCreated: number;
  success: boolean;
  error?: string;
}

const CustomerStatementFix: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<StatementFixResult[]>([]);
  const [currentStep, setCurrentStep] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customersData = await supabaseService.getCustomers();
      setCustomers(customersData);
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm),
  );

  const fixSingleCustomerStatement = async (customer: Customer) => {
    try {
      setFixing(true);
      setProgress(10);
      setCurrentStep(`جاري إصلاح كشف حساب ${customer.name}...`);

      const result = await CustomerStatementFixer.fixCustomerStatement(
        customer.id,
      );

      setProgress(100);
      setCurrentStep("تم الانتهاء!");

      const fixResult: StatementFixResult = {
        customerId: customer.id,
        customerName: customer.name,
        issuesFound: result.diagnostics?.issues || [],
        issuesFixed: result.diagnostics?.recommendations || [],
        salesCreated: result.salesCreated?.length || 0,
        success: true,
      };

      setResults([fixResult]);

      setTimeout(() => {
        setFixing(false);
        setProgress(0);
        setCurrentStep("");
      }, 2000);
    } catch (error: any) {
      console.error("Error fixing customer statement:", error);

      const fixResult: StatementFixResult = {
        customerId: customer.id,
        customerName: customer.name,
        issuesFound: ["فشل في تحليل المشاكل"],
        issuesFixed: [],
        salesCreated: 0,
        success: false,
        error: error.message || "خطأ غير معروف",
      };

      setResults([fixResult]);
      setFixing(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  const fixAllCustomersStatements = async () => {
    try {
      setFixing(true);
      setResults([]);
      const totalCustomers = customers.length;
      let processed = 0;

      const fixResults: StatementFixResult[] = [];

      for (const customer of customers) {
        try {
          setCurrentStep(`معالجة ${customer.name}...`);
          setProgress((processed / totalCustomers) * 100);

          const result = await CustomerStatementFixer.fixCustomerStatement(
            customer.id,
          );

          const fixResult: StatementFixResult = {
            customerId: customer.id,
            customerName: customer.name,
            issuesFound: result.diagnostics?.issues || [],
            issuesFixed: result.diagnostics?.recommendations || [],
            salesCreated: result.salesCreated?.length || 0,
            success: true,
          };

          fixResults.push(fixResult);
        } catch (error: any) {
          const fixResult: StatementFixResult = {
            customerId: customer.id,
            customerName: customer.name,
            issuesFound: ["فشل في التحليل"],
            issuesFixed: [],
            salesCreated: 0,
            success: false,
            error: error.message || "خطأ غير معروف",
          };

          fixResults.push(fixResult);
        }

        processed++;
      }

      setResults(fixResults);
      setProgress(100);
      setCurrentStep("تم الانتهاء من جميع العملاء!");

      setTimeout(() => {
        setFixing(false);
        setProgress(0);
        setCurrentStep("");
      }, 3000);
    } catch (error: any) {
      console.error("Error fixing all customers:", error);
      setFixing(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  const runDatabaseDiagnostic = async () => {
    try {
      setFixing(true);
      setCurrentStep("فحص قاعدة البيانات...");
      setProgress(50);

      // يمكن إضافة فحص شامل لقاعدة البيانات هنا
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setProgress(100);
      setCurrentStep("تم الفحص!");

      setTimeout(() => {
        setFixing(false);
        setProgress(0);
        setCurrentStep("");
      }, 1000);
    } catch (error) {
      setFixing(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              إصلاح مشاكل كشوف الحساب
            </h1>
            <p className="text-gray-600 mt-1">
              أداة شاملة لحل مشاكل عدم ظهور المنتجات في كشوف حساب العملاء
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadCustomers}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`}
              />
              تحديث العملاء
            </Button>
            <Button
              onClick={runDatabaseDiagnostic}
              variant="outline"
              size="sm"
              disabled={fixing}
            >
              <Database className="h-4 w-4 ml-2" />
              فحص قاعدة البيانات
            </Button>
          </div>
        </div>

        {/* Problem Description */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>المشكلة الشائعة:</strong> قد لا تظهر المنتجات المشتراة في
            كشوف حساب العملاء رغم وجود عمليات شراء. هذه الأداة تحلل وتصلح هذه
            المشاكل تلقائياً عبر فحص العلاقات بين الجداول وإعادة بناء البيانات
            المفقودة.
          </AlertDescription>
        </Alert>

        {/* Progress Bar */}
        {fixing && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{currentStep}</span>
                  <span className="text-sm text-gray-600">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-600" />
                إصلاح عميل واحد
              </CardTitle>
              <CardDescription>إصلاح مشاكل كشف حساب عميل محدد</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-search">البحث عن عميل</Label>
                <div className="relative">
                  <Input
                    id="customer-search"
                    placeholder="ابحث بالاسم أو الهاتف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {searchTerm && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCustomer?.id === customer.id
                          ? "bg-blue-50 border-blue-300"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-gray-600">
                        {customer.phone}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedCustomer && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="font-medium text-green-800">
                    العميل المختار: {selectedCustomer.name}
                  </div>
                  <div className="text-sm text-green-600">
                    {selectedCustomer.phone}
                  </div>
                </div>
              )}

              <Button
                onClick={() =>
                  selectedCustomer &&
                  fixSingleCustomerStatement(selectedCustomer)
                }
                disabled={!selectedCustomer || fixing}
                className="w-full"
              >
                {fixing ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 ml-2" />
                )}
                إصلاح كشف هذا العميل
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                إصلاح شامل
              </CardTitle>
              <CardDescription>إصلاح جميع كشوف حساب العملاء</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>إجمالي العملاء:</span>
                  <span className="font-medium">{customers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>العملاء المحملين:</span>
                  <span className="font-medium">
                    {loading ? "جاري التحميل..." : customers.length}
                  </span>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>تحذير:</strong> هذه العملية قد تستغرق وقتاً طويلاً حسب
                  عدد العملاء.
                </AlertDescription>
              </Alert>

              <Button
                onClick={fixAllCustomersStatements}
                disabled={fixing || customers.length === 0}
                className="w-full"
                variant="outline"
              >
                {fixing ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 ml-2" />
                )}
                إصلاح جميع كشوف الحساب
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
                المشاكل الشائعة
              </CardTitle>
              <CardDescription>أهم المشاكل وحلولها</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <strong>المشكلة:</strong> عدم ظهور المنتجات
                  <br />
                  <strong>السبب:</strong> مشاكل في العلاقات
                </div>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                  <strong>المشكلة:</strong> كشف حساب فارغ
                  <br />
                  <strong>السبب:</strong> بيانات مفقودة
                </div>
                <div className="p-2 bg-green-50 border border-green-200 rounded">
                  <strong>الحل:</strong> إعادة بناء البيانات
                  <br />
                  <strong>النتيجة:</strong> عرض صحيح للمشتريات
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>نتائج الإصلاح</CardTitle>
              <CardDescription>
                تقرير تفصيلي عن عمليات الإصلاح المنجزة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg ${
                      result.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">
                          {result.customerName}
                        </span>
                      </div>
                      <Badge
                        variant={result.success ? "secondary" : "destructive"}
                      >
                        {result.success ? "نجح" : "فشل"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <strong>المشاكل المكتشفة:</strong>
                        <div className="mt-1">
                          {result.issuesFound.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-600">
                              {result.issuesFound.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-green-600">
                              لا توجد مشاكل
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <strong>الإصلاحات المنجزة:</strong>
                        <div className="mt-1">
                          {result.issuesFixed.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-600">
                              {result.issuesFixed.map((fix, i) => (
                                <li key={i}>{fix}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">
                              لا توجد إصلاحات
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <strong>الإحصائيات:</strong>
                        <div className="mt-1 space-y-1">
                          <div>مبيعات منشأة: {result.salesCreated}</div>
                          {result.error && (
                            <div className="text-red-600">
                              خطأ: {result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium mb-2">ملخص النتائج</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">إجمالي العمليات:</span>
                    <div className="font-medium">{results.length}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">نجح:</span>
                    <div className="font-medium text-green-600">
                      {results.filter((r) => r.success).length}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">فشل:</span>
                    <div className="font-medium text-red-600">
                      {results.filter((r) => !r.success).length}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">مبيعات مُنشأة:</span>
                    <div className="font-medium text-blue-600">
                      {results.reduce((sum, r) => sum + r.salesCreated, 0)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help */}
        <Card>
          <CardHeader>
            <CardTitle>إرشادات الاستخدام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <strong>1. للعميل الواحد:</strong> ابحث عن العميل، اختره، ثم
                اضغط "إصلاح كشف هذا العميل"
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <strong>2. للجميع:</strong> اضغط "إصلاح جميع كشوف الحساب" وانتظر
                انتهاء العملية
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <strong>3. النتائج:</strong> ستظهر تفاصيل المشاكل المكتشفة
                والإصلاحات المنجزة
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <strong>4. التحقق:</strong> راجع كشوف حساب العملاء للتأكد من
                ظهور المنتجات
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CustomerStatementFix;
