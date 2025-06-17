import React, { useState, useEffect } from "react";
import Layout from "@/components/ui/Layout";
import { Button } from "@/components/ui/button";
import DataValidationPanel from "@/components/DataValidationPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  BarChart3,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  FileText,
  Printer,
} from "lucide-react";
import {
  Customer,
  Product,
  Sale,
  FullReport,
  getCurrentDateGregorian,
  formatDateGregorian,
  formatDateTimeGregorian,
} from "@/lib/types";
import { formatCurrency } from "@/lib/storage";
import { calculateBusinessKPIs, analyzeInventory } from "@/lib/calculations";
import { supabaseService } from "@/lib/supabaseService";
import { offlineManager } from "@/lib/offlineManager";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { SyncDebugger, autoFixSyncIssues } from "@/lib/syncDebugger";
import {
  emergencyFixConstraintErrors,
  inspectSyncQueue,
} from "@/lib/emergencyFix";
import { networkChecker, useNetworkStatus } from "@/lib/networkChecker";
import { UUIDErrorFixer, fixUUIDErrors } from "@/lib/uuidErrorFixer";
import { QuantitySyncFixer } from "@/lib/quantitySyncFixer";
import { DangerousActions } from "@/components/DangerousActions";
import {
  quickFixSyncErrors,
  emergencyCleanup,
  checkSyncHealth,
} from "@/lib/quickSyncFix";
import {
  fixInventoryAndSalesNow,
  getDetailedSystemReport,
} from "@/lib/emergencyInventoryFix";
import OfflineSyncFix from "@/components/OfflineSyncFix";
import SyncErrorManagerComponent from "@/components/SyncErrorManager";
import CustomerDiagnostic from "@/components/CustomerDiagnostic";
import ConnectionDiagnostic from "@/components/ConnectionDiagnostic";
import { ComprehensiveFakeDataCleanup } from "@/lib/comprehensiveFakeDataCleanup";
import { CompleteSystemReset } from "@/lib/completeSystemReset";
import ConnectionThrottler from "@/lib/connectionThrottler";
import SystemValidation from "@/components/SystemValidation";
import ThrottlerMonitor from "@/components/ThrottlerMonitor";
import { diagnoseAndFix } from "@/lib/diagnosticAndFix";

