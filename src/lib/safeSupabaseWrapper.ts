// Safe Supabase Wrapper to prevent AbortError and other connection issues
import { supabase } from "./supabase";
import { OfflineModeHandler } from "./offlineModeHandler";

export class SafeSupabaseWrapper {
  // Safe query execution with automatic retry and error handling
  static async safeQuery<T>(
    queryFn: () => Promise<{ data: T; error: any }>,
    retries: number = 1,
  ): Promise<{ data: T | null; error: any; isOffline: boolean }> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Check if we should attempt
        if (!OfflineModeHandler.shouldAttemptConnection()) {
          return {
            data: null,
            error: new Error("Connection cooldown active"),
            isOffline: true,
          };
        }

        console.log(
          `🔄 Attempting Supabase query (attempt ${attempt + 1}/${retries + 1})`,
        );

        // Execute query with timeout
        const queryPromise = queryFn();
        const timeoutPromise = new Promise<{ data: T; error: any }>(
          (_, reject) => {
            setTimeout(() => {
              reject(new Error("Query timeout"));
            }, 8000); // 8 second timeout
          },
        );

        const result = await Promise.race([queryPromise, timeoutPromise]);

        // Success
        OfflineModeHandler.recordAttempt(true);
        console.log("✅ Supabase query successful");

        return {
          data: result.data,
          error: result.error,
          isOffline: false,
        };
      } catch (error: any) {
        lastError = error;
        console.warn(
          `❌ Supabase query failed (attempt ${attempt + 1}):`,
          error.message,
        );

        // Record failed attempt
        OfflineModeHandler.recordAttempt(false);

        // If this was the last attempt, break
        if (attempt === retries) {
          break;
        }

        // Wait before retry
        await this.wait(1000 * (attempt + 1)); // Progressive delay
      }
    }

    // All attempts failed
    const isOffline =
      !navigator.onLine ||
      lastError?.message?.includes("Failed to fetch") ||
      lastError?.message?.includes("NetworkError") ||
      lastError?.message?.includes("timeout");

    return {
      data: null,
      error: lastError,
      isOffline,
    };
  }

  // Safe connection test
  static async testConnection(): Promise<boolean> {
    try {
      const result = await this.safeQuery(
        () => supabase.from("customers").select("count").limit(0),
        0, // No retries for connection test
      );

      return !result.error || result.error.code === "PGRST116";
    } catch {
      return false;
    }
  }

  // Utility: Wait function
  private static wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get a safe Supabase client with built-in error handling
  static getSafeClient() {
    return {
      from: (table: string) => ({
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            single: () =>
              this.safeQuery(() =>
                supabase.from(table).select(columns).eq(column, value).single(),
              ),
            order: (column: string, options?: any) =>
              this.safeQuery(() =>
                supabase
                  .from(table)
                  .select(columns)
                  .eq(column, value)
                  .order(column, options),
              ),
          }),
          limit: (count: number) =>
            this.safeQuery(() =>
              supabase.from(table).select(columns).limit(count),
            ),
          order: (column: string, options?: any) =>
            this.safeQuery(() =>
              supabase.from(table).select(columns).order(column, options),
            ),
        }),
        insert: (data: any) => ({
          select: () =>
            this.safeQuery(() => supabase.from(table).insert(data).select()),
        }),
        update: (data: any) => ({
          eq: (column: string, value: any) =>
            this.safeQuery(() =>
              supabase.from(table).update(data).eq(column, value),
            ),
        }),
        delete: () => ({
          eq: (column: string, value: any) =>
            this.safeQuery(() =>
              supabase.from(table).delete().eq(column, value),
            ),
        }),
      }),
    };
  }
}
