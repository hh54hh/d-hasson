// Comprehensive Offline Data Manager for مركز البدر
// مدير البيانات الشامل للعمل بدون إنترنت

import { Customer, Product, Sale, SaleItem } from "./types";
import { logError } from "./utils";
import { offlineSync } from "./offlineSync";

export interface OfflineDataState {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  lastSyncTime: string;
  isInitialized: boolean;
  syncQueue: any[];
}

export interface DataSyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export class OfflineDataManager {
  private static instance: OfflineDataManager;
  private data: OfflineDataState;
  private listeners: Set<(data: OfflineDataState) => void> = new Set();

  private readonly STORAGE_KEYS = {
    OFFLINE_DATA: "badr_offline_data",
    SYNC_QUEUE: "badr_sync_queue",
    LAST_SYNC: "badr_last_sync",
    USER_SESSION: "badr_user_session",
  };

  private constructor() {
    this.data = this.loadOfflineData();
    this.setupStorageListener();
  }

  static getInstance(): OfflineDataManager {
    if (!OfflineDataManager.instance) {
      OfflineDataManager.instance = new OfflineDataManager();
    }
    return OfflineDataManager.instance;
  }

  // Simple initialization for better performance
  async initialize(): Promise<void> {
    try {
      console.log("🔧 Offline Data Manager: Quick initializing...");

      // Load existing data from localStorage
      const existingData = this.loadOfflineData();

      // Use existing data or create simple default
      if (!existingData.isInitialized) {
        this.data = {
          customers: [],
          products: [],
          sales: [],
          saleItems: [],
          lastSyncTime: new Date().toISOString(),
          isInitialized: true,
          syncQueue: [],
        };
        this.saveOfflineData();
      } else {
        this.data = existingData;
      }

      console.log("✅ Offline Data Manager: Quick initialization complete");
      this.notifyListeners();
    } catch (error) {
      console.warn("⚠️ Offline Data Manager initialization issue:", error);
      // Don't throw error - continue with basic functionality
    }
  }

