import type { ReactNode, FC } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "./button";
import {
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Home,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncStatus } from "@/components/SyncStatus";
import { offlineManager } from "@/lib/offlineManager";
import { logout } from "@/lib/storage";
import { useState } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/", icon: Users, label: "العملاء", name: "customers" },
    {
      path: "/add-sale",
      icon: Plus,
      label: "إضافة عملية بيع",
      name: "add-sale",
    },
    { path: "/inventory", icon: Package, label: "المخزن", name: "inventory" },
    {
      path: "/analytics",
      icon: BarChart3,
      label: "التحليلات",
      name: "analytics",
    },
    { path: "/settings", icon: Settings, label: "الضبط", name: "settings" },
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2 rounded-lg">
                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 hidden xs:block">
                مركز البدر
              </h1>
              <h1 className="text-lg font-bold text-gray-800 xs:hidden">
                البدر
              </h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8 space-x-reverse">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center space-x-2 space-x-reverse py-2 px-3 rounded-lg transition-colors",
                      isActive
                        ? "bg-blue-100 text-blue-600"
                        : "text-gray-600 hover:text-blue-600 hover:bg-blue-50",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side buttons */}
            <div className="flex items-center space-x-4 space-x-reverse">
              {/* Offline Indicator */}
              {!navigator.onLine && (
                <div className="hidden sm:flex items-center gap-2 bg-orange-100 text-orange-800 px-2 py-1 rounded-lg text-xs font-medium">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  أوف لاين
                </div>
              )}

              {/* SyncStatus - Hidden on small screens */}
              <div className="hidden sm:block">
                <SyncStatus />
              </div>

              {/* Logout Button - Desktop */}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="hidden sm:flex bg-red-600 hover:bg-red-700 text-white shadow-lg"
                size="sm"
              >
                <LogOut className="h-4 w-4 ml-1" />
                <span className="hidden md:inline">تسجيل الخروج</span>
              </Button>

              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden"
                size="sm"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <nav className="py-4 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className={cn(
                        "flex items-center space-x-3 space-x-reverse py-3 px-4 rounded-lg transition-colors",
                        isActive
                          ? "bg-blue-100 text-blue-600"
                          : "text-gray-600 hover:text-blue-600 hover:bg-blue-50",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}

                {/* Mobile-only items */}
                <div className="pt-4 mt-4 border-t border-gray-200 space-y-2">
                  {/* Offline indicator */}
                  {!navigator.onLine && (
                    <div className="flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-lg text-sm font-medium">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      أوف لاين
                    </div>
                  )}

                  {/* Sync Status */}
                  <div className="px-4">
                    <SyncStatus />
                  </div>

                  {/* Logout Button */}
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      handleLogout();
                    }}
                    className="w-full flex items-center space-x-3 space-x-reverse py-3 px-4 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">تسجيل الخروج</span>
                  </button>
                </div>
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
