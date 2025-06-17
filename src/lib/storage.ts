import { Customer, Product, Sale } from "./types";
import { offlineSync } from "./offlineSync";
import { realTimeDataSync } from "./realTimeDataSync";

const STORAGE_KEYS = {
  AUTH: "paw_auth",
  CUSTOMERS: "paw_customers",
  PRODUCTS: "paw_products",
  SALES: "paw_sales",
} as const;

const LOGIN_CODE = "112233";

// Generate UUID-compatible unique ID
let idCounter = 0;
const generateUniqueId = (): string => {
  // Generate a UUID-like format that works with database
  const timestamp = Date.now().toString(16);
  const counter = (++idCounter).toString(16).padStart(4, "0");
  const random = Math.random().toString(16).substr(2, 8);
  return `${timestamp.substr(-8)}-${counter}-4${random.substr(0, 3)}-8${random.substr(3, 3)}-${random.substr(6)}${timestamp.substr(-4)}`;
};

// Storage utilities
const getFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error("Failed to parse localStorage item:", error);
    return defaultValue;
  }
};

const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

// Authentication
export const authenticate = (code: string): boolean => {
  const isValid = code === LOGIN_CODE;
  if (isValid) {
    saveToStorage(STORAGE_KEYS.AUTH, {
      authenticated: true,
      loginTime: Date.now(),
    });
  }
  return isValid;
};

export const isAuthenticated = (): boolean => {
  try {
    const auth = getFromStorage(STORAGE_KEYS.AUTH, { authenticated: false });
    return Boolean(auth && auth.authenticated);
  } catch (error) {
    console.warn("Authentication check failed:", error);
    return false;
  }
};

export const logout = (): void => {
  localStorage.removeItem(STORAGE_KEYS.AUTH);
};

// Customers - Real data from Supabase only
export const getCustomers = (): Customer[] => {
  return getFromStorage(STORAGE_KEYS.CUSTOMERS, []);
};

export const addCustomer = (customerData: Omit<Customer, "id">): Customer => {
  const customers = getCustomers();
  const newCustomer: Customer = {
    ...customerData,
    id: generateUniqueId(),
  };

  customers.push(newCustomer);
  saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

  // Add to sync queue
  offlineSync.addToQueue("customers", "INSERT", newCustomer.id, {
    id: newCustomer.id,
    name: newCustomer.name,
    phone: newCustomer.phone,
    address: newCustomer.address,
    payment_status: newCustomer.paymentStatus,
    last_sale_date: newCustomer.lastSaleDate,
    debt_amount: newCustomer.debtAmount || 0,
    debt_paid_date: newCustomer.debtPaidDate,
  });

  // Broadcast real-time update
  realTimeDataSync.broadcastUpdate("customers", "add", newCustomer);

  return newCustomer;
};

export const updateCustomer = (
  id: string,
  updates: Partial<Customer>,
): Customer | null => {
  const customers = getCustomers();
  const index = customers.findIndex((c) => c.id === id);

  if (index === -1) return null;

  customers[index] = { ...customers[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

  // Add to sync queue
  const updatedCustomer = customers[index];
  offlineSync.addToQueue("customers", "UPDATE", id, {
    id: updatedCustomer.id,
    name: updatedCustomer.name,
    phone: updatedCustomer.phone,
    address: updatedCustomer.address,
    payment_status: updatedCustomer.paymentStatus,
    last_sale_date: updatedCustomer.lastSaleDate,
    debt_amount: updatedCustomer.debtAmount || 0,
    debt_paid_date: updatedCustomer.debtPaidDate,
  });

  return customers[index];
};

export const deleteCustomer = (id: string): boolean => {
  const customers = getCustomers();
  const index = customers.findIndex((c) => c.id === id);

  if (index === -1) return false;

  customers.splice(index, 1);
  saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

  // Add to sync queue
  offlineSync.addToQueue("customers", "DELETE", id, {});

  return true;
};

// Products - Real data from Supabase only (no fake data)
export const getProducts = (): Product[] => {
  return getFromStorage(STORAGE_KEYS.PRODUCTS, []);
};

export const addProduct = (productData: Omit<Product, "id">): Product => {
  const products = getProducts();
  const newProduct: Product = {
    ...productData,
    id: generateUniqueId(),
  };

  products.push(newProduct);
  saveToStorage(STORAGE_KEYS.PRODUCTS, products);

  // Add to sync queue
  offlineSync.addToQueue("products", "INSERT", newProduct.id, {
    id: newProduct.id,
    name: newProduct.name,
    wholesale_price: newProduct.wholesalePrice,
    sale_price: newProduct.salePrice,
    quantity: newProduct.quantity,
    min_quantity: newProduct.minQuantity,
  });

  // Broadcast real-time update
  realTimeDataSync.broadcastUpdate("products", "add", newProduct);

  return newProduct;
};

export const updateProduct = (
  id: string,
  updates: Partial<Product>,
): Product | null => {
  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) return null;

  products[index] = { ...products[index], ...updates };
  saveToStorage(STORAGE_KEYS.PRODUCTS, products);

  // Add to sync queue
  const updatedProduct = products[index];
  offlineSync.addToQueue("products", "UPDATE", id, {
    id: updatedProduct.id,
    name: updatedProduct.name,
    wholesale_price: updatedProduct.wholesalePrice,
    sale_price: updatedProduct.salePrice,
    quantity: updatedProduct.quantity,
    min_quantity: updatedProduct.minQuantity,
  });

  // Broadcast real-time update
  realTimeDataSync.broadcastUpdate("products", "update", updatedProduct);

  return products[index];
};

export const deleteProduct = (id: string): boolean => {
  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) return false;

  products.splice(index, 1);
  saveToStorage(STORAGE_KEYS.PRODUCTS, products);

  // Add to sync queue
  offlineSync.addToQueue("products", "DELETE", id, {});

  // Broadcast real-time update
  realTimeDataSync.broadcastUpdate("products", "delete", { id });

  return true;
};

