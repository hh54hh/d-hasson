// Supabase Connection Validator
import { supabase, isSupabaseConfigured } from "./supabase";

export interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
  message: string;
}

export class SupabaseValidator {
  // Validate Supabase configuration and connection
  static async validateConnection(): Promise<ConnectionStatus> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured) {
      return {
        configured: false,
        connected: false,
        error: "SUPABASE_NOT_CONFIGURED",
        message:
          "إعدادات Supabase غير مُكوّنة. النظام سيعمل في وضع أوف لاين فقط.",
      };
    }

    // Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        configured: false,
        connected: false,
        error: "MISSING_ENV_VARS",
        message:
          "متغيرات البيئة لـ Supabase مفقودة. النظام سيعمل في وضع أوف لاين فقط.",
      };
    }

    // Validate URL format
    if (
      !supabaseUrl.startsWith("https://") ||
      !supabaseUrl.includes(".supabase.co")
    ) {
      return {
        configured: false,
        connected: false,
        error: "INVALID_URL",
        message: "رابط Supabase غير صحيح. النظام سيعمل في وضع أوف لاين فقط.",
      };
    }

    // Test actual connection
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const { error } = await supabase!
        .from("customers")
        .select("count")
        .limit(0)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error && error.code !== "PGRST116") {
        return {
          configured: true,
          connected: false,
          error: "CONNECTION_FAILED",
          message: `فشل في الاتصال مع قاعدة البيانات: ${error.message}. النظام سيعمل في وضع أوف لاين.`,
        };
      }

      return {
        configured: true,
        connected: true,
        message: "تم الاتصال بقاعدة البيانات بنجاح.",
      };
    } catch (networkError: any) {
      if (networkError.name === "AbortError") {
        return {
          configured: true,
          connected: false,
          error: "TIMEOUT",
          message:
            "انتهت مهلة الاتصال مع قاعدة البيانات. النظام سيعمل في وضع أوف لاين.",
        };
      }

      if (
        networkError.message?.includes("Failed to fetch") ||
        !navigator.onLine
      ) {
        return {
          configured: true,
          connected: false,
          error: "NETWORK_ERROR",
          message: "لا يوجد اتصال بالإنترنت. النظام سيعمل في وضع أوف لاين.",
        };
      }

      return {
        configured: true,
        connected: false,
        error: "UNKNOWN_ERROR",
        message: `خطأ غير معروف في الاتصال: ${networkError.message}. النظام سيعمل في وضع أوف لاين.`,
      };
    }
  }

  // Show user-friendly connection status
  static async showConnectionStatus(): Promise<void> {
    const status = await this.validateConnection();

    console.log("📡 Supabase Connection Status:");
    console.log(`   Configured: ${status.configured ? "✅" : "❌"}`);
    console.log(`   Connected: ${status.connected ? "✅" : "❌"}`);
    console.log(`   Message: ${status.message}`);

    if (status.error) {
      console.log(`   Error Code: ${status.error}`);
    }

    // Show alert to user if there are issues
    if (!status.connected) {
      alert(
        `🔌 حالة الاتصال\n\n${status.message}\n\nسيتم حفظ البيانات محلياً وسيتم مزامنتها عند استعادة الاتصال.`,
      );
    }
  }

  // Quick connection check without alerts
  static async isConnectionAvailable(): Promise<boolean> {
    try {
      const status = await this.validateConnection();
      return status.connected;
    } catch (error) {
      return false;
    }
  }
}
