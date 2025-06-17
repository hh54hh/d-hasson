import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/ui/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  Calculator,
  Save,
  Printer,
  CreditCard,
  Clock,
  CheckCircle,
  Package,
  User,
  DollarSign,
  Search,
  AlertCircle,
  Plus,
  Minus,
  X,
  Phone,
} from "lucide-react";
import {
  Customer,
  Product,
  CartItem,
  Sale,
  getCurrentDateGregorian,
  formatDateGregorian,
} from "@/lib/types";
import { formatCurrency, getProducts, getCustomers } from "@/lib/storage";
import { supabaseService } from "@/lib/supabaseService";
import { offlineManager } from "@/lib/offlineManager";
import { generateCartInvoice } from "@/components/CartInvoice";
import { cn } from "@/lib/utils";
import { DuplicateDetector } from "@/lib/duplicateDetector";
import { backgroundSync } from "@/lib/backgroundSync";
import { ExistingCustomerSaleManager } from "@/lib/existingCustomerSaleManager";
import { SaleCalculations } from "@/lib/saleCalculations";
import { CustomerSaleHistory } from "@/lib/customerSaleHistory";
import ExistingCustomerSaleForm from "@/components/ExistingCustomerSaleForm";
import { useRealTimeDataSync } from "@/lib/realTimeDataSync";

