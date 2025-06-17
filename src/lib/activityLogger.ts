// Comprehensive Activity Logger for Customer History
import {
  Customer,
  Sale,
  DebtPayment,
  Transaction,
  ActivityLog,
  getCurrentDateGregorian,
} from "./types";
import { formatCurrency } from "./storage";

export class ActivityLogger {
  // Generate comprehensive activity log for a customer
  static generateCustomerActivityLog(
    customer: Customer,
    sales: Sale[],
    debtPayments: DebtPayment[] = [],
    transactions: Transaction[] = [],
  ): ActivityLog[] {
    const activities: ActivityLog[] = [];

    // Add sales activities
    sales
      .filter((sale) => sale.customerId === customer.id)
      .forEach((sale) => {
        activities.push({
          id: `sale_${sale.id}`,
          customerId: customer.id,
          type: "sale",
          date: sale.saleDate,
          amount: sale.totalAmount,
          description: `🛒 عملية شراء - ${sale.items?.length || 1} منتج`,
          details: {
            saleId: sale.id,
            products:
              sale.items?.map((item) => ({
                name: item.productName,
                quantity: item.quantity,
                amount: item.totalAmount,
              })) || [],
            paymentType: sale.paymentType,
            notes: sale.notes,
          },
          created_at: sale.created_at || sale.saleDate,
        });

        // Add payment activity if it was a cash sale
        if (sale.paymentType === "cash" && sale.paidAmount > 0) {
          activities.push({
            id: `payment_${sale.id}`,
            customerId: customer.id,
            type: "payment",
            date: sale.paymentDate || sale.saleDate,
            amount: sale.paidAmount,
            description: `💰 دفع نقدي فوري - ${formatCurrency(sale.paidAmount)}`,
            details: {
              saleId: sale.id,
              paymentType: "cash",
            },
            created_at: sale.created_at || sale.saleDate,
          });
        }

        // Add debt activity if there's remaining amount
        if (sale.remainingAmount > 0) {
          activities.push({
            id: `debt_${sale.id}`,
            customerId: customer.id,
            type: "debt_added",
            date: sale.saleDate,
            amount: sale.remainingAmount,
            description: `⏰ دين مُضاف - ${formatCurrency(sale.remainingAmount)}`,
            details: {
              saleId: sale.id,
              paymentType: sale.paymentType,
            },
            created_at: sale.created_at || sale.saleDate,
          });
        }
      });

    // Add debt payment activities
    debtPayments
      .filter((payment) => payment.customerId === customer.id)
      .forEach((payment) => {
        activities.push({
          id: `debt_payment_${payment.id}`,
          customerId: customer.id,
          type: "payment",
          date: payment.paymentDate,
          amount: payment.amount,
          description: `💳 تسديد دين - ${payment.paymentType === "full" ? "كامل" : "جزئي"}`,
          details: {
            paymentType: payment.paymentType,
            notes: payment.notes,
          },
          created_at: payment.created_at || payment.paymentDate,
        });
      });

    // Add transaction activities
    transactions
      .filter((transaction) => transaction.customerId === customer.id)
      .forEach((transaction) => {
        if (transaction.type === "payment") {
          activities.push({
            id: `transaction_${transaction.id}`,
            customerId: customer.id,
            type: "payment",
            date: transaction.transactionDate.split("T")[0],
            amount: transaction.amount,
            description: `💰 ${transaction.description}`,
            details: {
              notes: transaction.description,
            },
            created_at: transaction.created_at || transaction.transactionDate,
          });
        }
      });

    // Sort activities by date (newest first)
    activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return activities;
  }

  // Generate summary for customer activities
  static generateActivitySummary(activities: ActivityLog[]): {
    totalSales: number;
    totalPaid: number;
    totalDebt: number;
    salesCount: number;
    paymentsCount: number;
  } {
    const summary = {
      totalSales: 0,
      totalPaid: 0,
      totalDebt: 0,
      salesCount: 0,
      paymentsCount: 0,
    };

    activities.forEach((activity) => {
      switch (activity.type) {
        case "sale":
          summary.totalSales += activity.amount || 0;
          summary.salesCount++;
          break;
        case "payment":
          summary.totalPaid += activity.amount || 0;
          summary.paymentsCount++;
          break;
        case "debt_added":
          summary.totalDebt += activity.amount || 0;
          break;
      }
    });

    return summary;
  }

