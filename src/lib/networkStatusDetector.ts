/**
 * أداة كشف حالة الشبكة والاتصال المحسنة
 * Enhanced Network Status Detector Utility
 */
export class NetworkStatusDetector {
  private static isOnline = navigator.onLine;
  private static lastOnlineTime = Date.now();
  private static lastOfflineTime = 0;
  private static connectionQuality: "good" | "poor" | "offline" = "good";
  private static listeners: Array<(isOnline: boolean) => void> = [];
  private static lastQualityCheckFailed = false;
  private static qualityCheckInterval: number | null = null;
  private static isInitialized = false;

  /**
   * تهيئة مراقب حالة الشبكة
   */
  static initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // مراقبة أحداث الشبكة
      window.addEventListener("online", this.handleOnline.bind(this));
      window.addEventListener("offline", this.handleOffline.bind(this));

      // فحص دوري لجودة الاتصال مع معالجة الأخطاء
      this.qualityCheckInterval = window.setInterval(() => {
        this.safeCheckConnectionQuality();
      }, 60000); // كل دقيقة لتقليل الأخطاء

      this.isInitialized = true;
      console.log("🌐 Network status detector initialized safely");
    } catch (error) {
      console.warn("🌐 Failed to initialize network status detector:", error);
    }
  }

  /**
   * فحص آمن لجودة الاتصال
   */
  private static safeCheckConnectionQuality() {
    try {
      this.checkConnectionQuality();
    } catch (error) {
      console.warn("🌐 Safe connection quality check failed:", error);
      // استخدام حالة المتصفح كبديل
      this.connectionQuality = navigator.onLine ? "poor" : "offline";
    }
  }

  /**
   * معالجة حدث عودة الاتصال
   */
  private static handleOnline() {
    this.isOnline = true;
    this.lastOnlineTime = Date.now();
    this.lastQualityCheckFailed = false; // إعادة تعيين حالة الخطأ
    console.log("🌐 Network connection restored");
    this.notifyListeners(true);

    // فحص فوري لجودة الاتصال عند العودة (مع تأخير لتجنب الأخطاء)
    setTimeout(() => {
      this.safeCheckConnectionQuality();
    }, 2000);
  }

  /**
   * معالجة حدث فقدان الاتصال
   */
  private static handleOffline() {
    this.isOnline = false;
    this.lastOfflineTime = Date.now();
    this.connectionQuality = "offline";
    console.log("🌐 Network connection lost");
    this.notifyListeners(false);
  }

  /**
   * فحص جودة الاتصال المحسن
   */
  private static async checkConnectionQuality() {
    if (!this.isOnline) {
      this.connectionQuality = "offline";
      return;
    }

    try {
      const startTime = Date.now();

      // استخدام طريقة آمنة للاختبار
      const success = await this.performSafeConnectionTest();

      if (!success) {
        throw new Error("Connection test failed");
      }

      const latency = Date.now() - startTime;

      if (latency < 1000) {
        this.connectionQuality = "good";
      } else if (latency < 3000) {
        this.connectionQuality = "poor";
      } else {
        this.connectionQuality = "poor";
      }

      // إعادة تعيين حالة الخطأ عند النجاح
      this.lastQualityCheckFailed = false;

      console.log(
        `🌐 Connection quality: ${this.connectionQuality} (${latency}ms)`,
      );
    } catch (error: any) {
      // تجنب رسائل الخطأ المتكررة
      if (!this.lastQualityCheckFailed) {
        console.warn(
          "🌐 Connection quality check failed - using navigator.onLine status",
        );
        this.lastQualityCheckFailed = true;
      }

      // استخدام حالة المتصفح كبديل
      this.connectionQuality = navigator.onLine ? "poor" : "offline";
    }
  }

  /**
   * تنفيذ اختبار اتصال آمن
   */
  private static async performSafeConnectionTest(): Promise<boolean> {
    // الطريقة الأولى: اختبار بسيط مع navigator
    if (!navigator.onLine) {
      return false;
    }

    try {
      // الطريقة الثانية: اختبار مع Image (أكثر أماناً)
      return await this.testWithImage();
    } catch (imageError) {
      try {
        // الطريقة الثالثة: اختبار مع fetch آمن
        return await this.testWithSafeFetch();
      } catch (fetchError) {
        // الطريقة الرابعة: اختبار بسيط مع تأخير
        return await this.testWithSimpleDelay();
      }
    }
  }

  /**
   * اختبار الاتصال باستخدام صورة
   */
  private static testWithImage(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        const timeout = setTimeout(() => {
          reject(new Error("Image load timeout"));
        }, 3000);

        img.onload = () => {
          clearTimeout(timeout);
          resolve(true);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Image load failed"));
        };

        // استخدام data URL لتجنب مشاكل CORS
        img.src =
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * اختبار آمن مع fetch
   */
  private static async testWithSafeFetch(): Promise<boolean> {
    try {
      // جرب fetch مع data URL لتجنب CORS
      const response = await Promise.race([
        fetch("data:text/plain,connection-test"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timeout")), 2000),
        ),
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * اختبار بسيط مع تأخير
   */
  private static async testWithSimpleDelay(): Promise<boolean> {
    try {
      // فحص بسيط مع تأخير
      await new Promise((resolve) => setTimeout(resolve, 100));

      // تحقق من أن الحالة لم تتغير
      if (!navigator.onLine) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * إضافة مستمع لتغيير حالة الشبكة
   */
  static addListener(callback: (isOnline: boolean) => void) {
    if (typeof callback === "function") {
      this.listeners.push(callback);
    }
  }

  /**
   * إزالة مستمع
   */
  static removeListener(callback: (isOnline: boolean) => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * إشعار جميع المستمعين
   */
  private static notifyListeners(isOnline: boolean) {
    this.listeners.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error("Error in network status listener:", error);
      }
    });
  }

  /**
   * الحصول على حالة الشبكة الحالية
   */
  static getStatus(): {
    isOnline: boolean;
    quality: "good" | "poor" | "offline";
    lastOnlineTime: number;
    lastOfflineTime: number;
    timeSinceLastOnline: number;
    timeSinceLastOffline: number;
  } {
    const now = Date.now();
    return {
      isOnline: this.isOnline,
      quality: this.connectionQuality,
      lastOnlineTime: this.lastOnlineTime,
      lastOfflineTime: this.lastOfflineTime,
      timeSinceLastOnline: now - this.lastOnlineTime,
      timeSinceLastOffline: now - this.lastOfflineTime,
    };
  }

  /**
   * فحص ما إذا كان الاتصال مستقر
   */
  static isConnectionStable(): boolean {
    const now = Date.now();
    const timeSinceLastChange = Math.min(
      now - this.lastOnlineTime,
      now - this.lastOfflineTime,
    );

    // اعتبار الاتصال مستقر إذا لم يتغير لأكثر من 10 ثوانٍ
    return timeSinceLastChange > 10000 && this.isOnline;
  }

  /**
   * انتظار استقرار الاتصال
   */
  static async waitForStableConnection(
    timeout: number = 30000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkStability = () => {
        if (this.isConnectionStable()) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }

        setTimeout(checkStability, 1000);
      };

      checkStability();
    });
  }

  /**
   * الحصول على رسالة وصفية لحالة الشبكة
   */
  static getStatusMessage(): string {
    const status = this.getStatus();

    if (!status.isOnline) {
      return "لا يوجد اتصال بالإنترنت";
    }

    switch (status.quality) {
      case "good":
        return "الاتصال جيد";
      case "poor":
        return "الاتصال ضعيف";
      case "offline":
        return "لا يوجد اتصال";
      default:
        return "حالة الاتصال غير معروفة";
    }
  }

  /**
   * تحديد ما إذا كان يجب إعادة المحاولة
   */
  static shouldRetry(attemptNumber: number): boolean {
    const status = this.getStatus();

    // لا تعيد المحاولة إذا كان أوف لاين
    if (!status.isOnline) {
      return false;
    }

    // مع الاتصال الجيد، أعد المحاولة حتى 3 مرات
    if (status.quality === "good") {
      return attemptNumber < 3;
    }

    // مع الاتصال الضعيف، أعد المحاولة مرة واحدة فقط
    if (status.quality === "poor") {
      return attemptNumber < 2;
    }

    return false;
  }

  /**
   * فحص فوري لجودة الاتصال
   */
  static async checkQualityNow(): Promise<"good" | "poor" | "offline"> {
    try {
      await this.checkConnectionQuality();
    } catch (error) {
      console.warn("🌐 Immediate quality check failed:", error);
    }
    return this.connectionQuality;
  }

  /**
   * تنظيف الموارد
   */
  static cleanup() {
    try {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);

      if (this.qualityCheckInterval) {
        clearInterval(this.qualityCheckInterval);
        this.qualityCheckInterval = null;
      }

      this.listeners = [];
      this.isInitialized = false;
      console.log("🌐 Network status detector cleaned up");
    } catch (error) {
      console.warn("🌐 Cleanup failed:", error);
    }
  }
}

// تهيئة تلقائية آمنة عند تحميل المكتبة
if (typeof window !== "undefined" && typeof navigator !== "undefined") {
  try {
    NetworkStatusDetector.initialize();
  } catch (error) {
    console.warn("🌐 Auto-initialization failed:", error);
  }
}

export default NetworkStatusDetector;
