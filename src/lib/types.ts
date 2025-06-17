export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  paymentStatus: "cash" | "deferred" | "partial";
  lastSaleDate: string;
  debtAmount?: number;
  debtPaidDate?: string;
  sales: Sale[];
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  wholesalePrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  created_at?: string;
  updated_at?: string;
}

// Cart item for multi-product sales
export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Updated Sale interface to support multiple products in one transaction
export interface Sale {
  id: string;
  customerId: string;
  saleDate: string;
  totalAmount: number;
  paymentType: "cash" | "deferred" | "partial";
  paidAmount: number;
  remainingAmount: number;
  paymentDate?: string;
  profitAmount?: number;
  notes?: string;
  items: SaleItem[]; // Multiple products in one sale
  created_at?: string;
  updated_at?: string;
}

// Individual sale item within a sale
export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  profitAmount?: number;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentType: "full" | "partial";
  paymentDate: string;
  notes?: string;
  remainingDebt: number;
  created_at?: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  type: "sale" | "payment" | "refund";
  amount: number;
  description: string;
  transactionDate: string;
  created_at?: string;
}

export interface SaleCalculation {
  subtotal: number;
  total: number;
  profitAmount: number;
  profitMargin: number;
}

export interface Analytics {
  totalSales: number;
  totalProfit: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: Product[];
  topSellingProducts: Array<{
    product: Product;
    quantity: number;
    revenue: number;
  }>;
  recentSales: Sale[];
  pendingPayments: Customer[];
}

// Activity log for comprehensive customer history
export interface ActivityLog {
  id: string;
  customerId: string;
  type: "sale" | "payment" | "debt_added" | "customer_edit" | "note";
  date: string;
  amount?: number;
  description: string;
  details?: {
    saleId?: string;
    products?: { name: string; quantity: number; amount: number }[];
    paymentType?: string;
    notes?: string;
  };
  created_at: string;
}

// Complete report data structure for PDF export
export interface FullReport {
  generatedAt: string;
  summary: {
    totalCustomers: number;
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    totalProfit: number;
    pendingDebt: number;
  };
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  transactions: Transaction[];
  debtPayments: DebtPayment[];
  lowStockAlerts: Product[];
  activityLogs: ActivityLog[];
}

// Utility function to get current date in Gregorian format only
export const getCurrentDateGregorian = (): string => {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
};

// Utility function to format date for display (Gregorian only)
export const formatDateGregorian = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB"); // DD/MM/YYYY format
};

// Utility function to format datetime for display (Gregorian only)
export const formatDateTimeGregorian = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString("en-GB"); // DD/MM/YYYY, HH:MM:SS format
};
