// Utility to handle Supabase errors gracefully
export interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export const handleSupabaseError = (error: any): string => {
  // Handle different types of errors
  if (!error) return "خطأ غير معروف";

  // If it's a string, return it directly
  if (typeof error === "string") return error;

  // If it has a message property
  if (error.message) {
    // Handle specific Supabase error codes
    if (error.code === "PGRST200") {
      return "مشكلة في هيكل قاعدة البيانات - سيتم استخدام البيانات المحلية";
    }

    if (error.code === "23505") {
      return "البيانات موجودة مسبقاً";
    }

    if (error.code === "23503") {
      return "مرجع غير صالح في قاعدة البيانات";
    }

    return error.message;
  }

  // If it has error details
  if (error.details) {
    return `خطأ في قاعدة البيانات: ${error.details}`;
  }

  // Response stream errors
  if (error.toString().includes("body stream already read")) {
    return "خطأ في قراءة البيانات - سيتم المحاولة مرة أخرى";
  }

  // Network errors
  if (
    error.toString().includes("NetworkError") ||
    error.toString().includes("fetch") ||
    error.toString().includes("Failed to fetch") ||
    error.name === "TypeError" ||
    error.message?.includes("Failed to fetch")
  ) {
    return navigator.onLine
      ? "فشل الاتصال مع قاعدة البيانات - تحقق من إعدادات Supabase"
      : "لا يوجد اتصال بالإنترنت - البرنامج يعمل في وضع أوف لاين";
  }

  // Generic fallback
  return error.toString() || "خطأ غير معروف";
};

export const isRelationshipError = (error: any): boolean => {
  if (!error) return false;

  const errorStr = error.toString().toLowerCase();
  const errorMessage = error.message?.toLowerCase() || "";

  return (
    errorStr.includes("relationship") ||
    errorStr.includes("foreign key") ||
    errorMessage.includes("relationship") ||
    errorMessage.includes("foreign key") ||
    error.code === "PGRST200"
  );
};

export const isStreamError = (error: any): boolean => {
  if (!error) return false;

  const errorStr = error.toString().toLowerCase();
  return errorStr.includes("body stream already read");
};

// Wrapper function for safe Supabase operations
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<T>,
  fallback: T,
  operationName?: string,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    console.warn(
      `⚠️ ${operationName || "Supabase operation"} failed:`,
      errorMessage,
    );

    // If it's a relationship error, we might want to retry with a different approach
    if (isRelationshipError(error)) {
      console.log("🔄 Relationship error detected, using fallback approach");
    }

    return fallback;
  }
};

// Retry mechanism for failed operations
export const retrySupabaseOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on relationship errors - they won't resolve by retrying
      if (isRelationshipError(error)) {
        throw error;
      }

      // Don't retry on stream errors - they won't resolve by retrying
      if (isStreamError(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        console.log(
          `🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError;
};
