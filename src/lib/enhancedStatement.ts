// Enhanced Customer Statement Generator with proper data handling
import { Customer } from "./types";
import { formatCurrency } from "./storage";
import { getCurrentDateGregorian, formatDateGregorian } from "./types";
import { supabaseService } from "./supabaseService";
import { logError } from "./utils";

export interface StatementData {
  customer: Customer;
  products: any[];
  debtPayments: any[];
  totals: {
    totalPurchases: number;
    totalPaid: number;
    currentDebt: number;
    totalQuantity: number;
    salesCount: number;
  };
}

export interface EnhancedStatementData {
  customer: Customer;
  sales: any[];
  debtPayments: any[];
  totals: {
    totalPurchases: number;
    totalPaid: number;
    currentDebt: number;
    totalQuantity: number;
    salesCount: number;
    totalItems: number;
  };
}

// Enhanced function to fetch customer data from Supabase
export async function fetchCustomerStatementData(
  customerId: string,
): Promise<EnhancedStatementData> {
  console.log("🔍 Fetching customer statement data for:", customerId);

  try {
    // Get customer analytics with all related data
    const analytics = await supabaseService.getCustomerAnalytics(customerId);

    console.log("📊 Customer analytics:", {
      customer: analytics.customer.name,
      salesCount: analytics.sales.length,
      debtPaymentsCount: analytics.debtPayments.length,
      totalPurchases: analytics.totalPurchases,
      currentDebt: analytics.currentDebt,
    });

    // Calculate totals with items
    let totalQuantity = 0;
    let totalItems = 0;

    analytics.sales.forEach((sale) => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item: any) => {
          totalQuantity += item.quantity || 0;
          totalItems += 1;
        });
      } else {
        // Legacy format fallback
        totalQuantity += 1;
        totalItems += 1;
      }
    });

    const statementData: EnhancedStatementData = {
      customer: analytics.customer,
      sales: analytics.sales,
      debtPayments: analytics.debtPayments,
      totals: {
        totalPurchases: analytics.totalPurchases,
        totalPaid: analytics.totalPaid,
        currentDebt: analytics.currentDebt,
        totalQuantity,
        salesCount: analytics.sales.length,
        totalItems,
      },
    };

    console.log("✅ Statement data prepared:", statementData.totals);
    return statementData;
  } catch (error) {
    const errorInfo = logError(
      "❌ Error fetching customer statement data:",
      error,
    );
    throw new Error(`فشل في جلب بيانات كشف الحساب: ${errorInfo.message}`);
  }
}

