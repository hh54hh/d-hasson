# إضافة زر البيع في قائمة العملاء

## الميزة الجديدة

تم إضافة زر "بيع" في قائمة العملاء في صفحة Dashboard، والذي ينقل المستخدم مباشرة إلى صفحة البيع مع تحديد العميل مسبقاً.

## التحسينات المضافة

### 1. زر البيع في Dashboard

**الموقع**: `src/pages/Dashboard.tsx`

- تم إضافة زر "بيع" باللون البرتقالي مع أيقونة عربة التسوق
- الزر موضوع في المكان الأول من قائمة الأزرار لكل عميل
- يستخدم `Link` component ل��انتقال السريع إلى صفحة البيع

```typescript
<Link to={`/add-sale?customerId=${customer.id}`}>
  <Button
    size="sm"
    className="bg-orange-600 hover:bg-orange-700 text-white"
  >
    <ShoppingCart className="h-4 w-4 ml-1" />
    بيع
  </Button>
</Link>
```

### 2. دعم URL Parameters في صفحة البيع

**الموقع**: `src/pages/AddSale.tsx`

- تم إضافة `useSearchParams` لقراءة معرف العميل من URL
- إضافة `useEffect` لتحديد العميل تلقائياً عند فتح الصفحة
- تحويل تلقائي لوضع "عميل موجود" عند وجود `customerId` في URL

```typescript
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
```

## كيفية العمل

1. **في صفحة Dashboard**:

   - يظهر زر "بيع" أمام ��ل عميل في القائمة
   - عند النقر على الزر، يتم الانتقال إلى صفحة البيع مع تمرير `customerId` في URL

2. **في صفحة البيع**:
   - تتم قراءة `customerId` من URL parameters
   - يتم البحث عن العميل في قائمة العملاء المحملة
   - إذا تم العثور على العميل، يتم تحديده تلقائياً
   - يتم تغيير الوضع إلى "عميل موجود" تلقائياً
   - يصبح النموذج جاهزاً لإضافة المنتجات ومعالجة البيع

## المزايا

✅ **توفير الوقت**: لا حاجة لبحث عن العميل مرة أخرى  
✅ **سهولة الاستخدام**: انتقال مباشر من قائمة العملاء إلى البيع  
✅ **تجربة سلسة**: تحديد العميل تلقائياً بدون تدخل المستخدم  
✅ **تصميم متسق**: زر البيع متناسق مع باقي أزرار الواجهة

## مثال على الاستخدام

1. في صفحة Dashboard، ابحث عن العميل المطلوب
2. اضغط على زر "بيع" الأحمر بجانب اسم العميل
3. ستنفتح صفحة البيع مع تحديد العميل مسبقاً
4. أضف المنتجات المطلوبة واكمل عملية البيع

## URL Format

```
/add-sale?customerId=71d00e49-7589-4fdb-837b-1ec01dc789ce
```

حيث `customerId` هو معرف العميل الفريد في قاعدة البيانات.
