/**
 * نظام ذكي لتنظيم طلبات الاتصال ومنع الإفراط
 * Intelligent Connection Throttling System
 */
export class ConnectionThrottler {
  private static requestQueue = new Map<string, number>();
  private static activeRequests = new Set<string>();
  private static requestStartTimes = new Map<string, number>();
  private static maxConcurrentRequests = 5; // زيادة عدد الطلبات المسموحة
  private static minDelayBetweenRequests = 100; // تقليل التأخير
  private static lastRequestTime = 0;
  private static requestTimeout = 45000; // الاحتفاظ بالـ timeout
  private static emergencyMode = false; // وضع الطوارئ

  /**
   * تحديد ما إذا كان يمكن تنفيذ الطلب الآن
   */
  static canMakeRequest(requestId: string): boolean {
    // في وضع الطوارئ، اسمح بجميع الطلبات
    if (this.emergencyMode) {
      return true;
    }

    const now = Date.now();

    // تخفيف أكبر - السماح بمعظم الطلبات
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      return false;
    }

    // تأخير قصير جداً بين الطلبات
    if (now - this.lastRequestTime < this.minDelayBetweenRequests) {
      return false;
    }

    // تحقق من عدم تشغيل نفس الطلب
    if (this.activeRequests.has(requestId)) {
      return false;
    }

