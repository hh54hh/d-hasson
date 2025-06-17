import { supabase, isSupabaseConfigured } from "./supabase";
import {
  Customer,
  Product,
  Sale,
  SaleItem,
  CartItem,
  DebtPayment,
  Transaction,
  FullReport,
  getCurrentDateGregorian,
} from "./types";
import {
  handleSupabaseError,
  isRelationshipError,
  safeSupabaseOperation,
} from "./supabaseErrorHandler";
import { OfflineModeHandler } from "./offlineModeHandler";
import { logError, formatError, createErrorInfo } from "./utils";
import { logEnhancedError, getArabicErrorMessage } from "./errorHandler";
import { ConnectionManager } from "./connectionManager";
import { ConnectionThrottler } from "./connectionThrottler";
import { offlineManager } from "./offlineManager";

// Enhanced Supabase service with full cart integration
export class SupabaseService {
  private static instance: SupabaseService;

  // Export supabase client for direct access when needed
  get supabase() {
    return supabase;
  }

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private async ensureConnection() {
    try {
      // استخدام مدير الاتصال المحسن
      await ConnectionManager.ensureConnectionWithRetry();
      OfflineModeHandler.recordAttempt(true);
    } catch (connectionError: any) {
      OfflineModeHandler.recordAttempt(false);

      // تسجيل الخطأ مع تفاصيل إضافية
      logError("فشل في ضمان الاتصال:", connectionError, {
        operation: "ensure_connection",
        connectionStatus: ConnectionManager.getConnectionStatus(),
      });

      throw connectionError;
    }
  }

  // Check if sale_items table and relationships exist
  async checkSchemaHealth(): Promise<{
    healthy: boolean;
    missingTable: boolean;
    missingRelations: boolean;
  }> {
    try {
      await this.ensureConnection();

      // Check if sale_items table exists
      const { data, error } = await supabase!
        .from("sale_items")
        .select("id")
        .limit(1);

      if (error) {
        console.warn("Schema health check failed:", error);

        // Check if it's a missing table error
        if (error.code === "42P01") {
          return {
            healthy: false,
            missingTable: true,
            missingRelations: false,
          };
        }

        // Check if it's a relationship error
        if (error.code === "PGRST200") {
          return {
            healthy: false,
            missingTable: false,
            missingRelations: true,
          };
        }

        return { healthy: false, missingTable: false, missingRelations: false };
      }

      // Table exists, now check relationships by trying a join
      const { error: relationError } = await supabase!
        .from("sales")
        .select("id, sale_items(id)")
        .limit(1);

      if (relationError && relationError.code === "PGRST200") {
        return { healthy: false, missingTable: false, missingRelations: true };
      }

      return { healthy: true, missingTable: false, missingRelations: false };
    } catch (error) {
      console.warn("Schema health check failed:", error);
      return { healthy: false, missingTable: false, missingRelations: false };
    }
  }

