// Enhanced offline management with no-connection error prevention
import { supabaseService } from "./supabaseService";
import {
  Customer,
  Product,
  Sale,
  Transaction,
  CartItem,
  getCurrentDateGregorian,
} from "./types";
import { SupabaseValidator } from "./supabaseValidator";
import { SyncErrorManager } from "./syncErrorManager";

interface QueuedOperation {
  id: string;
  type: "create" | "update" | "delete";
  table: "customers" | "products" | "sales" | "transactions" | "sale_items";
  data: any;
  timestamp: number;
  retryCount: number;
  processed?: boolean;
}

class OfflineManager {
  private readonly QUEUE_KEY = "offline_queue";
  private readonly CACHE_KEYS = {
    customers: "cached_customers",
    products: "cached_products",
    sales: "cached_sales",
    transactions: "cached_transactions",
    last_sync: "last_sync_time",
  };
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private initialized = false;

  constructor() {
    this.initializeOfflineMode();
  }

  private async initializeOfflineMode() {
    if (this.initialized) return;

    // Set up event listeners
    this.setupEventListeners();

    // Clean any duplicate operations from previous sessions
    this.cleanDuplicateOperations();

    // Try to load initial data if online
    if (this.isOnline) {
      await this.initialDataLoad();
    }

    // Setup periodic sync
    this.setupPeriodicSync();

    this.initialized = true;
  }

