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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Search,
  RefreshCw,
  Save,
  AlertCircle,
} from "lucide-react";
import { Product } from "@/lib/types";
import { formatCurrency, getProducts } from "@/lib/storage";
import { analyzeInventory, suggestOptimalPrice } from "@/lib/calculations";
import { formatError } from "@/lib/utils";
import { useRealTimeDataSync } from "@/lib/realTimeDataSync";
import { supabaseService } from "@/lib/supabaseService";
import { cn } from "@/lib/utils";
import InventoryDiagnostic from "@/components/InventoryDiagnostic";
import { offlineManager } from "@/lib/offlineManager";
import FastDataLoader from "@/components/FastDataLoader";

const Inventory: React.FC = () => {
  return (
    <FastDataLoader loadCustomers={false} loadSales={false}>
      {({ products, loading, error, refreshData }) => (
        <InventoryContent
          products={products}
          loading={loading}
          error={error}
          refreshData={refreshData}
        />
      )}
    </FastDataLoader>
  );
};

interface InventoryContentProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

const InventoryContent: React.FC<InventoryContentProps> = ({
  products,
  loading,
  error: dataError,
  refreshData,
}) => {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // Add/Edit product modal states
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: "",
    wholesalePrice: 0,
    salePrice: 0,
    quantity: 0,
    minQuantity: 5,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time data sync for broadcasting updates
  const { broadcastUpdate } = useRealTimeDataSync();

  useEffect(() => {
    const filtered = products.filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredProducts(filtered);
  }, [products, searchTerm]);

  // Use error from FastDataLoader or local error
  const displayError = dataError || error;

  const loadProducts = async (forceRefresh = false) => {
    try {
      setLocalLoading(true);
      setError(null);

      if (forceRefresh) {
        console.log("🔄 Force refreshing product quantities from Supabase...");
      }

      let productsData = [];

      try {
        // Try to load from Supabase first
        productsData = await supabaseService.getProducts();
        console.log(`✅ Loaded ${productsData.length} products from Supabase`);
      } catch (supabaseError: any) {
        const errorMessage = formatError(supabaseError);
        console.warn(
          "⚠️ Supabase unavailable, loading from offline cache:",
          errorMessage,
        );

        // Fall back to offline data
        try {
          productsData = await offlineManager.getProducts();
          console.log(
            `📱 Loaded ${productsData.length} products from offline cache`,
          );

          if (
            errorMessage?.includes("offline") ||
            errorMessage?.includes("أوف لاين") ||
            errorMessage?.includes("timed out")
          ) {
            setError(
              "يتم العمل في وضع عدم الاتصال. البيانات قد لا تكون محدثة.",
            );
          } else {
            setError(
              `تعذر الاتصال بقاعدة البيانات: ${errorMessage}. يتم عرض البيانات المحفوظة محلياً.`,
            );
          }
        } catch (offlineError) {
          console.error("Failed to load from offline cache:", offlineError);
          setError("فشل في تحميل المنتجات من جميع المصادر.");
          return;
        }
      }

      // Update filtered products immediately
      setFilteredProducts(productsData);

      // Trigger parent data refresh
      refreshData();

      if (forceRefresh && productsData.length > 0) {
        console.log(
          `✅ Refreshed ${productsData.length} products successfully`,
        );
        // Clear error if successful
        setError(null);
      }
    } catch (error) {
      console.error("Unexpected error loading products:", error);
      setError("حدث خطأ غير متوقع في تحميل المنتجات.");
    } finally {
      setLocalLoading(false);
    }
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        name: product.name,
        wholesalePrice: product.wholesalePrice,
        salePrice: product.salePrice,
        quantity: product.quantity,
        minQuantity: product.minQuantity,
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: "",
        wholesalePrice: 0,
        salePrice: 0,
        quantity: 0,
        minQuantity: 5,
      });
    }
    setProductModalOpen(true);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productFormData.name.trim()) {
      setError("اسم المنتج مطلوب");
      return;
    }

    if (productFormData.wholesalePrice <= 0 || productFormData.salePrice <= 0) {
      setError("يجب أن تكون الأسعار أكبر من صفر");
      return;
    }

    if (productFormData.salePrice <= productFormData.wholesalePrice) {
      setError("سعر البيع يجب أن يكون أكبر من سعر الجملة");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingProduct) {
        // Update existing product
        await supabaseService.updateProduct(editingProduct.id, {
          name: productFormData.name,
          wholesalePrice: productFormData.wholesalePrice,
          salePrice: productFormData.salePrice,
          quantity: productFormData.quantity,
          minQuantity: productFormData.minQuantity,
        });

        // Broadcast update immediately
        broadcastUpdate("products", "update", {
          id: editingProduct.id,
          name: productFormData.name,
          wholesalePrice: productFormData.wholesalePrice,
          salePrice: productFormData.salePrice,
          quantity: productFormData.quantity,
          minQuantity: productFormData.minQuantity,
        });

        alert("تم تحديث المنتج بنجاح في قاعدة البيانات!");
      } else {
        // Create new product
        const newProduct = await supabaseService.createProduct({
          name: productFormData.name,
          wholesalePrice: productFormData.wholesalePrice,
          salePrice: productFormData.salePrice,
          quantity: productFormData.quantity,
          minQuantity: productFormData.minQuantity,
        });

        // Broadcast new product immediately
        broadcastUpdate("products", "add", newProduct);

        alert("تم إضافة المنتج بنجاح إلى قاعدة البيانات!");
      }

      setProductModalOpen(false);

      // Refresh data immediately
      refreshData();
    } catch (error) {
      console.error("Error saving product:", error);
      setError("حدث خطأ أثناء حفظ المنتج. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await supabaseService.deleteProduct(productId);

      // Broadcast deletion immediately
      broadcastUpdate("products", "delete", { id: productId });

      // Refresh data immediately
      refreshData();

      alert("تم حذف المنتج بنجاح من قاعدة البيانات!");
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("حدث خطأ أثناء حذف المنتج");
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.quantity === 0) {
      return {
        label: "نفد المخزون",
        variant: "destructive" as const,
        className: "bg-red-100 text-red-800 border-red-300",
      };
    } else if (product.quantity <= product.minQuantity) {
      return {
        label: "مخزون منخفض",
        variant: "destructive" as const,
        className: "bg-yellow-100 text-yellow-800 border-yellow-300",
      };
    } else {
      return {
        label: "متوفر",
        variant: "default" as const,
        className: "bg-green-100 text-green-800 border-green-300",
      };
    }
  };

  const inventoryAnalysis = analyzeInventory(products);
  const lowStockProducts = products.filter((p) => p.quantity <= p.minQuantity);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل المنتجات من Supabase...</p>
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
              <Package className="h-8 w-8 text-green-600" />
              إدارة المخزون
            </h1>
            <p className="text-gray-600 mt-1">
              إدارة المنتجات والمخزون - متصل مع Supabase
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => loadProducts(true)}
              variant="outline"
              size="sm"
              disabled={loading}
              title="تحديث الكميات من قاعدة البيانات"
            >
              <RefreshCw
                className={cn("h-4 w-4 ml-2", loading && "animate-spin")}
              />
              تحديث الكميات
            </Button>
            <Button
              onClick={() => openProductModal()}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة منتج جديد
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {displayError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{displayError}</p>
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

        {/* Inventory Diagnostic Tool */}
        <InventoryDiagnostic />

        {/* Inventory Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    إجمالي المنتجات
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {products.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    مخزون منخفض: {lowStockProducts.length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    قيمة المخزون
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(inventoryAnalysis.totalValue)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    سعر الجملة:{" "}
                    {formatCurrency(inventoryAnalysis.totalWholesaleValue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    الربح المتوقع
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(inventoryAnalysis.potentialProfit)}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    هامش متوسط:{" "}
                    {inventoryAnalysis.averageProfitMargin.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    تنبيهات المخزون
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {lowStockProducts.length}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    قيمة: {formatCurrency(inventoryAnalysis.lowStockValue)}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="البحث في المنتجات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                title="تحديث البيانات من الخادم"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                تحديث
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <Card className="border-l-4 border-l-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                تنبيهات المخزون المنخفض
              </CardTitle>
              <CardDescription>
                المنتجات التي تحتاج إلى إعادة تخزين
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="border border-red-200 rounded-lg p-4 bg-red-50"
                  >
                    <h4 className="font-semibold text-red-800">
                      {product.name}
                    </h4>
                    <p className="text-sm text-red-600">
                      المتوفر: {product.quantity} قطعة
                    </p>
                    <p className="text-sm text-red-600">
                      الحد الأدنى: {product.minQuantity} قطعة
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    {products.length === 0
                      ? "لا توجد منتجات"
                      : "لم يتم العثور على منتجات"}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {products.length === 0
                      ? "ابدأ بإضافة منتج جديد إلى المخزون"
                      : "جرب تغيير مصطلح البحث"}
                  </p>
                  {products.length === 0 && (
                    <Button
                      onClick={() => openProductModal()}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة منتج جديد
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              const profitMargin =
                product.wholesalePrice > 0
                  ? ((product.salePrice - product.wholesalePrice) /
                      product.wholesalePrice) *
                    100
                  : 0;
              const totalValue = product.salePrice * product.quantity;
              const totalProfit =
                (product.salePrice - product.wholesalePrice) * product.quantity;

              return (
                <Card
                  key={product.id}
                  className="hover:shadow-lg transition-shadow duration-300"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {product.name}
                        </CardTitle>
                        <CardDescription>
                          منتج رقم: {product.id.slice(-8)}
                        </CardDescription>
                      </div>
                      <Badge className={stockStatus.className}>
                        {stockStatus.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">سعر الجملة:</p>
                        <p className="font-semibold">
                          {formatCurrency(product.wholesalePrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">سعر البيع:</p>
                        <p className="font-semibold">
                          {formatCurrency(product.salePrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">الكمية:</p>
                        <p className="font-semibold">{product.quantity} قطعة</p>
                      </div>
                      <div>
                        <p className="text-gray-600">الحد الأدنى:</p>
                        <p className="font-semibold">
                          {product.minQuantity} قطعة
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-600">هامش الربح:</p>
                          <p className="font-semibold text-green-600">
                            {profitMargin.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">قيمة المخزون:</p>
                          <p className="font-semibold">
                            {formatCurrency(totalValue)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-600">الربح المحتمل:</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(totalProfit)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openProductModal(product)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 ml-1" />
                        تعديل
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:border-red-300"
                          >
                            <Trash2 className="h-4 w-4 ml-1" />
                            حذف
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف المنتج "{product.name}"؟ هذه
                              العملية لا يمكن التراجع عنها وستحذف المنتج من
                              قاعدة البيانات.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProduct(product.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Add/Edit Product Modal */}
        <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                {editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "تعديل بيانات المنتج في قاعدة البيانات"
                  : "إضافة منتج جديد إلى قاعدة الب��انات"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">اسم المنتج *</Label>
                <Input
                  id="product-name"
                  value={productFormData.name}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      name: e.target.value,
                    })
                  }
                  placeholder="أدخل اسم المنتج"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wholesale-price">سعر الجملة *</Label>
                  <Input
                    id="wholesale-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productFormData.wholesalePrice}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        wholesalePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale-price">س��ر البيع *</Label>
                  <Input
                    id="sale-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productFormData.salePrice}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        salePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">الكمية *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={productFormData.quantity}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-quantity">الحد الأدنى *</Label>
                  <Input
                    id="min-quantity"
                    type="number"
                    min="1"
                    value={productFormData.minQuantity}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        minQuantity: parseInt(e.target.value) || 1,
                      })
                    }
                    placeholder="5"
                    required
                  />
                </div>
              </div>

              {/* Profit Calculation Preview */}
              {productFormData.wholesalePrice > 0 &&
                productFormData.salePrice > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>هامش الربح:</span>
                        <span className="font-semibold">
                          {(
                            ((productFormData.salePrice -
                              productFormData.wholesalePrice) /
                              productFormData.wholesalePrice) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>ربح الوحدة:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            productFormData.salePrice -
                              productFormData.wholesalePrice,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>الربح الإجمالي:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            (productFormData.salePrice -
                              productFormData.wholesalePrice) *
                              productFormData.quantity,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductModalOpen(false)}
                  disabled={isSubmitting}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin ml-2" />
                  ) : (
                    <Save className="h-4 w-4 ml-2" />
                  )}
                  {isSubmitting
                    ? "جاري الحفظ..."
                    : editingProduct
                      ? "تحديث المنتج"
                      : "إضافة المنتج"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Inventory;
