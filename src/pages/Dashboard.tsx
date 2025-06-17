import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/ui/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Plus,
  Edit,
  Trash2,
  Printer,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  DollarSign,
  Calendar,
  Save,
  RefreshCw,
  Eye,
  Phone,
  MapPin,
  ShoppingCart,
  FileText,
} from "lucide-react";
import {
  Customer,
  Product,
  Sale,
  getCurrentDateGregorian,
  formatDateGregorian,
} from "@/lib/types";
import {
  formatCurrency,
  getCustomers,
  getProducts,
  getSales,
} from "@/lib/storage";
import { calculateBusinessKPIs, analyzeCustomer } from "@/lib/calculations";
import { supabaseService } from "@/lib/supabaseService";
import { offlineManager } from "@/lib/offlineManager";
import { isSupabaseConfigured } from "@/lib/supabase";
import { networkChecker } from "@/lib/networkChecker";
import { cn } from "@/lib/utils";
import { ActivityLogger } from "@/lib/activityLogger";
import { backgroundSync } from "@/lib/backgroundSync";
import { OfflineModeHandler } from "@/lib/offlineModeHandler";
import DatabaseHealthAlert from "@/components/DatabaseHealthAlert";
import { useRealTimeDataSync } from "@/lib/realTimeDataSync";
import FastDataLoader from "@/components/FastDataLoader";

const Dashboard: React.FC = () => {
  return (
    <FastDataLoader>
      {({ customers, products, sales, loading, error, refreshData }) => (
        <DashboardContent
          customers={customers}
          products={products}
          sales={sales}
          loading={loading}
          error={error}
          refreshData={refreshData}
        />
      )}
    </FastDataLoader>
  );
};

interface DashboardContentProps {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  customers,
  products,
  sales,
  loading,
  error: dataError,
  refreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // Debt payment modal states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [debtPaymentOpen, setDebtPaymentOpen] = useState(false);
  const [debtPaymentData, setDebtPaymentData] = useState({
    paymentType: "full" as "full" | "partial",
    amount: 0,
    notes: "",
  });