  private setupEventListeners() {
    window.addEventListener("online", () => {
      console.log("🌐 Internet connection restored");
      this.isOnline = true;
      this.syncQueuedOperations();
    });

    window.addEventListener("offline", () => {
      console.log("📵 Internet connection lost - switching to offline mode");
      this.isOnline = false;
    });

    // Background sync when app becomes visible
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.isOnline) {
        this.syncQueuedOperations();
      }
    });
  }

  private setupPeriodicSync() {
    // Sync every 30 seconds when online
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncQueuedOperations();
      }
    }, 30000);
  }

  private async initialDataLoad() {
    try {
      // Quick connection check first
      const connectionAvailable =
        await SupabaseValidator.isConnectionAvailable();

      if (!connectionAvailable) {
        console.log("📱 Supabase not available - using local data only");
        return;
      }

      console.log("🔄 Loading initial data from Supabase...");
      const [customers, products, sales] = await Promise.all([
        supabaseService.getCustomers(),
        supabaseService.getProducts(),
        supabaseService.getSales(),
      ]);

      this.cacheData("customers", customers);
      this.cacheData("products", products);
      this.cacheData("sales", sales);

      console.log(
        `✅ Initial data loaded: ${customers.length} customers, ${products.length} products, ${sales.length} sales`,
      );
    } catch (error) {
      console.warn("📱 Using existing local data due to connection issues");
    }
  }

  // Cache data locally with error handling
  cacheData(key: keyof typeof this.CACHE_KEYS, data: any[]): void {
    try {
      const cacheKey = this.CACHE_KEYS[key];
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      console.error("Failed to cache data:", error);
      // Try to clear some space and retry
      this.clearOldCacheData();
      try {
        const cacheKey = this.CACHE_KEYS[key];
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          }),
        );
      } catch (retryError) {
        console.error("Failed to cache data after cleanup:", retryError);
      }
    }
  }

  // Get cached data with fallback
  getCachedData(key: keyof typeof this.CACHE_KEYS): any[] {
    try {
      const cacheKey = this.CACHE_KEYS[key];
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Cache valid for 24 hours in offline mode, 1 hour in online mode
        const maxAge = this.isOnline ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp < maxAge) {
          return parsed.data || [];
        }
      }
    } catch (error) {
      console.error("Failed to get cached data:", error);
    }
    return [];
  }

  // Clear old cache data to free up space
  private clearOldCacheData(): void {
    try {
      const keysToCheck = [
        "cached_old_data",
        "temp_cache",
        "backup_data",
        "analytics_cache",
      ];
      keysToCheck.forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error("Failed to clear old cache:", error);
    }
  }

  // Add operation to queue with error handling
  queueOperation(
    operation: Omit<QueuedOperation, "id" | "timestamp" | "retryCount">,
  ): void {
    try {
      const queuedOp: QueuedOperation = {
        ...operation,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
        processed: false,
      };

      const queue = this.getQueue();
      queue.push(queuedOp);
      this.saveQueue(queue);

      console.log(`📋 Operation queued: ${operation.type} ${operation.table}`);

      // Try to sync immediately if online
      if (this.isOnline) {
        setTimeout(() => this.syncQueuedOperations(), 1000);
      }
    } catch (error) {
      console.error("Failed to queue operation:", error);
    }
  }

  // Get queued operations with error handling
  private getQueue(): QueuedOperation[] {
    try {
      const queue = localStorage.getItem(this.QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error("Failed to get queue:", error);
      return [];
    }
  }

  // Save queue with error handling
  private saveQueue(queue: QueuedOperation[]): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Failed to save queue:", error);
      // Try to save only recent operations
      try {
        const recentQueue = queue.slice(-50); // Keep only last 50 operations
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(recentQueue));
      } catch (retryError) {
        console.error("Failed to save queue after reduction:", retryError);
      }
    }
  }

  // Sync queued operations with comprehensive error handling
  async syncQueuedOperations(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;

    try {
      // أولاً: تنظيف العمليات العالقة والمكررة
      console.log("🧹 تنظيف العمليات العالقة قبل المزامنة...");
      await SyncErrorManager.cleanupStuckOperations();

      const queue = this.getQueue();
      const successfulOps: string[] = [];
      let syncedCount = 0;

      console.log(`🔄 Starting sync of ${queue.length} operations...`);

      for (const operation of queue) {
        // تخطي العمليات في القائمة السوداء
        if (SyncErrorManager.isOperationBlacklisted(operation.id)) {
          console.log(`⚫ تخطي عملية في القائمة السوداء: ${operation.id}`);
          successfulOps.push(operation.id);
          continue;
        }

        if (operation.processed) {
          successfulOps.push(operation.id);
          continue;
        }

        try {
          await this.executeOperation(operation);
          successfulOps.push(operation.id);
          syncedCount++;
          console.log(
            `✅ Synced: ${operation.type} ${operation.table} (${syncedCount}/${queue.length})`,
          );

          // إزالة من القائمة السوداء إذا نجحت
          if (SyncErrorManager.isOperationBlacklisted(operation.id)) {
            SyncErrorManager.removeFromBlacklist(operation.id);
          }
        } catch (error: any) {
          const errorMessage =
            error?.message || error?.toString() || "Unknown error";
          console.error(
            `❌ Failed to sync operation ${operation.id}:`,
            errorMessage,
          );
          operation.retryCount = (operation.retryCount || 0) + 1;

          // إدراج في القائمة السوداء بعد محاولات كثيرة
          if (operation.retryCount >= 3) {
            console.warn(
              `🚫 إدراج العملية في القائمة السوداء بعد ${operation.retryCount} محاولات فاشلة`,
            );
            SyncErrorManager.blacklistOperation(operation.id);
            successfulOps.push(operation.id);
          }
        }
      }

      // Remove successful operations from queue
      const remainingQueue = queue.filter(
        (op) => !successfulOps.includes(op.id),
      );
      this.saveQueue(remainingQueue);

      // Update last sync time
      localStorage.setItem(this.CACHE_KEYS.last_sync, Date.now().toString());

      console.log(
        `🎉 Sync completed: ${syncedCount} operations synced, ${remainingQueue.length} remaining`,
      );
    } catch (error: any) {
      console.error("فشل في عملية المزامنة العامة:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Execute a queued operation with proper error handling
  private async executeOperation(operation: QueuedOperation): Promise<void> {
    try {
      switch (operation.table) {
        case "customers":
          if (operation.type === "create") {
            // Check if customer already exists before creating
            const existingCustomer = await supabaseService.getCustomerByPhone(
              operation.data.phone,
            );
            if (existingCustomer) {
              console.log(
                `✅ Customer with phone ${operation.data.phone} already exists, updating local cache`,
              );

              // Update local cache with Supabase customer
              const cachedCustomers = this.getCachedData("customers");
              const updatedCustomers = cachedCustomers.map((c: Customer) => {
                if (c.phone === operation.data.phone) {
                  return existingCustomer;
                }
                return c;
              });
              this.cacheData("customers", updatedCustomers);

              return; // Skip this operation as customer already exists
            }

            const newCustomer = await supabaseService.createCustomer(
              operation.data,
            );

            // Update local cache with real customer ID
            if (operation.data.tempId) {
              const cachedCustomers = this.getCachedData("customers");
              const updatedCustomers = cachedCustomers.map((c: Customer) => {
                if (c.id === operation.data.tempId) {
                  return newCustomer;
                }
                return c;
              });
              this.cacheData("customers", updatedCustomers);

              // Also update any sales that reference the temp ID
              const cachedSales = this.getCachedData("sales");
              const updatedSales = cachedSales.map((s: Sale) => {
                if (s.customerId === operation.data.tempId) {
                  return { ...s, customerId: newCustomer.id };
                }
                return s;
              });
              this.cacheData("sales", updatedSales);
            }
          } else if (operation.type === "update") {
            await supabaseService.updateCustomer(
              operation.data.id,
              operation.data,
            );
          }
          break;

        case "products":
          if (operation.type === "create") {
            await supabaseService.createProduct(operation.data);
          } else if (operation.type === "update") {
            await supabaseService.updateProduct(
              operation.data.id,
              operation.data,
            );
          }
          break;

        case "sales":
          if (operation.type === "create") {
            // For sales, make sure customer exists first
            let customerId = operation.data.customerId;
            let finalCustomerId = customerId;

            // If customer ID starts with "offline_", it was created offline
            if (customerId && customerId.startsWith("offline_")) {
              console.log(`🔄 Processing offline customer ID: ${customerId}`);

              // Find the customer data in cache
              let customerData = this.getCachedData("customers").find(
                (c: any) => c.id === customerId,
              );

              // إذا لم يوجد في الكاش، محاولة استعادته من العمليات المحفوظة
              if (!customerData) {
                console.warn(
                  `⚠️ Customer not found in cache, attempting recovery: ${customerId}`,
                );

                customerData = await this.recoverMissingCustomer(
                  customerId,
                  operation,
                );

                if (customerData) {
                  // إضافة العميل المستعاد إلى الكاش
                  const cachedCustomers = this.getCachedData("customers");
                  const updatedCustomers = [...cachedCustomers, customerData];
                  this.cacheData("customers", updatedCustomers);
                  console.log(
                    `💾 Recovered customer added to cache: ${customerData.name}`,
                  );
                }
              }

              if (customerData) {
                console.log(
                  `📋 Found customer data for ${customerData.name} (${customerData.phone})`,
                );

                // Check if customer already exists in Supabase
                const existingCustomer =
                  await supabaseService.getCustomerByPhone(customerData.phone);

                if (existingCustomer) {
                  console.log(
                    `✅ Customer already exists in Supabase: ${existingCustomer.id}`,
                  );
                  finalCustomerId = existingCustomer.id;

                  // Update local cache to use real ID
                  const cachedCustomers = this.getCachedData("customers");
                  const updatedCustomers = cachedCustomers.map(
                    (c: Customer) => {
                      if (c.id === customerId) {
                        return { ...c, id: existingCustomer.id };
                      }
                      return c;
                    },
                  );
                  this.cacheData("customers", updatedCustomers);
                } else {
                  // Create the customer first
                  console.log(
                    `🆕 Creating new customer in Supabase: ${customerData.name}`,
                  );
                  const newCustomer = await supabaseService.createCustomer({
                    name: customerData.name,
                    phone: customerData.phone,
                    address: customerData.address,
                    paymentStatus: customerData.paymentStatus || "cash",
                    lastSaleDate:
                      customerData.lastSaleDate || getCurrentDateGregorian(),
                    debtAmount: customerData.debtAmount || 0,
                  });
                  finalCustomerId = newCustomer.id;

                  console.log(
                    `✅ Customer created with ID: ${finalCustomerId}`,
                  );

                  // Update local cache
                  const cachedCustomers = this.getCachedData("customers");
                  const updatedCustomers = cachedCustomers.map(
                    (c: Customer) => {
                      if (c.id === customerId) {
                        return { ...c, id: newCustomer.id };
                      }
                      return c;
                    },
                  );
                  this.cacheData("customers", updatedCustomers);
                }
              } else {
                // كحل أخير، إنشاء عميل ا��تراضي
                console.warn(`⚠️ Creating fallback customer for ${customerId}`);

                const fallbackCustomer = this.createFallbackCustomer(
                  customerId,
                  operation,
                );

                try {
                  const newCustomer =
                    await supabaseService.createCustomer(fallbackCustomer);
                  finalCustomerId = newCustomer.id;

                  // إضافة العميل الافتراضي إلى الكاش
                  const cachedCustomers = this.getCachedData("customers");
                  const updatedCustomers = [
                    ...cachedCustomers,
                    { ...fallbackCustomer, id: newCustomer.id },
                  ];
                  this.cacheData("customers", updatedCustomers);

                  console.log(
                    `✅ Fallback customer created: ${newCustomer.id}`,
                  );
                } catch (fallbackError) {
                  console.error(
                    `❌ Failed to create fallback customer:`,
                    fallbackError,
                  );

                  // تأجيل هذه العملية للمحاولة لاحقاً
                  operation.retryCount = (operation.retryCount || 0) + 1;
                  throw new Error(
                    `فشل في إنشاء عميل بديل للـ ID: ${customerId}`,
                  );
                }
              }
            }

            // Validate final customer ID
            if (!finalCustomerId || finalCustomerId.startsWith("offline_")) {
              throw new Error(
                `Invalid customer ID for sync: ${finalCustomerId}`,
              );
            }

            console.log(
              `🛒 Creating sale with customer ID: ${finalCustomerId}`,
            );
            await supabaseService.createSaleWithCart(
              finalCustomerId,
              operation.data.cartItems,
              operation.data.saleData,
            );
          }
          break;

        case "transactions":
          if (operation.type === "create") {
            await supabaseService.createTransaction(operation.data);
          }
          break;

        default:
          console.warn(`Unknown operation table: ${operation.table}`);
      }
    } catch (error: any) {
      // Handle specific errors
      if (error.message && error.message.includes("موجود مسبقاً")) {
        console.log(
          `ℹ️ Skipping duplicate customer operation: ${error.message}`,
        );
        return; // Don't throw, just skip this operation
      }

      // Handle network and connection errors
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError") ||
        error.name === "TypeError" ||
        !navigator.onLine
      ) {
        console.log(
          `🌐 Network error during sync, operation will be retried: ${error.message}`,
        );
        throw error; // Re-throw to retry later
      }

      // Handle constraint violation errors
      if (
        error.message &&
        error.message.includes("violates not-null constraint")
      ) {
        console.log(
          `🗑️ Skipping operation with constraint violation: ${error.message}`,
        );
        return; // Don't throw, just skip this operation
      }

      // Handle old schema errors
      if (error.message && error.message.includes("product_name")) {
        console.log(
          `🔧 Skipping operation with old schema structure: ${error.message}`,
        );
        return; // Don't throw, just skip this operation
      }

      // Handle foreign key constraint errors
      if (error.message && error.message.includes("foreign key constraint")) {
        console.log(
          `🔑 Skipping operation with foreign key error: ${error.message}`,
        );
        return; // Don't throw, just skip this operation
      }

      // Handle Supabase configuration errors
      if (error.message?.includes("Supabase غير مُكوّن")) {
        console.log(`⚙️ Supabase not configured, skipping sync operation`);
        return; // Don't throw, just skip this operation
      }

      // Handle UUID format errors for offline IDs
      if (
        error.message?.includes("invalid input syntax for type uuid") &&
        error.message?.includes("offline_")
      ) {
        console.log(
          `🆔 UUID format error with offline ID, skipping operation: ${error.message}`,
        );
        return; // Don't throw, just skip this operation
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Offline-first data fetching with guaranteed response
  async getCustomers(): Promise<Customer[]> {
    // Always try cached first for immediate response
    let cachedCustomers = this.getCachedData("customers");

    if (this.isOnline) {
      try {
        const onlineCustomers = await supabaseService.getCustomers();

        // Merge online customers with any offline-only customers
        const offlineOnlyCustomers = cachedCustomers.filter(
          (c: Customer) =>
            c.id.startsWith("offline_") &&
            !onlineCustomers.find((oc: Customer) => oc.phone === c.phone),
        );

        const mergedCustomers = [...onlineCustomers, ...offlineOnlyCustomers];

        // Sort customers by creation date (newest first)
        mergedCustomers.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        this.cacheData("customers", mergedCustomers);
        return mergedCustomers;
      } catch (error) {
        // Silently fall back to cached data - don't spam console
        if (!error.message?.includes("وضع أوف لاين")) {
          console.warn("Using cached customers due to Supabase error");
        }
      }
    }

    // Return cached data or empty array - no fake data
    console.log(
      `📱 Customers loaded from cache: ${cachedCustomers.length} items`,
    );
    return cachedCustomers;
  }

  async getProducts(): Promise<Product[]> {
    // Always load from Supabase first, fallback to cache only if needed
    if (this.isOnline) {
      try {
        const onlineProducts = await supabaseService.getProducts();
        this.cacheData("products", onlineProducts);
        console.log(
          `📦 Products loaded from database: ${onlineProducts.length} items`,
        );
        return onlineProducts;
      } catch (error: any) {
        console.warn("Failed to load products from database:", {
          message: error?.message || "Unknown error",
          code: error?.code || "NO_CODE",
        });
      }
    }

    // Only use cache as last resort - no default fake data
    const cachedProducts = this.getCachedData("products");
    if (cachedProducts.length === 0) {
      console.warn("⚠️ No products available in database or cache");
      return [];
    }

    console.log(
      `📱 Products loaded from cache: ${cachedProducts.length} items`,
    );
    return cachedProducts;
  }
  async getCustomers(): Promise<Customer[]> {
    // Always load from Supabase first, fallback to cache only if needed
    if (this.isOnline) {
      try {
        const onlineCustomers = await supabaseService.getCustomers();
        this.cacheData("customers", onlineCustomers);
        console.log(
          `👥 Customers loaded from database: ${onlineCustomers.length} items`,
        );
        return onlineCustomers;
      } catch (error: any) {
        console.warn("Failed to load customers from database:", {
          message: error?.message || "Unknown error",
          code: error?.code || "NO_CODE",
        });
      }
    }

    // Only use cache as last resort - no default fake data
    const cachedCustomers = this.getCachedData("customers");
    if (cachedCustomers.length === 0) {
      console.warn("⚠️ No customers available in database or cache");
      return [];
    }

    console.log(
      `📱 Customers loaded from cache: ${cachedCustomers.length} items`,
    );
    return cachedCustomers;
  }

  async getSales(): Promise<Sale[]> {
    // Always return cached data first for instant response
    let cachedSales = this.getCachedData("sales");

    // Update in background if online - don't wait for it
    if (this.isOnline) {
      setTimeout(async () => {
        try {
          const onlineSales = await supabaseService.getSales();
          this.cacheData("sales", onlineSales);
          console.log(
            `🔄 Sales updated in background: ${onlineSales.length} items`,
          );
        } catch (error: any) {
          console.warn("Background sales update failed:", {
            message: error?.message || "Unknown error",
            code: error?.code || "NO_CODE",
          });
        }
      }, 75);
    }

    return cachedSales.length > 0 ? cachedSales : [];
  }

  // Offline-first operations with immediate local updates
  async createCustomerOffline(
    customer: Omit<Customer, "id" | "sales">,
  ): Promise<Customer> {
    const cachedCustomers = this.getCachedData("customers");

    // Check for duplicate phone numbers in cache
    const existingCustomer = cachedCustomers.find(
      (c: Customer) => c.phone === customer.phone,
    );

    if (existingCustomer) {
      console.log(
        `⚠️ Customer with phone ${customer.phone} already exists in cache`,
      );
      return existingCustomer;
    }

    // If online, also check Supabase for duplicates
    if (this.isOnline) {
      try {
        const supabaseCustomer = await supabaseService.getCustomerByPhone(
          customer.phone,
        );
        if (supabaseCustomer) {
          console.log(
            `⚠️ Customer with phone ${customer.phone} already exists in Supabase`,
          );
          // Add to local cache and return
          const updatedCustomers = [...cachedCustomers, supabaseCustomer];
          this.cacheData("customers", updatedCustomers);
          return supabaseCustomer;
        }
      } catch (error) {
        console.warn("Could not check Supabase for existing customer:", error);
      }
    }

    const newCustomer: Customer = {
      ...customer,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sales: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to cache immediately
    const updatedCustomers = [...cachedCustomers, newCustomer];
    this.cacheData("customers", updatedCustomers);

    console.log(
      `✅ Created new customer: ${newCustomer.name} (${newCustomer.phone})`,
    );

    // Queue for sync with comprehensive customer data
    this.queueOperation({
      type: "create",
      table: "customers",
      data: {
        ...customer,
        tempId: newCustomer.id, // Include temp ID for mapping
        id: newCustomer.id, // Also include as id for easier lookup
        // Include all customer data for recovery
        customerInfo: {
          ...customer,
          id: newCustomer.id,
        },
      },
    });

    return newCustomer;
  }

  async createSaleOffline(
    customerId: string,
    cartItems: CartItem[],
    saleData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
      notes?: string;
    },
  ): Promise<Sale> {
    // Validate customer exists
    const cachedCustomers = this.getCachedData("customers");
    const customer = cachedCustomers.find((c: Customer) => c.id === customerId);

    if (!customer) {
      throw new Error(`Customer not found with ID: ${customerId}`);
    }

    console.log(
      `🛒 Creating offline sale for customer: ${customer.name} (${customer.phone})`,
    );

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const profitAmount = cartItems.reduce(
      (sum, item) =>
        sum + (item.unitPrice - item.product.wholesalePrice) * item.quantity,
      0,
    );
    const remainingAmount =
      saleData.paymentType === "cash" ? 0 : totalAmount - saleData.paidAmount;

    const newSale: Sale = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      saleDate: getCurrentDateGregorian(),
      totalAmount,
      paymentType: saleData.paymentType,
      paidAmount: saleData.paidAmount,
      remainingAmount,
      paymentDate:
        saleData.paymentType === "cash" ? getCurrentDateGregorian() : undefined,
      profitAmount,
      notes: saleData.notes || "",
      items: cartItems.map((item, index) => ({
        id: `offline_item_${Date.now()}_${index}`,
        saleId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalPrice,
        profitAmount:
          (item.unitPrice - item.product.wholesalePrice) * item.quantity,
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to cache immediately
    const cachedSales = this.getCachedData("sales");
    const updatedSales = [newSale, ...cachedSales];
    this.cacheData("sales", updatedSales);

    // Update product quantities in cache
    const cachedProducts = this.getCachedData("products");
    const updatedProducts = cachedProducts.map((product) => {
      const cartItem = cartItems.find((item) => item.product.id === product.id);
      if (cartItem) {
        const newQuantity = product.quantity - cartItem.quantity;
        console.log(
          `📦 Updating product ${product.name}: ${product.quantity} → ${newQuantity} (-${cartItem.quantity})`,
        );

        if (newQuantity < 0) {
          console.warn(
            `⚠️ Product ${product.name} will have negative quantity: ${newQuantity}`,
          );
        }

        return {
          ...product,
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        };
      }
      return product;
    });

    this.cacheData("products", updatedProducts);
    console.log(`✅ Updated ${cartItems.length} product quantities in cache`);

    // Update customer debt in cache
    const updatedCustomers = cachedCustomers.map((customer) => {
      if (customer.id === customerId) {
        return {
          ...customer,
          lastSaleDate: getCurrentDateGregorian(),
          debtAmount: (customer.debtAmount || 0) + remainingAmount,
        };
      }
      return customer;
    });
    this.cacheData("customers", updatedCustomers);

    // Get customer data for reference
    const customerData = cachedCustomers.find((c) => c.id === customerId);

    // Queue for sync with customer information for recovery
    this.queueOperation({
      type: "create",
      table: "sales",
      data: {
        customerId,
        cartItems,
        saleData,
        // Include customer info for offline recovery
        customerInfo: customerData
          ? {
              id: customerData.id,
              name: customerData.name,
              phone: customerData.phone,
              address: customerData.address,
              paymentStatus: customerData.paymentStatus,
              debtAmount: customerData.debtAmount,
            }
          : null,
        // Additional metadata for debugging
        timestamp: Date.now(),
        originalCustomerId: customerId,
      },
    });

    return newSale;
  }

  // Check connectivity and queue status
  getStatus() {
    const queue = this.getQueue();
    const lastSync = localStorage.getItem(this.CACHE_KEYS.last_sync);

    return {
      isOnline: this.isOnline,
      queuedOperations: queue.length,
      syncInProgress: this.syncInProgress,
      lastSync: lastSync
        ? new Date(parseInt(lastSync)).toLocaleString("en-GB")
        : "Never",
      cacheStatus: {
        customers: this.getCachedData("customers").length,
        products: this.getCachedData("products").length,
        sales: this.getCachedData("sales").length,
      },
    };
  }

  // Clean duplicate operations from queue
  cleanDuplicateOperations(): void {
    try {
      const queue = this.getQueue();
      const seenOperations = new Set<string>();
      const cleanedQueue: QueuedOperation[] = [];

      for (const operation of queue) {
        // Create a unique key for each operation
        const operationKey = `${operation.type}_${operation.table}_${JSON.stringify(operation.data)}`;

        if (!seenOperations.has(operationKey)) {
          seenOperations.add(operationKey);
          cleanedQueue.push(operation);
        } else {
          console.log(
            `🧹 Removed duplicate operation: ${operation.type} ${operation.table}`,
          );
        }
      }

      this.saveQueue(cleanedQueue);
      console.log(
        `🧹 Cleaned queue: ${queue.length - cleanedQueue.length} duplicates removed`,
      );
    } catch (error) {
      console.error("Failed to clean duplicate operations:", error);
    }
  }

  // Clear all cached data (useful for fresh start)
  clearCache(): void {
    Object.values(this.CACHE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem(this.QUEUE_KEY);
    console.log("🗑️ All cache data cleared");
  }

  // Get queued operations for debugging/fixing
  getQueuedOperations(): QueuedOperation[] {
    return this.getQueue();
  }

  // Remove specific operation from queue
  removeOperationFromQueue(operationId: string): boolean {
    try {
      const queue = this.getQueue();
      const initialLength = queue.length;
      const filteredQueue = queue.filter((op) => op.id !== operationId);

      if (filteredQueue.length < initialLength) {
        this.saveQueue(filteredQueue);
        console.log(`🗑️ تم حذف العملية من الطابور: ${operationId}`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("فشل في حذ�� العملية من الطابور:", error);
      return false;
    }
  }

  // Clear all operations from queue
  clearQueue(): void {
    try {
      this.saveQueue([]);
      console.log("🗑️ تم تنظيف جميع العمليات من الطابور");
    } catch (error: any) {
      console.error("فشل في تنظيف الطابور:", error);
    }
  }

  // Reset sync state
  resetSyncState(): void {
    this.syncInProgress = false;
    this.initialized = false;
  }

  // Force immediate sync
  async forceSync(): Promise<void> {
    if (this.isOnline) {
      await this.syncQueuedOperations();
      await this.initialDataLoad();
    }
  }

  // تحديث بيانات عميل محدد في الكاش
  async refreshCustomerInCache(customer: Customer): Promise<void> {
    try {
      const cachedCustomers = this.getCachedData("customers");
      const updatedCustomers = cachedCustomers.map((c: Customer) => {
        if (c.id === customer.id || c.phone === customer.phone) {
          return { ...customer };
        }
        return c;
      });

      // إضافة العميل إذا لم يكن موجوداً
      const customerExists = updatedCustomers.some(
        (c: Customer) => c.id === customer.id,
      );
      if (!customerExists) {
        updatedCustomers.push(customer);
      }

      this.cacheData("customers", updatedCustomers);
      console.log(`✅ تم تحديث بيانات العميل في الكاش: ${customer.name}`);
    } catch (error: any) {
      console.error("فشل في تحديث بيانات العميل في الكاش:", error);
    }
  }

  // استعادة عميل مفقود من العمليات المحفوظة
  private async recoverMissingCustomer(
    offlineId: string,
    currentOperation?: any,
  ): Promise<any | null> {
    try {
      console.log(`🔍 Attempting to recover customer: ${offlineId}`);

      // 1. البحث في العمليات عن بيان��ت العميل
      const queue = this.getQueue();
      let customerData: any = null;

      // البحث في عمليات إنشاء العملاء
      const customerCreationOp = queue.find(
        (op) =>
          op.table === "customers" &&
          op.type === "create" &&
          (op.data.tempId === offlineId || op.data.id === offlineId),
      );

      if (customerCreationOp) {
        customerData = customerCreationOp.data;
        console.log(`📋 Found customer creation operation for ${offlineId}`);
      } else {
        // البحث في العملية الحالية عن معلومات العميل
        if (currentOperation && currentOperation.data.customerInfo) {
          customerData = currentOperation.data.customerInfo;
          console.log(`📊 Found customer info in current operation`);
        } else {
          // البحث في عمليات المبيعات عن أي معلومات عن العميل
          const salesOps = queue.filter(
            (op) =>
              op.table === "sales" &&
              op.data.customerId === offlineId &&
              (op.data.customerInfo || op.data.customerData),
          );

          if (salesOps.length > 0) {
            const latestSale = salesOps[salesOps.length - 1];
            customerData =
              latestSale.data.customerInfo || latestSale.data.customerData;
            console.log(`📊 Found customer info from sales operation`);
          }
        }
      }

      if (!customerData) {
        console.warn(`⚠️ No customer data found for ${offlineId}`);
        return null;
      }

      // 2. إنشاء كائن العميل المستعاد
      const recoveredCustomer = {
        id: offlineId,
        name: customerData.name || "عميل مستعاد",
        phone: customerData.phone || "غير محدد",
        address: customerData.address || "غير محدد",
        paymentStatus: customerData.paymentStatus || "cash",
        lastSaleDate: customerData.lastSaleDate || getCurrentDateGregorian(),
        debtAmount: customerData.debtAmount || 0,
        sales: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log(
        `✅ Recovered customer: ${recoveredCustomer.name} (${recoveredCustomer.phone})`,
      );
      return recoveredCustomer;
    } catch (error) {
      console.error(`❌ Error recovering customer ${offlineId}:`, error);
      return null;
    }
  }

  // إنشاء عميل افتراضي كحل أخير
  private createFallbackCustomer(offlineId: string, operation?: any): any {
    const timestamp = offlineId.split("_")[1] || Date.now().toString();
    const shortId = offlineId.slice(-8);

    // محاولة استخراج معلومات من العملية
    const fallbackData =
      operation?.data?.customerInfo || operation?.data?.customerData || {};

    return {
      name: fallbackData.name || `عميل ${shortId}`,
      phone: fallbackData.phone || `temp_${timestamp}`,
      address: fallbackData.address || "عنوان مؤقت",
      paymentStatus: fallbackData.paymentStatus || "cash",
      lastSaleDate: fallbackData.lastSaleDate || getCurrentDateGregorian(),
      debtAmount: fallbackData.debtAmount || 0,
    };
  }

  // تنظيف العمليات التالفة
  async cleanupFailedOperations(): Promise<number> {
    try {
      const queue = this.getQueue();
      const maxRetries = 10;
      let cleanedCount = 0;

      // إزالة العمليات التي فشلت أكثر من الحد المسموح
      const validOperations = queue.filter((op) => {
        if (op.retryCount > maxRetries) {
          console.warn(
            `🗑️ Removing operation after ${op.retryCount} retries: ${op.id}`,
          );
          cleanedCount++;
          return false;
        }
        return true;
      });

      // إضافة معلومات العميل للعمليات التي تفتقرها
      const enrichedOperations = validOperations.map((op) => {
        if (
          op.table === "sales" &&
          op.data.customerId &&
          op.data.customerId.startsWith("offline_") &&
          !op.data.customerInfo
        ) {
          // محاولة العثور على معلومات العميل من عمليات أخرى
          const customerOp = queue.find(
            (otherOp) =>
              otherOp.table === "customers" &&
              (otherOp.data.tempId === op.data.customerId ||
                otherOp.data.id === op.data.customerId),
          );

          if (customerOp) {
            op.data.customerInfo = customerOp.data;
            console.log(`🔧 Enriched operation ${op.id} with customer info`);
          }
        }
        return op;
      });

      // حفظ الطابور المحسن
      this.saveQueue(enrichedOperations);

      console.log(`🧹 Cleaned up ${cleanedCount} failed operations`);
      return cleanedCount;
    } catch (error) {
      console.error("❌ Error cleaning up operations:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();
