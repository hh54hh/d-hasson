// Network connectivity test utility
export class NetworkTest {
  // Test basic network connectivity
  static async testConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Test with a simple fetch to a reliable endpoint
      const response = await fetch("https://httpbin.org/status/200", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-cache",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return true;
    } catch (error) {
      console.warn("Network connectivity test failed:", error);
      return false;
    }
  }

  // Test Supabase specific connectivity
  static async testSupabaseConnectivity(): Promise<boolean> {
    try {
      // This will be tested by the actual Supabase service
      const { supabase } = await import("./supabase");
      if (!supabase) return false;

      // Simple query to test connectivity
      const { error } = await supabase
        .from("customers")
        .select("count")
        .limit(0);

      return error === null || error.code === "PGRST116"; // PGRST116 is "no rows" which means connection works
    } catch (error) {
      console.warn("Supabase connectivity test failed:", error);
      return false;
    }
  }

  // Get network status with detailed information
  static getNetworkStatus(): {
    online: boolean;
    connection?: any;
    downlink?: number;
    effectiveType?: string;
  } {
    const navigator = window.navigator as any;

    return {
      online: navigator.onLine,
      connection: navigator.connection,
      downlink: navigator.connection?.downlink,
      effectiveType: navigator.connection?.effectiveType,
    };
  }
}