// Sales - Real data from Supabase only
export const getSales = (): Sale[] => {
  return getFromStorage(STORAGE_KEYS.SALES, []);
};

export const addSale = (saleData: Omit<Sale, "id">): Sale => {
  const sales = getSales();
  const newSale: Sale = {
    ...saleData,
    id: generateUniqueId(),
  };

  sales.push(newSale);
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));

  // Add to sync queue
  offlineSync.addToQueue("sales", "INSERT", newSale.id, {
    id: newSale.id,
    customer_id: newSale.customerId,
    product_id: newSale.productId,
    product_name: newSale.productName,
    quantity: newSale.quantity,
    unit_price: newSale.unitPrice,
    total_amount: newSale.totalAmount,
    payment_type: newSale.paymentType,
    paid_amount: newSale.paidAmount,
    remaining_amount: newSale.remainingAmount,
    sale_date: newSale.saleDate,
    payment_date: newSale.paymentDate,
    profit_amount: newSale.profitAmount,
    notes: newSale.notes,
  });

  // Broadcast real-time update
  realTimeDataSync.broadcastUpdate("sales", "add", newSale);

  return newSale;
};

export const updateSale = (id: string, updates: Partial<Sale>): Sale | null => {
  const sales = getSales();
  const index = sales.findIndex((s) => s.id === id);

  if (index === -1) return null;

  sales[index] = { ...sales[index], ...updates };
  saveToStorage(STORAGE_KEYS.SALES, sales);

  // Add to sync queue
  const updatedSale = sales[index];
  offlineSync.addToQueue("sales", "UPDATE", id, {
    id: updatedSale.id,
    customer_id: updatedSale.customerId,
    product_id: updatedSale.productId,
    product_name: updatedSale.productName,
    quantity: updatedSale.quantity,
    unit_price: updatedSale.unitPrice,
    total_amount: updatedSale.totalAmount,
    payment_type: updatedSale.paymentType,
    paid_amount: updatedSale.paidAmount,
    remaining_amount: updatedSale.remainingAmount,
    sale_date: updatedSale.saleDate,
    payment_date: updatedSale.paymentDate,
    profit_amount: updatedSale.profitAmount,
    notes: updatedSale.notes,
  });

  return sales[index];
};

// Currency and formatting utilities
export const CURRENCY = "د.ع";

export const formatCurrency = (amount: number): string => {
  if (amount === 0) return `0 ${CURRENCY}`;

  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString("ar-IQ");
  const prefix = amount < 0 ? "-" : "";

  return `${prefix}${formatted} ${CURRENCY}`;
};

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("ar-IQ");
};

// Initialize default data - Real data from Supabase only
export const initializeDefaultData = (): void => {
  // Only initialize empty arrays if needed - no fake data
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    saveToStorage(STORAGE_KEYS.CUSTOMERS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    saveToStorage(STORAGE_KEYS.PRODUCTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SALES)) {
    saveToStorage(STORAGE_KEYS.SALES, []);
  }

  console.log("🔧 النظام مهيأ للبيانات الحقيقية من Supabase");
  console.log("📊 جميع البيانات ستأتي من قاعدة البيانات");
};

// Clear all local data (for fresh start with real data)
export const clearAllLocalData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
  localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
  localStorage.removeItem(STORAGE_KEYS.SALES);
  console.log("🧹 تم مسح جميع البيانات المحلية");
};

// Cache real data from Supabase
export const cacheSupabaseData = (
  customers: Customer[],
  products: Product[],
  sales: Sale[],
): void => {
  saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
  saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  saveToStorage(STORAGE_KEYS.SALES, sales);
  console.log("💾 تم حفظ البيانات الحقيقية في الكاش");
  console.log(
    `📊 العملاء: ${customers.length}, المنتجات: ${products.length}, المبيعات: ${sales.length}`,
  );
};
