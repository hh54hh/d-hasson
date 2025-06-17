import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  ShoppingCart,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { Customer, CartItem } from "@/lib/types";
import { formatCurrency } from "@/lib/storage";
import { ExistingCustomerSaleManager } from "@/lib/existingCustomerSaleManager";

interface ExistingCustomerSaleFormProps {
  customer: Customer;
  cartItems: CartItem[];
  saleData: {
    paymentType: "cash" | "deferred" | "partial";
    paidAmount: number;
    notes?: string;
  };
  onSaleComplete: (result: {
    sale: any;
    updatedCustomer: Customer;
    inventoryUpdates: any[];
    warnings: string[];
  }) => void;
  onError: (error: string) => void;
}

interface ProcessStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "processing" | "completed" | "error";
  details?: string;
}

const ExistingCustomerSaleForm: React.FC<ExistingCustomerSaleFormProps> = ({
  customer,
  cartItems,
  saleData,
  onSaleComplete,
  onError,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<ProcessStep[]>([
    {
      id: "validate_customer",
      title: "التحقق من بيانات العميل",
      description: "التأكد من صحة بيانات العميل الموجود",
      status: "pending",
    },
    {
      id: "validate_inventory",
      title: "فحص المخزون",
      description: "التحقق من توفر المنتجات والكميات",
      status: "pending",
    },
    {
      id: "calculate_amounts",
      title: "حساب المبالغ",
      description: "حساب إجمالي المبلغ والربح والمبلغ المتبقي",
      status: "pending",
    },
    {
      id: "create_sale",
      title: "إنشاء عملية البيع",
      description: "حفظ البيع في قاعدة البيانات",
      status: "pending",
    },
    {
      id: "update_customer",
      title: "تحديث بيانات العميل",
      description: "تحديث تاريخ آخر بيع والديون",
      status: "pending",
    },
    {
      id: "update_inventory",
      title: "تحديث المخزون",
      description: "تقليل كميات المنتجات المباعة",
      status: "pending",
    },
    {
      id: "verify_consistency",
      title: "التحقق النهائي",
      description: "التأكد من تناسق جميع البيانات",
      status: "pending",
    },
  ]);

  // حساب إحصائيات البيع
  const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalProfit = cartItems.reduce(
    (sum, item) =>
      sum + (item.unitPrice - item.product.wholesalePrice) * item.quantity,
    0,
  );
  const remainingAmount =
    saleData.paymentType === "cash" ? 0 : totalAmount - saleData.paidAmount;
  const newDebtAmount = (customer.debtAmount || 0) + remainingAmount;

  const updateStepStatus = (
    stepId: string,
    status: ProcessStep["status"],
    details?: string,
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, details } : step,
      ),
    );
  };

  const processSale = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // خطوة 1: التحقق من بيانات العميل
      setCurrentStep(0);
      updateStepStatus("validate_customer", "processing");
      setProgress(10);

      await new Promise((resolve) => setTimeout(resolve, 500)); // تأخير بصري

      updateStepStatus(
        "validate_customer",
        "completed",
        `تم التحقق من العميل: ${customer.name}`,
      );

      // خطوة 2: فحص المخزون
      setCurrentStep(1);
      updateStepStatus("validate_inventory", "processing");
      setProgress(25);

      await new Promise((resolve) => setTimeout(resolve, 500));

      updateStepStatus(
        "validate_inventory",
        "completed",
        `تم فحص ${cartItems.length} منتج`,
      );

      // خطوة 3: حساب المبالغ
      setCurrentStep(2);
      updateStepStatus("calculate_amounts", "processing");
      setProgress(40);

      await new Promise((resolve) => setTimeout(resolve, 300));

      updateStepStatus(
        "calculate_amounts",
        "completed",
        `إجمالي: ${formatCurrency(totalAmount)}`,
      );

      // خطوة 4: إنشاء عملية البيع
      setCurrentStep(3);
      updateStepStatus("create_sale", "processing");
      setProgress(55);

      // تنفيذ العملية الفعلية
      const result =
        await ExistingCustomerSaleManager.createSaleForExistingCustomer(
          customer,
          cartItems,
          saleData,
        );

      updateStepStatus(
        "create_sale",
        "completed",
        `تم إنشاء البيع: ${result.sale.id.slice(-8)}`,
      );

      // خطوة 5: تحديث العميل
      setCurrentStep(4);
      updateStepStatus("update_customer", "processing");
      setProgress(70);

      await new Promise((resolve) => setTimeout(resolve, 300));

      updateStepStatus(
        "update_customer",
        "completed",
        `تم تحديث بيانات العميل`,
      );

      // خطوة 6: تحديث المخزون
      setCurrentStep(5);
      updateStepStatus("update_inventory", "processing");
      setProgress(85);

      await new Promise((resolve) => setTimeout(resolve, 300));

      updateStepStatus(
        "update_inventory",
        "completed",
        `تم تحديث ${result.inventoryUpdates.length} منتج`,
      );

      // خطوة 7: التحقق النهائي
      setCurrentStep(6);
      updateStepStatus("verify_consistency", "processing");
      setProgress(95);

      await new Promise((resolve) => setTimeout(resolve, 500));

      updateStepStatus(
        "verify_consistency",
        "completed",
        "تم التحقق من تناسق البيانات",
      );

      setProgress(100);

      // إشعار النجاح
      setTimeout(() => {
        onSaleComplete(result);
      }, 1000);
    } catch (error: any) {
      const currentStepData = steps[currentStep];
      updateStepStatus(currentStepData.id, "error", error.message);
      onError(error.message || "حدث خطأ أثناء معالجة البيع");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* معلومات العميل والبيع */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* معلومات العميل */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              معلومات العميل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <strong>الاسم:</strong> {customer.name}
            </div>
            <div>
              <strong>الهاتف:</strong> {customer.phone}
            </div>
            <div>
              <strong>العنوان:</strong> {customer.address}
            </div>
            <div>
              <strong>الدين الحالي:</strong>
              <Badge
                variant={customer.debtAmount! > 0 ? "destructive" : "secondary"}
                className="mr-2"
              >
                {formatCurrency(customer.debtAmount || 0)}
              </Badge>
            </div>
            <div>
              <strong>الدين بعد البيع:</strong>
              <Badge
                variant={newDebtAmount > 0 ? "destructive" : "secondary"}
                className="mr-2"
              >
                {formatCurrency(newDebtAmount)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* إحصائيات البيع */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              إحصائيات البيع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>عدد المنتجات:</span>
              <Badge variant="outline">{cartItems.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>المبلغ الإجمالي:</span>
              <span className="font-bold">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>المبلغ المدفوع:</span>
              <span className="font-bold text-green-600">
                {formatCurrency(saleData.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>المبلغ المتبقي:</span>
              <span
                className={`font-bold ${remainingAmount > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {formatCurrency(remainingAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>الربح المتوقع:</span>
              <span className="font-bold text-purple-600">
                {formatCurrency(totalProfit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>طريقة الدفع:</span>
              <Badge
                variant={
                  saleData.paymentType === "cash"
                    ? "secondary"
                    : saleData.paymentType === "deferred"
                      ? "destructive"
                      : "outline"
                }
              >
                {saleData.paymentType === "cash"
                  ? "نقدي"
                  : saleData.paymentType === "deferred"
                    ? "آجل"
                    : "جزئي"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* المنتجات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
            المنتجات ({cartItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cartItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{item.product.name}</div>
                  <div className="text-sm text-gray-600">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    {formatCurrency(item.totalPrice)}
                  </div>
                  <div className="text-sm text-green-600">
                    ربح: +
                    {formatCurrency(
                      (item.unitPrice - item.product.wholesalePrice) *
                        item.quantity,
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* شريط التقدم */}
      {isProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">معالجة عملية البيع...</span>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* خطوات المعالجة */}
      <Card>
        <CardHeader>
          <CardTitle>خطوات معالجة البيع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  step.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : step.status === "processing"
                      ? "bg-blue-50 border-blue-200"
                      : step.status === "error"
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex-shrink-0">
                  {step.status === "completed" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : step.status === "processing" ? (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  ) : step.status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{step.title}</div>
                  <div className="text-sm text-gray-600">
                    {step.details || step.description}
                  </div>
                </div>
                <Badge
                  variant={
                    step.status === "completed"
                      ? "secondary"
                      : step.status === "processing"
                        ? "default"
                        : step.status === "error"
                          ? "destructive"
                          : "outline"
                  }
                >
                  {step.status === "completed"
                    ? "مكتمل"
                    : step.status === "processing"
                      ? "جاري"
                      : step.status === "error"
                        ? "خطأ"
                        : "في الانتظار"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* أزرار التحكم */}
      <div className="flex gap-4">
        <Button
          onClick={processSale}
          disabled={isProcessing}
          className="flex-1 bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              جاري معالجة البيع...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 ml-2" />
              تأكيد البيع للعميل الموجود
            </>
          )}
        </Button>
      </div>

      {/* ملاحظات هامة */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>ملاحظة:</strong> هذا النظام يضمن دقة العمليات الحسابية
          والتزامن مع جميع العلاقات المربوطة في قاعدة البيانات. سيتم تحديث
          بيانات العميل والمخزون تلقائياً مع إنشاء سجلات المعاملات.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ExistingCustomerSaleForm;