export function generateEnhancedStatement(data: EnhancedStatementData): string {
  const { customer, sales, debtPayments, totals } = data;

  return `
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

        @page {
          margin: 1.5cm;
          size: A4;
        }

        body {
          font-family: 'Arial', sans-serif;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: white;
        }

        .statement-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }

        .store-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
          color: #000;
        }

        .statement-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #000;
        }

        .statement-date {
          font-size: 10px;
          color: #666;
        }

        .customer-info {
          background: #f8f9fa;
          border: 1px solid #000;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 5px;
        }

        .customer-info h3 {
          font-size: 14px;
          margin-bottom: 10px;
          color: #000;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 11px;
        }

        .info-label {
          font-weight: bold;
          color: #000;
        }

        .info-value {
          color: #333;
        }

        .section {
          margin-bottom: 25px;
        }

        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #000;
          background: #f0f0f0;
          padding: 8px;
          border: 1px solid #000;
          text-align: center;
        }

        .purchases-table, .payments-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000;
          margin-bottom: 15px;
        }

        .purchases-table th, .purchases-table td,
        .payments-table th, .payments-table td {
          border: 1px solid #000;
          padding: 6px;
          text-align: center;
          font-size: 10px;
        }

        .purchases-table th, .payments-table th {
          background: #e9ecef;
          font-weight: bold;
          color: #000;
        }

        .purchases-table td, .payments-table td {
          color: #333;
        }

        .amount {
          font-weight: bold;
          color: #000;
        }

        .no-data {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 20px;
          background: #f8f9fa;
          border: 1px solid #ddd;
        }

        .summary {
          background: #f8f9fa;
          border: 2px solid #000;
          padding: 15px;
          margin-top: 20px;
        }

        .summary h3 {
          font-size: 14px;
          margin-bottom: 10px;
          color: #000;
          text-align: center;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 11px;
        }

        .summary-label {
          font-weight: bold;
          color: #000;
        }

        .summary-value {
          font-weight: bold;
          color: #000;
        }

        .debt-highlight {
          background: #fff3cd;
          color: #856404;
          padding: 2px 4px;
          border-radius: 3px;
        }

        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }

        @media print {
          body {
            background: white;
            font-size: 10px;
          }

          .statement-container {
            box-shadow: none;
            padding: 0;
            max-width: none;
          }

          .section {
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="statement-container">
        <!-- Header -->
        <div class="header">
          <div class="store-name">مركز البدر للهواتف الذكية</div>
          <div class="statement-title">كشف حساب مفصل</div>
          <div class="statement-date">تاريخ الكشف: ${formatDateGregorian(getCurrentDateGregorian())}</div>
        </div>

        <!-- Customer Information -->
        <div class="customer-info">
          <h3>معلومات العميل</h3>
          <div class="info-row">
            <span class="info-label">الاسم:</span>
            <span class="info-value">${customer.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">رقم الهاتف:</span>
            <span class="info-value">${customer.phone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">العنوان:</span>
            <span class="info-value">${customer.address}</span>
          </div>
          <div class="info-row">
            <span class="info-label">تاريخ التسجيل:</span>
            <span class="info-value">${customer.registrationDate ? formatDateGregorian(customer.registrationDate) : "غير محدد"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">آخر بيعة:</span>
            <span class="info-value">${customer.lastSaleDate ? formatDateGregorian(customer.lastSaleDate) : "لا توجد مبيعات"}</span>
          </div>
        </div>

        <!-- Purchases Section -->
        <div class="section">
          <div class="section-title">سجل المشتريات (${totals.salesCount} عملية شراء)</div>
          ${
            sales.length > 0
              ? generatePurchasesTable(sales)
              : `
            <div class="no-data">
              لا توجد مشتريات مسجلة لهذا العميل
            </div>
          `
          }
        </div>

        <!-- Debt Payments Section -->
        <div class="section">
          <div class="section-title">سجل دفعات الديون (${debtPayments.length} دفعة)</div>
          ${
            debtPayments.length > 0
              ? generatePaymentsTable(debtPayments)
              : `
            <div class="no-data">
              لا توجد دفعات ديون مسجلة لهذا العميل
            </div>
          `
          }
        </div>

        <!-- Summary -->
        <div class="summary">
          <h3>ملخص الحساب</h3>
          <div class="summary-row">
            <span class="summary-label">إجمالي المشتريات:</span>
            <span class="summary-value">${formatCurrency(totals.totalPurchases)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">إجمالي المدفوع:</span>
            <span class="summary-value">${formatCurrency(totals.totalPaid)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">الرصيد المستحق:</span>
            <span class="summary-value ${totals.currentDebt > 0 ? "debt-highlight" : ""}">${formatCurrency(totals.currentDebt)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">عدد المنتجات المشتراة:</span>
            <span class="summary-value">${totals.totalQuantity} قطعة</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">عدد عمليات الشراء:</span>
            <span class="summary-value">${totals.salesCount} عملية</span>
          </div>
          ${
            totals.salesCount > 0
              ? `
            <div class="summary-row">
              <span class="summary-label">متوسط قيمة الشراء:</span>
              <span class="summary-value">${formatCurrency(totals.totalPurchases / totals.salesCount)}</span>
            </div>
          `
              : ""
          }
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>مركز البدر للهواتف الذكية - نظام إدارة المخزون</p>
          <p>تم إنشاء هذا الكشف بتاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePurchasesTable(sales: any[]): string {
  let tableContent = `
    <table class="purchases-table">
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
  `;

  sales.forEach((sale) => {
    // Build products list with details
    let productsList = "";
    let totalQuantity = 0;

    if (sale.items && sale.items.length > 0) {
      // New format with sale_items
      productsList = sale.items
        .map((item: any) => {
          totalQuantity += item.quantity || 0;
          return `${item.productName} (${item.quantity} × ${formatCurrency(item.unitPrice)})`;
        })
        .join("<br>");
    } else {
      // Legacy format fallback
      productsList = "منتج واحد";
      totalQuantity = 1;
    }

    const paymentTypeArabic =
      sale.paymentType === "cash"
        ? "نقداً"
        : sale.paymentType === "deferred"
          ? "آجل"
          : "مختلط";

    tableContent += `
      <tr>
        <td>${formatDateGregorian(sale.saleDate)}</td>
        <td style="text-align: right;">${productsList}</td>
        <td>${totalQuantity}</td>
        <td class="amount">${formatCurrency(sale.totalAmount)}</td>
        <td class="amount">${formatCurrency(sale.paidAmount)}</td>
        <td class="amount">${formatCurrency(sale.remainingAmount)}</td>
        <td>${paymentTypeArabic}</td>
      </tr>
    `;
  });

  tableContent += `
      </tbody>
    </table>
  `;

  return tableContent;
}

function generatePaymentsTable(debtPayments: any[]): string {
  let tableContent = `
    <table class="payments-table">
      <thead>
        <tr>
          <th>تاريخ الدفع</th>
          <th>المبلغ المدفوع</th>
          <th>نوع الدفعة</th>
          <th>الرصيد المتبقي</th>
          <th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>
  `;

  debtPayments.forEach((payment) => {
    const paymentTypeArabic =
      payment.paymentType === "full" ? "دفعة كاملة" : "دفعة جزئية";

    tableContent += `
      <tr>
        <td>${formatDateGregorian(payment.paymentDate)}</td>
        <td class="amount">${formatCurrency(payment.amount)}</td>
        <td>${paymentTypeArabic}</td>
        <td class="amount">${formatCurrency(payment.remainingDebt)}</td>
        <td>${payment.notes || "-"}</td>
      </tr>
    `;
  });

  tableContent += `
      </tbody>
    </table>
  `;

  return tableContent;
}

// Legacy support function
export function generateEnhancedStatementLegacy(data: StatementData): string {
  // Convert legacy data format to new format
  const enhancedData: EnhancedStatementData = {
    customer: data.customer,
    sales: data.products || [],
    debtPayments: data.debtPayments || [],
    totals: {
      ...data.totals,
      totalItems: data.products?.length || 0,
    },
  };

  return generateEnhancedStatement(enhancedData);
}

// Function to print customer statement directly
export async function printEnhancedCustomerStatement(
  customerId: string,
): Promise<void> {
  try {
    console.log(
      "🖨️ Starting to print enhanced customer statement for:",
      customerId,
    );

    // Fetch real-time data from Supabase
    const statementData = await fetchCustomerStatementData(customerId);

    // Generate HTML content
    const htmlContent = generateEnhancedStatement(statementData);

    // Create and print
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error(
        "فشل في فتح نافذة الطباعة. يرجى السماح للنوافذ المنبثقة.",
      );
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    console.log("✅ Statement printed successfully");
  } catch (error) {
    const errorInfo = logError("❌ Error printing customer statement:", error);
    throw new Error(`فشل في طباعة كشف الحساب: ${errorInfo.message}`);
  }
}
