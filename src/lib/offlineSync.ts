import { supabase, isSupabaseConfigured } from "./supabase";
import { getCustomers, getProducts, getSales } from "./storage";

// Storage utility functions
const STORAGE_KEYS = {
  CUSTOMERS: "paw_customers",
  PRODUCTS: "paw_products",
  SALES: "paw_sales",
} as const;

const setCustomers = (customers: any[]): void => {
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
};

const setProducts = (products: any[]): void => {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

const setSales = (sales: any[]): void => {
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
};

export interface SyncQueueItem {
  id: string;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string;
  data: any;
  synced: boolean;
  created_at: string;
}

class OfflineSync {
  private syncQueue: SyncQueueItem[] = [];
  private isOnline = navigator.onLine;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadSyncQueue();
    this.setupOnlineListener();
    this.startSyncInterval();
  }

  private loadSyncQueue() {
    const queue = localStorage.getItem("syncQueue");
    if (queue) {
      this.syncQueue = JSON.parse(queue);
    }
  }

  private saveSyncQueue() {
    localStorage.setItem("syncQueue", JSON.stringify(this.syncQueue));
  }

  private setupOnlineListener() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      console.log("📡 اتصال الإنترنت متاح - بدء المزامنة...");
      this.syncWithSupabase();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      console.log("📴 فقدان اتصال الإنترنت - التشغيل في وضع عدم الاتصال");
    });
  }

  private startSyncInterval() {
    // Try to sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && isSupabaseConfigured) {
        this.syncWithSupabase();
      }
    }, 30000);
  }

  addToQueue(
    tableName: string,
    operation: "INSERT" | "UPDATE" | "DELETE",
    recordId: string,
    data: any,
  ) {
    const queueItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      table_name: tableName,
      operation,
      record_id: recordId,
      data,
      synced: false,
      created_at: new Date().toISOString(),
    };

    this.syncQueue.push(queueItem);
    this.saveSyncQueue();

    // Try immediate sync if online
    if (this.isOnline && isSupabaseConfigured) {
      this.syncWithSupabase();
    }
  }

  async syncWithSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase || !this.isOnline) {
      return false;
    }

    console.log(
      `🔄 بدء مزامنة ${this.syncQueue.filter((item) => !item.synced).length} عنصر...`,
    );

    const unsyncedItems = this.syncQueue.filter((item) => !item.synced);
    let syncedCount = 0;

    for (const item of unsyncedItems) {
      try {
        await this.syncItem(item);
        item.synced = true;
        syncedCount++;
      } catch (error) {
        console.error(`❌ خطأ في مزامنة ${item.table_name}:`, error);
      }
    }

    this.saveSyncQueue();

    if (syncedCount > 0) {
      console.log(`✅ تم مزامنة ${syncedCount} عنصر بنجاح`);
      // Download latest data from Supabase after successful sync
      await this.downloadFromSupabase();
    }

    return syncedCount === unsyncedItems.length;
  }

  private async syncItem(item: SyncQueueItem) {
    if (!supabase) throw new Error("Supabase not configured");

    const tableName = item.table_name;
    const data = item.data;

    switch (item.operation) {
      case "INSERT":
        await supabase.from(tableName).insert([data]);
        break;

      case "UPDATE":
        const { id, ...updateData } = data;
        await supabase
          .from(tableName)
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq("id", item.record_id);
        break;

      case "DELETE":
        await supabase.from(tableName).delete().eq("id", item.record_id);
        break;
    }
  }

  async downloadFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      console.log("📥 تحميل البيانات الحديثة من Supabase...");

      // Download customers
      const { data: customers } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      // Download products
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .order("name");

      // Download sales
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .order("sale_date", { ascending: false });

      if (customers) {
        const transformedCustomers = customers.map((c) => ({
          ...c,
          sales: sales?.filter((s) => s.customer_id === c.id) || [],
          paymentStatus: c.payment_status,
          lastSaleDate: c.last_sale_date,
          debtAmount: c.debt_amount,
          debtPaidDate: c.debt_paid_date,
        }));
        setCustomers(transformedCustomers);
      }

      if (products) {
        const transformedProducts = products.map((p) => ({
          ...p,
          wholesalePrice: p.wholesale_price,
          salePrice: p.sale_price,
          minQuantity: p.min_quantity,
        }));
        setProducts(transformedProducts);
      }

      if (sales) {
        const transformedSales = sales.map((s) => ({
          ...s,
          customerId: s.customer_id,
          productId: s.product_id,
          productName: s.product_name,
          unitPrice: s.unit_price,
          totalAmount: s.total_amount,
          paymentType: s.payment_type,
          paidAmount: s.paid_amount,
          remainingAmount: s.remaining_amount,
          saleDate: s.sale_date,
          paymentDate: s.payment_date,
          profitAmount: s.profit_amount,
        }));
        setSales(transformedSales);
      }

      console.log("✅ تم تحميل البيانات بنجاح");
    } catch (error) {
      console.error("❌ خطأ في تحميل البيانات:", error);
    }
  }

  async uploadLocalData(): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !this.isOnline) {
      return;
    }

    console.log("📤 رفع البيانات المحلية إلى Supabase...");

    try {
      const customers = getCustomers();
      const products = getProducts();
      const sales = getSales();

      // Upload customers
      for (const customer of customers) {
        const supabaseCustomer = {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          payment_status: customer.paymentStatus,
          last_sale_date: customer.lastSaleDate,
          debt_amount: customer.debtAmount || 0,
          debt_paid_date: customer.debtPaidDate,
        };

        await supabase.from("customers").upsert([supabaseCustomer]);
      }

      // Upload products
      for (const product of products) {
        const supabaseProduct = {
          id: product.id,
          name: product.name,
          wholesale_price: product.wholesalePrice,
          sale_price: product.salePrice,
          quantity: product.quantity,
          min_quantity: product.minQuantity,
        };

        await supabase.from("products").upsert([supabaseProduct]);
      }

      // Upload sales
      for (const sale of sales) {
        const supabaseSale = {
          id: sale.id,
          customer_id: sale.customerId,
          product_id: sale.productId,
          product_name: sale.productName,
          quantity: sale.quantity,
          unit_price: sale.unitPrice,
          total_amount: sale.totalAmount,
          payment_type: sale.paymentType,
          paid_amount: sale.paidAmount,
          remaining_amount: sale.remainingAmount,
          sale_date: sale.saleDate,
          payment_date: sale.paymentDate,
          profit_amount: sale.profitAmount,
          notes: sale.notes,
        };

        await supabase.from("sales").upsert([supabaseSale]);
      }

      console.log("✅ تم رفع البيانات المحلية بنجاح");
    } catch (error) {
      console.error("❌ خطأ في رفع البيانات:", error);
    }
  }

  getQueueStatus() {
    return {
      total: this.syncQueue.length,
      pending: this.syncQueue.filter((item) => !item.synced).length,
      isOnline: this.isOnline,
      isConfigured: isSupabaseConfigured,
    };
  }

  clearSyncedItems() {
    this.syncQueue = this.syncQueue.filter((item) => !item.synced);
    this.saveSyncQueue();
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// Create singleton instance
export const offlineSync = new OfflineSync();

// Export utility functions
export const syncStatus = () => offlineSync.getQueueStatus();
export const forcSync = () => offlineSync.syncWithSupabase();
export const uploadLocalData = () => offlineSync.uploadLocalData();