    return true;
  }

  /**
   * ��نفيذ مباشر بدون throttling - للحالات الطارئة
   */
  static async executeBypass<T>(
    requestId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    console.warn(`🚨 Bypassing throttle for emergency: ${requestId}`);

    const uniqueRequestId = `bypass_${requestId}_${Date.now()}`;
    this.startRequest(uniqueRequestId);

    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.warn(`Bypass operation ${uniqueRequestId} failed:`, error);
      throw error;
    } finally {
      this.endRequest(uniqueRequestId);
    }
  }

  /**
   * تفعيل/إلغاء وضع الطوارئ
   */
  static setEmergencyMode(enabled: boolean): void {
    this.emergencyMode = enabled;
    console.warn(`🚨 Emergency mode ${enabled ? "ENABLED" : "DISABLED"}`);

    if (enabled) {
      // في وضع الطوارئ، زيادة الحدود
      this.maxConcurrentRequests = 10;
      this.minDelayBetweenRequests = 50;
    } else {
      // العودة للإعدادات العادية
      this.maxConcurrentRequests = 5;
      this.minDelayBetweenRequests = 100;
    }
  }

  /**
   * تسجيل بداية طلب جديد
   */
  static startRequest(requestId: string): void {
    this.activeRequests.add(requestId);
    this.requestStartTimes.set(requestId, Date.now());
    this.lastRequestTime = Date.now();
    console.log(
      `🚀 Starting request: ${requestId} (${this.activeRequests.size} active)`,
    );
  }

  /**
   * تسجيل انتهاء طلب
   */
  static endRequest(requestId: string): void {
    this.activeRequests.delete(requestId);
    this.requestStartTimes.delete(requestId);
    console.log(
      `✅ Completed request: ${requestId} (${this.activeRequests.size} active)`,
    );
  }

  /**
   * تنظيف الطلبات المعلقة بقوة أكبر
   */
  static cleanupStuckRequests(): void {
    const now = Date.now();
    const stuckRequests: string[] = [];
    const forceCleanupTime = 20000; // تنظيف أي طلب أكثر من 20 ثانية

    for (const [requestId, startTime] of this.requestStartTimes.entries()) {
      if (now - startTime > forceCleanupTime) {
        stuckRequests.push(requestId);
      }
    }

    if (stuckRequests.length > 0) {
      console.warn(
        `🧹 Force cleaning up ${stuckRequests.length} stuck requests after 20s:`,
        stuckRequests,
      );
      for (const requestId of stuckRequests) {
        this.activeRequests.delete(requestId);
        this.requestStartTimes.delete(requestId);
      }
    }

    // تنظيف إضافي إذا كان هناك طلبات كثيرة جداً
    if (this.activeRequests.size > this.maxConcurrentRequests * 2) {
      console.warn(
        `🚨 Too many active requests (${this.activeRequests.size}), force clearing all`,
      );
      this.activeRequests.clear();
      this.requestStartTimes.clear();
    }
  }

  /**
   * تنظيف قسري للطلبات
   */
  static forceCleanup(requestIdPattern?: string): void {
    if (requestIdPattern) {
      // تنظيف الطلبات التي تحتوي على النمط المحدد
      const toRemove: string[] = [];
      for (const requestId of this.activeRequests) {
        if (requestId.includes(requestIdPattern)) {
          toRemove.push(requestId);
        }
      }

      for (const requestId of toRemove) {
        this.activeRequests.delete(requestId);
        this.requestStartTimes.delete(requestId);
      }

      if (toRemove.length > 0) {
        console.warn(
          `🔧 Force cleaned ${toRemove.length} requests matching: ${requestIdPattern}`,
        );
      }
    } else {
      // تنظيف شامل
      console.warn(
        `🔧 Force cleaning all ${this.activeRequests.size} active requests`,
      );
      this.activeRequests.clear();
      this.requestStartTimes.clear();
    }
  }

  /**
   * مراقبة حالة النظام
   */
  static getSystemStatus(): {
    activeRequests: number;
    longestRunningRequest: number;
    queuedRequests: number;
    systemHealth: "healthy" | "warning" | "critical";
  } {
    const now = Date.now();
    let longestRunning = 0;

    for (const startTime of this.requestStartTimes.values()) {
      const duration = now - startTime;
      if (duration > longestRunning) {
        longestRunning = duration;
      }
    }

    let systemHealth: "healthy" | "warning" | "critical" = "healthy";

    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      systemHealth = "warning";
    }

    if (longestRunning > this.requestTimeout) {
      systemHealth = "critical";
    }

    return {
      activeRequests: this.activeRequests.size,
      longestRunningRequest: longestRunning,
      queuedRequests: this.requestQueue.size,
      systemHealth,
    };
  }

  /**
   * تنفيذ طلب مع تنظيم ذكي
   */
  static async executeThrottled<T>(
    requestId: string,
    operation: () => Promise<T>,
    maxWaitTime: number = 60000, // زيادة الوقت إلى 60 ثانية
  ): Promise<T> {
    const startTime = Date.now();
    const uniqueRequestId = `${requestId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // تنظيف الطلبات المعلقة قبل البدء
    this.cleanupStuckRequests();

    // Wait for permission to execute with exponential backoff
    let retryDelay = 100;
    let waitTime = 0;

    while (!this.canMakeRequest(uniqueRequestId)) {
      waitTime = Date.now() - startTime;

      // إذا انتظرنا أكثر من نصف المهلة، فعّل وضع الطوارئ
      if (waitTime > maxWaitTime / 2 && !this.emergencyMode) {
        console.warn(
          `⚠️ Long wait detected (${waitTime}ms), enabling emergency mode`,
        );
        this.setEmergencyMode(true);
        continue; // جرب مرة أخرى في وضع الطوارئ
      }

      if (waitTime > maxWaitTime) {
        // تنظيف إضافي عند انتهاء المهلة
        this.forceCleanup(requestId);

        // كحل أخير، جرب الـ bypass
        console.warn(`🚨 Request ${requestId} timed out, attempting bypass`);
        try {
          return await this.executeBypass(requestId, operation);
        } catch (bypassError) {
          throw new Error(
            `Request ${requestId} failed both throttled and bypass execution. Active requests: ${this.activeRequests.size}`,
          );
        }
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 1.2, 1000); // حد أقصى ثانية واحدة
    }

    this.startRequest(uniqueRequestId);

    try {
      // إضافة timeout للعملية نفسها (مهلة أطول)
      const operationTimeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Operation ${requestId} timed out after 30 seconds`),
            ),
          30000, // زيادة إلى 30 ثانية
        ),
      );

      const result = await Promise.race([operation(), operationTimeout]);
      return result;
    } catch (error) {
      console.warn(`Operation ${uniqueRequestId} failed:`, error);
      throw error;
    } finally {
      this.endRequest(uniqueRequestId);
    }
  }

  /**
   * إعادة تعيين النظام
   */
  static reset(): void {
    console.log(
      `🔄 Resetting throttler. Was tracking ${this.activeRequests.size} active requests`,
    );
    this.activeRequests.clear();
    this.requestStartTimes.clear();
    this.requestQueue.clear();
    this.lastRequestTime = 0;

    console.log("🔄 Connection throttler reset complete");
  }

  /**
   * إعادة تعيين طارئة - تستخدم عند تعليق النظام
   */
  static emergencyReset(): void {
    console.warn(
      `🚨 EMERGENCY RESET - Clearing ${this.activeRequests.size} active requests`,
    );

    // تنظيف شامل
    this.activeRequests.clear();
    this.requestStartTimes.clear();
    this.requestQueue.clear();
    this.lastRequestTime = 0;

    // تفعيل وضع الطوارئ للسماح بالطلبات
    this.setEmergencyMode(true);

    console.warn("🚨 Emergency reset complete - System in emergency mode");

    // إعادة تعيين وضع الطوارئ بعد دقيقة
    setTimeout(() => {
      this.setEmergencyMode(false);
      console.log("🔄 Emergency mode disabled, returning to normal");
    }, 60000);
  }
  /**
   * الحصول على إحصائيات النظام
   */
  static getStats(): {
    activeRequests: number;
    queuedRequests: number;
    lastRequestTime: number;
  } {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.size,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * تكوين معاملات النظام
   */
  static configure(options: {
    maxConcurrentRequests?: number;
    minDelayBetweenRequests?: number;
  }): void {
    if (options.maxConcurrentRequests !== undefined) {
      this.maxConcurrentRequests = options.maxConcurrentRequests;
    }
    if (options.minDelayBetweenRequests !== undefined) {
      this.minDelayBetweenRequests = options.minDelayBetweenRequests;
    }

    console.log("⚙️ Connection throttler configured:", {
      maxConcurrentRequests: this.maxConcurrentRequests,
      minDelayBetweenRequests: this.minDelayBetweenRequests,
    });
  }
}

export default ConnectionThrottler;
