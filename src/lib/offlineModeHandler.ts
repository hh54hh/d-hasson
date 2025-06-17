// Simple Offline Mode Handler to prevent Supabase connection spam
import { isSupabaseConfigured } from "./supabase";

export class OfflineModeHandler {
  private static connectionAttempts = 0;
  private static lastAttemptTime = 0;
  private static maxAttempts = 3;
  private static cooldownPeriod = 60000; // 1 minute

  // Check if we should attempt Supabase connection
  static shouldAttemptConnection(): boolean {
    const now = Date.now();

    // If not configured, don't attempt
    if (!isSupabaseConfigured) {
      return false;
    }

    // If not online, don't attempt
    if (!navigator.onLine) {
      return false;
    }

    // More conservative approach - allow fewer attempts with longer cooldown
    const maxAttemptsBeforeCooldown = 3; // Reduced back to 3
    const extendedCooldown = 60000; // Back to 1 minute to reduce spam

    // If we've tried too many times recently, wait
    if (
      this.connectionAttempts >= maxAttemptsBeforeCooldown &&
      now - this.lastAttemptTime < extendedCooldown
    ) {
      const waitTime = Math.round(
        (extendedCooldown - (now - this.lastAttemptTime)) / 1000,
      );
      if (waitTime > 0) {
        // Only log occasionally to reduce console spam
        if (this.connectionAttempts === maxAttemptsBeforeCooldown) {
          console.warn(
            `⏳ Too many connection attempts. Cooling down for ${waitTime}s`,
          );
        }
        return false;
      }
    }

    // Reset attempts if cooldown period has passed
    if (now - this.lastAttemptTime > extendedCooldown) {
      this.connectionAttempts = 0;
    }

    return true;
  }
  // Record a connection attempt
  static recordAttempt(success: boolean): void {
    this.lastAttemptTime = Date.now();

    if (success) {
      this.connectionAttempts = 0; // Reset on success
      console.log("✅ Supabase connection successful");
    } else {
      this.connectionAttempts++;
      console.warn(
        `❌ Supabase connection failed (${this.connectionAttempts}/3)`,
      );

      // If we've hit the limit, warn about cooldown
      if (this.connectionAttempts >= 3) {
        console.warn(
          "🚫 Connection attempts limit reached. Entering cooldown mode.",
        );
      }
    }
  }
  // Force reset connection attempts (useful for manual retry)
  static resetAttempts(): void {
    this.connectionAttempts = 0;
    this.lastAttemptTime = 0;
    console.log("🔄 Connection attempts manually reset");
  }

  // Get detailed status for debugging
  static getStatus(): {
    attempts: number;
    lastAttempt: string;
    canAttempt: boolean;
    nextAttemptIn: number;
  } {
    const now = Date.now();
    const nextAttemptTime = this.lastAttemptTime + 60000; // 1 minute cooldown
    const nextAttemptIn = Math.max(0, nextAttemptTime - now);

    return {
      attempts: this.connectionAttempts,
      lastAttempt: this.lastAttemptTime
        ? new Date(this.lastAttemptTime).toLocaleString("ar-SA")
        : "لم يتم المحاولة",
      canAttempt: this.shouldAttemptConnection(),
      nextAttemptIn: Math.round(nextAttemptIn / 1000), // seconds
    };
  }

  // Force reset connection state (useful for debugging)
  static forceReset(): void {
    this.connectionAttempts = 0;
    this.lastAttemptTime = 0;
    console.log("🔄 Connection state force reset - all attempts cleared");
  }

  // Check if we're in cooldown mode
  static isInCooldown(): boolean {
    const now = Date.now();
    return this.connectionAttempts >= 3 && now - this.lastAttemptTime < 60000;
  }

  // Enable offline mode message
  static showOfflineMessage(): void {
    console.log(
      "📱 Working in offline mode - data will sync when connection is restored",
    );
  }
}
