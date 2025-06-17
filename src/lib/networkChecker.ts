// Network Status Checker and Connection Fixer
import { supabase, isSupabaseConfigured } from "./supabase";

export interface NetworkStatus {
  isOnline: boolean;
  supabaseConnected: boolean;
  lastChecked: string;
  error?: string;
  ping?: number;
}

export class NetworkChecker {
  private static instance: NetworkChecker;
  private status: NetworkStatus = {
    isOnline: navigator.onLine,
    supabaseConnected: false,
    lastChecked: new Date().toISOString(),
  };

  static getInstance(): NetworkChecker {
    if (!NetworkChecker.instance) {
      NetworkChecker.instance = new NetworkChecker();
    }
    return NetworkChecker.instance;
  }

  constructor() {
    // Listen to online/offline events
    window.addEventListener("online", () => {
      this.status.isOnline = true;
      this.checkSupabaseConnection();
    });

    window.addEventListener("offline", () => {
      this.status.isOnline = false;
      this.status.supabaseConnected = false;
    });

    // Initial check
    this.checkSupabaseConnection();
  }

  // Check if Supabase is accessible
  async checkSupabaseConnection(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      this.status.supabaseConnected = false;
      this.status.error = "Supabase غير مُكوّن";
      return false;
    }

    if (!navigator.onLine) {
      this.status.isOnline = false;
      this.status.supabaseConnected = false;
      this.status.error = "لا يوجد اتصال بالإنترنت";
      return false;
    }

    try {
      const startTime = Date.now();

      // Simple test query with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const { error } = await supabase
        .from("customers")
        .select("count")
        .limit(0)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      const ping = Date.now() - startTime;

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows found" which is OK for connection test
        this.status.supabaseConnected = false;
        this.status.error = `خطأ قاعدة البيانات: ${error.message}`;
        this.status.ping = ping;
        return false;
      }

      this.status.supabaseConnected = true;
      this.status.error = undefined;
      this.status.ping = ping;
      this.status.lastChecked = new Date().toISOString();

      console.log(`✅ Supabase connection OK (${ping}ms)`);
      return true;
    } catch (error: any) {
      this.status.supabaseConnected = false;
      this.status.lastChecked = new Date().toISOString();

      if (error.name === "AbortError") {
        this.status.error = "انتهت مهلة الاتصال";
      } else if (error.message?.includes("Failed to fetch")) {
        this.status.error = "فشل الاتصال - تحقق من إعدادات الشبكة";
      } else {
        this.status.error = `خطأ في الاتصال: ${error.message}`;
      }

      console.warn(`❌ Supabase connection failed: ${this.status.error}`);
      return false;
    }
  }

  // Get current network status
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  // Force refresh connection status
  async refreshStatus(): Promise<NetworkStatus> {
    this.status.isOnline = navigator.onLine;
    await this.checkSupabaseConnection();
    return this.getStatus();
  }

  // Wait for connection to be restored
  async waitForConnection(maxWaitTime: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      if (await this.checkSupabaseConnection()) {
        return true;
      }

      // Wait 2 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return false;
  }

  // Get connection quality description
  getConnectionQuality(): string {
    if (!this.status.isOnline) return "غير متصل";
    if (!this.status.supabaseConnected) return "مشكلة في قاعدة البيانات";

    if (this.status.ping) {
      if (this.status.ping < 200) return "ممتاز";
      if (this.status.ping < 500) return "جيد";
      if (this.status.ping < 1000) return "متوسط";
      return "بطيء";
    }

    return "غير معروف";
  }

  // Auto-fix connection issues
  async autoFixConnection(): Promise<{
    success: boolean;
    message: string;
    actions: string[];
  }> {
    const actions: string[] = [];

    // Check basic connectivity
    if (!navigator.onLine) {
      return {
        success: false,
        message: "لا يوجد اتصال بالإنترنت",
        actions: ["تحقق من اتصال Wi-Fi أو البيانات"],
      };
    }

    actions.push("✅ اتصال الإنترنت متوفر");

    // Check Supabase configuration
    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: "إعدادات Supabase مفقودة",
        actions: [
          ...actions,
          "❌ تحقق من ملف .env",
          "❌ تأكد من VITE_SUPABASE_URL",
          "❌ تأكد من VITE_SUPABASE_ANON_KEY",
        ],
      };
    }

    actions.push("✅ إعدادات Supabase موجودة");

    // Test Supabase connection
    const connected = await this.checkSupabaseConnection();

    if (connected) {
      return {
        success: true,
        message: `اتصال ناجح - جودة الاتصال: ${this.getConnectionQuality()}`,
        actions: [...actions, "✅ قاعدة البيانات متصلة"],
      };
    }

    return {
      success: false,
      message: this.status.error || "فشل في الاتصال",
      actions: [
        ...actions,
        "❌ فشل الاتصال مع قاعدة البيانات",
        "تحقق من إعدادات Supabase",
        "تأكد من أن المشروع نشط",
      ],
    };
  }
}

// Global instance
export const networkChecker = NetworkChecker.getInstance();

// Utility function for components
export const useNetworkStatus = () => {
  return {
    getStatus: () => networkChecker.getStatus(),
    checkConnection: () => networkChecker.checkSupabaseConnection(),
    refreshStatus: () => networkChecker.refreshStatus(),
    autoFix: () => networkChecker.autoFixConnection(),
    getQuality: () => networkChecker.getConnectionQuality(),
  };
};