  // ============ PHONE VALIDATION ============
  async checkPhoneExists(phone: string, excludeId?: string): Promise<boolean> {
    await this.ensureConnection();

    let query = supabase!.from("customers").select("id").eq("phone", phone);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data?.length || 0) > 0;
  }

  // ============ GET CUSTOMER BY PHONE ============
  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    try {
      await this.ensureConnection();
    } catch (connectionError) {
      console.warn("Connection failed for getCustomerByPhone, returning null");
      return null; // Return null instead of throwing when offline
    }

    try {
      const { data, error } = await supabase!
        .from("customers")
        .select("*")
        .eq("phone", phone)
        .single();

      if (error) {
        // If no customer found, return null instead of throwing
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Try to get sales, but don't fail if it doesn't work
      let sales = [];
      try {
        sales = await this.getSalesByCustomerId(data.id);
      } catch (salesError) {
        console.warn("Failed to load customer sales:", salesError);
        // Continue without sales data
      }

      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        address: data.address,
        paymentStatus: data.payment_status,
        registrationDate: data.registration_date,
        lastSaleDate: data.last_sale_date,
        debtAmount: data.debt_amount || 0,
        debtPaidDate: data.debt_paid_date,
        sales: sales || [],
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (queryError: any) {
      logError("خطأ في البحث عن العميل بالهاتف:", queryError, {
        phone: phone,
        operation: "get_customer_by_phone",
      });
      return null; // Return null for any unexpected errors
    }
  }

  // ============ ENHANCED CUSTOMER BY ID ============
  async getCustomerById(id: string): Promise<Customer | null> {
    try {
      await this.ensureConnection();
    } catch (connectionError: any) {
      logError("فشل الاتصال في getCustomerById:", connectionError, {
        customerId: id,
        operation: "get_customer_by_id_connection",
      });

      // محاولة البحث في الكاش المحلي
      try {
        const offlineCustomers = await offlineManager.getCustomers();
        const customer = offlineCustomers.find((c: Customer) => c.id === id);
        if (customer) {
          console.log(
            `📱 تم العثور على العميل في الكاش المحلي: ${customer.name}`,
          );
          return customer;
        }
      } catch (offlineError: any) {
        logError("فشل في البحث في الك��ش المحلي:", offlineError, {
          customerId: id,
          operation: "get_customer_offline_fallback",
        });
      }

      return null; // بدلاً من رمي خطأ، نعيد null
    }

    try {
      const { data, error } = await supabase!
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        logError("خطأ في استعلام العميل:", error, {
          customerId: id,
          operation: "get_customer_by_id_query",
        });
        return null;
      }

      if (!data) {
        console.log(`⚠️ العميل غير موجود في قاعدة البيانات: ${id}`);
        return null;
      }

      // Try to get sales, but don't fail if it doesn't work
      let sales = [];
      try {
        sales = await this.getSalesByCustomerId(data.id);
      } catch (salesError) {
        console.warn("Failed to load customer sales:", salesError);
        // Continue without sales data
      }

      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        address: data.address,
        paymentStatus: data.payment_status,
        registrationDate: data.registration_date,
        lastSaleDate: data.last_sale_date,
        debtAmount: data.debt_amount || 0,
        debtPaidDate: data.debt_paid_date,
        sales: sales || [],
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (queryError: any) {
      logError("خطأ عام في getCustomerById:", queryError, {
        customerId: id,
        operation: "get_customer_by_id_general",
      });
      return null;
    }
  }

  // Execute critical operations with fallback to bypass
  private async executeCritical<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      // جرب التنفيذ العادي أولاً
      return await ConnectionThrottler.executeThrottled(
        operationName,
        operation,
      );
    } catch (error: any) {
      // إذا فشل بسبب timeout، جرب الـ bypass
      if (error.message?.includes("timed out waiting for throttle clearance")) {
        console.warn(`⚠️ Throttle timeout for ${operationName}, trying bypass`);
        return await ConnectionThrottler.executeBypass(
          operationName,
          operation,
        );
      }
      throw error;
    }
  }

  // ============ GET CUSTOMERS ============
  async getCustomers(): Promise<Customer[]> {
    return this.executeCritical("getCustomers", async () => {
      await this.ensureConnection();

      const { data: customers, error } = await supabase!
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const customersWithSales = await Promise.all(
        (customers || []).map(async (customer) => {
          const sales = await this.getSalesByCustomerId(customer.id);
          return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            paymentStatus: customer.payment_status,
            lastSaleDate: customer.last_sale_date,
            debtAmount: customer.debt_amount || 0,
            debtPaidDate: customer.debt_paid_date,
            sales: sales || [],
            created_at: customer.created_at,
            updated_at: customer.updated_at,
          };
        }),
      );

      return customersWithSales;
    });
  }

  async createCustomer(
    customerData: Omit<Customer, "id" | "sales" | "created_at" | "updated_at">,
  ): Promise<Customer> {
    await this.ensureConnection();

    // Check if phone already exists
    const phoneExists = await this.checkPhoneExists(customerData.phone);
    if (phoneExists) {
      throw new Error(`رقم الهاتف ${customerData.phone} موجود مسبقاً`);
    }

    const { data, error } = await supabase!
      .from("customers")
      .insert([
        {
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          payment_status: customerData.paymentStatus,
          last_sale_date:
            customerData.lastSaleDate || getCurrentDateGregorian(),
          debt_amount: customerData.debtAmount || 0,
          debt_paid_date: customerData.debtPaidDate,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        throw new Error(`رقم الهاتف ${customerData.phone} موجود مسبقاً`);
      }
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      paymentStatus: data.payment_status,
      lastSaleDate: data.last_sale_date,
      debtAmount: data.debt_amount || 0,
      debtPaidDate: data.debt_paid_date,
      sales: [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async updateCustomer(
    id: string,
    updates: Partial<Customer>,
  ): Promise<Customer> {
    await this.ensureConnection();

    // Check phone uniqueness if phone is being updated
    if (updates.phone) {
      const phoneExists = await this.checkPhoneExists(updates.phone, id);
      if (phoneExists) {
        throw new Error(`رقم الهاتف ${updates.phone} موجود مسبقاً`);
      }
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.phone) updateData.phone = updates.phone;
    if (updates.address) updateData.address = updates.address;
    if (updates.paymentStatus)
      updateData.payment_status = updates.paymentStatus;
    if (updates.lastSaleDate) updateData.last_sale_date = updates.lastSaleDate;
    if (updates.debtAmount !== undefined)
      updateData.debt_amount = updates.debtAmount;
    if (updates.debtPaidDate) updateData.debt_paid_date = updates.debtPaidDate;

    const { data, error } = await supabase!
      .from("customers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        throw new Error(`رقم الهاتف ${updates.phone} موجود مسبقاً`);
      }
      throw error;
    }

    const sales = await this.getSalesByCustomerId(id);

    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      paymentStatus: data.payment_status,
      lastSaleDate: data.last_sale_date,
      debtAmount: data.debt_amount || 0,
      debtPaidDate: data.debt_paid_date,
      sales: sales || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      await this.ensureConnection();

      const { error } = await supabase!.from("customers").delete().eq("id", id);

      if (error) throw error;
    } catch (connectionError: any) {
      // If connection fails, we should still allow offline deletion for better UX
      if (
        connectionError.message?.includes("أوف لاين") ||
        connectionError.message?.includes("offline")
      ) {
        // Queue deletion for when connection is restored
        console.warn(
          "⚠️ Cannot delete customer online, queuing for later sync:",
          id,
        );

        // For now, we'll throw a more user-friendly error
        throw new Error(
          "لا يمكن حذف العميل حالياً بسبب عدم توفر الإنترنت. سيتم المحاولة عند استعادة الاتصال.",
        );
      } else {
        // Re-throw other connection errors
        throw connectionError;
      }
    }
  }

  // ============ PRODUCTS ============
  async getProducts(): Promise<Product[]> {
    return this.executeCritical("getProducts", async () => {
      // أولاً: فحص حالة الشبكة
      if (!navigator.onLine) {
        console.log("🌐 لا يوجد اتصال بالإنترنت - استخدام الكاش المحلي");
        return this.getProductsFromCache();
      }

      try {
        // محاولة الاتصال مع معالجة محسنة للأخطاء
        await this.ensureConnection();
      } catch (connectionError: any) {
        console.warn(
          "⚠️ فشل في التحقق من الاتصال:",
          formatError(connectionError),
        );
        return this.getProductsFromCache();
      }

      try {
        console.log("📦 محاولة جلب المنتجات من Supabase...");

        // إضافة timeout إضافي للاستعلام
        const queryPromise = supabase!
          .from("products")
          .select("*")
          .order("name");

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Query timeout")), 10000),
        );

        const { data, error } = (await Promise.race([
          queryPromise,
          timeoutPromise,
        ])) as any;

        if (error) {
          // استخدام معالج الأخطاء المحسن
          const errorInfo = logEnhancedError("خطأ في استعلام المنتجات", error, {
            operation: "get_products_query",
            table: "products",
          });

          const arabicMessage = getArabicErrorMessage(error);
          console.warn(`⚠️ ${arabicMessage} - التراجع للكاش المحلي`);

          return this.getProductsFromCache();
        }

        if (!data || data.length === 0) {
          console.warn("⚠️ لم يتم إرجاع أي منتجات من قاعدة البيانات");
          return this.getProductsFromCache();
        }

        // تحويل البيانات
        const products = data.map((product) => ({
          id: product.id,
          name: product.name,
          wholesalePrice: product.wholesale_price,
          salePrice: product.sale_price,
          quantity: product.quantity,
          minQuantity: product.min_quantity,
          created_at: product.created_at,
          updated_at: product.updated_at,
        }));

        // تخزين ناجح في الكاش
        await this.cacheProducts(products);

        console.log(`✅ تم جلب ${products.length} منتج من Supabase بنجاح`);
        return products;
      } catch (queryError: any) {
        // تحليل وتصنيف الخطأ
        const errorType = this.categorizeNetworkError(queryError);

        console.error("خطأ عام في getProducts:", formatError(queryError));
        logError("خطأ عام في getProducts:", queryError, {
          operation: "get_products_general",
          errorType,
          isOnline: navigator.onLine,
          userAgent: navigator.userAgent,
        });

        console.warn(`⚠️ ${errorType} - التراجع للكاش المحلي`);
        return this.getProductsFromCache();
      }
    });
  }

  /**
   * الحصول على المنتجات من الكاش المحلي
   */
  private async getProductsFromCache(): Promise<Product[]> {
    try {
      if (offlineManager && typeof offlineManager.getProducts === "function") {
        const offlineProducts = await offlineManager.getProducts();
        if (offlineProducts && offlineProducts.length > 0) {
          console.log(
            `📱 تم الحصول على ${offlineProducts.length} منتج من الكاش المحلي`,
          );
          return offlineProducts;
        }
      }

      // إذا لم يوجد كاش، أرجع قائمة فارغة مع رسالة واضحة
      console.warn("⚠️ لا توجد منتجات في الكاش المحلي");
      return [];
    } catch (cacheError: any) {
      logError("فشل في جلب ��لمنتجات من الكاش:", cacheError, {
        operation: "get_products_cache_fallback",
      });
      return [];
    }
  }

  /**
   * تخزين المنتجات في الكاش
   */
  private async cacheProducts(products: Product[]): Promise<void> {
    try {
      if (offlineManager && typeof offlineManager.cacheData === "function") {
        await offlineManager.cacheData("products", products);
        console.log("💾 تم تخزين المنتجات في الكاش بنجاح");
      }
    } catch (cacheError: any) {
      console.warn("تعذر تخزين المنتجات في الكاش:", formatError(cacheError));
    }
  }

  /**
   * تصنيف أخطاء Supabase
   */
  private categorizeSupabaseError(error: any): string {
    const errorCode = error?.code;
    const errorMessage = error?.message?.toLowerCase() || "";

    if (errorCode === "PGRST116") return "لا توجد نتائج";
    if (errorCode === "42P01") return "جدول المنتجات مفقود";
    if (errorCode === "42501") return "صلاحيات غير كافية";
    if (errorMessage.includes("timeout")) return "انتهت مهلة ا��استعلام";
    if (errorMessage.includes("connection"))
      return "مشكلة في الاتصال بقاعدة البيانات";

    return "خطأ غير معروف في قاعدة البيانات";
  }

  /**
   * تصنيف أخطاء ��لشبكة
   */
  private categorizeNetworkError(error: any): string {
    const errorMessage = error?.message?.toLowerCase() || "";
    const errorName = error?.name?.toLowerCase() || "";

    if (errorMessage.includes("failed to fetch")) {
      return "فشل في الوصول للخادم - تحقق من الاتصال بالإنترنت";
    }

    if (
      errorMessage.includes("network error") ||
      errorMessage.includes("networkerror")
    ) {
      return "خطأ في الشبكة - تحقق من اتصال الإنترنت";
    }

    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("query timeout")
    ) {
      return "انتهت مهلة الاتصال - الشبكة بطيئة";
    }

    if (errorMessage.includes("cors")) {
      return "مشكلة في إعدادات CORS";
    }

    if (errorName.includes("aborterror")) {
      return "تم إلغاء الطلب";
    }

    if (!navigator.onLine) {
      return "لا يوجد اتصال بالإنترنت";
    }

    return `خطأ شبكة غير متوقع: ${errorMessage}`;
  }

  async createProduct(
    productData: Omit<Product, "id" | "created_at" | "updated_at">,
  ): Promise<Product> {
    await this.ensureConnection();

    const { data, error } = await supabase!
      .from("products")
      .insert([
        {
          name: productData.name,
          wholesale_price: productData.wholesalePrice,
          sale_price: productData.salePrice,
          quantity: productData.quantity,
          min_quantity: productData.minQuantity,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      wholesalePrice: data.wholesale_price,
      salePrice: data.sale_price,
      quantity: data.quantity,
      minQuantity: data.min_quantity,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    await this.ensureConnection();

    // تحضير البيانات للتحديث
    const updateData: any = {};

    // تحديث الحقول العادية
    if (updates.name) updateData.name = updates.name;
    if (updates.wholesalePrice !== undefined)
      updateData.wholesale_price = updates.wholesalePrice;
    if (updates.salePrice !== undefined)
      updateData.sale_price = updates.salePrice;
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    if (updates.minQuantity !== undefined)
      updateData.min_quantity = updates.minQuantity;

    // التعامل مع حقول التوقيت (من نظام التشخيص)
    if (updates.updated_at) updateData.updated_at = updates.updated_at;

    // تحديث الوقت الحالي إذا لم يتم تحديده صراحة
    if (!updateData.updated_at) {
      updateData.updated_at = new Date().toISOString();
    }

    try {
      // تأكد من وجود المنتج أولاً
      const { data: existingProduct, error: checkError } = await supabase!
        .from("products")
        .select("id")
        .eq("id", id)
        .single();

      if (checkError || !existingProduct) {
        throw new Error(`لا يمكن العثور على المنتج بالمعرف: ${id}`);
      }

      // تنفيذ التحديث
      const { data, error } = await supabase!
        .from("products")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logError("خطأ في تحديث المنتج:", error, {
          productId: id,
          updateData,
          operation: "update_product",
        });
        throw error;
      }

      if (!data) {
        throw new Error("لم يتم إرجاع بيانات بعد التحديث");
      }

      return {
        id: data.id,
        name: data.name,
        wholesalePrice: data.wholesale_price,
        salePrice: data.sale_price,
        quantity: data.quantity,
        minQuantity: data.min_quantity,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (updateError: any) {
      logError("فشل في تحديث المنتج:", updateError, {
        productId: id,
        updates,
        operation: "update_product_general",
      });
      throw updateError;
    }
  }

  async deleteProduct(id: string): Promise<void> {
    await this.ensureConnection();

    const { error } = await supabase!.from("products").delete().eq("id", id);

    if (error) throw error;
  }

  // ============ ENHANCED CART SALE CREATION WITH PROPER INVENTORY MANAGEMENT ============
  async createSaleWithCart(
    customerId: string,
    cartItems: CartItem[],
    saleData: {
      paymentType: "cash" | "deferred" | "partial";
      paidAmount: number;
      notes?: string;
    },
  ): Promise<Sale> {
    console.log("🛒 Creating sale with cart:", {
      customerId,
      cartItems,
      saleData,
    });

    if (!cartItems || cartItems.length === 0) {
      throw new Error("لا يمكن إنشاء بيعة بدون منتجات");
    }

    await this.ensureConnection();

    // Calculate totals
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const profitAmount = cartItems.reduce(
      (sum, item) =>
        sum + (item.unitPrice - item.product.wholesalePrice) * item.quantity,
      0,
    );
    const remainingAmount = totalAmount - (saleData.paidAmount || 0);

    console.log("💰 Sale calculations:", {
      totalAmount,
      profitAmount,
      remainingAmount,
    });

    // 🔥 CRITICAL: Validate inventory BEFORE creating sale
    console.log("🔍 Validating inventory for all products...");
    for (const cartItem of cartItems) {
      // Try to find product by ID first, then by name if ID doesn't work
      let currentProduct = null;
      let productError = null;

      // First attempt: exact ID match
      const { data: productById, error: errorById } = await supabase!
        .from("products")
        .select("id, name, quantity")
        .eq("id", cartItem.product.id)
        .single();

      if (productById && !errorById) {
        currentProduct = productById;
      } else {
        // Second attempt: find by name (for local products)
        console.log(
          `🔍 Product ID ${cartItem.product.id} not found, searching by name: ${cartItem.product.name}`,
        );
        const { data: productByName, error: errorByName } = await supabase!
          .from("products")
          .select("id, name, quantity")
          .eq("name", cartItem.product.name)
          .single();

        if (productByName && !errorByName) {
          currentProduct = productByName;
          console.log(
            `✅ Found product by name: ${productByName.name} (ID: ${productByName.id})`,
          );
          // Update the cart item to use the correct database ID
          cartItem.product.id = productByName.id;
        } else {
          productError = errorByName;
        }
      }

      if (!currentProduct || productError) {
        // إذا كان المنتج مفقوداً، قد يكون تم حذفه من النظام
        console.warn(`⚠️ المنتج غير موجود: ${cartItem.product.name}`);

        // محاولة إنشاء المنتج من بيانات السلة إذا كان متاحاً
        if (cartItem.product.salePrice && cartItem.product.wholesalePrice) {
          console.log(`🔄 محاولة إعادة إنشاء المنتج: ${cartItem.product.name}`);

          try {
            const newProduct = await this.createProduct({
              name: cartItem.product.name,
              wholesalePrice: cartItem.product.wholesalePrice,
              salePrice: cartItem.product.salePrice,
              quantity: cartItem.quantity + 10, // إضافة كمية إضافية
              minQuantity: 1,
            });

            console.log(`✅ تم إعادة إنشاء المنتج: ${newProduct.name}`);
            cartItem.product.id = newProduct.id;
            currentProduct = newProduct;
          } catch (createError) {
            console.error(
              `❌ فشل في إعادة إنشاء المنتج: ${cartItem.product.name}`,
              createError,
            );
            throw new Error(
              `المنتج غير موجود في النظام: ${cartItem.product.name}. يرجى إضافته من قسم المخزون أولاً.`,
            );
          }
        } else {
          throw new Error(
            `المنتج غير موجود في النظام: ${cartItem.product.name}. يرجى إضافته من قسم المخزون أولاً.`,
          );
        }
      }

      const currentQuantity = currentProduct?.quantity || 0;
      if (currentQuantity < cartItem.quantity) {
        throw new Error(
          `⚠️ الكمية غير كافية للمنتج: ${cartItem.product.name}\nمتوفر: ${currentQuantity}, مطلوب: ${cartItem.quantity}`,
        );
      }
    }

    console.log("✅ All inventory checks passed");

    // Create main sale record
    const { data: saleRecord, error: saleError } = await supabase!
      .from("sales")
      .insert([
        {
          customer_id: customerId,
          sale_date: getCurrentDateGregorian(),
          total_amount: totalAmount,
          payment_type: saleData.paymentType,
          paid_amount: saleData.paidAmount,
          remaining_amount: remainingAmount,
          payment_date:
            saleData.paymentType === "cash"
              ? getCurrentDateGregorian()
              : undefined,
          profit_amount: profitAmount,
          notes: saleData.notes || "",
          items_count: cartItems.length,
        },
      ])
      .select()
      .single();

    if (saleError) {
      const errorInfo = logError(
        "❌ Failed to create sale record:",
        saleError,
        {
          customerId,
          totalAmount,
          paidAmount,
          operation: "create_sale_record",
        },
      );
      throw new Error(`فشل في إنشاء البيعة: ${errorInfo.message}`);
    }

    console.log("✅ Sale record created:", saleRecord.id);

    // Create sale items with manual inventory updates
    console.log("📦 Creating sale items and updating inventory...");
    const saleItemsData = cartItems.map((item) => ({
      sale_id: saleRecord.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_amount: item.totalPrice,
      profit_amount:
        (item.unitPrice - item.product.wholesalePrice) * item.quantity,
    }));

    // Insert sale items (this will trigger automatic inventory deduction via database trigger)
    const { data: saleItems, error: itemsError } = await supabase!
      .from("sale_items")
      .insert(saleItemsData)
      .select();

    if (itemsError) {
      const errorInfo = logError(
        "❌ Failed to create sale items:",
        itemsError,
        {
          saleId: saleRecord.id,
          itemsCount: saleItemsData.length,
          operation: "create_sale_items",
        },
      );

      // If sale_items table doesn't exist, create it
      if (itemsError.code === "42P01") {
        throw new Error(
          "❌ جدول sale_items غير موجود في قاعدة البيانات. يرجى تشغيل س��ريبت CRITICAL_DATABASE_FIX.sql في Supabase أولاً",
        );
      }

      // Rollback: delete the sale record
      await supabase!.from("sales").delete().eq("id", saleRecord.id);
      throw new Error(`فشل في إنشاء تفاصيل البيعة: ${itemsError.message}`);
    }

    console.log(`✅ Created ${saleItems.length} sale items`);

    // Check if database triggers exist for inventory update
    console.log(
      "🔍 Checking if inventory will be updated by database triggers...",
    );

    // Let's check if triggers handle the inventory update automatically
    let triggersHandleInventory = false;

    try {
      // Test if triggers exist by checking if quantities changed after sale_items insert
      const { data: updatedProducts } = await supabase!
        .from("products")
        .select("id, quantity")
        .in(
          "id",
          cartItems.map((item) => item.product.id),
        );

      if (updatedProducts) {
        for (const cartItem of cartItems) {
          const updatedProduct = updatedProducts.find(
            (p) => p.id === cartItem.product.id,
          );
          const originalQuantity = cartItem.product.quantity;

          if (updatedProduct && updatedProduct.quantity < originalQuantity) {
            triggersHandleInventory = true;
            console.log(
              `🔗 Database trigger updated ${cartItem.product.name}: ${originalQuantity} → ${updatedProduct.quantity}`,
            );
          }
        }
      }
    } catch (error) {
      console.warn("Could not check trigger status, will update manually");
    }

    let inventoryUpdates = [];

    // Only update manually if triggers didn't handle it
    if (!triggersHandleInventory) {
      console.log("🔄 No triggers detected, updating inventory manually...");

      for (const cartItem of cartItems) {
        try {
          // Get current quantity
          const { data: currentProduct } = await supabase!
            .from("products")
            .select("quantity")
            .eq("id", cartItem.product.id)
            .single();

          const newQuantity =
            (currentProduct?.quantity || 0) - cartItem.quantity;

          // Update product quantity
          const { error: updateError } = await supabase!
            .from("products")
            .update({
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cartItem.product.id);

          if (updateError) {
            logError(
              `❌ Manual inventory update failed for ${cartItem.product.name}:`,
              updateError,
              {
                productId: cartItem.product.id,
                productName: cartItem.product.name,
                requestedQuantity: cartItem.quantity,
                newQuantity: newQuantity,
                operation: "manual_inventory_update",
              },
            );
          } else {
            inventoryUpdates.push({
              product: cartItem.product.name,
              soldQuantity: cartItem.quantity,
              newQuantity: newQuantity,
            });
            console.log(
              `✅ ${cartItem.product.name}: -${cartItem.quantity} → ${newQuantity}`,
            );
          }
        } catch (error: any) {
          logError(
            `⚠️ Manual inventory update error for ${cartItem.product.name}:`,
            error,
            {
              productId: cartItem.product.id,
              productName: cartItem.product.name,
              requestedQuantity: cartItem.quantity,
              operation: "manual_inventory_update_exception",
            },
          );
        }
      }

      if (inventoryUpdates.length > 0) {
        console.log(
          `🎯 Successfully updated inventory for ${inventoryUpdates.length} products`,
        );
      }
    } else {
      console.log("✅ Inventory updated automatically by database triggers");

      // Record the updates for tracking
      for (const cartItem of cartItems) {
        inventoryUpdates.push({
          product: cartItem.product.name,
          soldQuantity: cartItem.quantity,
          newQuantity: cartItem.product.quantity - cartItem.quantity,
        });
      }
    }

    // Update customer's last sale date and debt
    try {
      await this.updateCustomer(customerId, {
        lastSaleDate: getCurrentDateGregorian(),
        debtAmount: remainingAmount,
      });
      console.log("✅ Customer updated with new debt and sale date");
    } catch (customerError) {
      console.warn("⚠️ Failed to update customer:", customerError);
    }

    // Create transaction record
    try {
      await this.createTransaction({
        customerId,
        type: "sale",
        amount: totalAmount,
        description: `بيع متعدد - ${cartItems.length} منتج`,
        transactionDate: new Date().toISOString(),
      });
      console.log("✅ Transaction record created");
    } catch (transactionError) {
      console.warn("⚠️ Failed to create transaction record:", transactionError);
    }

    // Return the complete sale with items
    const completeSale = {
      id: saleRecord.id,
      customerId: saleRecord.customer_id,
      saleDate: saleRecord.sale_date,
      totalAmount: saleRecord.total_amount,
      paymentType: saleRecord.payment_type,
      paidAmount: saleRecord.paid_amount,
      remainingAmount: saleRecord.remaining_amount,
      paymentDate: saleRecord.payment_date,
      profitAmount: saleRecord.profit_amount,
      notes: saleRecord.notes,
      items: (saleItems || []).map((item) => ({
        id: item.id,
        saleId: item.sale_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalAmount: item.total_amount,
        profitAmount: item.profit_amount,
      })),
      created_at: saleRecord.created_at,
      updated_at: saleRecord.updated_at,
    };

    console.log("🎉 Sale completed successfully:", completeSale.id);
    return completeSale;
  }

  // ============ SALES ============
  async getSales(): Promise<Sale[]> {
    return this.executeCritical("getSales", async () => {
      await this.ensureConnection();

      try {
        // Try with relationships first
        const { data: sales, error } = await supabase!
          .from("sales")
          .select(
            `
          *,
          sale_items (*)
        `,
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.warn(
            "Sales relationship query failed, trying simple query:",
            error,
          );
          return this.getSalesSimple();
        }

        return (sales || []).map((sale) => ({
          id: sale.id,
          customerId: sale.customer_id,
          saleDate: sale.sale_date,
          totalAmount: sale.total_amount,
          paymentType: sale.payment_type,
          paidAmount: sale.paid_amount,
          remainingAmount: sale.remaining_amount,
          paymentDate: sale.payment_date,
          profitAmount: sale.profit_amount,
          notes: sale.notes,
          items: (sale.sale_items || []).map((item: any) => ({
            id: item.id,
            saleId: item.sale_id,
            productId: item.product_id,
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalAmount: item.total_amount,
            profitAmount: item.profit_amount,
          })),
          created_at: sale.created_at,
          updated_at: sale.updated_at,
        }));
      } catch (error) {
        console.warn("Sales query failed, using simple query:", error);
        return this.getSalesSimple();
      }
    });
  }

  // Fallback method for sales without relationships
  private async getSalesSimple(): Promise<Sale[]> {
    const { data: sales, error: salesError } = await supabase!
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (salesError) throw salesError;

    // Try to get sale items if table exists
    let allSaleItems: any[] = [];
    try {
      const { data: saleItemsData } = await supabase!
        .from("sale_items")
        .select("*");
      allSaleItems = saleItemsData || [];
    } catch (error) {
      console.warn(
        "sale_items table not accessible, using legacy format:",
        error,
      );
      // Table doesn't exist or not accessible - use legacy format
    }

    return (sales || []).map((sale) => {
      let items: any[] = [];

      if (allSaleItems.length > 0) {
        // New format with sale_items
        items = allSaleItems
          .filter((item: any) => item.sale_id === sale.id)
          .map((item: any) => ({
            id: item.id,
            saleId: item.sale_id,
            productId: item.product_id,
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalAmount: item.total_amount,
            profitAmount: item.profit_amount,
          }));
      } else {
        // Legacy format - create single item from sale data
        if (sale.product_id && sale.product_name) {
          items = [
            {
              id: `legacy_${sale.id}`,
              saleId: sale.id,
              productId: sale.product_id,
              productName: sale.product_name,
              quantity: sale.quantity || 1,
              unitPrice: sale.unit_price || sale.total_amount,
              totalAmount: sale.total_amount,
              profitAmount: sale.profit_amount || 0,
            },
          ];
        }
      }

      return {
        id: sale.id,
        customerId: sale.customer_id,
        saleDate: sale.sale_date,
        totalAmount: sale.total_amount,
        paymentType: sale.payment_type,
        paidAmount: sale.paid_amount,
        remainingAmount: sale.remaining_amount,
        paymentDate: sale.payment_date,
        profitAmount: sale.profit_amount,
        notes: sale.notes,
        items: items,
        created_at: sale.created_at,
        updated_at: sale.updated_at,
      };
    });
  }

  async getSalesByCustomerId(customerId: string): Promise<Sale[]> {
    try {
      await this.ensureConnection();
    } catch (connectionError) {
      console.warn(
        "Connection failed for getSalesByCustomerId, returning empty array",
      );
      return []; // Return empty array instead of throwing
    }

    try {
      const { data: sales, error } = await supabase!
        .from("sales")
        .select(
          `
          *,
          sale_items (*)
        `,
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Sales query failed:", error);
        return []; // Return empty array instead of throwing
      }

      return (sales || []).map((sale) => ({
        id: sale.id,
        customerId: sale.customer_id,
        saleDate: sale.sale_date,
        totalAmount: sale.total_amount,
        paymentType: sale.payment_type,
        paidAmount: sale.paid_amount,
        remainingAmount: sale.remaining_amount,
        paymentDate: sale.payment_date,
        profitAmount: sale.profit_amount,
        notes: sale.notes,
        items: (sale.sale_items || []).map((item: any) => ({
          id: item.id,
          saleId: item.sale_id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalAmount: item.total_amount,
          profitAmount: item.profit_amount,
        })),
        created_at: sale.created_at,
        updated_at: sale.updated_at,
      }));
    } catch (queryError) {
      console.error("Unexpected error in getSalesByCustomerId:", queryError);
      return []; // Return empty array for any unexpected errors
    }
  }

  // ============ DAILY REPORTS ============
  async getDailyReport(date: string): Promise<Sale[]> {
    console.log(`📊 Getting daily report for date: ${date}`);

    try {
      await this.ensureConnection();
    } catch (connectionError) {
      console.warn(
        "Connection failed for getDailyReport, using offline fallback",
      );
      // Try to get data from offline cache
      return this.getDailyReportOffline(date);
    }

    try {
      // Try with relationships first (enhanced query)
      const { data: sales, error } = await supabase!
        .from("sales")
        .select(
          `
          *,
          customers (
            id,
            name,
            phone
          ),
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_amount,
            profit_amount
          )
        `,
        )
        .eq("sale_date", date)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn(
          "Enhanced daily report query failed, using simple query:",
          error,
        );
        return this.getDailyReportSimple(date);
      }

      // Transform the data to the expected Sale format
      const formattedSales: Sale[] = (sales || []).map((sale: any) => ({
        id: sale.id,
        customerId: sale.customer_id,
        saleDate: sale.sale_date,
        totalAmount: sale.total_amount,
        paymentType: sale.payment_type,
        paidAmount: sale.paid_amount,
        remainingAmount: sale.remaining_amount,
        paymentDate: sale.payment_date,
        profitAmount: sale.profit_amount,
        notes: sale.notes,
        items: (sale.sale_items || []).map((item: any) => ({
          id: item.id,
          saleId: sale.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalAmount: item.total_amount,
          profitAmount: item.profit_amount,
        })),
        created_at: sale.created_at,
        updated_at: sale.updated_at,
        // Add customer info for analytics
        customerName: sale.customers?.name || "غير محدد",
        customerPhone: sale.customers?.phone || "",
      }));

      console.log(
        `✅ Daily report loaded: ${formattedSales.length} sales for ${date}`,
      );
      return formattedSales;
    } catch (queryError: any) {
      logError("Daily report query failed:", queryError, {
        date,
        operation: "get_daily_report_enhanced",
      });
      return this.getDailyReportSimple(date);
    }
  }

  // Fallback method for daily report without relationships
  private async getDailyReportSimple(date: string): Promise<Sale[]> {
    try {
      console.log(`📊 Using simple daily report for date: ${date}`);

      const { data: sales, error: salesError } = await supabase!
        .from("sales")
        .select("*")
        .eq("sale_date", date)
        .order("created_at", { ascending: false });

      if (salesError) {
        console.error("Simple daily report query failed:", salesError);
        return [];
      }

      // Get customer and product info separately
      const salesWithDetails = await Promise.all(
        (sales || []).map(async (sale) => {
          let customerName = "غير محدد";
          let customerPhone = "";
          let items: any[] = [];

          // Get customer info
          try {
            const { data: customer } = await supabase!
              .from("customers")
              .select("name, phone")
              .eq("id", sale.customer_id)
              .single();

            if (customer) {
              customerName = customer.name;
              customerPhone = customer.phone;
            }
          } catch (error) {
            console.warn(
              `Failed to get customer info for sale ${sale.id}:`,
              error,
            );
          }

          // Get sale items
          try {
            const { data: saleItems } = await supabase!
              .from("sale_items")
              .select("*")
              .eq("sale_id", sale.id);

            items = (saleItems || []).map((item: any) => ({
              id: item.id,
              saleId: item.sale_id,
              productId: item.product_id,
              productName: item.product_name,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              totalAmount: item.total_amount,
              profitAmount: item.profit_amount,
            }));
          } catch (error) {
            console.warn(
              `Failed to get sale items for sale ${sale.id}:`,
              error,
            );
            // For legacy sales without sale_items, create a single item
            if (sale.product_name) {
              items = [
                {
                  id: `legacy_${sale.id}`,
                  saleId: sale.id,
                  productId: sale.product_id || "",
                  productName: sale.product_name,
                  quantity: sale.quantity || 1,
                  unitPrice: sale.unit_price || sale.total_amount,
                  totalAmount: sale.total_amount,
                  profitAmount: sale.profit_amount || 0,
                },
              ];
            }
          }

          return {
            id: sale.id,
            customerId: sale.customer_id,
            saleDate: sale.sale_date,
            totalAmount: sale.total_amount,
            paymentType: sale.payment_type,
            paidAmount: sale.paid_amount,
            remainingAmount: sale.remaining_amount,
            paymentDate: sale.payment_date,
            profitAmount: sale.profit_amount,
            notes: sale.notes,
            items: items,
            created_at: sale.created_at,
            updated_at: sale.updated_at,
            customerName: customerName,
            customerPhone: customerPhone,
          };
        }),
      );

      console.log(
        `✅ Simple daily report loaded: ${salesWithDetails.length} sales for ${date}`,
      );
      return salesWithDetails;
    } catch (error: any) {
      console.error("Simple daily report failed:", error);
      return this.getDailyReportOffline(date);
    }
  }

  // Offline fallback for daily report
  private getDailyReportOffline(date: string): Sale[] {
    try {
      console.log(`📱 Using offline daily report for date: ${date}`);

      // Try to get data from localStorage cache
      const cachedSales = localStorage.getItem("cached_sales");
      if (!cachedSales) {
        console.warn("No cached sales data available for offline mode");
        return [];
      }

      const sales: Sale[] = JSON.parse(cachedSales);
      const dailySales = sales.filter((sale) => sale.saleDate === date);

      console.log(
        `📱 Offline daily report: ${dailySales.length} sales for ${date}`,
      );
      return dailySales;
    } catch (error) {
      console.error("Offline daily report failed:", error);
      return [];
    }
  }

  // ============ DEBT PAYMENTS ============
  async createDebtPayment(
    paymentData: Omit<DebtPayment, "id" | "created_at">,
  ): Promise<DebtPayment> {
    await this.ensureConnection();

    const { data, error } = await supabase!
      .from("debt_payments")
      .insert([
        {
          customer_id: paymentData.customerId,
          amount: paymentData.amount,
          payment_type: paymentData.paymentType,
          payment_date: paymentData.paymentDate || getCurrentDateGregorian(),
          notes: paymentData.notes || "",
          remaining_debt: paymentData.remainingDebt,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      customerId: data.customer_id,
      amount: data.amount,
      paymentType: data.payment_type,
      paymentDate: data.payment_date,
      notes: data.notes,
      remainingDebt: data.remaining_debt,
      created_at: data.created_at,
    };
  }

  async getDebtPaymentsByCustomerId(
    customerId: string,
  ): Promise<DebtPayment[]> {
    try {
      await this.ensureConnection();
    } catch (connectionError) {
      console.warn(
        "Connection failed for getDebtPaymentsByCustomerId, returning empty array",
      );
      return []; // Return empty array instead of throwing
    }

    try {
      const { data, error } = await supabase!
        .from("debt_payments")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Debt payments query failed:", error);
        return []; // Return empty array instead of throwing
      }

      return (data || []).map((payment) => ({
        id: payment.id,
        customerId: payment.customer_id,
        amount: payment.amount,
        paymentType: payment.payment_type,
        paymentDate: payment.payment_date,
        notes: payment.notes,
        remainingDebt: payment.remaining_debt,
        created_at: payment.created_at,
      }));
    } catch (queryError) {
      console.error(
        "Unexpected error in getDebtPaymentsByCustomerId:",
        queryError,
      );
      return []; // Return empty array for any unexpected errors
    }
  }

  // ============ TRANSACTIONS ============
  async createTransaction(
    transactionData: Omit<Transaction, "id" | "created_at">,
  ): Promise<Transaction> {
    await this.ensureConnection();

    const { data, error } = await supabase!
      .from("transactions")
      .insert([
        {
          customer_id: transactionData.customerId,
          type: transactionData.type,
          amount: transactionData.amount,
          description: transactionData.description,
          transaction_date: transactionData.transactionDate,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      customerId: data.customer_id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      transactionDate: data.transaction_date,
      created_at: data.created_at,
    };
  }

  async getTransactions(): Promise<Transaction[]> {
    await this.ensureConnection();

    const { data, error } = await supabase!
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (error) throw error;

    return (data || []).map((transaction) => ({
      id: transaction.id,
      customerId: transaction.customer_id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      transactionDate: transaction.transaction_date,
      created_at: transaction.created_at,
    }));
  }

  // ============ REPORTS ============
  async getFullReport(): Promise<FullReport> {
    await this.ensureConnection();

    try {
      // Get all data simultaneously for better performance
      const [customers, products, sales, transactions] = await Promise.all([
        this.getCustomers(),
        this.getProducts(),
        this.getSales(),
        this.getTransactions(),
      ]);

      // Calculate aggregate statistics
      const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const totalProfit = sales.reduce(
        (sum, sale) => sum + sale.profitAmount,
        0,
      );
      const totalDebt = customers.reduce(
        (sum, customer) => sum + customer.debtAmount,
        0,
      );
      const totalPaid = sales.reduce((sum, sale) => sum + sale.paidAmount, 0);

      const lowStockProducts = products.filter(
        (product) => product.quantity <= product.minQuantity,
      );

      return {
        customers,
        products,
        sales,
        transactions,
        statistics: {
          totalCustomers: customers.length,
          totalProducts: products.length,
          totalSales: sales.length,
          totalSalesAmount: totalSales,
          totalProfit,
          totalDebt,
          totalPaid,
          lowStockProducts: lowStockProducts.length,
          averageSaleAmount: sales.length > 0 ? totalSales / sales.length : 0,
        },
        lowStockProducts,
      };
    } catch (error) {
      console.error("Failed to generate full report:", error);
      throw new Error("فشل في توليد التقرير الشامل");
    }
  }

  // ============ ENHANCED CUSTOMER ANALYTICS ============
  async getCustomerAnalytics(customerId: string): Promise<{
    customer: Customer;
    sales: Sale[];
    debtPayments: DebtPayment[];
    totalPurchases: number;
    totalPaid: number;
    currentDebt: number;
    averagePurchase: number;
    lastPurchaseDate: string | null;
    purchaseFrequency: number;
  }> {
    await this.ensureConnection();

    const customer = await this.getCustomerById(customerId);
    const sales = await this.getSalesByCustomerId(customerId);
    const debtPayments = await this.getDebtPaymentsByCustomerId(customerId);

    const totalPurchases = sales.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0,
    );
    const totalPaid = sales.reduce((sum, sale) => sum + sale.paidAmount, 0);
    const currentDebt = customer.debtAmount;

    return {
      customer,
      sales,
      debtPayments,
      totalPurchases,
      totalPaid,
      currentDebt,
      averagePurchase: sales.length > 0 ? totalPurchases / sales.length : 0,
      lastPurchaseDate: sales.length > 0 ? sales[0].saleDate : null,
      purchaseFrequency: sales.length,
    };
  }

  // ============ ADVANCED DATA OPERATIONS ============
  async deleteAllCustomers(): Promise<void> {
    await this.ensureConnection();

    // Delete in correct order due to foreign key constraints
    await supabase!
      .from("debt_payments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("sale_items")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("sales")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("customers")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  async resetEntireDatabase(): Promise<void> {
    await this.ensureConnection();

    // Delete all data in correct order
    await supabase!
      .from("debt_payments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("sale_items")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("sales")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("customers")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase!
      .from("products")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }
}

// Create and export singleton instance
export const supabaseService = SupabaseService.getInstance();
