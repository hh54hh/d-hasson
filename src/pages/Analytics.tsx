import React, { useState, useEffect } from "react";
import Layout from "@/components/ui/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  Calendar,
  Eye,
  Download,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Customer, Product, Sale } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  getCustomers,
  getProducts,
  getSales,
} from "@/lib/storage";
import {
  calculateBusinessKPIs,
  analyzeInventory,
  analyzeCustomer,
} from "@/lib/calculations";
import { supabaseService } from "@/lib/supabaseService";
import { offlineManager } from "@/lib/offlineManager";

const Analytics: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyReportData, setDailyReportData] = useState<any[]>([]);

  // Fast local data loading (instant)
  const loadDataInstantly = () => {
    try {
      const localCustomers = getCustomers();
      const localProducts = getProducts();
      const localSales = getSales();

      setCustomers(localCustomers);
      setProducts(localProducts);
      setSales(localSales);

      console.log("⚡ Analytics data loaded instantly from localStorage");
    } catch (error) {
      console.warn("Warning loading local analytics data:", error);
    }
  };

  useEffect(() => {
    // Load data instantly from localStorage first
    loadDataInstantly();

    // Load the daily report for today
    if (selectedDate) {
      loadDailyReport(selectedDate);
    }
  }, []);

  useEffect(() => {
    if (selectedDate && customers.length > 0 && products.length > 0) {
      loadDailyReport(selectedDate);
    }
  }, [selectedDate, customers.length, products.length, sales.length]);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log("📊 Loading analytics data...");

      // Try to load fresh data from Supabase first
      try {
        const [customersData, productsData, salesData] = await Promise.all([
          supabaseService.getCustomers(),
          supabaseService.getProducts(),
          supabaseService.getSales(),
        ]);

        setCustomers(customersData);
        setProducts(productsData);
        setSales(salesData);

        console.log(
          `✅ Analytics data loaded: ${customersData.length} customers, ${productsData.length} products, ${salesData.length} sales`,
        );

        // Cache the fresh data
        offlineManager.cacheData("customers", customersData);
        offlineManager.cacheData("products", productsData);
        offlineManager.cacheData("sales", salesData);
      } catch (supabaseError: any) {
        console.warn(
          "⚠️ Supabase unavailable for analytics, using offline data:",
          supabaseError.message,
        );

        // Fallback to cached data
        const cachedCustomers = offlineManager.getCachedData("customers");
        const cachedProducts = offlineManager.getCachedData("products");
        const cachedSales = offlineManager.getCachedData("sales");

        setCustomers(cachedCustomers);
        setProducts(cachedProducts);
        setSales(cachedSales);

        console.log(
          `📱 Using cached data: ${cachedCustomers.length} customers, ${cachedProducts.length} products, ${cachedSales.length} sales`,
        );

        if (
          supabaseError.message?.includes("offline") ||
          supabaseError.message?.includes("أوف لاين")
        ) {
          setError("يتم العمل في وضع عدم الاتصال. البيانات قد لا تكون محدثة.");
        } else {
          setError(
            "تعذر الاتصال بقاعدة البيانات. يتم عرض البيانات المحفوظة محلياً.",
          );
        }
      }
    } catch (error) {
      console.error("Unexpected error loading analytics data:", error);
      setError("حدث خطأ غير متوقع في تحميل بيانات التحليلات.");

      // Last resort: try to load anything available
      try {
        setCustomers(offlineManager.getCachedData("customers") || []);
        setProducts(offlineManager.getCachedData("products") || []);
        setSales(offlineManager.getCachedData("sales") || []);
      } catch (cacheError) {
        console.error("Failed to load cached data:", cacheError);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDailyReport = async (date: string) => {
    console.log(`📊 Loading daily report for: ${date}`);

    try {
      // Load real data from Supabase first
      const freshSales = await offlineManager.getSales();
      const freshCustomers = await offlineManager.getCustomers();
      const freshProducts = await offlineManager.getProducts();

      console.log(
        `📊 Fresh data loaded: ${freshSales.length} sales, ${freshCustomers.length} customers, ${freshProducts.length} products`,
      );

      // Build detailed report data from real sales
      const detailedReportData = [];

      for (const sale of freshSales) {
        // Filter by date
        const saleDate = sale.saleDate;
        if (saleDate === date || saleDate.startsWith(date)) {
          const customer = freshCustomers.find((c) => c.id === sale.customerId);

          // If sale has multiple items, create a row for each item
          if (sale.items && sale.items.length > 0) {
            for (const item of sale.items) {
              const product = freshProducts.find(
                (p) => p.id === item.productId,
              );

              detailedReportData.push({
                id: `${sale.id}-${item.id}`,
                sale_id: sale.id,
                customer_id: sale.customerId,
                customerName: customer?.name || "غير معروف",
                customerPhone: customer?.phone || "",
                productName:
                  item.productName || product?.name || "منتج غير محدد",
                product_id: item.productId,
                quantity: item.quantity || 1,
                unit_price: item.unitPrice || 0,
                total_amount: item.totalAmount || 0,
                paid_amount:
                  sale.paymentType === "cash"
                    ? item.totalAmount || 0
                    : sale.paymentType === "deferred"
                      ? 0
                      : Math.round(
                          (item.totalAmount || 0) *
                            (sale.paidAmount / sale.totalAmount),
                        ),
                remaining_amount:
                  sale.paymentType === "cash"
                    ? 0
                    : sale.paymentType === "deferred"
                      ? item.totalAmount || 0
                      : Math.round(
                          (item.totalAmount || 0) *
                            (sale.remainingAmount / sale.totalAmount),
                        ),
                profit_amount: item.profitAmount || 0,
                payment_type: sale.paymentType,
                sale_date: sale.saleDate,
                created_at: sale.created_at || new Date().toISOString(),
                notes: sale.notes || "",
              });
            }
          } else {
            // Fallback for sales without items (old format)
            detailedReportData.push({
              id: sale.id,
              sale_id: sale.id,
              customer_id: sale.customerId,
              customerName: customer?.name || "غير معروف",
              customerPhone: customer?.phone || "",
              productName: "بيع عام",
              product_id: "",
              quantity: 1,
              unit_price: sale.totalAmount,
              total_amount: sale.totalAmount,
              paid_amount: sale.paidAmount,
              remaining_amount: sale.remainingAmount,
              profit_amount: sale.profitAmount || 0,
              payment_type: sale.paymentType,
              sale_date: sale.saleDate,
              created_at: sale.created_at || new Date().toISOString(),
              notes: sale.notes || "",
            });
          }
        }
      }

      // Sort by creation time (newest first)
      detailedReportData.sort(
        (a, b) =>
          new Date(b.created_at || "").getTime() -
          new Date(a.created_at || "").getTime(),
      );

      console.log(
        `✅ Detailed report built: ${detailedReportData.length} items for ${date}`,
      );
      setDailyReportData(detailedReportData);
    } catch (error: any) {
      const errorMessage = error?.message || "خطأ في تحميل التقرير";
      console.warn("⚠️ Failed to load daily report:", errorMessage);

      // Fallback to local data if available
      try {
        const localSales = sales.length > 0 ? sales : getSales();
        const localCustomers =
          customers.length > 0 ? customers : getCustomers();
        const localProducts = products.length > 0 ? products : getProducts();

        const localDetailedData = [];

        for (const sale of localSales) {
          const saleDate = sale.saleDate;
          if (saleDate === date || saleDate.startsWith(date)) {
            const customer = localCustomers.find(
              (c) => c.id === sale.customerId,
            );

            if (sale.items && sale.items.length > 0) {
              for (const item of sale.items) {
                const product = localProducts.find(
                  (p) => p.id === item.productId,
                );

                localDetailedData.push({
                  id: `${sale.id}-${item.id}`,
                  sale_id: sale.id,
                  customer_id: sale.customerId,
                  customerName: customer?.name || "غير معروف",
                  customerPhone: customer?.phone || "",
                  productName:
                    item.productName || product?.name || "منتج غير محدد",
                  product_id: item.productId,
                  quantity: item.quantity || 1,
                  unit_price: item.unitPrice || 0,
                  total_amount: item.totalAmount || 0,
                  paid_amount:
                    sale.paymentType === "cash"
                      ? item.totalAmount || 0
                      : sale.paymentType === "deferred"
                        ? 0
                        : Math.round(
                            (item.totalAmount || 0) *
                              (sale.paidAmount / sale.totalAmount),
                          ),
                  profit_amount: item.profitAmount || 0,
                  payment_type: sale.paymentType,
                  sale_date: sale.saleDate,
                  created_at: sale.created_at || new Date().toISOString(),
                  notes: sale.notes || "",
                });
              }
            } else {
              localDetailedData.push({
                id: sale.id,
                sale_id: sale.id,
                customer_id: sale.customerId,
                customerName: customer?.name || "غير معروف",
                customerPhone: customer?.phone || "",
                productName: "بيع عام",
                product_id: "",
                quantity: 1,
                unit_price: sale.totalAmount,
                total_amount: sale.totalAmount,
                paid_amount: sale.paidAmount,
                remaining_amount: sale.remainingAmount,
                profit_amount: sale.profitAmount || 0,
                payment_type: sale.paymentType,
                sale_date: sale.saleDate,
                created_at: sale.created_at || new Date().toISOString(),
                notes: sale.notes || "",
              });
            }
          }
        }

        localDetailedData.sort(
          (a, b) =>
            new Date(b.created_at || "").getTime() -
            new Date(a.created_at || "").getTime(),
        );

        console.log(
          `📱 Local fallback report: ${localDetailedData.length} items for ${date}`,
        );
        setDailyReportData(localDetailedData);
      } catch (fallbackError) {
        console.error("❌ Even local fallback failed:", fallbackError);
        setDailyReportData([]);
      }
    }
  };

  // Filter sales based on time period
  const getFilteredSales = () => {
    const now = new Date();
    const filterDate = new Date();

    switch (timeFilter) {
      case "today":
        filterDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        filterDate.setDate(now.getDate() - 7);
        break;
      case "month":
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return sales;
    }

    return sales.filter((sale) => new Date(sale.saleDate) >= filterDate);
  };

  const filteredSales = getFilteredSales();
  const businessKPIs = calculateBusinessKPIs(
    customers,
    products,
    filteredSales,
  );
  const inventoryAnalysis = analyzeInventory(products);

  // Daily report statistics
  const dailyStats = {
    totalSales: dailyReportData.length,
    totalRevenue: dailyReportData.reduce(
      (sum, sale) => sum + sale.total_amount,
      0,
    ),
    cashSales: dailyReportData.filter((sale) => sale.payment_type === "cash")
      .length,
    deferredSales: dailyReportData.filter(
      (sale) => sale.payment_type === "deferred",
    ).length,
    partialSales: dailyReportData.filter(
      (sale) => sale.payment_type === "partial",
    ).length,
    totalProfit: dailyReportData.reduce(
      (sum, sale) => sum + (sale.profit_amount || 0),
      0,
    ),
  };

  // Advanced analytics calculations
  const salesByDay = filteredSales.reduce(
    (acc, sale) => {
      const day = sale.saleDate;
      acc[day] = (acc[day] || 0) + sale.totalAmount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topProducts = products
    .map((product) => {
      const productSales = filteredSales.filter(
        (s) => s.productId === product.id,
      );
      const totalSold = productSales.reduce((sum, s) => sum + s.quantity, 0);
      const revenue = productSales.reduce((sum, s) => sum + s.totalAmount, 0);
      return { ...product, totalSold, revenue };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const topCustomers = customers
    .map((customer) => {
      const customerAnalysis = analyzeCustomer(customer, filteredSales);
      return { ...customer, ...customerAnalysis };
    })
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 5);

  const salesTrends = Object.entries(salesByDay)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .slice(-7); // Last 7 data points

  // Performance indicators
  const performanceIndicators = [
    {
      title: "نمو الإيرادات",
      value: businessKPIs.totalRevenue,
      change: "+12.5%",
      trend: "up",
      color: "green",
    },
    {
      title: "معدل التحويل",
      value: `${businessKPIs.cashSalesRatio.toFixed(1)}%`,
      change: "+3.2%",
      trend: "up",
      color: "blue",
    },
    {
      title: "متوسط قيمة الطلب",
      value: businessKPIs.avgOrderValue,
      change: "-1.8%",
      trend: "down",
      color: "orange",
    },
    {
      title: "دوران المخزون",
      value: `${businessKPIs.inventoryTurnover.toFixed(2)}x`,
      change: "+5.7%",
      trend: "up",
      color: "purple",
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">
              جاري تحميل البيانات التحليلية من Supabase...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              لوحة التحليلات المتقدمة
            </h1>
            <p className="text-gray-600 mt-1">
              تحليلات الأعمال الذكية ومؤشرات الأداء - متصل مع Supabase
            </p>
          </div>

          <div className="flex gap-2">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفترات</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">الأسبوع الماضي</SelectItem>
                <SelectItem value="month">الشهر الماضي</SelectItem>
                <SelectItem value="quarter">ربع سنوي</SelectItem>
                <SelectItem value="year">سنوي</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`}
              />
              تحديث
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="mr-auto text-red-600"
            >
              ✕
            </Button>
          </div>
        )}

        {/* Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceIndicators.map((indicator, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {indicator.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {typeof indicator.value === "number"
                        ? formatCurrency(indicator.value)
                        : indicator.value}
                    </p>
                    <div className="flex items-center mt-2">
                      {indicator.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span
                        className={`text-sm ml-1 ${
                          indicator.trend === "up"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {indicator.change}
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-full bg-${indicator.color}-100`}>
                    <BarChart3
                      className={`h-6 w-6 text-${indicator.color}-600`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Daily Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              التقارير اليومية التفصيلية
            </CardTitle>
            <CardDescription>
              تقرير مفصل للمبيعات والعمليات اليومية من قاعدة البيانات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Date Selector */}
              <div className="flex items-center gap-4">
                <Label htmlFor="report-date" className="text-sm font-medium">
                  اختر التاريخ:
                </Label>
                <Input
                  id="report-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48"
                />
                <Button
                  onClick={() => {
                    loadDataInstantly();
                    loadDailyReport(selectedDate);
                  }}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  تحديث البيانات
                </Button>
              </div>

              {/* Daily Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {dailyStats.totalSales}
                    </div>
                    <div className="text-sm text-blue-700">إجمالي المبيعات</div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(dailyStats.totalRevenue)}
                    </div>
                    <div className="text-sm text-green-700">
                      إجمالي الإيرادات
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {dailyStats.cashSales}
                    </div>
                    <div className="text-sm text-emerald-700">مبيعات نقدية</div>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {dailyStats.deferredSales}
                    </div>
                    <div className="text-sm text-red-700">مبيعات آجلة</div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {dailyStats.partialSales}
                    </div>
                    <div className="text-sm text-yellow-700">دفع جزئي</div>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {formatCurrency(dailyStats.totalProfit)}
                    </div>
                    <div className="text-sm text-purple-700">إجمالي الربح</div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Daily Report Table */}
              {dailyReportData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-right">
                          رقم الفاتورة
                        </TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">
                          المبلغ الإجمالي
                        </TableHead>
                        <TableHead className="text-right">
                          المبلغ المدفوع
                        </TableHead>
                        <TableHead className="text-right">نوع الدفع</TableHead>
                        <TableHead className="text-right">الربح</TableHead>
                        <TableHead className="text-right">الوقت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReportData.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            INV-{item.sale_id?.slice(-6) || "000000"}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {item.customerName || "غير معروف"}
                              </div>
                              <div className="text-sm text-gray-600">
                                {item.customerPhone || "لا يوجد"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.productName || "منتج غير محدد"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {item.quantity || 0}
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600">
                            {formatCurrency(item.total_amount || 0)}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(item.paid_amount || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                item.payment_type === "cash"
                                  ? "bg-green-100 text-green-800"
                                  : item.payment_type === "deferred"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {item.payment_type === "cash" && (
                                <CheckCircle className="h-3 w-3 ml-1" />
                              )}
                              {item.payment_type === "deferred" && (
                                <Clock className="h-3 w-3 ml-1" />
                              )}
                              {item.payment_type === "partial" && (
                                <CreditCard className="h-3 w-3 ml-1" />
                              )}
                              {item.payment_type === "cash"
                                ? "نقدي"
                                : item.payment_type === "deferred"
                                  ? "آجل"
                                  : "جزئي"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-purple-600">
                            {formatCurrency(item.profit_amount || 0)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString(
                                  "ar-SA",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "2-digit",
                                  },
                                )
                              : "غير محدد"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">
                    لا توجد مبيعات في هذا التاريخ
                  </h3>
                  <p>اختر تاريخاً آخر لعرض التقرير</p>
                </div>
              )}

              {/* Export Daily Report */}
              {dailyReportData.length > 0 && (
                <div className="flex gap-4 pt-4 border-t">
                  <Button
                    onClick={() => {
                      const reportData = {
                        date: selectedDate,
                        stats: dailyStats,
                        sales: dailyReportData,
                        exportTime: new Date().toISOString(),
                      };
                      const blob = new Blob(
                        [JSON.stringify(reportData, null, 2)],
                        {
                          type: "application/json",
                        },
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `daily-report-${selectedDate}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 ml-2" />
                    تصدير التقرير اليومي
                  </Button>

                  <Button
                    onClick={() => {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html dir="rtl">
                          <head>
                            <title>التقرير اليومي - ${formatDate(selectedDate)}</title>
                            <meta charset="utf-8">
                            <style>
                              body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; }
                              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                              th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                              th { background: #f5f5f5; font-weight: bold; }
                              .header { text-align: center; margin-bottom: 30px; }
                              .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
                              .stat-card { padding: 15px; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
                            </style>
                          </head>
                          <body>
                            <div class="header">
                              <h1>📱 PAW - التقرير اليومي</h1>
                              <h2>📅 ${formatDate(selectedDate)}</h2>
                              <p>البيانات من قاعدة بيانات Supabase</p>
                            </div>

                            <div class="stats">
                              <div class="stat-card">
                                <h3>إجمالي المبيعات</h3>
                                <p style="font-size: 24px; font-weight: bold; color: #2563eb;">${dailyStats.totalSales}</p>
                              </div>
                              <div class="stat-card">
                                <h3>إجمالي الإيرادات</h3>
                                <p style="font-size: 20px; font-weight: bold; color: #059669;">${formatCurrency(dailyStats.totalRevenue)}</p>
                              </div>
                              <div class="stat-card">
                                <h3>إجمالي الربح</h3>
                                <p style="font-size: 20px; font-weight: bold; color: #7c3aed;">${formatCurrency(dailyStats.totalProfit)}</p>
                              </div>
                            </div>

                            <table>
                              <thead>
                                <tr>
                                  <th>العميل</th>
                                  <th>المنتج</th>
                                  <th>الكمية</th>
                                  <th>المبلغ الإجمالي</th>
                                  <th>المبلغ المدفوع</th>
                                  <th>نوع الدفع</th>
                                  <th>الربح</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${dailyReportData
                                  .map(
                                    (sale) => `
                                  <tr>
                                    <td>${sale.customerName}</td>
                                    <td>${sale.productName}</td>
                                    <td>${sale.quantity}</td>
                                    <td>${formatCurrency(sale.total_amount)}</td>
                                    <td>${formatCurrency(sale.paid_amount)}</td>
                                    <td>${sale.payment_type === "cash" ? "نقدي" : sale.payment_type === "deferred" ? "آجل" : "جزئي"}</td>
                                    <td>${formatCurrency(sale.profit_amount || 0)}</td>
                                  </tr>
                                `,
                                  )
                                  .join("")}
                              </tbody>
                            </table>

                            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
                              تم إنشاء التقرير من قاعدة بيانات Supabase | ${new Date().toLocaleString("ar-SA")}
                            </div>
                          </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 ml-2" />
                    طباعة التقرير اليومي
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products and Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                أفضل المنتجات أداءً
              </CardTitle>
              <CardDescription>المنتجات الأكثر مبيعاً وربحية</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-100 text-blue-800">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-600">
                          مبيع: {product.totalSold} قطعة
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {formatCurrency(product.revenue)}
                      </p>
                      <p className="text-sm text-gray-600">
                        الربح:{" "}
                        {formatCurrency(
                          (product.salePrice - product.wholesalePrice) *
                            product.totalSold,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                أفضل العملاء
              </CardTitle>
              <CardDescription>العملاء الأكثر قيمة وولاءً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className="bg-purple-100 text-purple-800">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-gray-600">
                          {customer.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">
                        {formatCurrency(customer.totalPurchases)}
                      </p>
                      <p className="text-sm text-gray-600">
                        متوسط الطلب:{" "}
                        {formatCurrency(customer.averageOrderValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-gray-600" />
              تصدير التحليلات
            </CardTitle>
            <CardDescription>
              تصدير جميع البيانات التحليلية من Supabase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={() => {
                  const data = {
                    period: timeFilter,
                    businessKPIs,
                    inventoryAnalysis,
                    topProducts,
                    topCustomers,
                    salesTrends,
                    dailyStats,
                    exportDate: new Date().toISOString(),
                    dataSource: "Supabase",
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `analytics-${formatDate(new Date()).replace(/\//g, "-")}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                variant="outline"
              >
                <Download className="h-4 w-4 ml-2" />
                تصدير البيانات
              </Button>

              <Button onClick={() => window.print()} variant="outline">
                <Download className="h-4 w-4 ml-2" />
                طباعة التقرير
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Analytics;
