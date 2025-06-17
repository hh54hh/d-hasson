import React, { useState, useEffect } from "react";
import { getCustomers, getProducts, getSales } from "@/lib/storage";
import { offlineManager } from "@/lib/offlineManager";
import { Customer, Product, Sale } from "@/lib/types";

interface FastDataLoaderProps {
  children: (data: {
    customers: Customer[];
    products: Product[];
    sales: Sale[];
    loading: boolean;
    error: string | null;
    refreshData: () => void;
  }) => React.ReactNode;
  loadProducts?: boolean;
  loadCustomers?: boolean;
  loadSales?: boolean;
}

const FastDataLoader: React.FC<FastDataLoaderProps> = ({
  children,
  loadProducts = true,
  loadCustomers = true,
  loadSales = true,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDataInstantly = () => {
    try {
      // Load from localStorage immediately - NO delays
      if (loadCustomers) {
        const localCustomers = getCustomers();
        setCustomers(localCustomers);
      }

      if (loadProducts) {
        const localProducts = getProducts();
        setProducts(localProducts);
      }

      if (loadSales) {
        const localSales = getSales();
        setSales(localSales);
      }

      setLoading(false);
      setError(null);

      console.log("⚡ Fast data loader: Instant display from cache");
    } catch (err: any) {
      console.error("Error in fast data loading:", {
        message: err?.message || "Unknown error",
        code: err?.code || "NO_CODE",
      });
      setError("خطأ في تحميل البيانات");
      setLoading(false);
    }
  };

  const updateInBackground = () => {
    // Background update without blocking UI
    setTimeout(async () => {
      try {
        const updates: Promise<any>[] = [];

        if (loadCustomers) {
          updates.push(offlineManager.getCustomers().then(setCustomers));
        }

        if (loadProducts) {
          updates.push(offlineManager.getProducts().then(setProducts));
        }

        if (loadSales) {
          updates.push(offlineManager.getSales().then(setSales));
        }

        await Promise.all(updates);
        console.log("🔄 Fast data loader: Background update complete");
      } catch (err: any) {
        console.warn("Background update failed:", {
          message: err?.message || "Unknown error",
          code: err?.code || "NO_CODE",
        });
      }
    }, 150);
  };

  const refreshData = () => {
    loadDataInstantly();
    updateInBackground();
  };

  useEffect(() => {
    // Initial load
    loadDataInstantly();
    updateInBackground();
  }, []);

  return (
    <>
      {children({
        customers,
        products,
        sales,
        loading,
        error,
        refreshData,
      })}
    </>
  );
};

export default FastDataLoader;