  // Format activity for display
  static formatActivityForDisplay(activity: ActivityLog): {
    icon: string;
    title: string;
    subtitle: string;
    amount: string;
    color: string;
  } {
    const amount = activity.amount ? formatCurrency(activity.amount) : "";

    switch (activity.type) {
      case "sale":
        return {
          icon: "🛒",
          title: "عملية شراء",
          subtitle: activity.description,
          amount,
          color: "text-blue-600",
        };
      case "payment":
        return {
          icon: "💰",
          title: "دفعة",
          subtitle: activity.description,
          amount,
          color: "text-green-600",
        };
      case "debt_added":
        return {
          icon: "⏰",
          title: "دين مُضاف",
          subtitle: activity.description,
          amount,
          color: "text-red-600",
        };
      case "customer_edit":
        return {
          icon: "✏️",
          title: "تعديل بيانات",
          subtitle: activity.description,
          amount: "",
          color: "text-gray-600",
        };
      case "note":
        return {
          icon: "📝",
          title: "ملاحظة",
          subtitle: activity.description,
          amount: "",
          color: "text-purple-600",
        };
      default:
        return {
          icon: "📋",
          title: "نشاط",
          subtitle: activity.description,
          amount,
          color: "text-gray-600",
        };
    }
  }

  // Generate HTML for printing customer activity log
  static generatePrintableActivityLog(
    customer: Customer,
    activities: ActivityLog[],
  ): string {
    const summary = this.generateActivitySummary(activities);

    return `
      <div style="margin-top: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd;">
          <h3 style="margin: 0; font-size: 18px; color: #2563eb;">
            📋 سجل الأنشطة الشامل (${activities.length} نشاط)
          </h3>
        </div>

        <div style="padding: 15px;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 10px; background: #eff6ff; border-radius: 6px;">
              <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${summary.salesCount}</div>
              <div style="font-size: 12px; color: #666;">عمليات شراء</div>
            </div>
            <div style="text-align: center; padding: 10px; background: #f0fdf4; border-radius: 6px;">
              <div style="font-size: 20px; font-weight: bold; color: #059669;">${summary.paymentsCount}</div>
              <div style="font-size: 12px; color: #666;">عم��يات دفع</div>
            </div>
            <div style="text-align: center; padding: 10px; background: #fffbeb; border-radius: 6px;">
              <div style="font-size: 20px; font-weight: bold; color: #d97706;">${formatCurrency(summary.totalSales)}</div>
              <div style="font-size: 12px; color: #666;">إجمالي المشتريات</div>
            </div>
            <div style="text-align: center; padding: 10px; background: #fef2f2; border-radius: 6px;">
              <div style="font-size: 20px; font-weight: bold; color: #dc2626;">${formatCurrency(summary.totalDebt)}</div>
              <div style="font-size: 12px; color: #666;">إجمالي الديون</div>
            </div>
          </div>

          <div style="max-height: 400px; overflow-y: auto;">
            ${activities
              .map((activity, index) => {
                const formatted = this.formatActivityForDisplay(activity);
                return `
                <div style="border-bottom: 1px solid #f0f0f0; padding: 12px 0; display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 20px;">${formatted.icon}</div>
                    <div>
                      <div style="font-weight: bold; ${formatted.color}">${formatted.title}</div>
                      <div style="font-size: 14px; color: #666; margin-top: 2px;">${formatted.subtitle}</div>
                      <div style="font-size: 12px; color: #888; margin-top: 2px;">📅 ${activity.date}</div>
                    </div>
                  </div>
                  <div style="text-align: left;">
                    ${formatted.amount ? `<div style="font-weight: bold; ${formatted.color}">${formatted.amount}</div>` : ""}
                    ${
                      activity.details?.products
                        ? `
                      <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        ${activity.details.products
                          .slice(0, 2)
                          .map((p) => `${p.name} (${p.quantity})`)
                          .join(", ")}
                        ${activity.details.products.length > 2 ? ` +${activity.details.products.length - 2} أخرى` : ""}
                      </div>
                    `
                        : ""
                    }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }
}
