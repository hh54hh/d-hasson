import type { FC } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Database,
  Wrench,
  ShoppingCart,
  FileText,
  CheckCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

const PurchasesProblemExplanation: React.FC = () => {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          🚨 مشكلة هامة: لا تظهر المشتريات في كشف حساب العميل
        </CardTitle>
        <CardDescription className="text-red-700">
          المشكلة موجودة في قاعدة البيانات ولها حل فوري
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Problem Description */}
        <div className="bg-white p-4 rounded-lg border border-red-200">
          <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <Database className="h-4 w-4" />
            ما هي المشكلة؟
          </h4>
          <ul className="space-y-2 text-red-700 text-sm">
            <li>• عند إضافة منتجات في عملية البيع ✅</li>
            <li>• تتم العملية بنجاح ويحفظ اسم العميل ✅</li>
            <li>• لكن عند عرض كشف حساب العميل يظهر (0 عملية شراء) ❌</li>
            <li>• السبب: جدول sale_items مفقود من قاعدة البيانات ❌</li>
          </ul>
        </div>

        {/* Technical Explanation */}
        <div className="bg-white p-4 rounded-lg border border-red-200">
          <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            الشرح التقني:
          </h4>
          <div className="text-red-700 text-sm space-y-2">
            <p>
              <strong>المطلوب:</strong> جدول sale_items لحفظ تفاصيل كل منتج في
              البيعة
            </p>
            <p>
              <strong>الحالي:</strong> يتم حفظ البيعة الرئيسية فقط بدون تفاصيل
              المنتجات
            </p>
            <p>
              <strong>النتيجة:</strong> لا تظهر المنتجات في كشف حساب العميل
            </p>
          </div>
        </div>

        {/* Solution Steps */}
        <div className="bg-white p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            الحل (خطوات بسيطة):
          </h4>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="bg-blue-100 text-blue-800 text-xs">1</Badge>
              <div className="text-sm">
                <p className="font-medium">استخدم أداة الإصلاح التلقائي</p>
                <p className="text-gray-600">
                  اضغط الزر أدناه لتشغيل أداة الإصلاح
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-blue-100 text-blue-800 text-xs">2</Badge>
              <div className="text-sm">
                <p className="font-medium">إذا فشل الإصلاح التلقائي</p>
                <p className="text-gray-600">
                  ستحصل على كود SQL لتشغيله في Supabase يدوياً
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-green-100 text-green-800 text-xs">3</Badge>
              <div className="text-sm">
                <p className="font-medium">اختبر النتيجة</p>
                <p className="text-gray-600">
                  أضف عملية بيع جديدة واعرض كشف حساب العميل
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Expected Result */}
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            النتيجة المتوقعة بعد الإصلاح:
          </h4>
          <ul className="space-y-1 text-green-700 text-sm">
            <li>✅ ستظهر جميع المنتجات في كشف حساب العميل</li>
            <li>✅ ستظهر الكمية وسعر الوحدة لكل منتج</li>
            <li>✅ سيعمل النظام بشكل صحيح مع جميع العمليات</li>
            <li>✅ ستتقلل كميات المنتجات تلقائياً من المخزن</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/emergency-fix" className="flex-1">
            <Button className="w-full bg-red-600 hover:bg-red-700 flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              🚨 إصلاح المشكلة فوراً
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/add-sale" className="flex-1">
            <Button
              variant="outline"
              className="w-full border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              جرب إضافة بيعة جديدة
            </Button>
          </Link>
        </div>

        {/* Additional Help */}
        <div className="text-center pt-4 border-t border-red-200">
          <p className="text-sm text-red-600 mb-2">
            إذا استمرت المشكلة بعد الإصلاح، تواصل مع المطور
          </p>
          <Badge variant="outline" className="text-xs">
            الكود: SALE_ITEMS_MISSING_ERROR
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default PurchasesProblemExplanation;