  // Load data from localStorage
  private loadOfflineData(): OfflineDataState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.OFFLINE_DATA);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          customers: parsed.customers || [],
          products: parsed.products || [],
          sales: parsed.sales || [],
          saleItems: parsed.saleItems || [],
          lastSyncTime: parsed.lastSyncTime || new Date().toISOString(),
          isInitialized: parsed.isInitialized || false,
          syncQueue: parsed.syncQueue || [],
        };
      }
    } catch (error) {
      logError("Failed to load offline data:", error);
    }

    return {
      customers: [],
      products: [],
      sales: [],
      saleItems: [],
      lastSyncTime: new Date().toISOString(),
      isInitialized: false,
      syncQueue: [],
    };
  }

  // Save data to localStorage
  private saveOfflineData(): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.OFFLINE_DATA,
        JSON.stringify(this.data),
      );

      // Also cache in service worker for offline access
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CACHE_DATA",
          payload: this.data,
        });
      }
    } catch (error) {
      logError("Failed to save offline data:", error);
    }
  }

  // Initialize with default data
  private async initializeDefaultData(): Promise<void> {
    try {
      console.log("📦 Initializing default data for offline use...");

      // No fake products - start with empty arrays
      this.data = {
        customers: [],
        products: [], // Empty - no fake data
        sales: [],
        saleItems: [],
        lastSyncTime: new Date().toISOString(),
        isInitialized: true,
        syncQueue: [],
      };

      this.saveOfflineData();
      console.log("✅ Default data initialized for offline use");
    } catch (error) {
      logError("Failed to initialize default data:", error);
      throw error;
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get all data
  getData(): OfflineDataState {
    return { ...this.data };
  }

  // Get specific data types
  getCustomers(): Customer[] {
    return [...this.data.customers];
  }

  getProducts(): Product[] {
    return [...this.data.products];
  }

  getSales(): Sale[] {
    return [...this.data.sales];
  }

  // Add data with offline support
  async addCustomer(customerData: Omit<Customer, "id">): Promise<Customer> {
    try {
      const customer: Customer = {
        ...customerData,
        id: this.generateId(),
      };

      this.data.customers.push(customer);
      this.addToSyncQueue("customers", "INSERT", customer);
      this.saveOfflineData();
      this.notifyListeners();

      return customer;
    } catch (error) {
      logError("Failed to add customer offline:", error);
      throw error;
    }
  }

  async addProduct(productData: Omit<Product, "id">): Promise<Product> {
    try {
      const product: Product = {
        ...productData,
        id: this.generateId(),
      };

      this.data.products.push(product);
      this.addToSyncQueue("products", "INSERT", product);
      this.saveOfflineData();
      this.notifyListeners();

      return product;
    } catch (error) {
      logError("Failed to add product offline:", error);
      throw error;
    }
  }

  async addSale(saleData: Omit<Sale, "id">): Promise<Sale> {
    try {
      const sale: Sale = {
        ...saleData,
        id: this.generateId(),
      };

      this.data.sales.push(sale);

      // Update product quantity
      const product = this.data.products.find((p) => p.id === sale.productId);
      if (product) {
        product.quantity -= sale.quantity;
      }

      // Update customer debt
      const customer = this.data.customers.find(
        (c) => c.id === sale.customerId,
      );
      if (customer) {
        customer.debtAmount =
          (customer.debtAmount || 0) + (sale.remainingAmount || 0);
        customer.lastSaleDate = sale.saleDate;
        customer.paymentStatus =
          (sale.remainingAmount || 0) > 0 ? "deferred" : "cash";
      }

      this.addToSyncQueue("sales", "INSERT", sale);
      this.saveOfflineData();
      this.notifyListeners();

      return sale;
    } catch (error) {
      logError("Failed to add sale offline:", error);
      throw error;
    }
  }

  // Update data with offline support
  async updateCustomer(
    id: string,
    updates: Partial<Customer>,
  ): Promise<Customer | null> {
    try {
      const index = this.data.customers.findIndex((c) => c.id === id);
      if (index === -1) return null;

      this.data.customers[index] = {
        ...this.data.customers[index],
        ...updates,
      };
      const updatedCustomer = this.data.customers[index];

      this.addToSyncQueue("customers", "UPDATE", updatedCustomer);
      this.saveOfflineData();
      this.notifyListeners();

      return updatedCustomer;
    } catch (error) {
      logError("Failed to update customer offline:", error);
      throw error;
    }
  }

  async updateProduct(
    id: string,
    updates: Partial<Product>,
  ): Promise<Product | null> {
    try {
      const index = this.data.products.findIndex((p) => p.id === id);
      if (index === -1) return null;

      this.data.products[index] = { ...this.data.products[index], ...updates };
      const updatedProduct = this.data.products[index];

      this.addToSyncQueue("products", "UPDATE", updatedProduct);
      this.saveOfflineData();
      this.notifyListeners();

      return updatedProduct;
    } catch (error) {
      logError("Failed to update product offline:", error);
      throw error;
    }
  }

  // Delete data with offline support
  async deleteCustomer(id: string): Promise<boolean> {
    try {
      const index = this.data.customers.findIndex((c) => c.id === id);
      if (index === -1) return false;

      const customer = this.data.customers[index];
      this.data.customers.splice(index, 1);

      this.addToSyncQueue("customers", "DELETE", { id });
      this.saveOfflineData();
      this.notifyListeners();

      return true;
    } catch (error) {
      logError("Failed to delete customer offline:", error);
      return false;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const index = this.data.products.findIndex((p) => p.id === id);
      if (index === -1) return false;

      const product = this.data.products[index];
      this.data.products.splice(index, 1);

      this.addToSyncQueue("products", "DELETE", { id });
      this.saveOfflineData();
      this.notifyListeners();

      return true;
    } catch (error) {
      logError("Failed to delete product offline:", error);
      return false;
    }
  }

  // Sync queue management
  private addToSyncQueue(table: string, operation: string, data: any): void {
    const queueItem = {
      id: this.generateId(),
      table,
      operation,
      data,
      timestamp: new Date().toISOString(),
      attempts: 0,
    };

    this.data.syncQueue.push(queueItem);
  }

  // Get sync queue
  getSyncQueue(): any[] {
    return [...this.data.syncQueue];
  }

  // Clear specific items from sync queue
  clearSyncQueueItem(itemId: string): void {
    this.data.syncQueue = this.data.syncQueue.filter(
      (item) => item.id !== itemId,
    );
    this.saveOfflineData();
  }

  // Clear all sync queue
  clearSyncQueue(): void {
    this.data.syncQueue = [];
    this.saveOfflineData();
  }

  // Sync with server when online
  async syncWithServer(): Promise<DataSyncResult> {
    try {
      console.log("🔄 Starting data synchronization...");

      if (!navigator.onLine) {
        throw new Error("No internet connection available");
      }

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];
      const itemsToRemove: string[] = [];

      // Process sync queue
      for (const item of this.data.syncQueue) {
        try {
          await this.processSyncItem(item);
          itemsToRemove.push(item.id);
          synced++;
        } catch (error) {
          failed++;
          errors.push(`${item.table} ${item.operation}: ${error}`);
          item.attempts++;

          // Remove items that have failed too many times
          if (item.attempts >= 3) {
            itemsToRemove.push(item.id);
            errors.push(
              `${item.table} ${item.operation}: Max attempts reached, removing from queue`,
            );
          }
        }
      }

      // Remove processed items
      itemsToRemove.forEach((id) => this.clearSyncQueueItem(id));

      // Update last sync time
      this.data.lastSyncTime = new Date().toISOString();
      this.saveOfflineData();
      this.notifyListeners();

      console.log(`✅ Sync complete: ${synced} synced, ${failed} failed`);

      return {
        success: failed === 0,
        synced,
        failed,
        errors,
      };
    } catch (error) {
      logError("Data synchronization failed:", error);
      return {
        success: false,
        synced: 0,
        failed: this.data.syncQueue.length,
        errors: [String(error)],
      };
    }
  }

  // Process individual sync item
  private async processSyncItem(item: any): Promise<void> {
    // This would interface with your SupabaseService
    // For now, we'll simulate successful sync
    console.log(`🔄 Syncing ${item.table} ${item.operation}:`, item.data);

    // TODO: Implement actual Supabase sync logic here
    // await SupabaseService.getInstance().syncItem(item);
  }

  // Event listeners for data changes
  subscribe(listener: (data: OfflineDataState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.data));
  }

  // Setup storage event listener for cross-tab sync
  private setupStorageListener(): void {
    window.addEventListener("storage", (event) => {
      if (event.key === this.STORAGE_KEYS.OFFLINE_DATA && event.newValue) {
        try {
          this.data = JSON.parse(event.newValue);
          this.notifyListeners();
        } catch (error) {
          logError("Failed to sync data from storage event:", error);
        }
      }
    });
  }

  // Setup periodic sync check (disabled for performance)
  private setupPeriodicSync(): void {
    // Disabled periodic sync to improve performance
    // Sync will be triggered manually or on focus
    console.log("📱 Periodic sync disabled for better performance");
  }

  // Setup service worker communication
  private setupServiceWorkerCommunication(): void {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const { data } = event;

        if (data.type === "SYNC_OFFLINE_DATA") {
          console.log("📡 Service Worker requested data sync");
          this.syncWithServer().catch(console.warn);
        }
      });
    }
  }

  // Check if app is online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Get sync status
  getSyncStatus(): {
    isOnline: boolean;
    lastSync: string;
    pendingItems: number;
    nextSyncIn?: number;
  } {
    return {
      isOnline: this.isOnline(),
      lastSync: this.data.lastSyncTime,
      pendingItems: this.data.syncQueue.length,
    };
  }

  // Force refresh data (useful for debugging)
  async forceRefresh(): Promise<void> {
    try {
      if (navigator.onLine) {
        await this.syncWithServer();
      }

      // Refresh data from localStorage
      this.data = this.loadOfflineData();
      this.notifyListeners();
    } catch (error) {
      logError("Failed to force refresh data:", error);
    }
  }

  // Export data for backup
  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  // Import data from backup
  async importData(jsonData: string): Promise<void> {
    try {
      const importedData = JSON.parse(jsonData);

      // Validate data structure
      if (
        !importedData.customers ||
        !importedData.products ||
        !importedData.sales
      ) {
        throw new Error("Invalid data format");
      }

      this.data = {
        ...importedData,
        lastSyncTime: new Date().toISOString(),
        isInitialized: true,
      };

      this.saveOfflineData();
      this.notifyListeners();

      console.log("✅ Data imported successfully");
    } catch (error) {
      logError("Failed to import data:", error);
      throw error;
    }
  }

  // Clear all data (for reset)
  async clearAllData(): Promise<void> {
    try {
      this.data = {
        customers: [],
        products: [],
        sales: [],
        saleItems: [],
        lastSyncTime: new Date().toISOString(),
        isInitialized: false,
        syncQueue: [],
      };

      localStorage.removeItem(this.STORAGE_KEYS.OFFLINE_DATA);
      localStorage.removeItem(this.STORAGE_KEYS.SYNC_QUEUE);
      localStorage.removeItem(this.STORAGE_KEYS.LAST_SYNC);

      // Reinitialize with default data
      await this.initializeDefaultData();
      this.notifyListeners();

      console.log("🗑️ All data cleared and reset");
    } catch (error) {
      logError("Failed to clear data:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const offlineDataManager = OfflineDataManager.getInstance();
