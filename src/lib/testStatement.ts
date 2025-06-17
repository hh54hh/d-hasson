// Test function for customer statement
import { Customer } from "./types";
import { formatCurrency, formatDateGregorian } from "./storage";
import { getCurrentDateGregorian } from "./types";

export function testCustomerStatement() {
  // Sample customer data for testing
  const testCustomer: Customer = {
    id: "test-customer-id",
    name: "أحمد محمد",
    phone: "0501234567",
    address: "الرياض، المملكة العربية السعودية",
    paymentStatus: "deferred",
    registrationDate: "2024-01-15",
    lastSaleDate: "2024-06-15",
    debtAmount: 500,
    debtPaidDate: undefined,
    sales: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Sample products purchased
  const testProducts = [
    {
      date: "2024-06-10",
      productName: "iPhone 15 Pro",
      quantity: 1,
      unitPrice: 4500,
      totalPrice: 4500,
      paymentType: "آجل",
    },
    {
      date: "2024-06-12",
      productName: "غطاء حماية",
      quantity: 2,
      unitPrice: 50,
      totalPrice: 100,
      paymentType: "نقد",
    },
    {
      date: "2024-06-15",
      productName: "شاحن لاسلكي",
      quantity: 1,
      unitPrice: 150,
      totalPrice: 150,
      paymentType: "دفع جزئي",
    },
  ];

  // Sample debt payments
  const testDebtPayments = [
    {
      amount: 2000,
      paymentDate: "2024-06-13",
      notes: "دفعة أولى",
      remainingDebt: 2750,
    },
    {
      amount: 1000,
      paymentDate: "2024-06-14",
      notes: "دفعة ثانية",
      remainingDebt: 1750,
    },
  ];

  // Totals
  const testTotals = {
    totalPurchases: 4750,
    totalPaid: 4250,
    currentDebt: 500,
  };

  // Generate test statement
  const printContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>كشف حساب تجريبي - ${testCustomer.name}</title>
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
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏪 مركز البدر للهواتف النقالة</h1>
        <p>كشف حساب العميل (نموذج تجريبي)</p>
        <p>التاريخ: ${formatDateGregorian(getCurrentDateGregorian())}</p>
      </div>

      <div class="customer-info">
        <h2>معلومات العميل</h2>
        <div class="info-row">
          <span><strong>الاسم:</strong></span>
          <span>${testCustomer.name}</span>
        </div>
        <div class="info-row">
          <span><strong>رقم الهاتف:</strong></span>
          <span>${testCustomer.phone}</span>
        </div>
        <div class="info-row">
          <span><strong>العنوان:</strong></span>
          <span>${testCustomer.address}</span>
        </div>
        <div class="info-row">
          <span><strong>تاريخ التسجيل:</strong></span>
          <span>${formatDateGregorian(testCustomer.registrationDate)}</span>
        </div>
      </div>

      <div class="products-section">
        <div class="section-title">المنتجات المشتراة</div>
        <table>
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
            ${testProducts
              .map(
                (product) => `
              <tr>
                <td>${formatDateGregorian(product.date)}</td>
                <td class="product-name">${product.productName}</td>
                <td>${product.quantity}</td>
                <td>${formatCurrency(product.unitPrice)}</td>
                <td><strong>${formatCurrency(product.totalPrice)}</strong></td>
                <td>${product.paymentType}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="payments-section">
        <div class="section-title">عمليات تسديد الديون</div>
        ${testDebtPayments
          .map(
            (payment) => `
          <div class="payment-item">
            <strong>قام العميل بتسديد دين مبلغ ${formatCurrency(payment.amount)} في تاريخ ${formatDateGregorian(payment.paymentDate)}</strong>
            ${payment.notes ? `<br><em>ملاحظات: ${payment.notes}</em>` : ""}
            <br>المبلغ المتبقي بعد التسديد: ${formatCurrency(payment.remainingDebt)}
          </div>
        `,
          )
          .join("")}
      </div>

      <div class="totals">
        <h3 style="margin-bottom: 10px;">الملخص المالي</h3>
        <div class="total-row">
          <span>إجمالي المشتريات:</span>
          <span>${formatCurrency(testTotals.totalPurchases)}</span>
        </div>
        <div class="total-row">
          <span>إجمالي المدفوع:</span>
          <span>${formatCurrency(testTotals.totalPaid)}</span>
        </div>
        <div class="total-row">
          <span>المبلغ المستحق حالياً:</span>
          <span class="debt-amount">${formatCurrency(testTotals.currentDebt)}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; border-top: 1px solid #000; padding-top: 15px;">
        <p><strong>مركز البدر للهواتف النقالة</strong></p>
        <p>العنوان: [عنوان المحل] | الهاتف: [رقم الهاتف]</p>
        <p style="font-size: 12px; margin-top: 10px;">
          هذا نموذج تجريبي - تم إنشاؤه في: ${formatDateGregorian(getCurrentDateGregorian())}
        </p>
      </div>
    </body>
    </html>
  `;

  console.log("🧪 Test Statement HTML Generated");
  return printContent;
}

// Function to open test statement in new window
export function openTestStatement() {
  const printContent = testCustomerStatement();
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
  } else {
    console.error("Failed to open print window");
  }
}
