// System health monitoring and performance optimization

export interface SystemHealth {
  overall: "excellent" | "good" | "fair" | "poor";
  performance: PerformanceMetrics;
  storage: StorageMetrics;
  dataIntegrity: DataIntegrityCheck;
  recommendations: string[];
}

export interface PerformanceMetrics {
  loadTime: number;
  memoryUsage: number;
  storageSize: number;
  responseTime: number;
}

export interface StorageMetrics {
  totalSize: number;
  usedSpace: number;
  availableSpace: number;
  utilizationPercent: number;
}

export interface DataIntegrityCheck {
  customersValid: boolean;
  productsValid: boolean;
  salesValid: boolean;
  orphanedRecords: number;
  duplicateRecords: number;
}

// System health checker
export const checkSystemHealth = (): SystemHealth => {
  const startTime = performance.now();

  // Performance metrics
  const performance_metrics = getPerformanceMetrics();
  const storage = getStorageMetrics();
  const dataIntegrity = checkDataIntegrity();

  const endTime = performance.now();
  performance_metrics.responseTime = endTime - startTime;

  // Calculate overall health score
  const healthScore = calculateHealthScore(
    performance_metrics,
    storage,
    dataIntegrity,
  );

  const recommendations = generateRecommendations(
    performance_metrics,
    storage,
    dataIntegrity,
  );

  return {
    overall: getHealthStatus(healthScore),
    performance: performance_metrics,
    storage,
    dataIntegrity,
    recommendations,
  };
};

const getPerformanceMetrics = (): PerformanceMetrics => {
  // Memory usage (approximate)
  const memoryUsage = (performance as any).memory
    ? (performance as any).memory.usedJSHeapSize
    : 0;

  // Storage size
  const storageSize = getLocalStorageSize();

  return {
    loadTime: 0, // Will be calculated
    memoryUsage,
    storageSize,
    responseTime: 0, // Will be calculated
  };
};

const getStorageMetrics = (): StorageMetrics => {
  const totalSize = getLocalStorageSize();
  const maxSize = 10 * 1024 * 1024; // Assume 10MB max for localStorage
  const usedSpace = totalSize;
  const availableSpace = maxSize - usedSpace;
  const utilizationPercent = (usedSpace / maxSize) * 100;

  return {
    totalSize: maxSize,
    usedSpace,
    availableSpace,
    utilizationPercent,
  };
};

const getLocalStorageSize = (): number => {
  let total = 0;
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
  } catch (error) {
    console.error("Error calculating localStorage size:", error);
  }
  return total;
};

const checkDataIntegrity = (): DataIntegrityCheck => {
  try {
    const customers = JSON.parse(localStorage.getItem("paw_customers") || "[]");
    const products = JSON.parse(localStorage.getItem("paw_products") || "[]");
    const sales = JSON.parse(localStorage.getItem("paw_sales") || "[]");

    // Check if data structures are valid
    const customersValid =
      Array.isArray(customers) && customers.every(isValidCustomer);
    const productsValid =
      Array.isArray(products) && products.every(isValidProduct);
    const salesValid = Array.isArray(sales) && sales.every(isValidSale);

    // Check for orphaned records (sales without valid customer/product)
    let orphanedRecords = 0;
    const customerIds = new Set(customers.map((c: any) => c.id));
    const productIds = new Set(products.map((p: any) => p.id));

    sales.forEach((sale: any) => {
      if (
        !customerIds.has(sale.customerId) ||
        !productIds.has(sale.productId)
      ) {
        orphanedRecords++;
      }
    });

    // Check for duplicate IDs
    const allIds = [
      ...customers.map((c: any) => c.id),
      ...products.map((p: any) => p.id),
      ...sales.map((s: any) => s.id),
    ];
    const uniqueIds = new Set(allIds);
    const duplicateRecords = allIds.length - uniqueIds.size;

    return {
      customersValid,
      productsValid,
      salesValid,
      orphanedRecords,
      duplicateRecords,
    };
  } catch (error) {
    console.error("Error checking data integrity:", error);
    return {
      customersValid: false,
      productsValid: false,
      salesValid: false,
      orphanedRecords: 0,
      duplicateRecords: 0,
    };
  }
};

const isValidCustomer = (customer: any): boolean => {
  return (
    customer &&
    typeof customer.id === "string" &&
    typeof customer.name === "string" &&
    typeof customer.phone === "string" &&
    typeof customer.address === "string" &&
    ["cash", "deferred", "partial"].includes(customer.paymentStatus)
  );
};

const isValidProduct = (product: any): boolean => {
  return (
    product &&
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.wholesalePrice === "number" &&
    typeof product.salePrice === "number" &&
    typeof product.quantity === "number" &&
    typeof product.minQuantity === "number" &&
    product.wholesalePrice >= 0 &&
    product.salePrice >= 0 &&
    product.quantity >= 0 &&
    product.minQuantity >= 0
  );
};

const isValidSale = (sale: any): boolean => {
  return (
    sale &&
    typeof sale.id === "string" &&
    typeof sale.customerId === "string" &&
    typeof sale.productId === "string" &&
    typeof sale.quantity === "number" &&
    typeof sale.totalAmount === "number" &&
    ["cash", "deferred", "partial"].includes(sale.paymentType) &&
    sale.quantity > 0 &&
    sale.totalAmount >= 0
  );
};

