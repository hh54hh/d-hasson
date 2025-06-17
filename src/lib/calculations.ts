// Advanced business calculation utilities
import {
  Customer,
  Product,
  Sale,
  getCurrentDateGregorian,
  formatDateGregorian,
} from "./types";

export interface SaleCalculation {
  subtotal: number;
  total: number;
  profitAmount: number;
  profitMargin: number;
}

export interface InventoryAnalysis {
  totalValue: number;
  totalWholesaleValue: number;
  potentialProfit: number;
  averageProfitMargin: number;
  lowStockValue: number;
  turnoverRatio: number;
}

export interface CustomerAnalysis {
  totalPurchases: number;
  averageOrderValue: number;
  totalDebt: number;
  paymentHistory: {
    cash: number;
    deferred: number;
    partial: number;
  };
  customerLifetimeValue: number;
}

// Sale calculations without discounts and taxes (as requested)
export const calculateSaleDetails = (
  unitPrice: number,
  quantity: number,
  wholesalePrice: number,
): SaleCalculation => {
  const subtotal = unitPrice * quantity;
  const total = subtotal; // No discounts or taxes

  const profitPerUnit = unitPrice - wholesalePrice;
  const profitAmount = profitPerUnit * quantity;
  // حساب هامش الربح الصحيح = (الربح / سعر البيع) × 100
  const profitMargin = unitPrice > 0 ? (profitPerUnit / unitPrice) * 100 : 0;

  return {
    subtotal,
    total,
    profitAmount,
    profitMargin,
  };
};

// Inventory analysis
export const analyzeInventory = (products: any[]): InventoryAnalysis => {
  const totalValue = products.reduce(
    (sum, p) => sum + p.salePrice * p.quantity,
    0,
  );
  const totalWholesaleValue = products.reduce(
    (sum, p) => sum + p.wholesalePrice * p.quantity,
    0,
  );
  const potentialProfit = totalValue - totalWholesaleValue;

  const averageProfitMargin =
    products.length > 0
      ? products.reduce((sum, p) => {
          // حساب هامش الربح الصحيح = (الربح / سعر البيع) × 100
          const margin =
            p.salePrice > 0
              ? ((p.salePrice - p.wholesalePrice) / p.salePrice) * 100
              : 0;
          return sum + margin;
        }, 0) / products.length
      : 0;

  const lowStockProducts = products.filter((p) => p.quantity <= p.minQuantity);
  const lowStockValue = lowStockProducts.reduce(
    (sum, p) => sum + p.salePrice * p.quantity,
    0,
  );

  // Simple turnover ratio estimate (this would be more accurate with sales data)
  const turnoverRatio = totalValue > 0 ? potentialProfit / totalValue : 0;

  return {
    totalValue,
    totalWholesaleValue,
    potentialProfit,
    averageProfitMargin,
    lowStockValue,
    turnoverRatio,
  };
};

// Customer analysis with proper sales data handling
export const analyzeCustomer = (
  customer: any,
  sales: any[],
): CustomerAnalysis => {
  // Filter sales for this specific customer
  const customerSales = sales.filter((s) => s.customerId === customer.id);

  console.log(
    `📊 Analyzing customer ${customer.name}: found ${customerSales.length} sales`,
  );

  // Calculate total purchases amount
  const totalPurchases = customerSales.reduce((sum, sale) => {
    const amount = sale.totalAmount || 0;
    console.log(`💰 Sale ${sale.id}: ${amount}`);
    return sum + amount;
  }, 0);

  // Calculate average order value
  const averageOrderValue =
    customerSales.length > 0 ? totalPurchases / customerSales.length : 0;

  // Get current debt amount
  const totalDebt = customer.debtAmount || 0;

  // Analyze payment history
  const paymentHistory = customerSales.reduce(
    (acc, sale) => {
      const amount = sale.totalAmount || 0;
      if (sale.paymentType === "cash") acc.cash += amount;
      else if (sale.paymentType === "deferred") acc.deferred += amount;
      else if (sale.paymentType === "partial") acc.partial += amount;
      return acc;
    },
    { cash: 0, deferred: 0, partial: 0 },
  );

  // Customer Lifetime Value (simple calculation)
  const customerLifetimeValue = totalPurchases * 1.2; // Assuming 20% future growth

  const result = {
    totalPurchases,
    averageOrderValue,
    totalDebt,
    paymentHistory,
    customerLifetimeValue,
  };

  console.log(`📈 Customer ${customer.name} analysis:`, result);
  return result;
};

// Financial ratios and KPIs
export const calculateBusinessKPIs = (
  customers: any[],
  products: any[],
  sales: any[],
) => {
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCost = sales.reduce(
    (sum, s) =>
      sum + s.quantity * getProductWholesalePrice(s.productId, products),
    0,
  );
  const grossProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const totalDebt = customers.reduce((sum, c) => sum + (c.debtAmount || 0), 0);
  const debtToRevenueRatio =
    totalRevenue > 0 ? (totalDebt / totalRevenue) * 100 : 0;

  const cashSales = sales.filter((s) => s.paymentType === "cash").length;
  const cashSalesRatio =
    sales.length > 0 ? (cashSales / sales.length) * 100 : 0;

  const inventoryValue = products.reduce(
    (sum, p) => sum + p.salePrice * p.quantity,
    0,
  );
  const inventoryTurnover =
    inventoryValue > 0 ? totalRevenue / inventoryValue : 0;

  return {
    totalRevenue,
    totalCost,
    grossProfit,
    grossMargin,
    totalDebt,
    debtToRevenueRatio,
    cashSalesRatio,
    inventoryValue,
    inventoryTurnover,
    avgOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
    customerCount: customers.length,
    avgCustomerValue:
      customers.length > 0 ? totalRevenue / customers.length : 0,
  };
};

// Helper function to get product wholesale price
const getProductWholesalePrice = (
  productId: string,
  products: any[],
): number => {
  const product = products.find((p) => p.id === productId);
  return product ? product.wholesalePrice : 0;
};

// Price suggestion algorithms
export const suggestOptimalPrice = (
  wholesalePrice: number,
  marketData?: {
    competitorPrices: number[];
    demandLevel: "high" | "medium" | "low";
    seasonality: "peak" | "normal" | "low";
  },
): {
  suggested: number;
  min: number;
  max: number;
  reasoning: string;
} => {
  const baseMargin = 0.3; // 30% base margin
  let suggestedMargin = baseMargin;

  // Adjust based on demand
  if (marketData?.demandLevel === "high") suggestedMargin += 0.1;
  else if (marketData?.demandLevel === "low") suggestedMargin -= 0.05;

  // Adjust based on seasonality
  if (marketData?.seasonality === "peak") suggestedMargin += 0.05;
  else if (marketData?.seasonality === "low") suggestedMargin -= 0.1;

  const suggested = wholesalePrice * (1 + suggestedMargin);
  const min = wholesalePrice * 1.15; // Minimum 15% margin
  const max = wholesalePrice * 1.5; // Maximum 50% margin

  let reasoning = `هامش ربح مقترح: ${(suggestedMargin * 100).toFixed(1)}%`;
  if (marketData?.competitorPrices?.length) {
    const avgCompetitorPrice =
      marketData.competitorPrices.reduce((a, b) => a + b) /
      marketData.competitorPrices.length;
    reasoning += ` | متوسط أسعار المنافسين: ${avgCompetitorPrice.toLocaleString()}`;
  }

  return {
    suggested: Math.round(suggested),
    min: Math.round(min),
    max: Math.round(max),
    reasoning,
  };
};
