import { supabase, TABLES, isSupabaseConfigured } from "./supabase";
import { Customer, Product, Sale, DebtPayment, Transaction } from "./types";

// Check if database is available
const checkDatabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.",
    );
  }
};

// Customer operations
export const dbCustomers = {
  async getAll(): Promise<Customer[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.CUSTOMERS)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Customer | null> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.CUSTOMERS)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async create(
    customer: Omit<Customer, "id" | "created_at" | "updated_at">,
  ): Promise<Customer> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.CUSTOMERS)
      .insert([customer])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.CUSTOMERS)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    checkDatabase();
    const { error } = await supabase!
      .from(TABLES.CUSTOMERS)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

// Product operations
export const dbProducts = {
  async getAll(): Promise<Product[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.PRODUCTS)
      .select("*")
      .order("name");

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Product | null> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.PRODUCTS)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async create(
    product: Omit<Product, "id" | "created_at" | "updated_at">,
  ): Promise<Product> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.PRODUCTS)
      .insert([product])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.PRODUCTS)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    checkDatabase();
    const { error } = await supabase!
      .from(TABLES.PRODUCTS)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

// Sales operations
export const dbSales = {
  async getAll(): Promise<Sale[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.SALES)
      .select("*")
      .order("sale_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByCustomerId(customerId: string): Promise<Sale[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.SALES)
      .select("*")
      .eq("customer_id", customerId)
      .order("sale_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(
    sale: Omit<Sale, "id" | "created_at" | "updated_at">,
  ): Promise<Sale> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.SALES)
      .insert([sale])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getDailyReport(date: string): Promise<Sale[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.SALES)
      .select(
        `
        *,
        customers (name, phone),
        products (name)
      `,
      )
      .eq("sale_date", date)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },
};

// Debt payment operations
export const dbDebtPayments = {
  async getByCustomerId(customerId: string): Promise<DebtPayment[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.DEBT_PAYMENTS)
      .select("*")
      .eq("customer_id", customerId)
      .order("payment_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(
    payment: Omit<DebtPayment, "id" | "created_at">,
  ): Promise<DebtPayment> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.DEBT_PAYMENTS)
      .insert([payment])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// Transaction operations
export const dbTransactions = {
  async getByCustomerId(customerId: string): Promise<Transaction[]> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.TRANSACTIONS)
      .select("*")
      .eq("customer_id", customerId)
      .order("transaction_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(
    transaction: Omit<Transaction, "id" | "created_at">,
  ): Promise<Transaction> {
    checkDatabase();
    const { data, error } = await supabase!
      .from(TABLES.TRANSACTIONS)
      .insert([transaction])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// Utility function to check if database is available
export const isDatabaseAvailable = (): boolean => {
  return isSupabaseConfigured;
};
