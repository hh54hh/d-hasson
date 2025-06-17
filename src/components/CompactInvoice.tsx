import { formatCurrency, formatDate } from "@/lib/storage";

interface CompactInvoiceProps {
  customerData: {
    name: string;
    phone: string;
    address: string;
  };
  selectedProduct: {
    name: string;
    salePrice: number;
  } | null;
  saleData: {
    quantity: number;
    paymentType: "cash" | "deferred" | "partial";
    paidAmount: number;
    notes: string;
  };
  totalAmount: number;
  remainingAmount: number;
}

export const generateCompactInvoice = ({
  customerData,
  selectedProduct,
  saleData,
  totalAmount,
  remainingAmount,
}: CompactInvoiceProps) => {
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  const currentDate = formatDate(new Date());
  const currentTime = new Date().toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>فاتورة - ${invoiceNumber}</title>
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
          max-width: 400px;
          margin: 0 auto;
          background: white;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }

        .logo {
          font-size: 18px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 5px;
        }

        .invoice-title {
          font-size: 14px;
          color: #666;
        }

        .invoice-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          font-size: 11px;
          color: #666;
        }

        .section {
          margin-bottom: 12px;
          padding: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }

        .section-title {
          font-weight: bold;
          font-size: 12px;
          color: #2563eb;
          margin-bottom: 5px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 3px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          font-size: 12px;
        }

        .info-label {
          color: #666;
        }

        .info-value {
          font-weight: 500;
        }

        .product-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 11px;
        }

        .product-table th,
        .product-table td {
          border: 1px solid #ddd;
          padding: 4px 6px;
          text-align: center;
        }

        .product-table th {
          background: #f8f9fa;
          font-weight: bold;
          font-size: 10px;
        }

        .totals {
          background: #f8f9fa;
          padding: 8px;
          border-radius: 4px;
          margin: 10px 0;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          font-size: 12px;
        }

        .total-final {
          font-weight: bold;
          font-size: 14px;
          color: #2563eb;
          border-top: 1px solid #ddd;
          padding-top: 5px;
          margin-top: 5px;
        }

        .payment-status {
          padding: 6px;
          border-radius: 4px;
          text-align: center;
          font-weight: bold;
          font-size: 12px;
          margin: 10px 0;
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
          margin-top: 10px;
          padding: 6px;
          background: #f9fafb;
          border-radius: 4px;
          font-size: 11px;
        }

        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          font-size: 10px;
          color: #666;
        }

        @media print {
          body {
            padding: 5px;
          }

          .invoice-container {
            max-width: none;
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
        </div>

        <!-- Invoice Meta -->
        <div class="invoice-meta">
          <div>رقم الفاتورة: ${invoiceNumber}</div>
          <div>${currentDate} - ${currentTime}</div>
        </div>

        <!-- Customer Info -->
        <div class="section">
          <div class="section-title">👤 بيانات العميل</div>
          <div class="info-row">
            <span class="info-label">الاسم:</span>
            <span class="info-value">${customerData.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">الهاتف:</span>
            <span class="info-value">${customerData.phone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">العنوان:</span>
            <span class="info-value">${customerData.address}</span>
          </div>
        </div>

        <!-- Product Details -->
        <div class="section">
          <div class="section-title">📦 تفاصيل المنتج</div>
          <table class="product-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>المجموع</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${selectedProduct?.name || ""}</td>
                <td>${saleData.quantity}</td>
                <td>${formatCurrency(selectedProduct?.salePrice || 0)}</td>
                <td>${formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="totals">
          <div class="total-row total-final">
            <span>المبلغ الإجمالي:</span>
            <span>${formatCurrency(totalAmount)}</span>
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
            <span style="color: #dc2626;">${formatCurrency(remainingAmount)}</span>
          </div>
          `
              : ""
          }
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
        </div>

        <!-- Notes -->
        ${
          saleData.notes
            ? `
        <div class="notes">
          <strong>ملاحظات:</strong><br>
          ${saleData.notes}
        </div>
        `
            : ""
        }

        <!-- Footer -->
        <div class="footer">
          <strong>شكراً لتعاملكم معنا</strong><br>
          📱 مركز البدر - نظام إدارة مخزن الهواتف<br>
          للاستفسارات والدعم الفني يرجى التواصل مع الإدارة
        </div>
      </div>
    </body>
    </html>
  `;
};
