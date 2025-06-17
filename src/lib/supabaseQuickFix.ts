// Quick fix for Supabase connection spam issues
import { isSupabaseConfigured } from "./supabase";

// Simple state to track connection attempts
let connectionAttempts = 0;
let lastAttemptTime = 0;
const MAX_ATTEMPTS = 3;
const COOLDOWN_TIME = 30000; // 30 seconds

// Check if we should try to connect to Supabase
export function shouldAttemptSupabaseConnection(): boolean {
  const now = Date.now();

  // If not configured or not online, don't try
  if (!isSupabaseConfigured || !navigator.onLine) {
    return false;
  }

  // If we've tried too many times recently, wait
  if (
    connectionAttempts >= MAX_ATTEMPTS &&
    now - lastAttemptTime < COOLDOWN_TIME
  ) {
    return false;
  }

  // Reset attempts if cooldown has passed
  if (now - lastAttemptTime > COOLDOWN_TIME) {
    connectionAttempts = 0;
  }

  return true;
}

// Record connection attempt result
export function recordSupabaseAttempt(success: boolean): void {
  lastAttemptTime = Date.now();

  if (success) {
    connectionAttempts = 0; // Reset on success
  } else {
    connectionAttempts++;
  }
}

// Show offline message once
let offlineMessageShown = false;
export function showOfflineModeOnce(): void {
  if (!offlineMessageShown && typeof window !== "undefined") {
    console.log("📱 Working in offline mode - data saved locally");
    offlineMessageShown = true;
  }
}
