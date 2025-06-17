import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format error objects for better logging and display
 * Prevents [object Object] errors
 */
export function formatError(error: any): string {
  if (!error) return "Unknown error";

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (error.message) return error.message;

  if (error.error_description) return error.error_description;

  if (error.details) return error.details;

  try {
    return JSON.stringify(error);
  } catch {
    return error.toString() || "Unknown error";
  }
}

/**
 * Create detailed error info object for logging
 */
export function createErrorInfo(error: any, context?: Record<string, any>) {
  return {
    message: formatError(error),
    code: error?.code || error?.error_code || "NO_CODE",
    details: error?.details || error?.hint || "No details",
    timestamp: new Date().toISOString(),
    ...(context && { context }),
  };
}

/**
 * Log error with proper formatting in Arabic context
 */
export function logError(
  prefix: string,
  error: any,
  context?: Record<string, any>,
) {
  const errorInfo = createErrorInfo(error, context);
  console.error(prefix, errorInfo);

  // Also log a user-friendly message
  const friendlyMessage = `${prefix} ${errorInfo.message} (${errorInfo.code})`;
  console.error(friendlyMessage);

  return errorInfo;
}
