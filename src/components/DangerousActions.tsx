import type { FC } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Users, Trash2 } from "lucide-react";

interface DangerousActionsProps {
  customersCount: number;
  salesCount: number;
  productsCount: number;
  loading: boolean;
  onDeleteAllCustomers: () => void;
  onResetEntireDatabase: () => void;
}

export const DangerousActions: FC<DangerousActionsProps> = ({
  customersCount,
  salesCount,
  productsCount,
  loading,
  onDeleteAllCustomers,
  onResetEntireDatabase,
}) => {
  return (
    <>
      <Separator />

      {/* Dangerous Actions */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          عمليات خطيرة - احذر!
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={loading}
              className="w-full flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Users className="h-4 w-4" />
              حذف جميع العملاء فقط
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-600">
                ⚠️ تحذير: حذف جميع العملاء
              </AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف:
                <br />• جميع بيانات العملاء ({customersCount} عميل)
                <br />• جميع عمليات البيع ({salesCount} عملية)
                <br />• جميع عمليات تسديد الديون
                <br />• جميع المعاملات المرتبطة
                <br />
                <br />
                <strong>سيتم الاحتفاظ بجميع المنتجات والمخزون</strong>
                <br />
                <br />
                هذا الإجراء لا يمكن التراجع عنه!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDeleteAllCustomers}
                className="bg-orange-600 hover:bg-orange-700"
              >
                نعم، احذف جميع العملاء
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={loading}
              className="w-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4" />
              إعادة تعيين النظام كاملاً
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">
                🚨 تحذير خطير: إعادة تعيين كامل
              </AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف جميع البيانات نهائياً:
                <br />• {customersCount} عميل و {salesCount} عملية بيع
                <br />• {productsCount} منتج وجميع بيانات المخزون
                <br />• جميع عمليات التسديد والمعاملات
                <br />• جميع الإعدادات والبيانات المحلية
                <br />
                <br />
                <strong className="text-red-600">
                  هذا سيعيد النظام إلى حالة المصنع!
                </strong>
                <br />
                هذا الإجراء لا يمكن التراجع عنه نهائياً!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={onResetEntireDatabase}
                className="bg-red-600 hover:bg-red-700"
              >
                نعم، أعد تعيين كل شيء
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};