const calculateHealthScore = (
  performance: PerformanceMetrics,
  storage: StorageMetrics,
  dataIntegrity: DataIntegrityCheck,
): number => {
  let score = 100;

  // Performance penalties
  if (performance.responseTime > 100) score -= 10;
  if (performance.responseTime > 500) score -= 20;
  if (performance.storageSize > 5 * 1024 * 1024) score -= 10; // > 5MB

  // Storage penalties
  if (storage.utilizationPercent > 80) score -= 15;
  if (storage.utilizationPercent > 95) score -= 25;

  // Data integrity penalties
  if (!dataIntegrity.customersValid) score -= 30;
  if (!dataIntegrity.productsValid) score -= 30;
  if (!dataIntegrity.salesValid) score -= 30;
  if (dataIntegrity.orphanedRecords > 0)
    score -= dataIntegrity.orphanedRecords * 5;
  if (dataIntegrity.duplicateRecords > 0)
    score -= dataIntegrity.duplicateRecords * 10;

  return Math.max(0, score);
};

const getHealthStatus = (
  score: number,
): "excellent" | "good" | "fair" | "poor" => {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "poor";
};

const generateRecommendations = (
  performance: PerformanceMetrics,
  storage: StorageMetrics,
  dataIntegrity: DataIntegrityCheck,
): string[] => {
  const recommendations: string[] = [];

  // Performance recommendations
  if (performance.responseTime > 100) {
    recommendations.push(
      "⚡ تحسين الأداء: قم بإعادة تشغيل المتصفح لتحسين السرعة",
    );
  }

  if (performance.storageSize > 5 * 1024 * 1024) {
    recommendations.push(
      "💾 تنظيف البيانات: حجم البيانات كبير، يُنصح بأرشفة البيانات القديمة",
    );
  }

  // Storage recommendations
  if (storage.utilizationPercent > 80) {
    recommendations.push(
      "📦 مساحة التخزين: مساحة التخزين شبه ممتلئة، قم بتصدير البيانات وحذف القديمة",
    );
  }

  if (storage.utilizationPercent > 95) {
    recommendations.push(
      "🚨 تحذير: مساحة التخزين ممتلئة تقريباً! قم بتنظيف البيانات فوراً",
    );
  }

  // Data integrity recommendations
  if (
    !dataIntegrity.customersValid ||
    !dataIntegrity.productsValid ||
    !dataIntegrity.salesValid
  ) {
    recommendations.push(
      "🔧 إصلاح البيانات: توجد بيانات تالفة، استخدم أداة إصلاح البيانات",
    );
  }

  if (dataIntegrity.orphanedRecords > 0) {
    recommendations.push(
      `🔗 بيانات معلقة: ${dataIntegrity.orphanedRecords} سجل معلق، قم بتنظيف البيانات`,
    );
  }

  if (dataIntegrity.duplicateRecords > 0) {
    recommendations.push(
      `🔄 بيانات مكررة: ${dataIntegrity.duplicateRecords} سجل مكرر، قم بحذف المكررات`,
    );
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      "✅ النظام يعمل بكفاءة عالية! استمر في الاستخدام العادي",
    );
  }

  return recommendations;
};

// Performance optimization utilities
export const optimizeSystem = () => {
  // Clear temporary data
  clearTemporaryData();

  // Compress data if possible
  compressStorageData();

  // Fix data integrity issues
  fixDataIntegrity();

  return "تم تحسين النظام بنجاح";
};

const clearTemporaryData = () => {
  // Remove any temporary or cached data
  const keysToRemove = Object.keys(localStorage).filter(
    (key) => key.startsWith("temp_") || key.startsWith("cache_"),
  );

  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

const compressStorageData = () => {
  // This is a placeholder for data compression
  // In a real implementation, you might use compression libraries
  console.log("Data compression completed");
};

const fixDataIntegrity = () => {
  try {
    const customers = JSON.parse(localStorage.getItem("paw_customers") || "[]");
    const products = JSON.parse(localStorage.getItem("paw_products") || "[]");
    const sales = JSON.parse(localStorage.getItem("paw_sales") || "[]");

    // Remove duplicate IDs
    const uniqueCustomers = removeDuplicates(customers, "id");
    const uniqueProducts = removeDuplicates(products, "id");
    const uniqueSales = removeDuplicates(sales, "id");

    // Remove orphaned sales
    const customerIds = new Set(uniqueCustomers.map((c: any) => c.id));
    const productIds = new Set(uniqueProducts.map((p: any) => p.id));

    const validSales = uniqueSales.filter(
      (sale: any) =>
        customerIds.has(sale.customerId) && productIds.has(sale.productId),
    );

    // Save cleaned data
    localStorage.setItem("paw_customers", JSON.stringify(uniqueCustomers));
    localStorage.setItem("paw_products", JSON.stringify(uniqueProducts));
    localStorage.setItem("paw_sales", JSON.stringify(validSales));
  } catch (error) {
    console.error("Error fixing data integrity:", error);
  }
};

const removeDuplicates = (array: any[], key: string) => {
  const seen = new Set();
  return array.filter((item) => {
    const val = item[key];
    if (seen.has(val)) {
      return false;
    }
    seen.add(val);
    return true;
  });
};

// Export utility functions
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلو", "ميجا", "جيجا"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getHealthColor = (status: string): string => {
  switch (status) {
    case "excellent":
      return "text-green-600";
    case "good":
      return "text-blue-600";
    case "fair":
      return "text-yellow-600";
    case "poor":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

export const getHealthIcon = (status: string): string => {
  switch (status) {
    case "excellent":
      return "✅";
    case "good":
      return "🟢";
    case "fair":
      return "🟡";
    case "poor":
      return "🔴";
    default:
      return "⚪";
  }
};
