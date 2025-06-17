import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate Supabase configuration
const isValidUrl = supabaseUrl && supabaseUrl.startsWith("https://");
const isValidKey = supabaseKey && supabaseKey.length > 50;

// Check if Supabase is configured
export const isSupabaseConfigured = !!(isValidUrl && isValidKey);

// Log configuration status
if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Supabase configuration missing or invalid. App will work in offline mode.",
  );
  if (!supabaseUrl) console.warn("Missing VITE_SUPABASE_URL");
  if (!supabaseKey) console.warn("Missing VITE_SUPABASE_ANON_KEY");
  if (supabaseUrl && !isValidUrl)
    console.warn("Invalid VITE_SUPABASE_URL format");
  if (supabaseKey && !isValidKey)
    console.warn("Invalid VITE_SUPABASE_ANON_KEY format");
}

// Create Supabase client only if configured
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      db: {
        schema: "public",
      },
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          "X-Client-Info": "paw-inventory@1.0.0",
        },
      },
    })
  : null;

// Database table names
export const TABLES = {
  CUSTOMERS: "customers",
  PRODUCTS: "products",
  SALES: "sales",
  SALE_ITEMS: "sale_items",
  DEBT_PAYMENTS: "debt_payments",
  TRANSACTIONS: "transactions",
} as const;
