# إصلاح خطأ setLoading في حذف العميل

## المشكلة

حدث خطأ `ReferenceError: setLoading is not defined` عند محاولة حذف عميل:

```
Error deleting customer: ReferenceError: setLoading is not defined
    at deleteCustomer (Dashboard.tsx:1207:13)
```

## السبب الجذري

دالة `deleteCustomer` في مكون `DashboardContent` كانت تستخدم `setLoading(true)` و `setLoading(false)` لكن:

1. **لم يتم تعريف `loading` state** في المكون المحلي
2. **كان يستخدم `loading` prop** من المكون الأب فقط للقراءة
3. **لا يوجد `setLoading`** متاح في نطاق المكون

## الحل المطبق

### 1. إضافة Local Loading State

```typescript
// قبل
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

// بعد
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false); // ✅ إضافة
```

### 2. تحديث دالة deleteCustomer

```typescript
// قبل
const deleteCustomer = async (customerId: string, customerName: string) => {
  try {
    setLoading(true); // ❌ غير معرف
    setError(null);

    // ... باقي الكود

    if (!navigator.onLine) {
      setLoading(false); // ❌ غير معرف
      return;
    }

    if (!confirmDelete) {
      setLoading(false); // ❌ غير معرف
      return;
    }
  } finally {
    setLoading(false); // ❌ غير معرف
  }
};

// بعد
const deleteCustomer = async (customerId: string, customerName: string) => {
  try {
    setLocalLoading(true); // ✅ معرف ومحلي
    setError(null);

    // ... باقي الكود

    if (!navigator.onLine) {
      setLocalLoading(false); // ✅ معرف ومحلي
      return;
    }

    if (!confirmDelete) {
      setLocalLoading(false); // ✅ معرف ومحلي
      return;
    }
  } finally {
    setLocalLoading(false); // ✅ معرف ومحلي
  }
};
```

## التفسير التقني

### مشكلة النطاق (Scope)

```typescript
interface DashboardContentProps {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  loading: boolean; // ← هذا للقراءة فقط
  error: string | null;
  refreshData: () => void;
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  customers,
  products,
  sales,
  loading, // ← يأتي من الأب، للقراءة فقط
  error: dataError,
  refreshData,
}) => {
  // لا يوجد setLoading هنا!

  const deleteCustomer = async () => {
    setLoading(true); // ❌ ReferenceError!
  };
};
```

### الحل المطبق

```typescript
const DashboardContent: React.FC<DashboardContentProps> = ({
  customers,
  products,
  sales,
  loading, // ← للقراءة (زر التحديث)
  error: dataError,
  refreshData,
}) => {
  const [localLoading, setLocalLoading] = useState(false); // ✅ محلي

  const deleteCustomer = async () => {
    setLocalLoading(true); // ✅ يعمل!
  };
};
```

## الاستخدامات المختلفة

### Loading من الأب (للقراءة)

```typescript
<Button
  disabled={loading} // ← من الأب
  className={cn("h-4 w-4", loading && "animate-spin")} // ← من الأب
>
  تحديث
</Button>
```

### Local Loading (للعمليات المحلية)

```typescript
const deleteCustomer = async () => {
  setLocalLoading(true); // ← محلي للعملية
  try {
    await supabaseService.deleteCustomer(id);
  } finally {
    setLocalLoading(false); // ← إنهاء العملية
  }
};
```

## الفوائد

✅ **إصلاح الخطأ**: لا مزيد من `ReferenceError`  
✅ **عمليات منفصلة**: loading منفصل لكل عملية  
✅ **UX أفضل**: مؤشرات تحميل دقيقة  
✅ **كود آمن**: لا تعارض بين الـ states

## المستقبل

يمكن استخدام نفس النمط لعمليات أخرى:

```typescript
const [editLoading, setEditLoading] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);
const [paymentLoading, setPaymentLoading] = useState(false);
```

بهذا نحصل على control دقيق لكل عملية على حدة.
