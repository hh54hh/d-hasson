import { formatCurrency } from "@/lib/storage";
import {
  CartItem,
  formatDateGregorian,
  getCurrentDateGregorian,
} from "@/lib/types";

interface CartInvoiceProps {
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  cartItems: CartItem[];
  saleData: {
    paymentType: "cash" | "deferred" | "partial";
    paidAmount: number;
    notes: string;
  };
  totalAmount: number;
  remainingAmount: number;
  profitAmount: number;
}

export const generateCartInvoice = ({
  customer,
  cartItems,
  saleData,
  totalAmount,
  remainingAmount,
  profitAmount,
}: CartInvoiceProps) => {
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  const currentDate = formatDateGregorian(getCurrentDateGregorian());
  const currentTime = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsCount = cartItems.length;
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>فاتورة متعددة المنتجات - ${invoiceNumber}</title>
      <meta charset="utf-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          direction: rtl;
          padding: 15px;
          line-height: 1.4;
          color: #333;
          font-size: 13px;
        }
        
        .invoice-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        
        .logo {
          font-size: 20px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 8px;
        }
        
        .invoice-title {
          font-size: 16px;
          color: #666;
          margin-bottom: 5px;
        }
        
        .multi-product-badge {
          background: #10b981;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .invoice-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          font-size: 12px;
          color: #666;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .section {
          margin-bottom: 15px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }
        
        .section-title {
          font-weight: bold;
          font-size: 14px;
          color: #2563eb;
          margin-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
        }
        
        .info-label {
          color: #666;
        }
        
        .info-value {
          font-weight: 500;
        }
        
        .products-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 11px;
        }
        
        .products-table th,
        .products-table td {
          border: 1px solid #ddd;
          padding: 8px 6px;
          text-align: center;
        }
        
        .products-table th {
          background: #f8f9fa;
          font-weight: bold;
          font-size: 10px;
          color: #2563eb;
        }
        
        .products-table .product-name {
          text-align: right;
          font-weight: 500;
        }
        
        .products-table .amount {
          font-weight: bold;
          color: #1f2937;
        }
        
        .totals {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 6px;
          margin: 15px 0;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 13px;
        }
        
        .total-final {
          font-weight: bold;
          font-size: 16px;
          color: #2563eb;
          border-top: 2px solid #2563eb;
          padding-top: 8px;
          margin-top: 8px;
        }
        
        .summary-stats {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
          text-align: center;
        }
        
        .stat-box {
          flex: 1;
          padding: 10px;
          background: #f0f9ff;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }
        
        .stat-number {
          font-size: 18px;
          font-weight: bold;
          color: #2563eb;
        }
        
        .stat-label {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }
        
        .payment-status {
          padding: 8px;
          border-radius: 6px;
          text-align: center;
          font-weight: bold;
          font-size: 13px;
          margin: 15px 0;
        }
        
        .status-cash {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
        }
        
        .status-deferred {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        
        .status-partial {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fed7aa;
        }
        
        .notes {
          margin-top: 15px;
          padding: 10px;
          background: #f9fafb;
          border-radius: 6px;
          font-size: 12px;
          border: 1px solid #e5e7eb;
        }
        
        .footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #666;
        }
        
        .footer-highlight {
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 5px;
        }
        
        @media print {
          body {
            padding: 5px;
          }
          
          .invoice-container {
            max-width: none;
          }
          
          .multi-product-badge {
            background: #333 !important;
            color: white !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="logo">📱 مركز البدر</div>
          <div class="invoice-title">نظام إدارة مخزن الهواتف</div>
          <div class="multi-product-badge">فاتورة متعددة المنتجات</div>
        </div>
        
        <!-- Invoice Meta -->
        <div class="invoice-meta">
          <div><strong>رقم الفاتورة:</strong> ${invoiceNumber}</div>
          <div><strong>التاريخ:</strong> ${currentDate}</div>
          <div><strong>الوقت:</strong> ${currentTime}</div>
        </div>
        
        <!-- Summary Statistics -->
        <div class="summary-stats">
          <div class="stat-box">
            <div class="stat-number">${itemsCount}</div>
            <div class="stat-label">نوع منتج</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${totalQuantity}</div>
            <div class="stat-label">إجمالي القطع</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${formatCurrency(totalAmount)}</div>
            <div class="stat-label">المبلغ الإجمالي</div>
          </div>
        </div>
        
        <!-- Customer Info -->
        <div class="section">
          <div class="section-title">
            👤 بيانات العميل
          </div>
          <div class="info-row">
            <span class="info-label">الاسم:</span>
            <span class="info-value">${customer.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">الهاتف:</span>
            <span class="info-value">${customer.phone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">العنوان:</span>
            <span class="info-value">${customer.address}</span>
          </div>
        </div>
        
        <!-- Products Details -->
        <div class="section">
          <div class="section-title">
            📦 تفاصيل المنتجات (${itemsCount} منتج)
          </div>
          <table class="products-table">
            <thead>
              <tr>
                <th>م</th>
                <th>المنتج</th>
                <th>السعر</th>
                <th>الكمية</th>
                <th>المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${cartItems
                .map(
                  (item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="product-name">${item.product.name}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
                <td><strong>${item.quantity}</strong></td>
                <td class="amount">${formatCurrency(item.totalPrice)}</td>
              </tr>
              `,
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr style="background: #f3f4f6; font-weight: bold;">
                <td colspan="3">الإجمالي</td>
                <td><strong>${totalQuantity}</strong></td>
                <td class="amount" style="color: #2563eb;">${formatCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <!-- Totals -->
        <div class="totals">
          <div class="total-row">
            <span>المبلغ الإجمالي:</span>
            <span style="font-weight: bold;">${formatCurrency(totalAmount)}</span>
          </div>
          <div class="total-row">
            <span>المبلغ المدفوع:</span>
            <span style="color: #059669;">${formatCurrency(saleData.paidAmount)}</span>
          </div>
          ${
            remainingAmount > 0
              ? `
          <div class="total-row">
            <span>المبلغ المتبقي:</span>
            <span style="color: #dc2626; font-weight: bold;">${formatCurrency(remainingAmount)}</span>
          </div>
          `
              : ""
          }
          <div class="total-row total-final">
            <span>صافي المبلغ:</span>
            <span>${formatCurrency(totalAmount)}</span>
          </div>
        </div>
        
        <!-- Payment Status -->
        <div class="payment-status ${
          saleData.paymentType === "cash"
            ? "status-cash"
            : saleData.paymentType === "deferred"
              ? "status-deferred"
              : "status-partial"
        }">
          ${
            saleData.paymentType === "cash"
              ? "💵 نقدي - مدفوع بالكامل"
              : saleData.paymentType === "deferred"
                ? "⏳ آجل - مؤجل الدفع"
                : "📊 دفع جزئي"
          }
          ${
            remainingAmount > 0
              ? `<br><small>المبلغ المتبقي: ${formatCurrency(remainingAmount)}</small>`
              : ""
          }
        </div>
        
        <!-- Notes -->
        ${
          saleData.notes
            ? `
        <div class="notes">
          <strong>📝 ملاحظات:</strong><br>
          ${saleData.notes}
        </div>
        `
            : ""
        }
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-highlight">شكراً لتعاملكم معنا</div>
          📱 مركز البدر - نظام إدارة مخزن الهواتف<br>
          فاتورة متعددة المنتجات • نظام ذكي متطور<br>
          للاستفسارات والدعم الفني يرجى التواصل مع الإدارة
        </div>
      </div>
    </body>
    </html>
  `;
};
