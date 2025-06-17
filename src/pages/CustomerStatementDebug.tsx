import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  FileText,
  ShoppingCart,
  Users,
  Copy,
  ExternalLink,
  Wrench,
  Bug,
  TestTube,
} from "lucide-react";
import { Customer } from "@/lib/types";
import { formatCurrency } from "@/lib/storage";
import { offlineManager } from "@/lib/offlineManager";
import {
  CustomerStatementFixer,
  quickDiagnoseCustomer,
  quickFixCustomerStatement,
  enhancedGetCustomerStatement,
} from "@/lib/customerStatementFixer";

const CustomerStatementDebug: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const customersData = await offlineManager.getCustomers();
      setCustomers(customersData);
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.phone.includes(customerSearch),
  );

  const runDiagnosis = async (customer: Customer) => {
    setLoading(true);
    setSelectedCustomer(customer);
    setDiagnosis(null);
    setStatement(null);

    try {
      console.log(`🔍 Running diagnosis for ${customer.name}`);

      const diagnosisResult = await quickDiagnoseCustomer(customer.id);
      setDiagnosis(diagnosisResult);

      // إذا كان العميل موجود، جلب كشف الحساب
      if (diagnosisResult.customerExists) {
        const statementResult = await enhancedGetCustomerStatement(customer.id);
        setStatement(statementResult);
      }
    } catch (error: any) {
      console.error("Diagnosis failed:", error);
      setDiagnosis({
        customerExists: false,
        recommendations: [`خطأ في التشخيص: ${error.message}`],
        detailedIssues: { error: error.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const runComprehensiveFix = async () => {
    setFixing(true);
    setFixResult(null);

    try {
      const result = await quickFixCustomerStatement();
      setFixResult(result);

      // إعادة تشخيص العميل المحدد بعد الإصلاح
      if (selectedCustomer) {
        setTimeout(() => {
          runDiagnosis(selectedCustomer);
        }, 1000);
      }
    } catch (error: any) {
      setFixResult({
        success: false,
        message: `فشل الإصلاح: ${error.message}`,
        errors: [error.message],
      });
    } finally {
      setFixing(false);
    }
  };

  const copyDatabaseScript = () => {
    alert(
      "📄 سيتم فتح ملف ULTIMATE_CUSTOMER_STATEMENT_FIX.sql\n\nانسخ محتوى الملف كاملاً وشغله في Supabase SQL Editor",
    );
  };

  const getStatusIcon = (hasIssue: boolean) => {
    return hasIssue ? (
      <XCircle className="h-4 w-4 text-red-600" />
    ) : (
      <CheckCircle className="h-4 w-4 text-green-600" />
    );
  };

  const getStatusColor = (hasIssue: boolean) => {
    return hasIssue
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-green-200 bg-green-50 text-green-800";
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
            <Bug className="h-8 w-8 text-red-600" />
            تشخيص وإصلاح مشكلة كشف الحساب
          </h1>
          <p className="text-gray-600 mt-2">
            أداة شاملة لتشخيص وإصلاح مشاكل عرض المنتجات في كشف الحساب
          </p>
        </div>

        {/* Global Actions */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              إجراءات الإصلاح الشاملة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={runComprehensiveFix}
                disabled={fixing}
                className="bg-red-600 hover:bg-red-700 flex items-center gap-2 h-16"
              >
                <TestTube
                  className={`h-4 w-4 ${fixing ? "animate-spin" : ""}`}
                />
                <div>
                  <div className="font-semibold">
                    {fixing ? "جاري الإصلاح..." : "إصلاح شامل للنظام"}
                  </div>
                  <div className="text-xs opacity-70">فحص وإصلاح تلقائي</div>
                </div>
              </Button>

              <Button
                onClick={copyDatabaseScript}
                variant="outline"
                className="flex items-center gap-2 h-16"
              >
                <Copy className="h-4 w-4" />
                <div>
                  <div className="font-semibold">سكريبت قاعدة البيانات</div>
                  <div className="text-xs opacity-70">إصلاح يدوي شامل</div>
                </div>
              </Button>

              <Button
                onClick={() =>
                  window.open("https://supabase.com/dashboard", "_blank")
                }
                variant="outline"
                className="flex items-center gap-2 h-16"
              >
                <ExternalLink className="h-4 w-4" />
                <div>
                  <div className="font-semibold">فتح Supabase</div>
                  <div className="text-xs opacity-70">SQL Editor</div>
                </div>
              </Button>
            </div>

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
                      نتيجة الإصلاح الشامل:
                    </h4>
                    <p
                      className={
                        fixResult.success ? "text-green-700" : "text-red-700"
                      }
                    >
                      {fixResult.message}
                    </p>
                    {fixResult.steps && (
                      <div className="text-sm">
                        <strong>الخطوات المكتملة:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {fixResult.steps.map(
                            (step: string, index: number) => (
                              <li key={index}>{step}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    {fixResult.errors && fixResult.errors.length > 0 && (
                      <div className="text-sm">
                        <strong>مشاكل متبقية:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {fixResult.errors.map(
                            (error: string, index: number) => (
                              <li key={index}>{error}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Customer Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              اختيار عميل للتشخيص
            </CardTitle>
            <CardDescription>
              اختر عميل لتشخيص مشاكل كشف الحساب الخاص به
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="ابحث عن عميل بالاسم أو رقم الهاتف..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Customers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <Card
                  key={customer.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedCustomer?.id === customer.id
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : ""
                  }`}
                  onClick={() => runDiagnosis(customer)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-800">
                        {customer.name}
                      </h4>
                      <p className="text-sm text-gray-600">{customer.phone}</p>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            customer.debtAmount! > 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {customer.debtAmount! > 0
                            ? formatCurrency(customer.debtAmount!)
                            : "مسدد"}
                        </Badge>
                        {loading && selectedCustomer?.id === customer.id && (
                          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لم يتم العثور على عملاء</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnosis Results */}
        {selectedCustomer && diagnosis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-red-600" />
                نتائج تشخيص العميل: {selectedCustomer.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  className={`p-4 rounded-lg border ${getStatusColor(!diagnosis.customerExists)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(!diagnosis.customerExists)}
                    <span className="font-semibold">وجود العميل</span>
                  </div>
                  <div className="text-sm">
                    {diagnosis.customerExists ? "موجود" : "غير موجود"}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg border ${getStatusColor(diagnosis.salesCount === 0)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(diagnosis.salesCount === 0)}
                    <span className="font-semibold">عدد المبيعات</span>
                  </div>
                  <div className="text-sm">{diagnosis.salesCount}</div>
                </div>

                <div
                  className={`p-4 rounded-lg border ${getStatusColor(diagnosis.saleItemsCount === 0 && diagnosis.salesCount > 0)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(
                      diagnosis.saleItemsCount === 0 &&
                        diagnosis.salesCount > 0,
                    )}
                    <span className="font-semibold">تفاصيل المنتجات</span>
                  </div>
                  <div className="text-sm">{diagnosis.saleItemsCount}</div>
                </div>

                <div
                  className={`p-4 rounded-lg border ${getStatusColor(!diagnosis.databaseIntegrity)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(!diagnosis.databaseIntegrity)}
                    <span className="font-semibold">سلامة البيانات</span>
                  </div>
                  <div className="text-sm">
                    {diagnosis.databaseIntegrity ? "سليمة" : "مشاكل"}
                  </div>
                </div>
              </div>

              {/* Missing Items Sales */}
              {diagnosis.missingItemsSales.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    مبيعات بدون تفاصيل منتجات (
                    {diagnosis.missingItemsSales.length})
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">
                          تاريخ البيعة
                        </TableHead>
                        <TableHead className="text-right">
                          المبلغ الإجمالي
                        </TableHead>
                        <TableHead className="text-right">
                          عدد المنتجات المسجل
                        </TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnosis.missingItemsSales.map((sale: any) => (
                        <TableRow key={sale.saleId}>
                          <TableCell>{sale.saleDate}</TableCell>
                          <TableCell>
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell>{sale.itemsCount}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">بدون تفاصيل</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Recommendations */}
              {diagnosis.recommendations.length > 0 && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-orange-800">
                        💡 توصيات الإصلاح:
                      </h4>
                      <ul className="space-y-1">
                        {diagnosis.recommendations.map(
                          (rec: string, index: number) => (
                            <li key={index} className="text-sm text-orange-700">
                              • {rec}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Detailed Issues */}
              {diagnosis.detailedIssues &&
                Object.keys(diagnosis.detailedIssues).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">
                      تفاصيل المشاكل التقنية:
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(diagnosis.detailedIssues, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        {/* Customer Statement Preview */}
        {statement && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                معاينة كشف الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-800">
                    {statement.summary.totalSales}
                  </div>
                  <div className="text-sm text-blue-600">عدد المبيعات</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-800">
                    {statement.summary.totalItems}
                  </div>
                  <div className="text-sm text-green-600">عدد المنتجات</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-800">
                    {statement.summary.totalQuantity}
                  </div>
                  <div className="text-sm text-purple-600">إجمالي القطع</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-lg font-bold text-yellow-800">
                    {formatCurrency(statement.summary.totalAmount)}
                  </div>
                  <div className="text-sm text-yellow-600">إجمالي المبلغ</div>
                </div>
              </div>

              {/* Purchases List */}
              {statement.purchases.length > 0 ? (
                <div>
                  <h4 className="font-semibold mb-3">
                    📦 المنتجات المشتراة ({statement.purchases.length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">الكمية</TableHead>
                          <TableHead className="text-right">السعر</TableHead>
                          <TableHead className="text-right">المجموع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statement.purchases
                          .slice(0, 10)
                          .map((purchase: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{purchase.sale_date}</TableCell>
                              <TableCell className="font-medium">
                                {purchase.product_name}
                              </TableCell>
                              <TableCell>{purchase.quantity}</TableCell>
                              <TableCell>
                                {formatCurrency(purchase.unit_price)}
                              </TableCell>
                              <TableCell>
                                {formatCurrency(purchase.total_amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {statement.purchases.length > 10 && (
                      <div className="text-center py-2 text-gray-500 text-sm">
                        و {statement.purchases.length - 10} منتج آخر...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-red-800">
                      <h4 className="font-semibold">
                        ❌ لا توجد منتجات في كشف الحساب
                      </h4>
                      <p className="text-sm mt-1">
                        هذا يؤكد وجود المشكلة - يجب تشغيل سكريبت الإصلاح
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate("/")} variant="outline">
            العودة للرئيسية
          </Button>
          <Button onClick={() => navigate("/add-sale")}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            اختبر بعملية بيع جديدة
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerStatementDebug;
