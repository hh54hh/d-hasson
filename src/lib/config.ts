// Advanced business configuration for PAW system

export const BUSINESS_CONFIG = {
  // Currency and formatting
  currency: {
    symbol: "د.ع",
    name: "دينار عراقي",
    code: "IQD",
    decimalPlaces: 0,
    thousandSeparator: ",",
    decimalSeparator: ".",
  },

  // Date and time formatting
  dateFormat: {
    locale: "en-GB", // DD/MM/YYYY format
    arabicLocale: "ar-SA",
    timeZone: "Asia/Baghdad",
  },

  // Business rules
  business: {
    minProfitMargin: 15, // Minimum profit margin percentage
    maxDiscountPercent: 50, // Maximum discount allowed
    maxTaxPercent: 25, // Maximum tax percentage
    lowStockThreshold: 5, // Threshold for low stock warning
    debtWarningRatio: 20, // Warning when debt > 20% of revenue
    maxCreditDays: 30, // Maximum credit period in days
  },

  // Inventory management
  inventory: {
    autoReorderEnabled: false,
    reorderNotificationDays: 7,
    defaultMinQuantity: 3,
    categoriesEnabled: false,
    barcodeEnabled: false,
  },

  // Customer management
  customer: {
    loyaltyProgramEnabled: false,
    vipCustomerThreshold: 5000000, // IQD
    maxCreditLimit: 2000000, // IQD
    creditTerms: ["نقد", "آجل 7 أيام", "آجل 15 يوم", "آجل 30 يوم"],
  },

  // Reporting
  reporting: {
    defaultPeriod: "month",
    autoBackupEnabled: true,
    backupFrequency: "weekly",
    reportFormats: ["PDF", "Excel", "JSON"],
  },

  // UI preferences
  ui: {
    theme: "light",
    rtlEnabled: true,
    arabicNumbers: true,
    compactMode: false,
    showProfitMargins: true,
    showWholesalePrices: false,
  },

  // Security
  security: {
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
    autoLogout: true,
    dataEncryption: false,
    auditTrail: false,
  },

  // Performance
  performance: {
    maxRecordsPerPage: 50,
    enablePagination: true,
    enableSearch: true,
    enableFiltering: true,
    enableSorting: true,
  },

  // Integration
  integration: {
    whatsappEnabled: false,
    telegramEnabled: false,
    emailEnabled: false,
    smsEnabled: false,
    printerEnabled: true,
  },

  // Analytics
  analytics: {
    enableAdvancedAnalytics: true,
    trackUserBehavior: false,
    enablePredictiveAnalysis: false,
    dashboardRefreshInterval: 30000, // 30 seconds
  },
};

// Utility functions for configuration
export const formatCurrencyAdvanced = (
  amount: number,
  options: {
    showSymbol?: boolean;
    showCode?: boolean;
    compact?: boolean;
  } = {},
): string => {
  const { showSymbol = true, showCode = false, compact = false } = options;
  const { symbol, code, thousandSeparator } = BUSINESS_CONFIG.currency;

  let formatted = amount.toLocaleString("ar-IQ");

  if (compact && amount >= 1000000) {
    formatted = (amount / 1000000).toFixed(1) + "م";
  } else if (compact && amount >= 1000) {
    formatted = (amount / 1000).toFixed(1) + "ك";
  }

  if (showSymbol) formatted += ` ${symbol}`;
  if (showCode) formatted += ` (${code})`;

  return formatted;
};

export const validateBusinessRules = {
  profitMargin: (salePrice: number, wholesalePrice: number): boolean => {
    const margin = ((salePrice - wholesalePrice) / wholesalePrice) * 100;
    return margin >= BUSINESS_CONFIG.business.minProfitMargin;
  },

  discountPercent: (discount: number): boolean => {
    return (
      discount >= 0 && discount <= BUSINESS_CONFIG.business.maxDiscountPercent
    );
  },

  taxPercent: (tax: number): boolean => {
    return tax >= 0 && tax <= BUSINESS_CONFIG.business.maxTaxPercent;
  },

  creditLimit: (customerDebt: number): boolean => {
    return customerDebt <= BUSINESS_CONFIG.customer.maxCreditLimit;
  },

  stockLevel: (quantity: number, minQuantity: number): "ok" | "low" | "out" => {
    if (quantity === 0) return "out";
    if (quantity <= minQuantity) return "low";
    return "ok";
  },
};

// Theme and styling configuration
export const THEME_CONFIG = {
  colors: {
    primary: {
      50: "#eff6ff",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      900: "#1e3a8a",
    },
    success: {
      50: "#f0fdf4",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
    },
    danger: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
    },
  },
  fonts: {
    arabic: ["Cairo", "Tajawal", "Amiri"],
    english: ["Inter", "Roboto", "Arial"],
  },
  spacing: {
    xs: "0.5rem",
    sm: "1rem",
    md: "1.5rem",
    lg: "2rem",
    xl: "3rem",
  },
};

export default BUSINESS_CONFIG;
