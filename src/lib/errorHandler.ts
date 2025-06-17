/**
 * Enhanced error handling utilities
 * يمنع ظهور [object Object] في الأخطاء
 */

export interface ErrorInfo {
  message: string;
  code: string;
  type: "network" | "database" | "validation" | "unknown";
  timestamp: string;
  details?: any;
}

/**
 * Convert any error to a readable format
 */
export function parseError(error: any): ErrorInfo {
  const timestamp = new Date().toISOString();

  // Handle null/undefined
  if (!error) {
    return {
      message: "Unknown error occurred",
      code: "NO_ERROR",
      type: "unknown",
      timestamp,
    };
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      message: error,
      code: "STRING_ERROR",
      type: "unknown",
      timestamp,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name || "ERROR",
      type: getErrorType(error.message),
      timestamp,
      details: error.stack,
    };
  }

  // Handle Supabase errors
  if (error.code && error.message) {
    return {
      message: error.message,
      code: error.code,
      type: "database",
      timestamp,
      details: error.details || error.hint,
    };
  }

  // Handle fetch errors
  if (error.message && error.message.includes("Failed to fetch")) {
    return {
      message: "فشل في الاتصال بالخادم",
      code: "FETCH_FAILED",
      type: "network",
      timestamp,
      details: error.message,
    };
  }

  // Handle network errors
  if (error.message && error.message.includes("NetworkError")) {
    return {
      message: "خطأ في الشبكة",
      code: "NETWORK_ERROR",
      type: "network",
      timestamp,
      details: error.message,
    };
  }

  // Handle objects with nested error info
  if (error.error) {
    return parseError(error.error);
  }

  // Try to extract meaningful info from object
  const message =
    error.message ||
    error.error_description ||
    error.description ||
    error.details ||
    "Unknown error";

  const code =
    error.code || error.error_code || error.status || "UNKNOWN_ERROR";

  return {
    message: typeof message === "string" ? message : JSON.stringify(message),
    code: String(code),
    type: getErrorType(String(message)),
    timestamp,
    details: error,
  };
}

/**
 * Determine error type from message
 */
function getErrorType(
  message: string,
): "network" | "database" | "validation" | "unknown" {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("timeout")
  ) {
    return "network";
  }

  if (
    lowerMessage.includes("supabase") ||
    lowerMessage.includes("database") ||
    lowerMessage.includes("sql") ||
    lowerMessage.includes("table")
  ) {
    return "database";
  }

  if (
    lowerMessage.includes("validation") ||
    lowerMessage.includes("required") ||
    lowerMessage.includes("invalid")
  ) {
    return "validation";
  }

  return "unknown";
}

/**
 * Log error with enhanced formatting
 */
export function logEnhancedError(prefix: string, error: any, context?: any) {
  const errorInfo = parseError(error);

  console.group(`❌ ${prefix}`);
  console.error("Message:", errorInfo.message);
  console.error("Code:", errorInfo.code);
  console.error("Type:", errorInfo.type);
  console.error("Time:", errorInfo.timestamp);

  if (errorInfo.details) {
    console.error("Details:", errorInfo.details);
  }

  if (context) {
    console.error("Context:", context);
  }

  console.groupEnd();

  return errorInfo;
}

/**
 * Get user-friendly error message in Arabic
 */
export function getArabicErrorMessage(error: any): string {
  const errorInfo = parseError(error);

  switch (errorInfo.type) {
    case "network":
      return "مشكلة في الاتصال بالإنترنت. تحقق من اتصالك وحاول مرة أخرى.";

    case "database":
      return "مشكلة في قاعدة البيانات. جاري المحاولة مرة أخرى...";

    case "validation":
      return "بيانات غير صحيحة. تحقق من المعلومات المدخلة.";

    default:
      return errorInfo.message || "حدث خطأ غير متوقع";
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  const errorInfo = parseError(error);

  return (
    errorInfo.type === "network" ||
    errorInfo.code === "FETCH_FAILED" ||
    errorInfo.code === "NETWORK_ERROR" ||
    errorInfo.message.includes("timeout")
  );
}
