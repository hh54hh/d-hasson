// Enhanced Sale Calculations Display Component
// مكون عرض الحسابات المحسنة للمبيعات

import type { FC } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { SaleCalculations } from "@/lib/saleCalculations";
import { formatCurrency } from "@/lib/storage";

interface EnhancedSaleCalculationsProps {
  calculations: SaleCalculations;
  className?: string;
  showDetails?: boolean;
}

export const EnhancedSaleCalculations: FC<EnhancedSaleCalculationsProps> = ({
  calculations,
  className = "",
  showDetails = false,
}) => {
  // التحقق من صحة الحسابات
  const validation = SaleCalculations.validateCalculations(calculations);
  const display = SaleCalculations.formatCalculationsDisplay(calculations);

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          ملخص الحسابات
          {validation.isValid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* الإجماليات الأساسية */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(calculations.totalAmount)}
            </div>
            <div className="text-sm text-gray-600">الإجمالي النهائي</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-green-600">
              {formatCurrency(calculations.totalProfit)}
            </div>
            <div className="text-sm text-gray-600">
              الربح ({calculations.profitMargin}%)
            </div>
          </div>
        </div>

        <Separator />

        {/* تفاصيل الدفع */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">المبلغ المدفوع:</span>
            <span className="text-green-600 font-semibold">
              {formatCurrency(calculations.actualPaidAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">المبلغ المتبقي:</span>
            <span
              className={`font-semibold ${
                calculations.remainingAmount > 0
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
            >
              {formatCurrency(calculations.remainingAmount)}
            </span>
          </div>
        </div>

        {/* حالة الدفع */}
        <div className="flex justify-center">
          <Badge
            variant={calculations.remainingAmount > 0 ? "secondary" : "default"}
            className="text-sm"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            {calculations.remainingAmount > 0 ? "دفع جزئي" : "مدفوع بالكامل"}
          </Badge>
        </div>

        {/* تفاصيل المنتجات */}
        {showDetails && calculations.itemBreakdown.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                تفاصيل المنتجات
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {calculations.itemBreakdown.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between text-xs bg-gray-50 p-2 rounded"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-gray-600">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(item.totalPrice)}
                      </div>
                      <div className="text-green-600">
                        +{formatCurrency(item.profit)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* تحذيرات وأخطاء */}
        {(!validation.isValid || validation.warnings.length > 0) && (
          <>
            <Separator />
            <div className="space-y-2">
              {!validation.isValid && (
                <div className="text-red-600 text-sm space-y-1">
                  <div className="font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    أخطاء في الحسابات:
                  </div>
                  {validation.errors.map((error, index) => (
                    <div key={index} className="text-xs bg-red-50 p-1 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div className="text-orange-600 text-sm space-y-1">
                  <div className="font-medium">تحذيرات:</div>
                  {validation.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="text-xs bg-orange-50 p-1 rounded"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ملخص سريع */}
        <div className="bg-blue-50 p-3 rounded text-center">
          <div className="text-xs text-blue-800">{display.summary}</div>
        </div>
      </CardContent>
    </Card>
  );
};

// مكون مبسط للعرض السريع
export const QuickSaleCalculations: FC<{
  calculations: SaleCalculations;
  className?: string;
}> = ({ calculations, className = "" }) => {
  return (
    <div className={`bg-gray-50 p-3 rounded-lg ${className}`}>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <div className="font-semibold text-blue-600">
            {formatCurrency(calculations.totalAmount)}
          </div>
          <div className="text-xs text-gray-600">الإجمالي</div>
        </div>
        <div>
          <div className="font-semibold text-green-600">
            {formatCurrency(calculations.actualPaidAmount)}
          </div>
          <div className="text-xs text-gray-600">المدفوع</div>
        </div>
        <div>
          <div
            className={`font-semibold ${
              calculations.remainingAmount > 0
                ? "text-orange-600"
                : "text-green-600"
            }`}
          >
            {formatCurrency(calculations.remainingAmount)}
          </div>
          <div className="text-xs text-gray-600">المتبقي</div>
        </div>
      </div>
    </div>
  );
};
