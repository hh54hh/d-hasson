// Memory cleanup utilities to prevent listener leaks
// أدوات تنظيف الذاكرة لمنع تسريب المستمعين

class MemoryCleanup {
  private static registeredListeners: Array<{
    element: EventTarget;
    event: string;
    listener: EventListener;
  }> = [];

  // Register event listener for proper cleanup
  static addEventListener(
    element: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    element.addEventListener(event, listener, options);
    this.registeredListeners.push({ element, event, listener });
  }

  // Cleanup all registered listeners
  static cleanup(): void {
    console.log(
      `🧹 Cleaning up ${this.registeredListeners.length} event listeners`,
    );

    this.registeredListeners.forEach(({ element, event, listener }) => {
      try {
        element.removeEventListener(event, listener);
      } catch (error) {
        console.warn("Failed to remove event listener:", error);
      }
    });

    this.registeredListeners = [];
    console.log("✅ Memory cleanup completed");
  }

  // Clean up specific Monaco Editor listeners that are causing issues
  static cleanupMonacoListeners(): void {
    try {
      // Clear any Monaco editor related listeners
      const monacoElements = document.querySelectorAll("[data-mode-id]");
      monacoElements.forEach((element) => {
        const clone = element.cloneNode(true);
        element.parentNode?.replaceChild(clone, element);
      });

      console.log("🧹 Monaco editor listeners cleaned up");
    } catch (error) {
      console.warn("Failed to cleanup Monaco listeners:", error);
    }
  }

  // Force garbage collection if available (development only)
  static forceGarbageCollection(): void {
    if (typeof window !== "undefined" && "gc" in window) {
      try {
        (window as any).gc();
        console.log("🗑️ Forced garbage collection");
      } catch (error) {
        console.warn("Could not force garbage collection:", error);
      }
    }
  }

  // Setup automatic cleanup on page unload
  static setupAutoCleanup(): void {
    const cleanup = () => {
      this.cleanup();
      this.cleanupMonacoListeners();
    };

    // Register cleanup on various unload events
    window.addEventListener("beforeunload", cleanup);
    window.addEventListener("unload", cleanup);
    window.addEventListener("pagehide", cleanup);

    // Cleanup on visibility change (when tab becomes hidden)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.cleanupMonacoListeners();
      }
    });

    console.log("🛡️ Automatic memory cleanup initialized");
  }
}

// Initialize auto cleanup when module loads
MemoryCleanup.setupAutoCleanup();

export { MemoryCleanup };
