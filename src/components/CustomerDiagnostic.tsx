import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Search,
  CheckCircle,
  AlertCircle,
  Settings,
  Loader2,
  Phone,
  Database,
} from "lucide-react";
import { Customer } from "@/lib/types";
import { CustomerDataDiagnostic } from "@/lib/customerDataDiagnostic";
import { supabaseService } from "@/lib/supabaseService";

const CustomerDiagnostic: React.FC = () => {
  const [customerId, setCustomerId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [fixResult, setFixResult] = useState<any>(null);

  const searchCustomer = async (id?: string, phone?: string) => {
    if (!id && !phone) {
      alert("يرجى إدخال ID العميل أو رقم الهاتف");
      return;
    }

    try {
      setLoading(true);
      let customer: Customer | null = null;

      if (id) {
        customer = await supabaseService.getCustomerById(id);
      } else if (phone) {
        customer = await supabaseService.getCustomerByPhone(phone);
      }

      if (!customer) {
        alert("لم يتم العثور على العميل");
        return;
      }

      // تشغيل التشخيص
      const diagnosisResult =
        await CustomerDataDiagnostic.diagnoseCustomerValidationIssue(customer);
      setDiagnosis(diagnosisResult);
    } catch (error: any) {
      console.error("Error searching customer:", error);
      alert(`خطأ في البحث: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runAutoFix = async () => {
    if (!diagnosis?.customerData?.originalCustomer) return;

    try {
      setLoading(true);
      const result = await CustomerDataDiagnostic.autoFixCustomerIssue(
        diagnosis.customerData.originalCustomer,
      );
      setFixResult(result);

      if (result.success) {
        alert(
          `✅ ${result.message}\n\nالإجراءات:\n${result.actions.join("\n")}`,
        );
      } else {
        alert(
          `❌ ${result.message}\n\nالإجراءات:\n${result.actions.join("\n")}`,
        );
      }
    } catch (error: any) {
      console.error("Error in auto fix:", error);
      alert(`خطأ في الإصلاح: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          تشخيص مشاكل العملاء
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* البحث عن العميل */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer-id">ID العميل</Label>
              <Input
                id="customer-id"
                placeholder="أدخل ID العميل"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">رقم الهاتف</Label>
              <Input
                id="customer-phone"
                placeholder="أدخل رقم الهاتف"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => searchCustomer(customerId)}
              disabled={loading || !customerId}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 ml-2" />
              )}
              بحث بـ ID
            </Button>
            <Button
              onClick={() => searchCustomer(undefined, customerPhone)}
              disabled={loading || !customerPhone}
              className="flex-1"
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Phone className="h-4 w-4 ml-2" />
              )}
              بحث بالهاتف
            </Button>
          </div>
        </div>

        {/* نتائج التشخيص */}
        {diagnosis && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">نتائج التشخيص</h4>
              <Badge
                variant={diagnosis.success ? "secondary" : "destructive"}
                className="flex items-center gap-1"
              >
                {diagnosis.success ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {diagnosis.success ? "سليم" : "مشاكل مكتشفة"}
              </Badge>
            </div>

            {/* معلومات العميل */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h5 className="font-medium mb-2">معلومات العميل:</h5>
              <div className="text-sm space-y-1">
                <div>
                  <strong>ال��سم:</strong>{" "}
                  {diagnosis.customerData.originalCustomer.name}
                </div>
                <div>
                  <strong>ID:</strong>{" "}
                  {diagnosis.customerData.originalCustomer.id}
                </div>
                <div>
                  <strong>الهاتف:</strong>{" "}
                  {diagnosis.customerData.originalCustomer.phone}
                </div>
              </div>
            </div>

            {/* المشاكل المكتشفة */}
            {diagnosis.issues.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <strong className="text-red-800">المشاكل المكتشفة:</strong>
                    <ul className="text-sm text-red-700 space-y-1">
                      {diagnosis.issues.map((issue: string, index: number) => (
                        <li key={index}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* الحلول المقترحة */}
            {diagnosis.solutions.length > 0 && (
              <Alert className="border-blue-200 bg-blue-50">
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <strong className="text-blue-800">الحلول المقترحة:</strong>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {diagnosis.solutions.map(
                        (solution: string, index: number) => (
                          <li key={index}>• {solution}</li>
                        ),
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* حالة البيانات */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h5 className="font-medium">حالة البيانات:</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>في قاعدة البيانات (ID):</span>
                    <Badge
                      variant={
                        diagnosis.customerData.databaseCustomer
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {diagnosis.customerData.databaseCustomer
                        ? "موجود"
                        : "غير موجود"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>في قاعدة البيانات (هاتف):</span>
                    <Badge
                      variant={
                        diagnosis.customerData.phoneSearchResult
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {diagnosis.customerData.phoneSearchResult
                        ? "موجود"
                        : "غير موجود"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>في الكاش المحلي:</span>
                    <Badge
                      variant={
                        diagnosis.customerData.offlineCustomer
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {diagnosis.customerData.offlineCustomer
                        ? "موجود"
                        : "غير موجود"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium">التوصيات:</h5>
                <div className="text-sm space-y-1">
                  {diagnosis.recommendations.map(
                    (rec: string, index: number) => (
                      <div
                        key={index}
                        className="p-2 bg-green-50 rounded text-green-700"
                      >
                        {rec}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* زر الإصلاح التلقائي */}
            {!diagnosis.success && (
              <Button
                onClick={runAutoFix}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 ml-2" />
                )}
                تشغيل الإصلاح التلقائي
              </Button>
            )}
          </div>
        )}

        {/* نتائج الإصلاح */}
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
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <strong
                  className={
                    fixResult.success ? "text-green-800" : "text-red-800"
                  }
                >
                  {fixResult.message}
                </strong>
                <div className="text-sm">
                  <strong>الإجراءات المنجزة:</strong>
                  <ul className="mt-1 space-y-1">
                    {fixResult.actions.map((action: string, index: number) => (
                      <li key={index}>• {action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* معلومات مساعدة */}
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            <strong>كيفية الاستخدام:</strong> أدخل ID العميل أو رقم الهاتف
            لتشخيص أي مشاكل في البيانات. سيتم فحص وجود العميل في قاعدة البيانات
            والكاش المحلي وتقديم حلول للمشاكل المكتشفة.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default CustomerDiagnostic;