const Settings: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");
  const [schemaStatus, setSchemaStatus] = useState<{
    status: "checking" | "healthy" | "needs_fix";
    missingTable: boolean;
    missingRelations: boolean;
  }>({
    status: "checking",
    missingTable: false,
    missingRelations: false,
  });
  const [offlineStatus, setOfflineStatus] = useState(
    offlineManager.getStatus(),
  );

  useEffect(() => {
    loadData();
    checkConnection();

    // Auto-fix sync issues on page load
    const performAutoFixes = async () => {
      try {
        const queueInfo = SyncDebugger.getQueueInfo();
        if (queueInfo.problematic > 0 || queueInfo.oldStructure > 0) {
          console.log("🔧 Auto-fixing sync issues on page load...");
          autoFixSyncIssues();
        }

        // Execute emergency fix for constraint errors immediately
        try {
          emergencyFixConstraintErrors();
          console.log("✅ Emergency constraint fix completed");
        } catch (fixError) {
          console.error("Emergency fix failed:", fixError);
        }

        // Execute UUID error fix
        try {
          fixUUIDErrors();
          console.log("✅ UUID error fix completed");
        } catch (uuidFixError) {
          console.error("UUID fix failed:", uuidFixError);
        }

        // Execute quantity sync fix (with graceful error handling)
        try {
          const quantityHealth =
            await QuantitySyncFixer.performQuantityHealthCheck();
          if (!quantityHealth.healthy) {
            console.log("🔧 Auto-fixing quantity issues...");
          } else {
            console.log("✅ Quantity health check completed - all good");
          }
        } catch (quantityFixError) {
          // Handle gracefully - don't break the app
          console.warn(
            "⚠️ Quantity fix warning:",
            quantityFixError?.message || quantityFixError,
          );
        }
      } catch (error) {
        console.error("Error during auto-fix:", error);
      }
    };

    // Execute auto-fixes with debounce to prevent multiple executions
    let hasExecuted = false;
    const timer = setTimeout(() => {
      if (!hasExecuted) {
        hasExecuted = true;
        performAutoFixes();
      }
    }, 1000);

    // Cleanup timer on unmount
    return () => {
      hasExecuted = true;
      clearTimeout(timer);
    };

    // Update offline status every 5 seconds
    const statusInterval = setInterval(() => {
      setOfflineStatus(offlineManager.getStatus());
    }, 5000);

    // Return cleanup function for both timer and interval
    return () => {
      hasExecuted = true;
      clearTimeout(timer);
      clearInterval(statusInterval);
    };
  }, []);

  const checkConnection = async () => {
    setConnectionStatus("checking");
    setSchemaStatus({
      status: "checking",
      missingTable: false,
      missingRelations: false,
    });

    try {
      // Use network checker for better diagnostics
      const isConnected = await networkChecker.checkSupabaseConnection();

      if (isConnected) {
        setConnectionStatus("connected");

        // Check schema health if connected
        try {
          const schemaHealth = await supabaseService.checkSchemaHealth();
          setSchemaStatus({
            status: schemaHealth.healthy ? "healthy" : "needs_fix",
            missingTable: schemaHealth.missingTable,
            missingRelations: schemaHealth.missingRelations,
          });
        } catch (schemaError) {
          console.warn("Schema check failed:", schemaError);
          setSchemaStatus({
            status: "needs_fix",
            missingTable: true,
            missingRelations: true,
          });
        }
      } else {
        setConnectionStatus("disconnected");
        setSchemaStatus({
          status: "checking",
          missingTable: false,
          missingRelations: false,
        });
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Connection failed";
      console.error("Connection check failed:", errorMessage);
      setConnectionStatus("disconnected");
      setSchemaStatus({
        status: "needs_fix",
        missingTable: false,
        missingRelations: false,
      });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use offline manager for resilient data loading
      const [customersData, productsData, salesData] = await Promise.all([
        offlineManager.getCustomers(),
        offlineManager.getProducts(),
        offlineManager.getSales(),
      ]);

      setCustomers(customersData);
      setProducts(productsData);
      setSales(salesData);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("فشل في تحميل البيانات. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    try {
      const data = {
        customers,
        products,
        sales,
        exportDate: new Date().toISOString(),
        version: "2.0",
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `مركز_البدر_backup_${getCurrentDateGregorian()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      alert("تم تصدير البيانات بنجاح!");
    } catch (error) {
      console.error("Error exporting data:", error);
      setError("حدث خطأ أثناء تصدير البيانات.");
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        if (data.customers && data.products && data.sales) {
          // Clear current data
          offlineManager.clearCache();

          // Import new data
          offlineManager.cacheData("customers", data.customers);
          offlineManager.cacheData("products", data.products);
          offlineManager.cacheData("sales", data.sales);

          alert("تم استيراد البيانات بنجاح! سيتم تحديث الصفحة.");
          window.location.reload();
        } else {
          throw new Error("Invalid file format");
        }
      } catch (error) {
        console.error("Error importing data:", error);
        setError("فشل في استيراد البيانات. يرجى التأكد من صحة الملف.");
      }
    };
    reader.readAsText(file);
  };

  const resetData = async () => {
    try {
      setLoading(true);

      // Clear offline cache
      offlineManager.clearCache();

      // If connected, also clear Supabase data
      if (connectionStatus === "connected") {
        // Note: This would require admin permissions in Supabase
        console.log("Would clear Supabase data if admin permissions available");
      }

      setCustomers([]);
      setProducts([]);
      setSales([]);

      alert("تم إعادة تعيين البيانات بنجاح!");
    } catch (error) {
      console.error("Error resetting data:", error);
      setError("حدث خطأ أثناء إعادة تعيين البيانات.");
    } finally {
      setLoading(false);
    }
  };

  const syncWithSupabase = async () => {
    try {
      setLoading(true);
      await offlineManager.forcSync();
      await loadData();
      alert("تم تحديث البيانات بنجاح!");
    } catch (error) {
      console.error("Error syncing data:", error);
      setError("حدث خطأ أثناء مزامنة البيانات.");
    } finally {
      setLoading(false);
    }
  };

  const fixSyncIssues = async () => {
    try {
      setLoading(true);

      // Get queue info before fixing
      const queueInfo = SyncDebugger.getQueueInfo();
      console.log("Queue info before fixing:", queueInfo);

      // Auto-fix sync issues
      autoFixSyncIssues();

      // Update offline status after fixing
      setOfflineStatus(offlineManager.getStatus());

      alert(
        `تم إصلاح مشاكل المزامنة!\nالعمليات المؤجلة: ${queueInfo.total}\nالعمليات المشكوك فيها: ${queueInfo.problematic}\nالعمليات ذات البنية القديمة: ${queueInfo.oldStructure}`,
      );
    } catch (error) {
      console.error("Error fixing sync issues:", error);
      setError("حدث خطأ أثناء إصلاح مشاكل المزامنة.");
    } finally {
      setLoading(false);
    }
  };

  const clearSyncQueue = async () => {
    if (
      confirm(
        "هل أنت متأكد من حذف جميع العمليات المؤجل��؟ هذا الإجراء لا يمكن التراجع عنه.",
      )
    ) {
      try {
        SyncDebugger.clearQueue();
        setOfflineStatus(offlineManager.getStatus());
        alert("تم حذف جميع العمليات المؤجلة.");
      } catch (error) {
        console.error("Error clearing sync queue:", error);
        setError("حدث خطأ أثناء حذف العمليات المؤجلة.");
      }
    }
  };

  const runNetworkDiagnostics = async () => {
    try {
      setLoading(true);

      console.log("🔍 Running network diagnostics...");
      const result = await networkChecker.autoFixConnection();

      const status = networkChecker.getStatus();

      const message =
        `تشخيص الشبكة والاتصال:\n\n` +
        `🌐 حالة الإنترنت: ${status.isOnline ? "متصل" : "غير متصل"}\n` +
        `💾 قاعدة البيانات: ${status.supabaseConnected ? "متصلة" : "غير متصلة"}\n` +
        `⚡ جودة الاتصال: ${networkChecker.getConnectionQuality()}\n` +
        `📡 الاستجابة: ${status.ping ? `${status.ping}ms` : "غير محدد"}\n\n` +
        `${result.success ? "✅" : "❌"} ${result.message}\n\n` +
        `الإجراءات:\n${result.actions.map((action) => `�� ${action}`).join("\n")}`;

      alert(message);

      // Update connection status
      checkConnection();
    } catch (error) {
      console.error("Network diagnostics failed:", error);
      alert("فشل في تشخيص الشبكة.");
    } finally {
      setLoading(false);
    }
  };

  // Quick fix for sync errors
  const handleQuickSyncFix = async () => {
    setLoading(true);
    try {
      await quickFixSyncErrors();
      await loadData();
      alert("تم إصلاح مشاكل المزامنة بنجاح! ✅");
    } catch (error) {
      console.error("Quick sync fix failed:", error);
      alert("فشل في الإصلاح السري��. جاري تجربة التنظيف الشامل...");

      try {
        emergencyCleanup();
        await loadData();
        alert("تم التنظيف الشامل بنجاح! قد تحتاج لإعادة تسجيل بعض البيانات.");
      } catch (emergencyError) {
        alert("فشل في التنظيف الشامل. يرجى إعادة تشغيل التطبيق.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Check sync health
  const checkSyncStatus = () => {
    const health = checkSyncHealth();

    if (health.healthy) {
      alert(
        "✅ نظام المزامنة يعمل بشكل طبيعي!\n\nالعمليات في الطابور: " +
          health.queueLength,
      );
    } else {
      const issuesText = health.issues.join("\n• ");
      alert(
        `⚠️ تم العثور على مشاكل في المزامنة:\n\n• ${issuesText}\n\nالعمليات في الطابور: ${health.queueLength}\nالعملاء المؤقتين: ${health.offlineCustomers}\n\nيُنصح بالضغط على "إصلاح سريع للمزامنة"`,
      );
    }
  };

  // Emergency fix for inventory and sales issues
  const handleEmergencyFix = async () => {
    setLoading(true);
    try {
      const result = await fixInventoryAndSalesNow();
      alert(result);
      await loadData();
    } catch (error) {
      console.error("Emergency fix failed:", error);
      alert(
        "فشل في الإصلاح الطارئ. يرجى تشغيل سكريبت CRITICAL_DATABASE_FIX.sql يدوياً في Supabase.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Comprehensive system diagnosis
  const handleSystemDiagnosis = async () => {
    setLoading(true);
    try {
      const report = await diagnoseAndFix();

      // Show report in a modal-like alert
      const formattedReport = report.replace(/\n/g, "\n");
      alert(formattedReport);

      await loadData();
    } catch (error) {
      console.error("System diagnosis failed:", error);
      alert("فشل في التشخيص. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // Comprehensive fake data cleanup
  const handleComprehensiveFakeDataCleanup = async () => {
    setLoading(true);
    try {
      // First check for fake data
      const checkResult = await ComprehensiveFakeDataCleanup.checkForFakeData();

      if (!checkResult.hasFakeData) {
        alert("✅ لا توجد بيانات وهمية في النظام. جميع البيانات حقيقية.");
        return;
      }

      const confirmCleanup = window.confirm(
        `تم العثور على بيانات وهمية:\n\n` +
          `${checkResult.details.join("\n")}\n\n` +
          `هل تريد حذف جميع البيانات الوهمية؟\n\n` +
          `سيتم:\n` +
          `• حذف جميع المنتجات الوهمية\n` +
          `• حذف جميع العملاء الوهميين\n` +
          `• تنظيف الذاكرة المحلية\n` +
          `• إعادة تحميل البيانات الحقيقية فقط`,
      );

      if (!confirmCleanup) return;

      const result = await ComprehensiveFakeDataCleanup.cleanupAllFakeData();

      if (result.success) {
        alert(
          `✅ ${result.message}\n\n` +
            `التفاصيل:\n` +
            `• منتجات وهمية محذوفة: ${result.details.fakeProductsRemoved}\n` +
            `• عملاء وهميين محذوفين: ${result.details.fakeCustomersRemoved}\n` +
            `• تم تنظيف الذاكرة المحلية: ${result.details.localStorageCleared ? "نعم" : "لا"}\n` +
            `• تم تحميل البيانات الحقيقية: ${result.details.realDataReloaded ? "نعم" : "لا"}`,
        );

        // Refresh the page data
        await loadData();
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error("Comprehensive cleanup failed:", error);
      alert("فشل في تنظيف البيانات الوهمية. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // Complete system reset
  const handleCompleteSystemReset = async () => {
    // First confirmation
    const firstConfirm = window.confirm(
      "⚠️ تحذير خطير ⚠️\n\n" +
        "هذا الإجراء سيحذف جميع البيانات نهائياً:\n\n" +
        "• جميع العملاء والمنتجات\n" +
        "• جميع عمليات البيع والمشتريات\n" +
        "• جميع المعاملات والديون\n" +
        "• جميع البيانات المحلية\n\n" +
        "هذا الإجراء لا يمكن التراجع عنه!\n\n" +
        "هل أنت متأكد؟",
    );

    if (!firstConfirm) return;

    // Second confirmation with typing
    const confirmText = window.prompt(
      "للتأكيد من هذا الإجراء الخطير، اكتب النص التالي بالضبط:\n\n" +
        "احذف جميع البيانات نهائياً",
    );

    if (confirmText !== "احذف جميع البيانات نهائياً") {
      alert("تم إلغاء العملية - لم يتم كتابة النص بشكل صحيح");
      return;
    }

    // Final confirmation with countdown
    const finalConfirm = window.confirm(
      "⚠️ التحذير الأخير ⚠️\n\n" +
        "ستفقد جميع البيانات إلى الأبد!\n\n" +
        "هل أنت متأكد 100% من المتابعة؟",
    );

    if (!finalConfirm) return;

    setLoading(true);
    try {
      console.log("🔥 بدء تفريغ النظام بالكامل...");

      const result = await CompleteSystemReset.resetEverything();

      if (result.success) {
        alert(
          `✅ ${result.message}\n\n` +
            `التفاصيل:\n` +
            `• عملاء محذوفين: ${result.details.customersDeleted}\n` +
            `• منتجات محذوفة: ${result.details.productsDeleted}\n` +
            `• مبيعات محذوفة: ${result.details.salesDeleted}\n` +
            `• عناصر مبيعات محذوفة: ${result.details.saleItemsDeleted}\n` +
            `• دفعات ديون محذوفة: ${result.details.debtPaymentsDeleted}\n` +
            `• معاملات محذوفة: ${result.details.transactionsDeleted}\n` +
            `• تم تنظيف الذاكرة المحلية: ${result.details.localStorageCleared ? "نعم" : "لا"}\n` +
            `• تم تنظيف الـ cache: ${result.details.offlineCacheCleared ? "نعم" : "لا"}\n\n` +
            `النظام فارغ الآن ومستعد للبدء من جديد!`,
        );

        // Verify system is empty
        const verification = await CompleteSystemReset.verifySystemEmpty();

        if (verification.isEmpty) {
          alert("✅ تم التحقق: النظام فارغ بالكامل");
        } else {
          alert(
            `⚠️ تحذير: قد تكون هناك بيانات متبقية:\n` +
              `عملاء: ${verification.details.customers}\n` +
              `منتجات: ${verification.details.products}\n` +
              `مبيعات: ${verification.details.sales}\n` +
              `مفاتيح محلية: ${verification.details.localStorageKeys}`,
          );
        }

        // Refresh the page data
        await loadData();

        // Reload the page to ensure clean state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error("Complete system reset failed:", error);
      alert("فشل في إعادة تعيين النظام. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // Emergency connection reset
  const handleEmergencyConnectionReset = () => {
    try {
      console.log("🚨 تنفيذ إعادة تعيين طارئة للاتصالات...");

      // إعادة تعيين طارئة للـ throttler
      ConnectionThrottler.emergencyReset();

      // تنظيف offline manager
      offlineManager.clearAllCache();

      alert(
        "✅ تم إعادة تعيين نظام الاتصالات في وضع الطوارئ\n\n" +
          "تم:\n" +
          "• إعادة تعيين جميع الطلبات المعلقة\n" +
          "• تفعيل وضع الطوارئ (طلبات غير محدودة)\n" +
          "• إضافة نظام bypass للطلبات المعلقة\n" +
          "• تنظيف الـ cache\n\n" +
          "وضع الطوارئ سيُلغى تلقائياً بعد دقيقة واحدة.\n" +
          "حاول تحديث الصفحة الآن",
      );
    } catch (error) {
      console.error("Emergency reset failed:", error);
      alert("فشل في إعادة التعيين الطارئة");
    }
  };

  // Get detailed system report
  const handleDetailedReport = async () => {
    setLoading(true);
    try {
      const report = await getDetailedSystemReport();
      alert(report);
    } catch (error) {
      console.error("Detailed report failed:", error);
      alert("فشل في إنشاء التقرير. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // Delete all customers only
  const deleteAllCustomers = async () => {
    if (
      !window.confirm(
        "هل أنت متأكد من حذف جميع العملاء؟\n\nسيتم حذف:\n- جميع بيانات العملاء\n- جميع عمليات البيع المرتبطة\n- جميع عمليات تسديد الديون\n\nهذا الإجراء لا يمكن التراجع عنه!",
      )
    ) {
      return;
    }

    const finalConfirm = window.prompt("اكتب 'حذف جميع العملاء' للتأكيد:");
    if (finalConfirm !== "حذف جميع العملاء") {
      alert("تم إلغاء العملية");
      return;
    }

    try {
      setLoading(true);
      console.log("🗑️ Deleting all customers and related data...");

      await supabaseService.deleteAllCustomers();

      setCustomers([]);
      setSales([]);

      // Clear offline cache
      offlineManager.clearCache();

      alert(
        "✅ تم حذف جميع العملاء وعمليات البيع بنجاح!\n📦 تم الاحتفاظ بجميع المنتجات",
      );
    } catch (error) {
      console.error("Error deleting all customers:", error);
      setError("حدث خطأ أثناء حذف العملاء: " + (error as any)?.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset entire database
  const resetEntireDatabase = async () => {
    if (
      !window.confirm(
        "⚠️ تحذير: إعادة تعيين كامل للنظام!\n\nسيتم حذف:\n- جميع العملاء والمبيعات\n- جميع المنتجات والمخزون\n- جميع عمليات التسديد والمعاملات\n- جميع البيانات المخزنة محلياً\n\nهذا الإجراء لا يمكن التراجع عنه نهائياً!",
      )
    ) {
      return;
    }

    const finalConfirm = window.prompt("اكتب 'إعادة تعيين كامل' للتأكيد:");
    if (finalConfirm !== "إعادة تعيين كامل") {
      alert("تم إلغاء العملية");
      return;
    }

    try {
      setLoading(true);
      console.log("💥 Performing complete database reset...");

      await supabaseService.resetEntireDatabase();

      // Clear all local state
      setCustomers([]);
      setProducts([]);
      setSales([]);

      // Clear offline cache completely
      offlineManager.clearCache();
      localStorage.clear();

      alert(
        "✅ تم إعادة تعيين النظام بالكامل!\n\n🔄 سيتم إعادة تحميل الصفحة...",
      );

      // Reload page to reset everything
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error resetting database:", error);
      setError("حدث خطأ أثناء إعادة تعيين النظام: " + (error as any)?.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate and print full system report
  const generateFullReport = async () => {
    try {
      setReportLoading(true);

      // Generate comprehensive report
      const report: FullReport = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalCustomers: customers.length,
          totalProducts: products.length,
          totalSales: sales.length,
          totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
          totalProfit: sales.reduce(
            (sum, sale) => sum + (sale.profitAmount || 0),
            0,
          ),
          pendingDebt: customers.reduce(
            (sum, customer) => sum + (customer.debtAmount || 0),
            0,
          ),
        },
        customers,
        products,
        sales,
        transactions: [], // Would be loaded from supabase
        debtPayments: [], // Would be loaded from supabase
        lowStockAlerts: products.filter((p) => p.quantity <= p.minQuantity),
      };

      const reportHTML = generateReportHTML(report);

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setError("حدث خطأ أثناء إنشاء التقرير.");
    } finally {
      setReportLoading(false);
    }
  };

  const generateReportHTML = (report: FullReport): string => {
    const lowStockProducts = report.lowStockAlerts;
    const debtCustomers = report.customers.filter(
      (c) => (c.debtAmount || 0) > 0,
    );
    const businessKPIs = calculateBusinessKPIs(customers, products, sales);

    return `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>تقرير شامل - مركز البدر</title>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; line-height: 1.6; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
          .subtitle { font-size: 18px; color: #666; margin-bottom: 10px; }
          .report-info { font-size: 14px; color: #888; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
          .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef; }
          .summary-number { font-size: 32px; font-weight: bold; color: #2563eb; margin-bottom: 8px; }
          .summary-label { font-size: 14px; color: #666; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { font-size: 20px; font-weight: bold; color: #2563eb; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e9ecef; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          th { background: #f1f5f9; font-weight: bold; color: #2563eb; }
          .highlight { background: #fef3c7; }
          .danger { background: #fee2e2; }
          .success { background: #dcfce7; }
          .page-break { page-break-before: always; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e9ecef; font-size: 12px; color: #666; }
          @media print {
            body { padding: 10px; font-size: 11px; }
            .summary { grid-template-columns: repeat(2, 1fr); }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">📱 مركز البدر</div>
          <div class="subtitle">تقرير شامل لنظام إدارة مخزن الهواتف</div>
          <div class="report-info">
            تاريخ التقرير: ${formatDateTimeGregorian(report.generatedAt)}<br>
            التاريخ الميلادي: ${formatDateGregorian(getCurrentDateGregorian())}
          </div>
        </div>

        <!-- Executive Summary -->
        <div class="summary">
          <div class="summary-card">
            <div class="summary-number">${report.summary.totalCustomers}</div>
            <div class="summary-label">إجمالي العملاء</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${report.summary.totalProducts}</div>
            <div class="summary-label">إجمالي المنتجات</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${report.summary.totalSales}</div>
            <div class="summary-label">إجمالي المبيعات</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${formatCurrency(report.summary.totalRevenue)}</div>
            <div class="summary-label">إجمالي الإيرادات</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${formatCurrency(report.summary.totalProfit)}</div>
            <div class="summary-label">إجمالي الأرباح</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${formatCurrency(report.summary.pendingDebt)}</div>
            <div class="summary-label">إجمالي الديون</div>
          </div>
        </div>

        <!-- Key Performance Indicators -->
        <div class="section">
          <div class="section-title">📊 مؤشرا�� الأ��اء ال��ئي��ي��</div>
          <table>
            <tr>
              <th>المؤشر</th>
              <th>القيمة</th>
              <th>الوصف</th>
            </tr>
            <tr>
              <td>هامش الربح الإجمالي</td>
              <td>${businessKPIs.grossMargin.toFixed(1)}%</td>
              <td>نسبة الربح من إجمالي الإيرادات</td>
            </tr>
            <tr>
              <td>متوسط قيمة العميل</td>
              <td>${formatCurrency(businessKPIs.avgCustomerValue)}</td>
              <td>متوسط إنفاق العميل الواحد</td>
            </tr>
            <tr>
              <td>نسبة المبيعات النقدية</td>
              <td>${businessKPIs.cashSalesRatio.toFixed(1)}%</td>
              <td>نسبة المبيعات المدفوعة نقداً</td>
            </tr>
            <tr>
              <td>نسبة الديون للإيرادات</td>
              <td>${businessKPIs.debtToRevenueRatio.toFixed(1)}%</td>
              <td>نسبة الديون المستحقة من الإيرادات</td>
            </tr>
          </table>
        </div>

        <!-- Customers Overview -->
        <div class="section">
          <div class="section-title">👥 نظرة عامة على العملاء (${report.customers.length} عميل)</div>
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>آخر عملية</th>
                <th>حالة الدفع</th>
                <th>المبلغ المستحق</th>
              </tr>
            </thead>
            <tbody>
              ${report.customers
                .slice(0, 20)
                .map(
                  (customer) => `
                <tr class="${(customer.debtAmount || 0) > 0 ? "highlight" : ""}">
                  <td>${customer.name}</td>
                  <td>${customer.phone}</td>
                  <td>${formatDateGregorian(customer.lastSaleDate)}</td>
                  <td>${customer.paymentStatus === "cash" ? "نقدي" : customer.paymentStatus === "deferred" ? "آجل" : "جزئي"}</td>
                  <td>${formatCurrency(customer.debtAmount || 0)}</td>
                </tr>
              `,
                )
                .join("")}
              ${report.customers.length > 20 ? '<tr><td colspan="5" style="text-align: center; color: #666;">... والمزيد</td></tr>' : ""}
            </tbody>
          </table>
        </div>

        <!-- Products Overview -->
        <div class="section page-break">
          <div class="section-title">📦 نظرة عامة على المنتجات (${report.products.length} منتج)</div>
          <table>
            <thead>
              <tr>
                <th>اسم المنتج</th>
                <th>سعر الجملة</th>
                <th>سعر البيع</th>
                <th>الكمية المتوفرة</th>
                <th>الحد الأدنى</th>
                <th>حالة المخزن</th>
              </tr>
            </thead>
            <tbody>
              ${report.products
                .map(
                  (product) => `
                <tr class="${product.quantity <= product.minQuantity ? "danger" : product.quantity > product.minQuantity * 2 ? "success" : ""}">
                  <td>${product.name}</td>
                  <td>${formatCurrency(product.wholesalePrice)}</td>
                  <td>${formatCurrency(product.salePrice)}</td>
                  <td>${product.quantity}</td>
                  <td>${product.minQuantity}</td>
                  <td>
                    ${
                      product.quantity === 0
                        ? "نفد المخزن"
                        : product.quantity <= product.minQuantity
                          ? "مخزن منخفض"
                          : "متوفر"
                    }
                  </td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Low Stock Alerts -->
        ${
          lowStockProducts.length > 0
            ? `
        <div class="section">
          <div class="section-title">⚠️ تنبيهات المخزن المنخفض (${lowStockProducts.length} منتج)</div>
          <table>
            <thead>
              <tr>
                <th>اسم المنتج</th>
                <th>الكمية الحالية</th>
                <th>الحد الأدنى</th>
                <th>الكمية المطلوبة</th>
              </tr>
            </thead>
            <tbody>
              ${lowStockProducts
                .map(
                  (product) => `
                <tr class="danger">
                  <td>${product.name}</td>
                  <td>${product.quantity}</td>
                  <td>${product.minQuantity}</td>
                  <td>${Math.max(0, product.minQuantity * 2 - product.quantity)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
        `
            : ""
        }

        <!-- Debt Customers -->
        ${
          debtCustomers.length > 0
            ? `
        <div class="section">
          <div class="section-title">💰 العملاء المدينون (${debtCustomers.length} عميل)</div>
          <table>
            <thead>
              <tr>
                <th>اسم العميل</th>
                <th>رقم الهاتف</th>
                <th>��لمبلغ المستحق</th>
                <th>آخر عملية</th>
                <th>حالة الدفع</th>
              </tr>
            </thead>
            <tbody>
              ${debtCustomers
                .map(
                  (customer) => `
                <tr class="highlight">
                  <td>${customer.name}</td>
                  <td>${customer.phone}</td>
                  <td>${formatCurrency(customer.debtAmount || 0)}</td>
                  <td>${formatDateGregorian(customer.lastSaleDate)}</td>
                  <td>${customer.paymentStatus === "deferred" ? "آجل" : "جزئي"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
        `
            : ""
        }

        <!-- Recent Sales -->
        <div class="section page-break">
          <div class="section-title">🛒 آخر المبيعات (${Math.min(15, report.sales.length)} عملية)</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>العميل</th>
                <th>عدد المنتجات</th>
                <th>المبلغ الإجمالي</th>
                <th>المبلغ المدفوع</th>
                <th>المتبقي</th>
                <th>الربح</th>
              </tr>
            </thead>
            <tbody>
              ${report.sales
                .slice(0, 15)
                .map((sale) => {
                  const customer = report.customers.find(
                    (c) => c.id === sale.customerId,
                  );
                  return `
                  <tr>
                    <td>${formatDateGregorian(sale.saleDate)}</td>
                    <td>${customer?.name || "غير معروف"}</td>
                    <td>${sale.items?.length || 1}</td>
                    <td>${formatCurrency(sale.totalAmount)}</td>
                    <td>${formatCurrency(sale.paidAmount)}</td>
                    <td>${formatCurrency(sale.remainingAmount)}</td>
                    <td>${formatCurrency(sale.profitAmount || 0)}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <strong>مركز البدر - نظام إدارة مخزن الهواتف</strong><br>
          تقرير شامل تم إنشاؤه في: ${formatDateTimeGregorian(report.generatedAt)}<br>
          النظام يعمل بتقنية PWA مع دعم العمل أوف لاين • مطور بواسطة فريق مركز البدر
        </div>
      </body>
      </html>
    `;
  };

  const businessKPIs = calculateBusinessKPIs(customers, products, sales);
  const inventoryAnalysis = analyzeInventory(products);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-blue-600" />
            إعدادات النظام
          </h1>
          <p className="text-gray-600 mt-1">
            إدارة البيانات والتقارير والإعدادات العامة
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="mr-auto text-red-600"
            >
              ✕
            </Button>
          </div>
        )}

        {/* Customer Statement Issue Alert */}
        <Card className="border-l-4 border-l-orange-500 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <FileText className="h-5 w-5" />
              هل لا تظهر المنتجات في كشف الحساب؟
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-orange-700 mb-4">
              إذا كانت كشوف حساب العملاء فارغة أو لا تظهر المنتجات المشتراة،
              يمكن إصلاح هذا بسهولة
            </p>
            <Button
              onClick={handleEmergencyFix}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RefreshCw
                className={cn("h-4 w-4 ml-2", loading && "animate-spin")}
              />
              إصلاح المشكلة
            </Button>
          </CardContent>
        </Card>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    حالة الاتصال
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {connectionStatus === "connected" ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-600">
                          متصل
                        </span>
                      </>
                    ) : connectionStatus === "disconnected" ? (
                      <>
                        <WifiOff className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-600">
                          غير متصل
                        </span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
                        <span className="text-sm font-semibold text-yellow-600">
                          جاري الفحص
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    العمليات المؤجلة
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {offlineStatus.queuedOperations}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {offlineStatus.syncInProgress
                      ? "جاري المزامنة..."
                      : "في الانتظار"}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    البيانات المحفوظة
                  </p>
                  <div className="text-lg font-bold text-gray-800">
                    {customers.length + products.length + sales.length}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">سجل محلي</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    آخر مزامنة
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    {offlineStatus.lastSync || "غير متوفر"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">تزامن تلقائي</p>
                </div>
                <RefreshCw className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    حالة قاعدة البيانات
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {schemaStatus.status === "healthy" ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-600">
                          سليمة
                        </span>
                      </>
                    ) : schemaStatus.status === "needs_fix" ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-600">
                          تحتاج إصلاح
                        </span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
                        <span className="text-sm font-semibold text-yellow-600">
                          جاري الفحص
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {schemaStatus.status === "needs_fix"
                      ? schemaStatus.missingTable
                        ? "⚠️ جدول sale_items مفقود"
                        : schemaStatus.missingRelations
                          ? "⚠️ العلاقات مفقودة"
                          : "قم بتشغيل supabase-schema-fix.sql"
                      : "العلاقات والجداول"}
                  </p>
                </div>
                <Database className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Business Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              إحصائيات العمل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {customers.length}
                </div>
                <div className="text-sm text-gray-600">إجمالي العملاء</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(businessKPIs.totalRevenue)}
                </div>
                <div className="text-sm text-gray-600">إجمالي الإيرادات</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {businessKPIs.grossMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">هامش الربح</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {inventoryAnalysis.lowStockItems}
                </div>
                <div className="text-sm text-gray-600">
                  منتجات منخفضة المخزن
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                إدارة البيانات
              </CardTitle>
              <CardDescription>
                نسخ احتياطي واستيراد وتصدير البيانات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={exportData}
                className="w-full flex items-center gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                تصدير نسخة احتياطية
              </Button>

              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                  id="import-file"
                />
                <label htmlFor="import-file">
                  <Button
                    as="span"
                    className="w-full flex items-center gap-2"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4" />
                    استعادة البيانات
                  </Button>
                </label>
              </div>

              <Separator />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    إعادة تعيين النظام
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد إعادة التعيين</AlertDialogTitle>
                    <AlertDialogDescription>
                      هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن
                      التراجع عنه وسيتم فقدان جميع العملاء والمنتجات والمبيعات.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={resetData}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      نعم، احذف جميع البيانات
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                أدوات الصيانة
              </CardTitle>
              <CardDescription>إصلاح وتشخيص مشاكل النظام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Critical Issue Fixes */}
              <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  🚨 إصلاح المشاكل الحرجة
                </h4>
                <div className="space-y-2">
                  <Button
                    onClick={handleEmergencyFix}
                    disabled={loading}
                    className="w-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", loading && "animate-spin")}
                    />
                    إصلاح فوري: المخزن + كشف الحساب
                  </Button>

                  <Button
                    onClick={handleSystemDiagnosis}
                    disabled={loading}
                    className="w-full flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <AlertCircle
                      className={cn("h-4 w-4", loading && "animate-spin")}
                    />
                    تشخيص شامل + إصلاح تلقائي
                  </Button>

                  <Button
                    onClick={handleEmergencyConnectionReset}
                    className="w-full flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    إعادة تعيين الاتصالات (طوارئ)
                  </Button>

                  <Button
                    onClick={handleComprehensiveFakeDataCleanup}
                    disabled={loading}
                    className="w-full flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Trash2
                      className={cn("h-4 w-4", loading && "animate-spin")}
                    />
                    حذف جميع البيانات الوهمية
                  </Button>
                </div>
              </div>

              {/* Complete System Reset Section */}
              <div className="border-2 border-red-500 rounded-lg p-4 bg-red-100">
                <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  🔥 تفريغ النظام بالكامل
                </h4>
                <p className="text-red-800 text-sm mb-3">
                  ⚠️ خطر شديد: سيحذف جميع البيانات نهائياً (عملاء، منتجات،
                  مبيعات، إعدادات)
                </p>
                <div className="space-y-2">
                  <Button
                    onClick={handleCompleteSystemReset}
                    disabled={loading}
                    className="w-full flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold"
                  >
                    <Trash2
                      className={cn("h-4 w-4", loading && "animate-spin")}
                    />
                    تفريغ وإعادة تعيين النظام بالكامل
                  </Button>
                  <p className="text-xs text-red-700">
                    ⚠️ هذا الإجراء نهائي ولا يمكن التراجع عنه!
                  </p>
                </div>
              </div>

              {/* Essential Maintenance Only */}
              <div className="space-y-2">
                <Button
                  onClick={handleQuickSyncFix}
                  disabled={loading}
                  className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", loading && "animate-spin")}
                  />
                  مزامنة مع قاعدة البيانات
                </Button>

                {offlineStatus.queuedOperations > 0 && (
                  <Button
                    onClick={clearSyncQueue}
                    className="w-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف العمليات المؤجلة ({offlineStatus.queuedOperations})
                  </Button>
                )}
              </div>

              {schemaStatus.status === "needs_fix" && (
                <div className="space-y-2">
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800 mb-2">
                      <strong>مشكلة في قاعدة البيانات:</strong>
                    </p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {schemaStatus.missingTable && (
                        <li>• جدول sale_items مفقود</li>
                      )}
                      {schemaStatus.missingRelations && (
                        <li>• العلاقات بين الجداول مفقودة</li>
                      )}
                    </ul>
                  </div>

                  <Button
                    onClick={() => {
                      window.open(
                        "https://supabase.com/dashboard/project",
                        "_blank",
                      );
                      alert(
                        "قم بفتح SQL Editor في Supabase وتشغيل الملف supabase-schema-fix.sql الموجود في المشروع",
                      );
                    }}
                    className="w-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Database className="h-4 w-4" />
                    إصلاح قاعدة البيانات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Validation Panel */}
          <DataValidationPanel />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                التقارير والطباعة
              </CardTitle>
              <CardDescription>إنشاء وطباعة التقارير الشاملة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* MAIN FEATURE: Full System Report */}
              <Button
                onClick={generateFullReport}
                disabled={reportLoading}
                className="w-full flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {reportLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {reportLoading
                  ? "جاري إنشاء التقرير..."
                  : "طباعة التقرير الشامل PDF"}
              </Button>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">
                  التقرير الشامل يتضمن:
                </h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• ملخص تنفيذي لجميع العمليات</li>
                  <li>• قائمة العملاء وحالاتهم</li>
                  <li>• جرد المنتجات والكميات</li>
                  <li>• تاريخ المبيعات والأرباح</li>
                  <li>• تنبيهات المخزن المنخفض</li>
                  <li>• العملاء المدينون</li>
                  <li>• مؤشرات الأداء الرئيسية</li>
                </ul>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Printer className="h-3 w-3" />
                  طباعة الصفحة
                </Button>
                <Button
                  onClick={checkConnection}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  فحص الاتصال
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cache Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-600" />
              حالة التخزين المؤقت
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {offlineStatus.cacheStatus.customers}
                </div>
                <div className="text-sm text-gray-600">عملاء محفوظون</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {offlineStatus.cacheStatus.products}
                </div>
                <div className="text-sm text-gray-600">منتجات محفوظة</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {offlineStatus.cacheStatus.sales}
                </div>
                <div className="text-sm text-gray-600">مبيعات محفوظة</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Validation - فحص النظام قبل الإصدار */}
        <SystemValidation />

        {/* Connection Diagnostic - أداة تشخيص الاتصال */}
        <ConnectionDiagnostic />

        {/* Throttler Monitor - مراقب تنظيم الاتصال */}
        <ThrottlerMonitor />

        {/* Sync Error Manager */}
        <SyncErrorManagerComponent />

        {/* Customer Data Diagnostic */}
        <CustomerDiagnostic />

        {/* Offline Sync Fix Tool */}
        <OfflineSyncFix />
      </div>
    </Layout>
  );
};

export default Settings;
