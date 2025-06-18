import React, { useEffect, type ReactNode, type FC } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddSale from "./pages/AddSale";
import Inventory from "./pages/Inventory";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import EmergencyFix from "./pages/EmergencyFix";
import FixCustomerStatement from "./pages/FixCustomerStatement";
import CustomerStatementDebug from "./pages/CustomerStatementDebug";
import CustomerStatementFix from "./pages/CustomerStatementFix";
import { isAuthenticated, initializeDefaultData } from "./lib/storage";
import { ToastProvider } from "./components/ToastProvider";
import PWAInstaller from "./components/PWAInstaller";
import OfflineIndicator from "./components/OfflineIndicator";
import { quickFixSyncErrors } from "./lib/quickSyncFix";
import { appInitializer } from "./lib/appInitializer";
import { offlineDataManager } from "./lib/offlineDataManager";
import { MemoryCleanup } from "./lib/memoryCleanup";
import { RealDataLoader } from "./lib/realDataLoader";
import { CleanupFakeData } from "./lib/cleanupFakeData";
// استيرادات التنظيف التلقائي تم إزالتها لحل مشكلة الـ refresh المستمر

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Faster settings for better performance
      staleTime: 1 * 60 * 1000, // 1 minute
      cacheTime: 5 * 60 * 1000, // 5 minutes
      retry: 1, // Only retry once
      retryDelay: 1000, // Fixed 1 second delay
      refetchOnWindowFocus: false, // Disable auto refetch for performance
      refetchOnMount: false, // Don't refetch on mount
    },
    mutations: {
      retry: 1, // Only retry once
    },
  },
});

// Protected Route Component - Improved to prevent redirect loops
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isChecking, setIsChecking] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);

  React.useEffect(() => {
    // Check authentication with a small delay to prevent race conditions
    const checkAuth = () => {
      try {
        const authStatus = isAuthenticated();
        setAuthenticated(authStatus);
        setIsChecking(false);
      } catch (error) {
        console.warn("Authentication check failed:", error);
        setAuthenticated(false);
        setIsChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAuth, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  return authenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Ultra Simple App Initializer - No Background Processing
let appInitialized = false; // Global flag to prevent double initialization

const AppInitializer: FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    let isMounted = true;

    // Prevent double initialization
    if (appInitialized) {
      setIsReady(true);
      return;
    }

    // Super simple initialization - NO background processing
    const initialize = async () => {
      try {
        if (!isMounted || appInitialized) return;

        console.log("⚡ Ultra-fast initialization...");
        appInitialized = true;

        // Initialize memory cleanup first
        MemoryCleanup.setupAutoCleanup();

        // Initialize for real data only (no fake data)
        initializeDefaultData();

        if (!isMounted) return;

        // تم إزالة التنظيف التلقائي لحل مشكلة الـ refresh المستمر
        // يمكن للمستخدم استخدام التنظيف اليدوي من الإعدادات عند الحاجة

        console.log("✅ App ready with real data loading");
        setIsReady(true);
      } catch (error) {
        console.warn("⚠️ Initialization warning:", error);
        // Continue anyway
        setIsReady(true);
      }
    };

    initialize();

    // Setup periodic memory cleanup to prevent leaks - less frequent
    const cleanupInterval = setInterval(() => {
      if (isMounted) {
        MemoryCleanup.cleanupMonacoListeners();
        MemoryCleanup.forceGarbageCollection();
      }
    }, 120000); // Every 2 minutes

    // Cleanup on unmount
    return () => {
      isMounted = false;
      clearInterval(cleanupInterval);
      MemoryCleanup.cleanup();
    };
  }, []); // Empty dependency array - run only once

  // Show loading state briefly, then app
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">تحضير التطبيق...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <AppInitializer>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-sale"
                element={
                  <ProtectedRoute>
                    <AddSale />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute>
                    <Inventory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/emergency-fix"
                element={
                  <ProtectedRoute>
                    <EmergencyFix />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fix-customer-statement"
                element={
                  <ProtectedRoute>
                    <FixCustomerStatement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/debug-customer-statement"
                element={
                  <ProtectedRoute>
                    <CustomerStatementDebug />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer-statement-fix"
                element={
                  <ProtectedRoute>
                    <CustomerStatementFix />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* PWA and Offline Components */}
            <PWAInstaller />
            <OfflineIndicator />
          </Router>
        </AppInitializer>
      </QueryClientProvider>
    </ToastProvider>
  );
};

export default App;
