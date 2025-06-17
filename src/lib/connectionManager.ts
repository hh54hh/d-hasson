import { supabase, isSupabaseConfigured } from "./supabase";
import { logError, formatError } from "./utils";

/**
 * مدير الاتصال المحسن لـ Supabase
 * Enhanced Connection Manager for Supabase
 */
export class ConnectionManager {
  private static retryAttempts = 0;
  private static maxRetries = 3;
  private static retryDelays = [1000, 3000, 5000]; // تأخيرات متزايدة
  private static lastConnectionCheck = 0;
  private static connectionCheckInterval = 30000; // 30 ثانية
  private static isConnected = false;

  /**
   * فحص الاتصال مع إعادة المحاولة التلقائية
   */
  static async ensureConnectionWithRetry(): Promise<void> {
    const now = Date.now();

    // إذا تم فحص الاتصال مؤخراً وكان يعمل، لا نحتاج لفح�� مرة أخرى
    if (
      this.isConnected &&
      now - this.lastConnectionCheck < this.connectionCheckInterval
    ) {
      return;
    }

    // Check if OfflineModeHandler is blocking attempts
    const { OfflineModeHandler } = await import("./offlineModeHandler");
    if (!OfflineModeHandler.shouldAttemptConnection()) {
      console.log("🚫 Connection blocked by OfflineModeHandler cooldown");
      throw new Error(
        "الاتصال محجوب مؤقتاً. الرجاء الانتظار قبل المحاولة مرة أخرى.",
      );
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase غير مُكوّن بشكل صحيح");
    }

    if (!navigator.onLine) {
      throw new Error("لا يوجد اتصال بالإنترنت");
    }

    let lastError: any = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`🔄 محاولة الاتصال ${attempt + 1}/${this.maxRetries}...`);

        // اختبار اتصال مع مهلة زمنية أطول للعمليات الخلفية
        const timeoutMs = attempt === 0 ? 8000 : 12000; // Longer timeout for retries

        const { error } = (await Promise.race([
          supabase.from("customers").select("count").limit(0),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Connection timeout")),
              timeoutMs,
            ),
          ),
        ])) as any;

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        // نجح الاتصال
        this.isConnected = true;
        this.lastConnectionCheck = now;
        this.retryAttempts = 0;
        console.log("✅ تم إنشاء الاتصال بنجاح");
        return;
      } catch (error: any) {
        lastError = error;
        this.isConnected = false;

        console.warn(`⚠️ فشل في المحاولة ${attempt + 1}:`, formatError(error));

        // إذا لم تكن هذه المحاولة الأخيرة، انتظر قبل المحاولة مرة أخرى
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelays[attempt] || 5000;
          console.log(`⏳ انتظار ${delay}ms قبل المحاولة مرة أخرى...`);
          await this.delay(delay);
        }
      }
    }

    // فشل في جميع المحاولات
    this.retryAttempts++;

    if (lastError?.message?.includes("Connection timeout")) {
      throw new Error("انتهت مهلة الاتصال. تحقق من الاتصال بالإنترنت.");
    }

    if (
      lastError?.message?.includes("Failed to fetch") ||
      lastError?.message?.includes("NetworkError")
    ) {
      throw new Error("الاتصال مؤقتاً غير متوفر. جاري المحاولة مرة أخرى...");
    }

    throw new Error(
      `فشل الاتصال بعد ${this.maxRetries} محاولات: ${formatError(lastError)}`,
    );
  }

  /**
   * تنفيذ عملية مع إعادة المحاولة التلقائية
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = "database operation",
  ): Promise<T> {
    let lastError: any = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // التأكد من الاتصال قبل تنفيذ العملية
        await this.ensureConnectionWithRetry();

        // تنفيذ العملية
        const result = await operation();
        return result;
      } catch (error: any) {
        lastError = error;

        console.warn(
          `⚠️ فشل في ${operationName} - المحاولة ${attempt + 1}/${this.maxRetries}:`,
          formatError(error),
        );

        // إذا كان الخطأ متعلق بالاتصال، حاول مرة أخرى
        if (this.isRetryableError(error) && attempt < this.maxRetries - 1) {
          this.isConnected = false; // إعادة تعيين حالة الاتصال
          const delay = this.retryDelays[attempt] || 5000;
          console.log(`⏳ انتظار ${delay}ms قبل إعادة المحاولة...`);
          await this.delay(delay);
          continue;
        }

        // إذا لم يكن الخطأ قابل للإعادة، اخرج من الحلقة
        break;
      }
    }

    throw lastError;
  }

  /**
   * فحص إذا كان الخطأ قابل للإعادة
   */
  private static isRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || "";
    const errorCode = error?.code;

    // أخطاء الشبكة القابلة للإعادة
    return (
      errorMessage.includes("connection timeout") ||
      errorMessage.includes("failed to fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("الاتصال مؤقتاً غير متوفر") ||
      errorCode === "ETIMEDOUT" ||
      errorCode === "ENOTFOUND" ||
      errorCode === "ECONNREFUSED"
    );
  }

  /**
   * تأخير لمدة محددة
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * إعادة تعيين حالة الاتصال
   */
  static resetConnectionState(): void {
    this.isConnected = false;
    this.lastConnectionCheck = 0;
    this.retryAttempts = 0;
    console.log("🔄 تم إعادة تعيين حالة الاتصال");
  }

  /**
   * الحصول على حالة الاتصال الحالية
   */
  static getConnectionStatus(): {
    isConnected: boolean;
    lastCheck: number;
    retryAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      lastCheck: this.lastConnectionCheck,
      retryAttempts: this.retryAttempts,
    };
  }

  /**
   * مراقبة الاتصال في الخلفية
   */
  static startConnectionMonitoring(): void {
    // فحص دوري للاتصال
    setInterval(async () => {
      if (!this.isConnected) {
        try {
          await this.ensureConnectionWithRetry();
          console.log("🔄 تم استعادة الاتصال تلقائياً");
        } catch (error: any) {
          console.warn("⚠️ لا يزال الاتصال غير متوفر:", formatError(error));
        }
      }
    }, this.connectionCheckInterval);

    // مراقبة تغيير حالة الشبكة
    window.addEventListener("online", () => {
      console.log("🌐 تم اكتشاف عودة الاتصال بالإنترنت");
      this.resetConnectionState();
    });

    window.addEventListener("offline", () => {
      console.log("🌐 تم فقدان الاتصال بالإنترنت");
      this.resetConnectionState();
    });

    console.log("🔍 تم بدء مراقبة الاتصال في الخلفية");
  }
}

// بدء مراقبة الاتصال عند تحميل المكتبة
if (typeof window !== "undefined") {
  ConnectionManager.startConnectionMonitoring();
}

export default ConnectionManager;