const AddSale: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cart system
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer states - support both new and existing customers
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(
    null,
  );
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerData, setCustomerData] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [saleData, setSaleData] = useState({
    paymentType: "cash" as "cash" | "deferred" | "partial",
    paidAmount: 0,
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExistingCustomerForm, setShowExistingCustomerForm] =
    useState(false);

  // Real-time data sync for immediate updates
  const { updateTrigger } = useRealTimeDataSync();

  useEffect(() => {
    // Load real data from Supabase first
    loadRealData();
  }, []);

  // Update data when real-time changes occur
  useEffect(() => {
    if (updateTrigger > 0) {
      console.log(
        "🔄 Real-time data update detected in AddSale, refreshing...",
      );
      loadRealData(); // Refresh data from Supabase
    }
  }, [updateTrigger]);

  // Handle customer preselection from URL parameters
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId && customers.length > 0) {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        console.log(`🎯 تم تحديد العميل مسبقاً: ${customer.name}`);
        setCustomerMode("existing");
        setExistingCustomer(customer);
        setCustomerSearchValue(customer.name);
        setCustomerSearchOpen(false);
      }
    }
  }, [searchParams, customers]);

  // Load real data from Supabase
  const loadRealData = async () => {
    try {
      console.log("🛒 Loading real data for sales...");

      // First load cached data instantly
      const localProducts = getProducts();
      const localCustomers = getCustomers();

      setProducts(localProducts);
      setFilteredProducts(localProducts);
      setCustomers(localCustomers);

      console.log("⚡ AddSale data loaded from cache");

      // Then load fresh data from Supabase
      try {
        const freshProducts = await offlineManager.getProducts();
        const freshCustomers = await offlineManager.getCustomers();

        setProducts(freshProducts);
        setFilteredProducts(freshProducts);
        setCustomers(freshCustomers);

        console.log(
          `🔄 Updated with ${freshProducts.length} real products and ${freshCustomers.length} customers`,
        );
      } catch (supabaseError) {
        console.warn("Could not load fresh data, using cached:", supabaseError);
      }
    } catch (error) {
      console.error("Error loading real data for sales:", error);
    }
  };

  const loadProducts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        console.log("🔄 Force refreshing products with latest quantities...");
        // Get fresh data from Supabase first
        try {
          const freshProducts = await supabaseService.getProducts();
          setProducts(freshProducts);
          setFilteredProducts(freshProducts);
          console.log(
            `✅ Loaded ${freshProducts.length} products with updated quantities`,
          );
          return;
        } catch (supabaseError) {
          console.warn("⚠️ Supabase unavailable, falling back to offline data");
        }
      }

      const productsData = await offlineManager.getProducts();
      setProducts(productsData);
      setFilteredProducts(productsData);

      console.log(`📦 Loaded ${productsData.length} products for sale`);
    } catch (error) {
      console.error("Error loading products:", error);
      setError("فشل في تحميل المنتجات. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await offlineManager.getCustomers();
      setCustomers(customersData);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const searchProducts = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
      return;
    }

    // Local search for immediate response
    const localResults = products.filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredProducts(localResults);
  };

  const searchCustomers = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      return customers;
    }
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm),
    );
  };

  // Cart management
  const addToCart = (product: Product) => {
    // Get current quantity in cart for this product
    const currentCartQuantity =
      cart.find((item) => item.id === product.id)?.quantity || 0;
    const availableQuantity = product.quantity - currentCartQuantity;

    console.log(
      `🛒 Adding ${product.name}: Available=${product.quantity}, In Cart=${currentCartQuantity}, Can Add=${availableQuantity}`,
    );

    if (availableQuantity <= 0) {
      setError(
        `${product.name} - الكمية المتاحة منتهية (في المخزن: ${product.quantity}, في السلة: ${currentCartQuantity})`,
      );
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        const newQuantity = existingItem.quantity + 1;
        return prevCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: newQuantity,
                totalPrice: newQuantity * item.unitPrice,
              }
            : item,
        );
      } else {
        return [
          ...prevCart,
          {
            id: product.id,
            product: { ...product }, // Create a copy to avoid reference issues
            quantity: 1,
            unitPrice: product.salePrice,
            totalPrice: product.salePrice,
          },
        ];
      }
    });

    setProductSearchValue("");
    setProductSearchOpen(false);
    setError(null);
  };

  const updateCartItemQuantity = (productId: string, newQuantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setError("المنتج غير موجود");
      return;
    }

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Check if requested quantity exceeds available stock
    if (newQuantity > product.quantity) {
      setError(
        `الكمية المطلوبة (${newQuantity}) تتجاوز المتاح في المخزن لـ ${product.name} (${product.quantity})`,
      );
      return;
    }

    console.log(
      `📝 Updating cart: ${product.name} quantity = ${newQuantity} (available: ${product.quantity})`,
    );

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: newQuantity * item.unitPrice,
            }
          : item,
      ),
    );
    setError(null);
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  // Customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setExistingCustomer(customer);
    setCustomerSearchValue(`${customer.name} - ${customer.phone}`);
    setCustomerSearchOpen(false);
    // Clear new customer data when selecting existing
    setCustomerData({ name: "", phone: "", address: "" });
  };

  // Calculations using enhanced system
  const saleCalculations = React.useMemo(() => {
    if (cart.length === 0) {
      return {
        totalAmount: 0,
        totalProfit: 0,
        actualPaidAmount: 0,
        remainingAmount: 0,
        profitMargin: 0,
        itemBreakdown: [],
      };
    }

    try {
      return SaleCalculations.calculateSaleTotals(cart, {
        paymentType: saleData.paymentType,
        paidAmount: saleData.paidAmount,
      });
    } catch (error) {
      console.warn("تحذير في حسابات السلة:", error);
      return {
        totalAmount: cart.reduce((sum, item) => sum + item.totalPrice, 0),
        totalProfit: 0,
        actualPaidAmount: saleData.paidAmount,
        remainingAmount: 0,
        profitMargin: 0,
        itemBreakdown: [],
      };
    }
  }, [cart, saleData.paymentType, saleData.paidAmount]);

  // استخدام القيم المحسوبة
  const cartTotalAmount = saleCalculations.totalAmount;
  const totalProfitAmount = saleCalculations.totalProfit;
  const remainingAmount = saleCalculations.remainingAmount;

  // Auto-update paid amount for cash payments
  useEffect(() => {
    if (saleData.paymentType === "cash") {
      setSaleData((prev) => ({ ...prev, paidAmount: cartTotalAmount }));
    }
  }, [cartTotalAmount, saleData.paymentType]);

  const handlePaymentTypeChange = (
    paymentType: "cash" | "deferred" | "partial",
  ) => {
    setSaleData((prev) => ({
      ...prev,
      paymentType,
      paidAmount:
        paymentType === "cash"
          ? cartTotalAmount
          : paymentType === "deferred"
            ? 0
            : prev.paidAmount,
    }));
  };

  const validateForm = (): boolean => {
    if (cart.length === 0) {
      setError("يرجى إضافة منتج واحد على الأقل للسلة");
      return false;
    }

    if (customerMode === "new") {
      if (!customerData.name || !customerData.phone || !customerData.address) {
        setError("يرجى إدخال جميع بيانات العميل الجديد");
        return false;
      }
    } else {
      if (!existingCustomer) {
        setError("يرجى اختيار عميل موجود");
        return false;
      }
    }

    if (saleData.paymentType === "partial") {
      if (saleData.paidAmount <= 0) {
        setError("يرجى إدخال المبلغ المدفوع للدفع الجزئي");
        return false;
      }
      if (saleData.paidAmount >= cartTotalAmount) {
        setError(
          "في حالة الدفع الجزئي، المبلغ المدفوع يجب أن يكون أقل من المبلغ الإجمالي",
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      let customer: Customer;

      if (customerMode === "new") {
        // Use smart duplicate detection before creating customer
        console.log("🔍 Checking for potential duplicate customers...");

        const potentialDuplicates = DuplicateDetector.findPotentialDuplicates(
          {
            name: customerData.name,
            phone: customerData.phone,
            address: customerData.address,
          },
          customers,
        );

        if (potentialDuplicates.length > 0) {
          console.log(
            `⚠️ Found ${potentialDuplicates.length} potential duplicates`,
          );

          const userDecision = await DuplicateDetector.showDuplicateWarning(
            {
              name: customerData.name,
              phone: customerData.phone,
              address: customerData.address,
            },
            potentialDuplicates,
          );

          switch (userDecision.action) {
            case "use_existing":
              if (userDecision.selectedCustomer) {
                customer = userDecision.selectedCustomer;
                setError(
                  `✅ تم ربط العملية بالعميل الموجود: ${userDecision.selectedCustomer.name}`,
                );
              } else {
                setError("خطأ في اختيار العميل الموجود");
                return;
              }
              break;

            case "create_new":
              try {
                customer = await offlineManager.createCustomerOffline({
                  name: customerData.name,
                  phone: customerData.phone,
                  address: customerData.address,
                  paymentStatus: saleData.paymentType,
                  lastSaleDate: getCurrentDateGregorian(),
                  debtAmount: remainingAmount,
                });
                setError(`✅ تم إنشاء عميل جديد: ${customer.name}`);
              } catch (createError: any) {
                console.error("Error creating customer:", createError);
                setError("فشل في إنشاء العميل الجديد");
                return;
              }
              break;

            case "cancel":
              setError(
                `⚠️ تم إلغاء العملية. يرجى مراجعة بيانات العميل وتعديلها.`,
              );
              return;

            default:
              setError("اختيار غير صالح");
              return;
          }
        } else {
          // No duplicates found, create customer normally
          try {
            customer = await offlineManager.createCustomerOffline({
              name: customerData.name,
              phone: customerData.phone,
              address: customerData.address,
              paymentStatus: saleData.paymentType,
              lastSaleDate: getCurrentDateGregorian(),
              debtAmount: remainingAmount,
            });
            console.log("✅ Created new customer without duplicates");
          } catch (error: any) {
            console.error("Error creating customer:", error);
            setError("فشل في إنشاء العميل");
            return;
          }
        }
      } else {
        customer = existingCustomer!;

        // للعملاء الموجودين، استخدم النظام المحسن
        if (customerMode === "existing") {
          setShowExistingCustomerForm(true);
          return; // عرض النموذج المحسن بدلاً من المتابعة
        }
      }

      // Create sale with cart items using offline manager (للعملاء الجدد فقط)
      const sale = await offlineManager.createSaleOffline(customer.id, cart, {
        paymentType: saleData.paymentType,
        paidAmount: saleData.paidAmount,
        notes: saleData.notes,
      });

      // Force immediate sync to Supabase if online
      if (navigator.onLine) {
        try {
          console.log("���� Forcing immediate sync to Supabase...");
          await offlineManager.forceSync();
          console.log("✅ Sync completed successfully");
        } catch (syncError) {
          console.warn("⚠️ Sync failed, but data is saved locally:", syncError);
        }
      }

      // Refresh product data to show updated quantities
      console.log("🔄 Refreshing product quantities...");
      try {
        const updatedProducts = await offlineManager.getProducts();
        setProducts(updatedProducts);
        console.log("✅ Product quantities refreshed");
      } catch (refreshError) {
        console.warn("Failed to refresh products:", refreshError);
      }

      // Success feedback
      const itemsCount = cart.length;
      const itemsText = itemsCount === 1 ? "منتج واحد" : `${itemsCount} منتجات`;
      const isNewCustomer = customerMode === "new";

      alert(
        `🎉 تم حفظ عملية البيع بنجاح!\n\n` +
          `👤 العميل: ${customer.name} ${isNewCustomer ? "(عميل جديد)" : ""}\n` +
          `📱 الهاتف: ${customer.phone}\n` +
          `📦 المنتجات: ${itemsText}\n` +
          `💰 المبلغ الإجمالي: ${formatCurrency(cartTotalAmount)}\n` +
          `💳 طريقة الدفع: ${saleData.paymentType === "cash" ? "نقدي" : saleData.paymentType === "deferred" ? "آجل" : "دفع جزئي"}\n\n` +
          `${navigator.onLine ? "✅ تم التزامن مع قاعدة البيانات" : "📱 محفوظ محلياً - سيتم التزامن عند الاتصال"}\n\n` +
          `${isNewCustomer ? "🆕 العميل الجديد سيظهر في صفحة الأعضاء" : ""}`,
      );

      // Reset form
      setCart([]);
      setCustomerData({ name: "", phone: "", address: "" });
      setExistingCustomer(null);
      setCustomerSearchValue("");
      setSaleData({
        paymentType: "cash",
        paidAmount: 0,
        notes: "",
      });

      // Navigate back to dashboard with a slight delay to ensure data is processed
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (error: any) {
      console.error("Error saving sale:", error);
      setError(
        error.message ||
          "حدث خطأ أثناء حفظ عملية البيع. يرجى المحاولة مرة أخرى.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExistingCustomerSaleComplete = async (result: {
    sale: any;
    updatedCustomer: Customer;
    inventoryUpdates: any[];
    warnings: string[];
  }) => {
    try {
      // تحديث البيانات المحلية
      const updatedProducts = await supabaseService.getProducts();
      setProducts(updatedProducts);

      const updatedCustomers = await supabaseService.getCustomers();
      setCustomers(updatedCustomers);

      // عرض رسالة النجاح
      const itemsCount = cart.length;
      const itemsText = itemsCount === 1 ? "منتج واحد" : `${itemsCount} منتجات`;
      const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

      let warningsText = "";
      if (result.warnings.length > 0) {
        warningsText = `\n\n⚠️ تحذيرات: ${result.warnings.join(", ")}`;
      }

      alert(
        `🎉 تم حفظ عملية البيع بنجاح!\n\n` +
          `👤 العميل: ${result.updatedCustomer.name}\n` +
          `📱 الهاتف: ${result.updatedCustomer.phone}\n` +
          `📦 المنتجات: ${itemsText}\n` +
          `💰 المبلغ الإجمالي: ${formatCurrency(totalAmount)}\n` +
          `💳 طريقة الدفع: ${saleData.paymentType === "cash" ? "نقدي" : saleData.paymentType === "deferred" ? "آجل" : "دفع جزئي"}\n` +
          `🏪 تم تحديث ${result.inventoryUpdates.length} منتج في المخزون\n` +
          `💳 الدين الجديد: ${formatCurrency(result.updatedCustomer.debtAmount || 0)}\n` +
          `✅ تم التزامن مع قاعدة البيانات${warningsText}`,
      );

      // إعادة تعيين النموذج
      resetForm();

      // العودة للصفحة الرئيسية
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (error: any) {
      console.error("Error handling sale completion:", error);
      setError("حدث خطأ أثناء تحديث البيانات بعد البيع");
    }
  };

  const handleExistingCustomerSaleError = (error: string) => {
    setError(error);
    setShowExistingCustomerForm(false);
  };

  const resetForm = () => {
    setCart([]);
    setCustomerData({ name: "", phone: "", address: "" });
    setExistingCustomer(null);
    setCustomerSearchValue("");
    setSaleData({
      paymentType: "cash",
      paidAmount: 0,
      notes: "",
    });
    setShowExistingCustomerForm(false);
  };

  const handlePrint = () => {
    if (!validateForm()) return;

    const customer =
      customerMode === "existing"
        ? existingCustomer!
        : {
            name: customerData.name,
            phone: customerData.phone,
            address: customerData.address,
          };

    const invoiceHTML = generateCartInvoice({
      customer,
      cartItems: cart,
      saleData,
      totalAmount: cartTotalAmount,
      remainingAmount,
      profitAmount: totalProfitAmount,
    });

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            إضاف�� عملية بيع متعددة المنتجات
          </h1>
          <p className="text-gray-600 mt-1">
            نظام ذكي لإضافة عدة منتجات لنفس العميل - متصل مع Supabase
          </p>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  بيانات العميل
                </CardTitle>
                <CardDescription>
                  اختر عميل موجود أو أضف عميل جديد
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Mode Selection */}
                <div className="space-y-3">
                  <Label>نوع العميل</Label>
                  <RadioGroup
                    value={customerMode}
                    onValueChange={(value) =>
                      setCustomerMode(value as "new" | "existing")
                    }
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="new" id="new" />
                      <Label htmlFor="new">عميل جديد</Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="existing" id="existing" />
                      <Label htmlFor="existing">عميل موجود</Label>
                    </div>
                  </RadioGroup>
                </div>

                {customerMode === "existing" ? (
                  // Existing Customer Search
                  <div className="space-y-2">
                    <Label htmlFor="customer-search">البحث عن عميل موجود</Label>
                    <div className="relative">
                      <Input
                        id="customer-search"
                        type="text"
                        placeholder="ابحث بالاسم أو رقم الهاتف..."
                        value={customerSearchValue}
                        onChange={(e) => {
                          setCustomerSearchValue(e.target.value);
                          setCustomerSearchOpen(true);
                        }}
                        onFocus={() => setCustomerSearchOpen(true)}
                        className="h-12"
                      />
                      <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

                      {/* Customer Dropdown */}
                      {customerSearchOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                          {searchCustomers(customerSearchValue).map(
                            (customer) => (
                              <div
                                key={customer.id}
                                onClick={() => handleCustomerSelect(customer)}
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {customer.name}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {customer.phone} • {customer.address}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      customer.debtAmount! > 0
                                        ? "destructive"
                                        : "secondary"
                                    }
                                  >
                                    {customer.debtAmount! > 0
                                      ? formatCurrency(customer.debtAmount!)
                                      : "مدفوع"}
                                  </Badge>
                                </div>
                              </div>
                            ),
                          )}
                          {searchCustomers(customerSearchValue).length ===
                            0 && (
                            <div className="p-4 text-center text-gray-500">
                              لم يتم العثور على عملاء
                            </div>
                          )}
                        </div>
                      )}

                      {/* Close dropdown when clicking outside */}
                      {customerSearchOpen && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setCustomerSearchOpen(false)}
                        />
                      )}
                    </div>

                    {existingCustomer && (
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-green-800 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              العميل المختار
                            </h4>
                            <div className="text-sm">
                              <div>
                                <strong>الاسم:</strong> {existingCustomer.name}
                              </div>
                              <div>
                                <strong>الهاتف:</strong>{" "}
                                {existingCustomer.phone}
                              </div>
                              <div>
                                <strong>العنوان:</strong>{" "}
                                {existingCustomer.address}
                              </div>
                              {existingCustomer.debtAmount! > 0 && (
                                <div className="text-red-600">
                                  <strong>دين مستحق:</strong>{" "}
                                  {formatCurrency(existingCustomer.debtAmount!)}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  // New Customer Form
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">اسم العميل الجديد *</Label>
                      <Input
                        id="name"
                        value={customerData.name}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            name: e.target.value,
                          })
                        }
                        placeholder="أدخل اسم العميل"
                        required={customerMode === "new"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        رقم الهاتف *{" "}
                        <span className="text-xs text-gray-500">
                          (لن يتكرر نفس الرقم)
                        </span>
                      </Label>
                      <Input
                        id="phone"
                        value={customerData.phone}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            phone: e.target.value,
                          })
                        }
                        placeholder="أدخل رقم الهاتف"
                        required={customerMode === "new"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">العنوان *</Label>
                      <Textarea
                        id="address"
                        value={customerData.address}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            address: e.target.value,
                          })
                        }
                        placeholder="أدخل عنوان العميل"
                        required={customerMode === "new"}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Product Selection Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  إضافة المنتجا�� للسلة
                </CardTitle>
                <CardDescription>
                  ابحث واختر المنتجات من قاعدة البيانات
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-search">بحث وإضافة منتج</Label>
                  <div className="relative">
                    <Input
                      id="product-search"
                      type="text"
                      placeholder="ابحث عن المنتج بالاسم..."
                      value={productSearchValue}
                      onChange={(e) => {
                        setProductSearchValue(e.target.value);
                        searchProducts(e.target.value);
                        setProductSearchOpen(true);
                      }}
                      onFocus={() => setProductSearchOpen(true)}
                      className="h-12"
                      disabled={loading}
                    />
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

                    {/* Product Dropdown */}
                    {productSearchOpen && filteredProducts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                        {filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                السعر: {formatCurrency(product.salePrice)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  product.quantity <= product.minQuantity
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {product.quantity} متوفر
                              </Badge>
                              <Plus className="h-4 w-4 text-green-600" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No Results */}
                    {productSearchOpen &&
                      productSearchValue &&
                      filteredProducts.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
                          لم يتم العثور على منتجات تطابق البحث
                        </div>
                      )}
                  </div>

                  {/* Close dropdown when clicking outside */}
                  {productSearchOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProductSearchOpen(false)}
                    />
                  )}
                </div>

                {loading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">جاري تحميل المنتجات...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Shopping Cart */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-purple-600" />
                  سلة المشتريات ({cart.length} منتج)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">المجموع</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.product.name}
                          <div className="text-sm text-gray-600">
                            متوفر: {item.product.quantity}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateCartItemQuantity(
                                  item.id,
                                  item.quantity - 1,
                                )
                              }
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateCartItemQuantity(
                                  item.id,
                                  item.quantity + 1,
                                )
                              }
                              disabled={item.quantity >= item.product.quantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                تفاصيل الدفع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>نوع الدفع *</Label>
                    <RadioGroup
                      value={saleData.paymentType}
                      onValueChange={(value) =>
                        handlePaymentTypeChange(
                          value as "cash" | "deferred" | "partial",
                        )
                      }
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="cash" id="cash" />
                        <Label
                          htmlFor="cash"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          نقدي (دفع كامل)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="deferred" id="deferred" />
                        <Label
                          htmlFor="deferred"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Clock className="h-4 w-4 text-red-600" />
                          آجل (دفع لاحق)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="partial" id="partial" />
                        <Label
                          htmlFor="partial"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <DollarSign className="h-4 w-4 text-yellow-600" />
                          دفع جزئي من الدين
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {saleData.paymentType === "partial" && (
                    <div className="space-y-2">
                      <Label htmlFor="paidAmount">المبلغ المدفوع *</Label>
                      <Input
                        id="paidAmount"
                        type="number"
                        min="1"
                        max={cartTotalAmount - 1}
                        value={saleData.paidAmount}
                        onChange={(e) =>
                          setSaleData({
                            ...saleData,
                            paidAmount: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="أدخل المبلغ المدفوع"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea
                      id="notes"
                      value={saleData.notes}
                      onChange={(e) =>
                        setSaleData({
                          ...saleData,
                          notes: e.target.value,
                        })
                      }
                      placeholder="أضف ملاحظات حول عملية البيع..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* Calculation Summary */}
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calculator className="h-5 w-5" />
                      ملخص الحساب
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">عدد المنتجات:</span>
                      <span className="font-semibold">{cart.length}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">
                        المبلغ الإجمالي:
                      </span>
                      <span className="font-bold text-lg">
                        {formatCurrency(cartTotalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">المبلغ المدفوع:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(saleData.paidAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">المبلغ المتبقي:</span>
                      <span
                        className={cn(
                          "font-bold",
                          remainingAmount > 0
                            ? "text-red-600"
                            : "text-green-600",
                        )}
                      >
                        {formatCurrency(remainingAmount)}
                      </span>
                    </div>

                    <Separator />

                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">الربح المتوقع:</span>
                        <span className="font-bold text-green-800">
                          {formatCurrency(totalProfitAmount)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="flex items-center gap-2"
              disabled={cart.length === 0}
            >
              <Printer className="h-4 w-4" />
              معاينة الفاتورة
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || cart.length === 0 || loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "جاري الحفظ في Supabase..." : "حفظ عملية البيع"}
            </Button>
          </div>
        </form>

        {/* النموذج المحسن لمبيعات العملاء الموجودين */}
        {showExistingCustomerForm && existingCustomer && (
          <div className="mt-8">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">
                  🎯 نظام محسن لمبيعات العملاء الموجودين
                </CardTitle>
                <CardDescription className="text-blue-600">
                  نظام متقدم يضمن ا��دقة والتزامن مع جميع العلاقات والعمليات
                  الحسابية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExistingCustomerSaleForm
                  customer={existingCustomer}
                  cartItems={cart}
                  saleData={saleData}
                  onSaleComplete={handleExistingCustomerSaleComplete}
                  onError={handleExistingCustomerSaleError}
                />

                <div className="mt-6 flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowExistingCustomerForm(false)}
                  >
                    ← العودة للنموذج العادي
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AddSale;
