// Supabase Connection Diagnostics Tool
import { supabase, isSupabaseConfigured } from "./supabase";
import { OfflineModeHandler } from "./offlineModeHandler";

export class SupabaseDiagnostics {
  // Run comprehensive diagnostics
  static async runDiagnostics(): Promise<{
    status: "healthy" | "degraded" | "offline";
    details: string[];
    recommendations: string[];
  }> {
    const details: string[] = [];
    const recommendations: string[] = [];
    let status: "healthy" | "degraded" | "offline" = "healthy";

    // Check 1: Configuration
    details.push(
      `📋 Configuration: ${isSupabaseConfigured ? "✅ OK" : "❌ Missing"}`,
    );
    if (!isSupabaseConfigured) {
      status = "offline";
      recommendations.push("تحقق من إعدادات Supabase في ملف البيئة");
    }

    // Check 2: Network Status
    details.push(
      `🌐 Network: ${navigator.onLine ? "✅ Online" : "❌ Offline"}`,
    );
    if (!navigator.onLine) {
      status = "offline";
      recommendations.push("تحقق من اتصال الإنترنت");
    }

    // Check 3: Connection Handler Status
    const handlerStatus = OfflineModeHandler.getStatus();
    details.push(`🔄 Connection Attempts: ${handlerStatus.attempts}/3`);
    details.push(`⏰ Last Attempt: ${handlerStatus.lastAttempt}`);
    details.push(
      `🚦 Can Attempt: ${handlerStatus.canAttempt ? "✅ Yes" : "❌ No"}`,
    );

    if (OfflineModeHandler.isInCooldown()) {
      status = status === "healthy" ? "degraded" : status;
      details.push(`⏳ Cooldown: ${handlerStatus.nextAttemptIn}s remaining`);
      recommendations.push("انتظر انتهاء فترة التبريد أو اضغط على إعادة تعيين");
    }

    // Check 4: Simple Connection Test (if allowed)
    if (isSupabaseConfigured && navigator.onLine && handlerStatus.canAttempt) {
      try {
        console.log("🧪 Running connection test...");

        // Simple test without AbortController
        const testPromise = supabase.from("customers").select("count").limit(0);

        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Test timeout")), 3000);
        });

        const result = (await Promise.race([testPromise, timeout])) as any;

        if (result.error && result.error.code !== "PGRST116") {
          status = status === "healthy" ? "degraded" : status;
          details.push(`❌ Connection Test: Failed - ${result.error.message}`);
          recommendations.push("تحقق من إعدادات Supabase أو حالة الخادم");
        } else {
          details.push("✅ Connection Test: Successful");
          OfflineModeHandler.recordAttempt(true);
        }
      } catch (testError: any) {
        status = status === "healthy" ? "degraded" : status;
        details.push(`❌ Connection Test: ${testError.message}`);
        OfflineModeHandler.recordAttempt(false);

        if (testError.message === "Test timeout") {
          recommendations.push("الاتصال بطيء - تحقق من جودة الإنترنت");
        } else {
          recommendations.push("مشكلة في الاتصال - تحقق من إعدادات الشبكة");
        }
      }
    } else {
      details.push("⏭️ Connection Test: Skipped (conditions not met)");
    }

    return { status, details, recommendations };
  }

  // Quick health check
  static async quickCheck(): Promise<boolean> {
    if (!isSupabaseConfigured || !navigator.onLine) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("customers")
        .select("count")
        .limit(0);

      return !error || error.code === "PGRST116";
    } catch {
      return false;
    }
  }

  // Get current system status
  static getSystemStatus(): {
    supabase: boolean;
    network: boolean;
    handler: string;
  } {
    const handlerStatus = OfflineModeHandler.getStatus();

    return {
      supabase: isSupabaseConfigured,
      network: navigator.onLine,
      handler: handlerStatus.canAttempt
        ? "ready"
        : OfflineModeHandler.isInCooldown()
          ? "cooldown"
          : "blocked",
    };
  }

  // Force connection reset
  static resetConnection(): void {
    OfflineModeHandler.forceReset();
    console.log("🔄 Supabase connection state reset");
  }
}