  // Customer details modal
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] =
    useState<Customer | null>(null);

  // Customer edit modal
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerData, setEditCustomerData] = useState({
    name: "",
    phone: "",
    address: "",
  });

  // Real-time data sync for immediate updates
  const { updateTrigger } = useRealTimeDataSync();

  // Update data when real-time changes occur
  useEffect(() => {
    if (updateTrigger > 0) {
      console.log(
        "🔄 Real-time data update detected in Dashboard, refreshing...",
      );
      refreshData(); // Use FastDataLoader's refresh function
    }
  }, [updateTrigger, refreshData]);

  useEffect(() => {
    const filtered = customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm),
    );
    setFilteredCustomers(filtered);
  }, [customers, searchTerm]);

  // Use error from FastDataLoader or local error
  const displayError = dataError || error;

  const loadData = async (forceRefresh = false) => {
    // Simply use refreshData for all refresh operations
    refreshData();

    if (forceRefresh) {
      console.log("🔄 Force refresh requested");
      // Trigger a background sync if needed
      setTimeout(async () => {
        try {
          if (navigator.onLine) {
            await offlineManager.forcSync();
            refreshData(); // Refresh again after sync
            console.log("✅ Force refresh completed");
          }
        } catch (error) {
          console.warn("Force refresh failed:", error);
        }
      }, 300);
    }
  };

  const openDebtPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDebtPaymentData({
      paymentType: "full",
      amount: customer.debtAmount || 0,
      notes: "",
    });
    setDebtPaymentOpen(true);
  };

  const handlePaymentTypeChange = (paymentType: "full" | "partial") => {
    setDebtPaymentData((prev) => ({
      ...prev,
      paymentType,
      amount:
        paymentType === "full"
          ? selectedCustomer?.debtAmount || 0
          : prev.amount,
    }));
  };

  const handleDebtPayment = async () => {
    if (!selectedCustomer) return;

    // Validate payment amount
    if (debtPaymentData.amount <= 0) {
      setError("يجب أن يكون مبلغ الدفع أكبر من الصفر");
      return;
    }

    if (debtPaymentData.amount > (selectedCustomer.debtAmount || 0)) {
      setError("مبلغ الدفع أكبر من المبلغ المستحق");
      return;
    }

    try {
      setError(null);
      console.log(
        `💳 Processing debt payment for customer ${selectedCustomer.name}`,
      );

      const currentDebt = selectedCustomer.debtAmount || 0;
      const paymentAmount = debtPaymentData.amount;
      const remainingDebt =
        debtPaymentData.paymentType === "full"
          ? 0
          : currentDebt - paymentAmount;

      console.log(
        `💰 Payment details: Current debt=${currentDebt}, Payment=${paymentAmount}, Remaining=${remainingDebt}`,
      );

      // Update customer debt first (most important)
      const updatedCustomer = await supabaseService.updateCustomer(
        selectedCustomer.id,
        {
          debtAmount: remainingDebt,
          paymentStatus: remainingDebt === 0 ? "cash" : "partial",
          debtPaidDate:
            remainingDebt === 0 ? getCurrentDateGregorian() : undefined,
        },
      );

      console.log("✅ Customer debt updated successfully");

      // Try to create debt payment record (non-critical)
      try {
        await supabaseService.createDebtPayment({
          customerId: selectedCustomer.id,
          amount: paymentAmount,
          paymentType: debtPaymentData.paymentType,
          paymentDate: getCurrentDateGregorian(),
          notes: debtPaymentData.notes,
          remainingDebt,
        });
        console.log("✅ Debt payment record created");
      } catch (paymentRecordError) {
        console.warn(
          "⚠️ Failed to create debt payment record:",
          paymentRecordError,
        );
        // Continue anyway as the main debt update succeeded
      }

      // Try to create transaction record (non-critical)
      try {
        await supabaseService.createTransaction({
          customerId: selectedCustomer.id,
          type: "payment",
          amount: paymentAmount,
          description: `تسديد ${debtPaymentData.paymentType === "full" ? "كامل" : "جزئي"} للدين`,
          transactionDate: new Date().toISOString(),
        });
        console.log("✅ Transaction record created");
      } catch (transactionError) {
        console.warn(
          "⚠️ Failed to create transaction record:",
          transactionError,
        );
        // Continue anyway as the main debt update succeeded
      }

      alert(
        `✅ تم تسديد ${formatCurrency(paymentAmount)} بنجاح!\n\n` +
          `💰 المبلغ المدفوع: ${formatCurrency(paymentAmount)}\n` +
          `⏰ المبلغ المتبقي: ${formatCurrency(remainingDebt)}\n` +
          `📅 تاريخ الدفع: ${formatDateGregorian(getCurrentDateGregorian())}`,
      );

      setDebtPaymentOpen(false);

      // Refresh data to get updated customer information
      refreshData();

      // Refresh data in background
      setTimeout(() => {
        loadData(true);
      }, 500);
    } catch (error) {
      console.error("Error processing debt payment:", error);
      setError(
        `حدث خطأ أثناء معالجة تسديد الدين: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      );
    }
  };

  const openCustomerDetails = async (customer: Customer) => {
    try {
      // Get customer sales from both online and offline sources
      let customerSales = [];

      if (navigator.onLine) {
        try {
          customerSales = await supabaseService.getSalesByCustomerId(
            customer.id,
          );
        } catch (error) {
          console.warn(
            "Failed to load sales from Supabase, using local data:",
            error,
          );
          customerSales = sales.filter((s) => s.customerId === customer.id);
        }
      } else {
        customerSales = sales.filter((s) => s.customerId === customer.id);
      }

      // Sort sales by date (newest first)
      customerSales.sort(
        (a, b) =>
          new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime(),
      );

      console.log(
        `📊 Loaded ${customerSales.length} sales for customer ${customer.name}`,
      );

      setSelectedCustomerDetails({
        ...customer,
        sales: customerSales,
      });
      setCustomerDetailsOpen(true);
    } catch (error) {
      console.error("Error loading customer details:", error);
      // Fallback to local data
      const fallbackSales = sales.filter((s) => s.customerId === customer.id);
      setSelectedCustomerDetails({
        ...customer,
        sales: fallbackSales,
      });
      setCustomerDetailsOpen(true);
    }
  };

  // Customer Edit Functions
  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomerData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
    });
    setEditCustomerOpen(true);
    setError(null);
  };

  const handleEditCustomer = async () => {
    if (!editingCustomer) return;

    if (
      !editCustomerData.name?.trim() ||
      !editCustomerData.phone?.trim() ||
      !editCustomerData.address?.trim()
    ) {
      setError("يرجى إدخال جميع البيانات المطلوبة");
      return;
    }

    try {
      setError(null);
      console.log(`✏️ Updating customer: ${editingCustomer.name}`);

      await supabaseService.updateCustomer(editingCustomer.id, {
        name: editCustomerData.name.trim(),
        phone: editCustomerData.phone.trim(),
        address: editCustomerData.address.trim(),
      });

      console.log("✅ Customer updated successfully");
      alert("✅ تم تحديث بيانات العميل بنجاح!");

      setEditCustomerOpen(false);

      // Refresh data to get updated customer information
      refreshData();

      // Additional refresh in background
      setTimeout(() => {
        loadData(true);
      }, 500);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      const errorMessage = error?.message || "خطأ غير محدد";

      if (
        errorMessage.includes("موجود مسبقاً") ||
        errorMessage.includes("duplicate")
      ) {
        setError(
          "رقم الهاتف موجود مسبقاً لعميل آخر. يرجى استخدام رقم هاتف مختلف.",
        );
      } else if (
        errorMessage.includes("offline") ||
        errorMessage.includes("أوف لاين")
      ) {
        setError(
          "لا يمكن تحديث العميل في وضع عدم الاتصال. يرجى الاتصال بالإنترنت أولاً.",
        );
      } else {
        setError(`حدث خطأ أثناء تحديث بيانات العميل: ${errorMessage}`);
      }
    }
  };

  // Enhanced Customer Statement Generator using new system
  const printEnhancedCustomerStatement = async (customer: Customer) => {
    try {
      console.log(
        `📄 Generating enhanced statement for customer: ${customer.name}`,
      );

      // Import the new enhanced statement function
      const { printEnhancedCustomerStatement: printStatement } = await import(
        "@/lib/enhancedStatement"
      );

      // Use the new enhanced printing system
      await printStatement(customer.id);

      console.log("✅ Enhanced statement printed successfully");
    } catch (error) {
      console.error("❌ Error generating enhanced statement:", error);

      // Fallback to simple statement if enhanced fails
      console.log("🔄 Falling back to simple statement...");
      try {
        await generateFallbackStatement(customer);
      } catch (fallbackError) {
        console.error("❌ Fallback statement also failed:", fallbackError);
        alert(
          "حدث خطأ في إنشاء كشف الحساب. يرجى التأكد من وجود اتصال بالإنترنت والمحاولة مرة أخرى.",
        );
      }
    }
  };

  // Fallback statement generator for when enhanced version fails
  const generateFallbackStatement = async (customer: Customer) => {
    console.log("📋 Generating fallback statement...");

    // Get basic customer data
    let customerSales = [];
    let customerDebtPayments = [];

    try {
      customerSales = await supabaseService.getSalesByCustomerId(customer.id);
      customerDebtPayments = await supabaseService.getDebtPaymentsByCustomerId(
        customer.id,
      );
    } catch (error) {
      console.warn("⚠️ Using local cached data:", error);
      customerSales = sales.filter((sale) => sale.customerId === customer.id);
      customerDebtPayments = [];
    }

    // Calculate basic totals
    const totalPurchases = customerSales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0,
    );
    const totalPaid = customerSales.reduce(
      (sum, sale) => sum + (sale.paidAmount || 0),
      0,
    );
    const currentDebt = customer.debtAmount || 0;

    // Generate simple statement
    generateSimpleStatement(customer, customerSales, customerDebtPayments, {
      totalPurchases,
      totalPaid,
      currentDebt,
    });
  };

  // Generate Simple Customer Statement (Fallback)
  const generateSimpleStatement = (
    customer: Customer,
    sales: any[],
    debtPayments: any[],
    totals: any,
  ) => {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب - ${customer.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #000;
            background: white;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding: 20px 0;
            margin-bottom: 20px;
          }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 14px; }

          .customer-info {
            border: 1px solid #000;
            padding: 15px;
            margin-bottom: 20px;
          }
          .customer-info h2 {
            font-size: 18px;
            margin-bottom: 10px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }

          .products-section {
            margin-bottom: 20px;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            background: #000;
            color: white;
            padding: 8px;
            margin-bottom: 10px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
          }
          th, td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
          }
          th {
            background: #f0f0f0;
            font-weight: bold;
          }
          .product-name { text-align: right; }

          .payments-section {
            margin: 20px 0;
          }
          .payment-item {
            border: 1px solid #ccc;
            padding: 10px;
            margin: 5px 0;
            background: #f9f9f9;
          }

          .totals {
            border: 2px solid #000;
            padding: 15px;
            margin-top: 20px;
            background: #f5f5f5;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-weight: bold;
          }
          .debt-amount {
            color: red;
            font-size: 18px;
          }

          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏪 مركز البدر للهواتف النقالة</h1>
          <p>كشف حساب العميل</p>
          <p>التاريخ: ${formatDateGregorian(getCurrentDateGregorian())}</p>
        </div>

        <div class="customer-info">
          <h2>معلومات العميل</h2>
          <div class="info-row">
            <span><strong>الاسم:</strong></span>
            <span>${customer.name}</span>
          </div>
          <div class="info-row">
            <span><strong>رقم الهاتف:</strong></span>
            <span>${customer.phone}</span>
          </div>
          <div class="info-row">
            <span><strong>العنوان:</strong></span>
            <span>${customer.address}</span>
          </div>
          <div class="info-row">
            <span><strong>تاريخ التسجيل:</strong></span>
            <span>${formatDateGregorian(customer.registrationDate)}</span>
          </div>
        </div>

        <div class="products-section">
          <div class="section-title">المنتجات المشتراة (${sales.length} عملية شراء)</div>
          ${
            sales.length === 0
              ? `<div style="text-align: center; padding: 30px; border: 2px solid #ddd; background: #f9f9f9;">
              <h3 style="color: #666; margin-bottom: 10px;">📦 لا توجد مشتريات لهذا العميل</h3>
              <p style="color: #888; font-size: 12px;">لم يقم العميل بشراء أي منتجات حتى الآن</p>
            </div>`
              : `<table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المنتجات</th>
                  <th>إجمالي الكمية</th>
                  <th>قيمة الشراء</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>نوع الدفع</th>
                </tr>
              </thead>
              <tbody>
                ${sales
                  .map((sale) => {
                    let productsList = "";
                    let totalQuantity = 0;

                    if (sale.items && sale.items.length > 0) {
                      productsList = sale.items
                        .map((item) => {
                          totalQuantity += item.quantity || 0;
                          return `${item.productName} (${item.quantity} × ${formatCurrency(item.unitPrice)})`;
                        })
                        .join("<br>");
                    } else {
                      productsList = "منتج واحد";
                      totalQuantity = 1;
                    }

                    const paymentTypeArabic =
                      sale.paymentType === "cash"
                        ? "نقداً"
                        : sale.paymentType === "deferred"
                          ? "آجل"
                          : "مختلط";

                    return `
                    <tr>
                      <td>${formatDateGregorian(sale.saleDate)}</td>
                      <td class="product-name" style="text-align: right;">${productsList}</td>
                      <td>${totalQuantity}</td>
                      <td><strong>${formatCurrency(sale.totalAmount)}</strong></td>
                      <td>${formatCurrency(sale.paidAmount)}</td>
                      <td style="color: ${sale.remainingAmount > 0 ? "red" : "green"};">${formatCurrency(sale.remainingAmount)}</td>
                      <td>${paymentTypeArabic}</td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>`
          }
        </div>

        ${
          debtPayments.length > 0
            ? `
          <div class="payments-section">
            <div class="section-title">عمليات تسديد الديون</div>
            ${debtPayments
              .map(
                (payment) => `
              <div class="payment-item">
                <strong>📅 ${formatDateGregorian(payment.paymentDate)}: قام العميل بتسديد دين مبلغ ${formatCurrency(payment.amount)}</strong>
                ${payment.notes ? `<br><em>📝 ملاحظات: ${payment.notes}</em>` : ""}
                <br>💰 المبلغ المتبقي بعد التسديد: <span style="color: ${payment.remainingDebt > 0 ? "red" : "green"}; font-weight: bold;">${formatCurrency(payment.remainingDebt)}</span>
                <br><small style="color: #666;">نوع التسديد: ${payment.paymentType === "full" ? "تسديد كامل" : "تسديد جزئي"}</small>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : `
          <div class="payments-section">
            <div class="section-title">عمليات تسديد الديون</div>
            <div style="text-align: center; padding: 15px; color: #666; border: 1px solid #ddd;">
              لم يقم العميل بأي ��مليات تسديد للديون حتى الآن
            </div>
          </div>
        `
        }

        <div class="totals">
          <h3 style="margin-bottom: 10px;">الملخص المالي</h3>
          <div class="total-row">
            <span>إجمالي المشتريات:</span>
            <span>${formatCurrency(totals.totalPurchases)}</span>
          </div>
          <div class="total-row">
            <span>إجمالي المدفوع:</span>
            <span>${formatCurrency(totals.totalPaid)}</span>
          </div>
          <div class="total-row">
            <span>المبلغ المستحق حالياً:</span>
            <span class="debt-amount">${formatCurrency(totals.currentDebt)}</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; border-top: 1px solid #000; padding-top: 15px;">
          <p><strong>مركز البدر للهواتف النقالة</strong></p>
          <p>العنوان: [عنوان المحل] | الهاتف: [رقم الهاتف]</p>
          <p style="font-size: 12px; margin-top: 10px;">
            تم إنشاء هذا الكشف في: ${formatDateGregorian(getCurrentDateGregorian())} - ${new Date().toLocaleTimeString("ar-SA")}
          </p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();

      // Auto print after short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert(
        "لا يمكن فتح نافذة الطباعة. يرجى التأكد من السماح للنوافذ المنبثقة.",
      );
    }
  };
  // Legacy print function (keeping for compatibility but not used)
  const generatePrintableStatement_legacy = (
    customer: Customer,
    products: any[],
    debtPayments: any[],
    totals: any,
  ) => {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كشف حساب - ${customer.name}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: white;
            padding: 15px;
          }

          .statement-container {
            max-width: 100%;
            margin: 0 auto;
            background: white;
            border: 2px solid #000;
            overflow: hidden;
          }

          .header {
            background: #000;
            color: white;
            padding: 15px;
            text-align: center;
            border-bottom: 2px solid #000;
          }

          .header h1 {
            font-size: 18px;
            margin-bottom: 5px;
            font-weight: bold;
          }

          .header p {
            font-size: 12px;
          }

          .customer-section {
            padding: 15px;
            background: white;
            border-bottom: 1px solid #000;
          }

          .customer-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }

          .info-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }

          .info-label {
            font-weight: bold;
            color: #475569;
            font-size: 12px;
            margin-bottom: 5px;
          }

          .info-value {
            color: #1e293b;
            font-size: 16px;
            font-weight: 600;
          }

          .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            padding: 25px;
            background: #f1f5f9;
            border-bottom: 1px solid #e2e8f0;
          }

          .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .summary-number {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }

          .summary-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
          }

          .products-section {
            padding: 25px;
          }

          .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #2563eb;
          }

          .products-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .products-table th {
            background: #2563eb;
            color: white;
            padding: 15px 10px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
          }

          .products-table td {
            padding: 12px 10px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }

          .products-table tbody tr:nth-child(even) {
            background: #f8fafc;
          }

          .products-table tbody tr:hover {
            background: #e0f2fe;
          }

          .payment-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }

          .payment-cash {
            background: #dcfce7;
            color: #166534;
          }

          .payment-deferred {
            background: #fee2e2;
            color: #991b1b;
          }

          .payment-partial {
            background: #fef3c7;
            color: #92400e;
          }

          .totals-section {
            padding: 25px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
          }

          .totals-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }

          .total-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            text-align: center;
          }

          .total-amount {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }

          .total-label {
            font-size: 12px;
            color: #64748b;
          }

          .debt-warning {
            background: #fef2f2;
            border: 2px solid #ef4444;
            color: #dc2626;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
          }

          .no-debt {
            background: #f0fdf4;
            border: 2px solid #22c55e;
            color: #15803d;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
          }

          .footer {
            background: #1e293b;
            color: white;
            padding: 20px;
            text-align: center;
          }

          .footer p {
            margin: 5px 0;
            opacity: 0.9;
          }

          @media print {
            body { padding: 0; margin: 0; }
            .statement-container { border: none; }
            .no-print { display: none !important; }
          }

          @page {
            margin: 1cm;
            size: A4;
          }
        </style>
      </head>
      <body>
        <div class="statement-container">
          <!-- Header -->
          <div class="header">
            <h1>🏪 مركز البدر للهواتف النقالة</h1>
            <p>كشف حساب العميل - ${formatDateGregorian(getCurrentDateGregorian())}</p>
          </div>

          <!-- Customer Information -->
          <div class="customer-section">
            <div class="customer-info">
              <div class="info-item">
                <div class="info-label">اسم العميل</div>
                <div class="info-value">${customer.name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">رقم الهاتف</div>
                <div class="info-value">${customer.phone}</div>
              </div>
              <div class="info-item">
                <div class="info-label">العنوان</div>
                <div class="info-value">${customer.address}</div>
              </div>
              <div class="info-item">
                <div class="info-label">تاريخ التسجيل</div>
                <div class="info-value">${formatDateGregorian(customer.registrationDate)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">آخر عملية شراء</div>
                <div class="info-value">${formatDateGregorian(customer.lastSaleDate)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">حالة الحساب</div>
                <div class="info-value">${customer.paymentStatus === "cash" ? "نقدي" : customer.paymentStatus === "deferred" ? "آجل" : "دفع جزئي"}</div>
              </div>
            </div>
          </div>

          <!-- Summary Cards -->
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-number" style="color: #2563eb;">${totals.salesCount}</div>
              <div class="summary-label">عدد العمليات</div>
            </div>
            <div class="summary-card">
              <div class="summary-number" style="color: #059669;">${totals.totalQuantity}</div>
              <div class="summary-label">إجمالي القطع</div>
            </div>
            <div class="summary-card">
              <div class="summary-number" style="color: #7c3aed;">${formatCurrency(totals.totalPurchases)}</div>
              <div class="summary-label">إجمالي المشتريات</div>
            </div>
            <div class="summary-card">
              <div class="summary-number" style="color: #059669;">${formatCurrency(totals.totalPaid)}</div>
              <div class="summary-label">إجمالي المدفوع</div>
            </div>
          </div>

          <!-- Products Table -->
          <div class="products-section">
            <h2 class="section-title">📦 تفاصيل المشتريات</h2>

            ${
              products.length === 0
                ? `
              <div style="text-align: center; padding: 40px; color: #64748b;">
                <p style="font-size: 18px;">لا توجد مشتريات مسجلة لهذا العميل</p>
              </div>
            `
                : `
              <table class="products-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>اسم المنتج</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>المجموع</th>
                    <th>نوع الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  ${products
                    .map(
                      (product, index) => `
                    <tr>
                      <td>${formatDateGregorian(product.saleDate)}</td>
                      <td style="font-weight: 600; text-align: right; padding-right: 15px;">${product.productName}</td>
                      <td style="font-weight: bold; color: #2563eb;">${product.quantity}</td>
                      <td>${formatCurrency(product.unitPrice)}</td>
                      <td style="font-weight: bold; color: #059669;">${formatCurrency(product.totalPrice)}</td>
                      <td>
                        <span class="payment-status payment-${product.paymentType}">
                          ${product.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            `
            }
          </div>

          <!-- Totals Section -->
          <div class="totals-section">
            <div class="totals-grid">
              <div class="total-item">
                <div class="total-amount" style="color: #2563eb;">${formatCurrency(totals.totalPurchases)}</div>
                <div class="total-label">إجمالي المشتريات</div>
              </div>
              <div class="total-item">
                <div class="total-amount" style="color: #059669;">${formatCurrency(totals.totalPaid)}</div>
                <div class="total-label">إجمالي المدفوع</div>
              </div>
              <div class="total-item">
                <div class="total-amount" style="color: ${totals.currentDebt > 0 ? "#dc2626" : "#059669"};">${formatCurrency(totals.currentDebt)}</div>
                <div class="total-label">المبلغ المستحق</div>
              </div>
            </div>

            ${
              totals.currentDebt > 0
                ? `
              <div class="debt-warning">
                <h3>⚠️ تنبيه: يوجد مبلغ مستحق</h3>
                <p style="font-size: 18px; font-weight: bold; margin: 10px 0;">
                  المبلغ المستحق: ${formatCurrency(totals.currentDebt)}
                </p>
                <p>يرجى تسديد المبلغ المستحق في أقرب وقت ممكن</p>
              </div>
            `
                : `
              <div class="no-debt">
                <h3>✅ الحساب مسدد بالكامل</h3>
                <p>لا توجد مبالغ مستحقة على هذا العميل</p>
              </div>
            `
            }
          </div>

          <!-- Footer -->
          <div class="footer">
            <p><strong>مركز البدر للهواتف النقالة</strong></p>
            <p>📍 العنوان: [عنوان المحل] | 📞 الهاتف: [رقم الهاتف]</p>
            <p>تم إنشاء هذا الكشف في: ${formatDateGregorian(getCurrentDateGregorian())} - ${new Date().toLocaleTimeString("ar-SA")}</p>
            <p style="font-size: 12px; margin-top: 10px; opacity: 0.8;">
              نظام إدارة ذكي مع دعم العمل أوف لاين | إجمالي العمليات: ${totals.salesCount} | إجمالي القطع: ${totals.totalQuantity}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();

      // Auto print after loading
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert(
        "لا يمكن فتح نافذة الطباعة. يرجى التأكد من الس��اح للنوافذ المنبثقة.",
      );
    }
  };

  // Legacy print function (keeping for compatibility)
  const printCustomerDetails = (customer: Customer) => {
    const customerAnalysis = analyzeCustomer(customer, sales);
    const customerSales = sales.filter(
      (sale) => sale.customerId === customer.id,
    );

    // Generate comprehensive activity log
    const activities = ActivityLogger.generateCustomerActivityLog(
      customer,
      customerSales,
      [], // debtPayments - could be loaded separately
      [], // transactions - could be loaded separately
    );

    const activitySummary = ActivityLogger.generateActivitySummary(activities);

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>تفاصيل العميل - ${customer.name}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .customer-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          th { background: #f1f5f9; font-weight: bold; }
          .stats { display: flex; gap: 20px; margin-bottom: 20px; }
          .stat-box { flex: 1; padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center; }
          .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">📱 مركز البدر</div>
          <p>تفاصيل العميل - تاريخ الطباعة: ${formatDateGregorian(getCurrentDateGregorian())}</p>
        </div>

        <div class="customer-info">
          <h2>معلومات العميل</h2>
          <p><strong>الاسم:</strong> ${customer.name}</p>
          <p><strong>رقم الهاتف:</strong> ${customer.phone}</p>
          <p><strong>العنوان:</strong> ${customer.address}</p>
          <p><strong>حالة الدفع:</strong> ${customer.paymentStatus === "cash" ? "نقدي" : customer.paymentStatus === "deferred" ? "آجل" : "دفع جزئي"}</p>
          <p><strong>آخر عملية شراء:</strong> ${formatDateGregorian(customer.lastSaleDate)}</p>
          ${customer.debtAmount && customer.debtAmount > 0 ? `<p><strong>المبلغ المستحق:</strong> ${formatCurrency(customer.debtAmount)}</p>` : ""}
        </div>

        <div class="stats">
          <div class="stat-box">
            <div class="stat-number">${customerAnalysis.totalPurchases}</div>
            <div class="stat-label">إجمالي المشتريات</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${customerSales.length}</div>
            <div class="stat-label">عدد العمليات</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${formatCurrency(customer.debtAmount || 0)}</div>
            <div class="stat-label">المبلغ المستحق</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">سجل المبيعات التفصيلي</div>
          ${
            customerSales.length === 0
              ? '<p style="text-align: center; color: #666; padding: 20px;">لا توجد مبيعات لهذا العميل</p>'
              : customerSales
                  .map(
                    (sale, index) => `
              <div style="border: 1px solid #ddd; margin-bottom: 15px; border-radius: 8px; overflow: hidden;">
                <div style="background: #f8f9fa; padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">
                  <span>🛒 عملية رقم ${index + 1} - ${formatDateGregorian(sale.saleDate)}</span>
                  <span style="float: left; color: ${sale.paymentType === "cash" ? "#059669" : sale.paymentType === "deferred" ? "#dc2626" : "#d97706"};">
                    ${sale.paymentType === "cash" ? "💰 نقدي" : sale.paymentType === "deferred" ? "⏰ آجل" : "💳 جزئي"}
                  </span>
                </div>

                <div style="padding: 15px;">
                  <div style="margin-bottom: 15px;">
                    <strong>تفاصيل المبيعة:</strong><br>
                    💰 المبلغ الإجمالي: <span style="color: #2563eb; font-weight: bold;">${formatCurrency(sale.totalAmount)}</span><br>
                    💳 المدفوع: <span style="color: #059669; font-weight: bold;">${formatCurrency(sale.paidAmount)}</span><br>
                    ⏰ المتبقي: <span style="color: ${sale.remainingAmount > 0 ? "#dc2626" : "#059669"}; font-weight: bold;">${formatCurrency(sale.remainingAmount)}</span><br>
                    ${sale.profitAmount ? `📈 الربح: <span style="color: #7c3aed; font-weight: bold;">${formatCurrency(sale.profitAmount)}</span><br>` : ""}
                    ${sale.notes ? `📝 ملاحظات: ${sale.notes}<br>` : ""}
                  </div>

                  ${
                    sale.items && sale.items.length > 0
                      ? `
                    <div>
                      <strong>📦 المنتجات المشتراة:</strong>
                      <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                        <thead>
                          <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #ddd; padding: 8px;">المنتج</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">الكمية</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">سعر الوحدة</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">المجموع</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">الربح</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${sale.items
                            .map(
                              (item) => `
                            <tr>
                              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${item.productName}</td>
                              <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
                              <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(item.unitPrice)}</td>
                              <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2563eb; font-weight: bold;">${formatCurrency(item.totalAmount)}</td>
                              <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #7c3aed;">${formatCurrency(item.profitAmount || 0)}</td>
                            </tr>
                          `,
                            )
                            .join("")}
                        </tbody>
                      </table>
                    </div>
                  `
                      : `
                    <div style="color: #666; font-style: italic;">
                      📦 عدد المنتجات: ${sale.items?.length || 1}
                    </div>
                  `
                  }
                </div>
              </div>
            `,
                  )
                  .join("")
          }
        </div>

        <div class="section">
          <div class="section-title">📦 المنتجات المشتراة</div>
          ${
            customerSales.length === 0
              ? '<p style="text-align: center; color: #666; padding: 20px;">لا توجد مشتريات لهذا العميل</p>'
              : customerSales
                  .map(
                    (sale, index) => `
              <div style="border: 1px solid #e5e7eb; margin-bottom: 10px; border-radius: 6px; overflow: hidden;">
                <div style="background: #f9fafb; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
                  📅 ${formatDateGregorian(sale.saleDate)} -
                  ${sale.paymentType === "cash" ? "💰 نقدي" : sale.paymentType === "deferred" ? "⏰ آجل" : "💳 جزئي"}
                  ${sale.remainingAmount > 0 ? ` - متبقي: ${formatCurrency(sale.remainingAmount)}` : ""}
                </div>

                <div style="padding: 12px;">
                  ${
                    sale.items && sale.items.length > 0
                      ? `
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                      <thead>
                        <tr style="background: #f3f4f6;">
                          <th style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">المنتج</th>
                          <th style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">الكمية</th>
                          <th style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">السعر</th>
                          <th style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${sale.items
                          .map(
                            (item) => `
                          <tr>
                            <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: 500;">${item.productName}</td>
                            <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${item.quantity}</td>
                            <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${formatCurrency(item.unitPrice)}</td>
                            <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: 600;">${formatCurrency(item.totalAmount)}</td>
                          </tr>
                        `,
                          )
                          .join("")}
                      </tbody>
                    </table>
                  `
                      : `
                    <div style="color: #6b7280; font-style: italic; text-align: center;">
                      تفاصيل المنتجات غير متوفرة لهذه العملية
                    </div>
                  `
                  }

                  ${
                    sale.notes
                      ? `
                    <div style="margin-top: 8px; padding: 6px; background: #f0f9ff; border-left: 3px solid #3b82f6; font-size: 13px;">
                      📝 ${sale.notes}
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>
            `,
                  )
                  .join("")
          }
        </div>

        <div class="section">
          <div class="section-title">📊 ملخص العميل</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 8px; background: #f9fafb; font-weight: 600;">عدد عمليات الشراء</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: 600;">${customerSales.length}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 8px; background: #f9fafb; font-weight: 600;">إجمالي المشتريات</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; color: #059669; font-weight: 600;">${formatCurrency(customerSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0))}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 8px; background: #f9fafb; font-weight: 600;">إجمالي المدفوع</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; color: #059669; font-weight: 600;">${formatCurrency(customerSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0))}</td>
              </tr>
              ${
                customer.debtAmount && customer.debtAmount > 0
                  ? `
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 8px; background: #fef2f2; font-weight: 600;">المبلغ المستحق</td>
                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; color: #dc2626; font-weight: 600;">${formatCurrency(customer.debtAmount)}</td>
              </tr>
              `
                  : ""
              }
            </tbody>
          </table>
        </div>

        ${ActivityLogger.generatePrintableActivityLog(customer, activities)}

        <div style="page-break-before: always; margin-top: 30px;">
          <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="color: #2563eb; margin-bottom: 10px;">🏪 مركز البدر للهواتف النقالة</h3>
            <p style="margin: 5px 0; color: #666;">📍 العنوان: [عنوان المحل]</p>
            <p style="margin: 5px 0; color: #666;">📞 الهاتف: [رقم الهاتف]</p>
            <p style="margin: 5px 0; color: #666;">⚡ نظام إدارة ذكي مع دعم العمل أوف لاين</p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #888;">
                تم إنشاء هذا التقرير في: ${formatDateGregorian(getCurrentDateGregorian())} - ${new Date().toLocaleTimeString("en-GB")}
              </p>
              <p style="font-size: 12px; color: #888;">
                العميل: ${customer.name} | الهاتف: ${customer.phone}
              </p>
              <p style="font-size: 12px; color: #888;">
                إجمالي العمليات: ${activities.length} | إجمالي المشتريات: ${formatCurrency(activitySummary.totalSales)}
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const deleteCustomer = async (customerId: string, customerName: string) => {
    try {
      setLocalLoading(true);
      setError(null);

      console.log(
        `🗑️ Attempting to delete customer: ${customerName} (ID: ${customerId})`,
      );

      // Check network status first
      if (!navigator.onLine) {
        setError(
          "لا يوجد اتصال بالإنترنت. لا يمكن حذف العميل في وضع عدم الاتصال.",
        );
        setLocalLoading(false);
        return;
      }

      // Check if customer has sales history before deletion
      const customerSales = sales.filter(
        (sale) => sale.customerId === customerId,
      );
      if (customerSales.length > 0) {
        const confirmDelete = window.confirm(
          `العميل ${customerName} لديه ${customerSales.length} عملية بيع مسجلة.\n\nهل تريد حذف العميل مع جميع سجل المبيعات؟\n\nهذا الإجراء لا يمكن التراجع عنه.`,
        );
        if (!confirmDelete) {
          setLocalLoading(false);
          return;
        }
      }

      await supabaseService.deleteCustomer(customerId);

      console.log(`✅ Customer ${customerName} deleted successfully`);
      alert(`✅ تم حذف العميل ${customerName} بنجاح!`);

      // Refresh data after successful deletion
      refreshData();

      setTimeout(() => {
        loadData(true);
      }, 500);
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      const errorMessage = error?.message || "خطأ غير محدد";

      if (
        errorMessage.includes("offline") ||
        errorMessage.includes("أوف لاين") ||
        errorMessage.includes("لا يمكن حذف العميل حالياً")
      ) {
        // Show a more user-friendly message for offline scenarios
        const retryOption = window.confirm(
          "لا يمكن حذف العميل حالياً بسبب مشاكل في الاتصال.\n\nهل تريد المحاولة مرة أخرى؟",
        );

        if (retryOption) {
          // Reset the connection attempts and try again
          OfflineModeHandler.resetAttempts();

          setTimeout(() => {
            deleteCustomer(customerId, customerName);
          }, 2000);
        } else {
          setError(
            "تم إلغاء عملية الحذف. يرجى المحاولة لاحقاً عندما يكون الاتصال أفضل.",
          );
        }
      } else if (
        errorMessage.includes("foreign key") ||
        errorMessage.includes("constraint")
      ) {
        setError(
          "لا يمكن حذف العميل لأنه مرتبط ببيانات أخرى. يرجى حذف المبيعات المرتبطة أول��ً.",
        );
      } else if (errorMessage.includes("Failed to fetch")) {
        setError(
          "فشل في الاتصال مع الخادم. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.",
        );
      } else {
        setError(`حدث خطأ أثناء حذف العميل: ${errorMessage}`);
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const getPaymentStatusInfo = (
    status: Customer["paymentStatus"],
    debtAmount?: number,
  ) => {
    switch (status) {
      case "cash":
        return {
          label: "نقد",
          variant: "default" as const,
          icon: CheckCircle,
          className: "bg-green-100 text-green-800 border-green-200",
        };
      case "deferred":
        return {
          label: `آجل (${formatCurrency(debtAmount || 0)})`,
          variant: "destructive" as const,
          icon: Clock,
          className: "bg-red-100 text-red-800 border-red-200",
        };
      case "partial":
        return {
          label: `دفع جزئي (${formatCurrency(debtAmount || 0)})`,
          variant: "secondary" as const,
          icon: AlertCircle,
          className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        };
      default:
        return {
          label: "غير محدد",
          variant: "outline" as const,
          icon: AlertCircle,
          className: "bg-gray-100 text-gray-800 border-gray-200",
        };
    }
  };

  const totalCustomers = customers.length;
  const debtCustomers = customers.filter(
    (c) => c.paymentStatus === "deferred" || c.paymentStatus === "partial",
  ).length;
  const totalDebt = customers.reduce((sum, c) => sum + (c.debtAmount || 0), 0);

  const businessKPIs = calculateBusinessKPIs(customers, products, sales);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل البيانات...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              إدارة العملاء
            </h1>
            <p className="text-gray-600 mt-1">
              متابعة العملاء والمبيعات والديون - نظام ذكي أوف لاين
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => loadData(true)}
              variant="outline"
              size="sm"
              disabled={loading}
              title="تحديث البيانات من قاعدة البيانات"
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={cn("h-4 w-4 ml-2", loading && "animate-spin")}
              />
              <span className="hidden sm:inline">تحديث من قاعدة البيانات</span>
              <span className="sm:hidden">تحديث</span>
            </Button>
            <Link to="/add-sale" className="w-full sm:w-auto">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg w-full">
                <Plus className="h-4 w-4 ml-2" />
                <span className="hidden sm:inline">إضافة عملية بيع</span>
                <span className="sm:hidden">بيع جديد</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Database Health Alert */}
        <DatabaseHealthAlert />

        {/* Error Alert */}
        {displayError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{displayError}</p>
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    إجمالي العملاء
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {totalCustomers}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    متوسط قيمة العميل:{" "}
                    {formatCurrency(businessKPIs.avgCustomerValue)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    إجمالي الإيرادات
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(businessKPIs.totalRevenue)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    هامش الربح: {businessKPIs.grossMargin.toFixed(1)}%
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    عملاء لديهم ديون
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {debtCustomers}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    نسبة الديون: {businessKPIs.debtToRevenueRatio.toFixed(1)}%
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    إجمالي الديون
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(totalDebt)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    المبيعات النقدية: {businessKPIs.cashSalesRatio.toFixed(1)}%
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Section */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="البحث بالاسم أو رقم الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        <div className="space-y-4">
          {filteredCustomers.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  {customers.length === 0
                    ? "لا توجد عملاء"
                    : "لم يتم العثور على عملاء"}
                </h3>
                <p className="text-gray-500 mb-6">
                  {customers.length === 0
                    ? "ابدأ بإضافة عملية بيع جديدة لإضافة أول عميل"
                    : "جرب تغيير مصطلح البحث"}
                </p>
                {customers.length === 0 && (
                  <Link to="/add-sale">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة عملية بيع
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredCustomers.map((customer) => {
              const paymentInfo = getPaymentStatusInfo(
                customer.paymentStatus,
                customer.debtAmount,
              );
              const StatusIcon = paymentInfo.icon;

              return (
                <Card
                  key={customer.id}
                  className="hover:shadow-lg transition-shadow duration-300"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Customer Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-gray-800">
                              {customer.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                {customer.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {customer.address}
                              </span>
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              "flex items-center gap-1",
                              paymentInfo.className,
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {paymentInfo.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              آخر عملية:{" "}
                            </span>
                            <span className="sm:hidden">آخر: </span>
                            {formatDateGregorian(customer.lastSaleDate)}
                          </span>
                          {customer.debtPaidDate && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="hidden sm:inline">
                                تاريخ التسديد:{" "}
                              </span>
                              <span className="sm:hidden">تسديد: </span>
                              {formatDateGregorian(customer.debtPaidDate)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              إجمالي المشتريات:{" "}
                            </span>
                            <span className="sm:hidden">إجمالي: </span>
                            {(() => {
                              const customerSales = sales.filter(
                                (s) => s.customerId === customer.id,
                              );
                              const total = customerSales.reduce(
                                (sum, sale) => sum + (sale.totalAmount || 0),
                                0,
                              );
                              return formatCurrency(total);
                            })()}
                          </span>
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              عدد العمليات:{" "}
                            </span>
                            <span className="sm:hidden">عدد: </span>
                            {(() => {
                              const customerSalesCount = sales.filter(
                                (s) => s.customerId === customer.id,
                              ).length;
                              return customerSalesCount;
                            })()}
                          </span>
                        </div>

                        {/* Show recent purchase details */}
                        {(() => {
                          const customerSales = sales.filter(
                            (s) => s.customerId === customer.id,
                          );
                          const latestSale = customerSales[0]; // Assuming sales are sorted by date

                          if (
                            latestSale &&
                            latestSale.items &&
                            latestSale.items.length > 0
                          ) {
                            const recentProducts = latestSale.items.slice(0, 2); // Show first 2 products
                            const remainingCount = latestSale.items.length - 2;

                            return (
                              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-600 mb-1">
                                  آخر مشتريات:
                                </div>
                                <div className="text-sm text-gray-800">
                                  {recentProducts.map((item, index) => (
                                    <span key={index}>
                                      📱 {item.productName} ({item.quantity})
                                      {index < recentProducts.length - 1
                                        ? ", "
                                        : ""}
                                    </span>
                                  ))}
                                  {remainingCount > 0 && (
                                    <span className="text-gray-500">
                                      {" "}
                                      +{remainingCount} منتج أخر
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap sm:gap-3">
                        {/* Sale Button */}
                        <Link to={`/add-sale?customerId=${customer.id}`}>
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <ShoppingCart className="h-4 w-4 ml-1" />
                            بيع
                          </Button>
                        </Link>

                        {/* Account Statement Button */}
                        <Button
                          onClick={() =>
                            printEnhancedCustomerStatement(customer)
                          }
                          size="sm"
                          variant="outline"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                        >
                          <FileText className="h-4 w-4 ml-1" />
                          <span className="hidden sm:inline">كشف الحساب</span>
                          <span className="sm:hidden">كشف</span>
                        </Button>

                        {/* Edit Button */}
                        <Button
                          onClick={() => openEditCustomer(customer)}
                          size="sm"
                          variant="outline"
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          <Edit className="h-4 w-4 ml-1" />
                          تعديل
                        </Button>

                        {/* Debt Payment Button */}
                        {(customer.paymentStatus === "deferred" ||
                          customer.paymentStatus === "partial") && (
                          <Button
                            onClick={() => openDebtPaymentModal(customer)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <DollarSign className="h-4 w-4 ml-1" />
                            <span className="hidden sm:inline">
                              تسديد الدين
                            </span>
                            <span className="sm:hidden">تسديد</span>
                          </Button>
                        )}

                        {/* Delete Button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            >
                              <Trash2 className="h-4 w-4 ml-1" />
                              حذف
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                تأكيد حذف العميل
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف العميل "{customer.name}"؟
                                هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع
                                البيانات المرتبطة بالعميل.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteCustomer(customer.id, customer.name)
                                }
                                className="bg-red-600 hover:bg-red-700"
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Debt Payment Modal */}
        <Dialog open={debtPaymentOpen} onOpenChange={setDebtPaymentOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                تسديد دين العميل
              </DialogTitle>
              <DialogDescription>
                تسديد دين العميل: {selectedCustomer?.name}
                <br />
                إجمالي الدين:{" "}
                {formatCurrency(selectedCustomer?.debtAmount || 0)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label>نوع التسديد</Label>
                <RadioGroup
                  value={debtPaymentData.paymentType}
                  onValueChange={(value) =>
                    handlePaymentTypeChange(value as "full" | "partial")
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="full" id="full" />
                    <Label htmlFor="full" className="cursor-pointer">
                      تسديد كامل (
                      {formatCurrency(selectedCustomer?.debtAmount || 0)})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="partial" id="partial" />
                    <Label htmlFor="partial" className="cursor-pointer">
                      تسديد جزئي
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {debtPaymentData.paymentType === "partial" && (
                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ المدفوع</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    max={(selectedCustomer?.debtAmount || 0) - 1}
                    value={debtPaymentData.amount}
                    onChange={(e) =>
                      setDebtPaymentData({
                        ...debtPaymentData,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="أدخل المبلغ المدفوع"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={debtPaymentData.notes}
                  onChange={(e) =>
                    setDebtPaymentData({
                      ...debtPaymentData,
                      notes: e.target.value,
                    })
                  }
                  placeholder="أضف ملاحظات حول عملية التسديد..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleDebtPayment}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="h-4 w-4 ml-2" />
                تسديد الدين
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Edit Modal - NOW WORKING */}
        <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                تعديل بيانات العميل
              </DialogTitle>
              <DialogDescription>
                تعديل بيانات العميل: {editingCustomer?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">اسم العميل *</Label>
                <Input
                  id="edit-name"
                  value={editCustomerData.name}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      name: e.target.value,
                    })
                  }
                  placeholder="أدخل اسم العميل"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">رقم الهاتف *</Label>
                <Input
                  id="edit-phone"
                  value={editCustomerData.phone}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      phone: e.target.value,
                    })
                  }
                  placeholder="أدخل رقم الهاتف"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address">العنوان *</Label>
                <Textarea
                  id="edit-address"
                  value={editCustomerData.address}
                  onChange={(e) =>
                    setEditCustomerData({
                      ...editCustomerData,
                      address: e.target.value,
                    })
                  }
                  placeholder="أدخل عنوان العميل"
                  required
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleEditCustomer}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="h-4 w-4 ml-2" />
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Details Modal */}
        <Dialog
          open={customerDetailsOpen}
          onOpenChange={setCustomerDetailsOpen}
        >
          <DialogContent className="sm:max-w-4xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                تفاصيل العميل: {selectedCustomerDetails?.name}
              </DialogTitle>
            </DialogHeader>

            {selectedCustomerDetails && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">معلومات العميل</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">الاسم:</span>
                        <span className="font-semibold">
                          {selectedCustomerDetails.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">الهاتف:</span>
                        <span className="font-semibold">
                          {selectedCustomerDetails.phone}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">العنوان:</span>
                        <span className="font-semibold">
                          {selectedCustomerDetails.address}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">آخ�� عملية:</span>
                        <span className="font-semibold">
                          {formatDateGregorian(
                            selectedCustomerDetails.lastSaleDate,
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">الملخص المالي</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">إجمالي المشتريات:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(
                            analyzeCustomer(selectedCustomerDetails, sales)
                              .totalPurchases,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">عدد العمليات:</span>
                        <span className="font-semibold">
                          {selectedCustomerDetails.sales?.length || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">المبلغ المستحق:</span>
                        <span
                          className={cn(
                            "font-semibold",
                            (selectedCustomerDetails.debtAmount || 0) > 0
                              ? "text-red-600"
                              : "text-green-600",
                          )}
                        >
                          {formatCurrency(
                            selectedCustomerDetails.debtAmount || 0,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">حالة الدفع:</span>
                        <Badge
                          className={
                            getPaymentStatusInfo(
                              selectedCustomerDetails.paymentStatus,
                              selectedCustomerDetails.debtAmount,
                            ).className
                          }
                        >
                          {
                            getPaymentStatusInfo(
                              selectedCustomerDetails.paymentStatus,
                              selectedCustomerDetails.debtAmount,
                            ).label
                          }
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sales History */}
                {selectedCustomerDetails.sales &&
                  selectedCustomerDetails.sales.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        ��جل المبيعات ({
                          selectedCustomerDetails.sales.length
                        }{" "}
                        عملية)
                      </h3>
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">
                                التاريخ
                              </TableHead>
                              <TableHead className="text-right">
                                المنتجات والتفاصيل
                              </TableHead>
                              <TableHead className="text-right">
                                المالية
                              </TableHead>
                              <TableHead className="text-right">
                                حالة الدفع
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedCustomerDetails.sales.map(
                              (sale, index) => (
                                <TableRow
                                  key={sale.id}
                                  className="hover:bg-gray-50"
                                >
                                  <TableCell className="font-medium">
                                    📅 {formatDateGregorian(sale.saleDate)}
                                    <div className="text-xs text-gray-500 mt-1">
                                      عملية #{index + 1}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      {sale.items && sale.items.length > 0 ? (
                                        <div>
                                          <div className="font-medium text-sm text-blue-600 mb-1">
                                            📦 {sale.items.length} منتج
                                          </div>
                                          {sale.items
                                            .slice(0, 2)
                                            .map((item, idx) => (
                                              <div
                                                key={idx}
                                                className="text-xs text-gray-700 bg-gray-100 rounded px-2 py-1 mb-1"
                                              >
                                                <span className="font-medium">
                                                  {item.productName}
                                                </span>
                                                <span className="text-gray-500">
                                                  {" "}
                                                  × {item.quantity}
                                                </span>
                                                <span className="text-green-600 font-medium">
                                                  {" "}
                                                  ={" "}
                                                  {formatCurrency(
                                                    item.totalAmount,
                                                  )}
                                                </span>
                                              </div>
                                            ))}
                                          {sale.items.length > 2 && (
                                            <div className="text-xs text-gray-500">
                                              +{sale.items.length - 2} منتج أخر
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-600">
                                          📦 عدد غير محدد من المنتجات
                                        </div>
                                      )}
                                      {sale.notes && (
                                        <div className="text-xs text-gray-500 italic mt-1">
                                          📝 {sale.notes}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          الإجمالي:
                                        </span>
                                        <span className="font-medium text-blue-600">
                                          {formatCurrency(sale.totalAmount)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          المدفوع:
                                        </span>
                                        <span className="font-medium text-green-600">
                                          {formatCurrency(sale.paidAmount)}
                                        </span>
                                      </div>
                                      {sale.remainingAmount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">
                                            ��لمتبقي:
                                          </span>
                                          <span className="font-medium text-red-600">
                                            {formatCurrency(
                                              sale.remainingAmount,
                                            )}
                                          </span>
                                        </div>
                                      )}
                                      {sale.profitAmount &&
                                        sale.profitAmount > 0 && (
                                          <div className="flex justify-between border-t pt-1">
                                            <span className="text-gray-600">
                                              الربح:
                                            </span>
                                            <span className="font-medium text-purple-600">
                                              {formatCurrency(
                                                sale.profitAmount,
                                              )}
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={
                                        sale.paymentType === "cash"
                                          ? "bg-green-100 text-green-800"
                                          : sale.paymentType === "deferred"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-yellow-100 text-yellow-800"
                                      }
                                    >
                                      {sale.paymentType === "cash"
                                        ? "💰 نقدي"
                                        : sale.paymentType === "deferred"
                                          ? "⏰ آجل"
                                          : "💳 جزئي"}
                                    </Badge>
                                    {sale.paymentDate && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        تم الدفع:{" "}
                                        {formatDateGregorian(sale.paymentDate)}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Dashboard;
