// Real-time Data Synchronization Manager
// مدير المزامنة الفورية للبيانات بين الصفحات

import { useState, useEffect } from "react";
import { Customer, Product, Sale } from "./types";

interface DataUpdateEvent {
  type: "customers" | "products" | "sales";
  action: "add" | "update" | "delete";
  data: any;
  timestamp: number;
}

type DataUpdateListener = (event: DataUpdateEvent) => void;

export class RealTimeDataSync {
  private static instance: RealTimeDataSync;
  private listeners: Set<DataUpdateListener> = new Set();
  private channel?: BroadcastChannel;
  private storageListener?: (event: StorageEvent) => void;

  private constructor() {
    this.setupBroadcastChannel();
    this.setupStorageListener();
  }

  static getInstance(): RealTimeDataSync {
    if (!RealTimeDataSync.instance) {
      RealTimeDataSync.instance = new RealTimeDataSync();
    }
    return RealTimeDataSync.instance;
  }

  // Setup BroadcastChannel for same-origin cross-tab communication
  private setupBroadcastChannel(): void {
    try {
      this.channel = new BroadcastChannel("badr-data-sync");
      this.channel.addEventListener("message", (event) => {
        console.log("🔄 Received real-time data update:", event.data);
        this.notifyListeners(event.data);
      });
    } catch (error) {
      console.warn(
        "⚠️ BroadcastChannel not supported, falling back to storage events",
      );
    }
  }

  // Setup storage event listener for cross-tab sync
  private setupStorageListener(): void {
    this.storageListener = (event: StorageEvent) => {
      if (event.key === "badr_data_update") {
        try {
          const updateEvent = JSON.parse(event.newValue || "{}");
          console.log("📡 Storage sync event received:", updateEvent);
          this.notifyListeners(updateEvent);
        } catch (error) {
          console.warn("Failed to parse storage sync event:", error);
        }
      }
    };
    window.addEventListener("storage", this.storageListener);
  }

  // Subscribe to data updates
  subscribe(listener: DataUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners about data changes
  private notifyListeners(event: DataUpdateEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in data sync listener:", error);
      }
    });
  }

  // Broadcast data update to all tabs/components
  broadcastUpdate(
    type: "customers" | "products" | "sales",
    action: "add" | "update" | "delete",
    data: any,
  ): void {
    const event: DataUpdateEvent = {
      type,
      action,
      data,
      timestamp: Date.now(),
    };

    console.log("📢 Broadcasting data update:", event);

    // Notify current tab listeners immediately
    this.notifyListeners(event);

    // Broadcast to other tabs via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (error) {
        console.warn("Failed to broadcast via BroadcastChannel:", error);
      }
    }

    // Fallback: Use localStorage for cross-tab communication
    try {
      localStorage.setItem("badr_data_update", JSON.stringify(event));
      // Clear after a short delay to avoid pollution
      setTimeout(() => {
        localStorage.removeItem("badr_data_update");
      }, 100);
    } catch (error) {
      console.warn("Failed to broadcast via localStorage:", error);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.channel) {
      this.channel.close();
    }
    if (this.storageListener) {
      window.removeEventListener("storage", this.storageListener);
      this.storageListener = undefined;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const realTimeDataSync = RealTimeDataSync.getInstance();

// Hook for React components
export function useRealTimeDataSync() {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = realTimeDataSync.subscribe((event) => {
      console.log("🔄 Data update received in component:", event);
      // Trigger re-render by updating state
      setUpdateTrigger((prev) => prev + 1);
    });

    return unsubscribe;
  }, []);

  return {
    updateTrigger,
    broadcastUpdate: (
      type: "customers" | "products" | "sales",
      action: "add" | "update" | "delete",
      data: any,
    ) => {
      realTimeDataSync.broadcastUpdate(type, action, data);
    },
  };
}
