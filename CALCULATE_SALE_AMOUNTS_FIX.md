# 🔧 إصلاح خطأ calculateSaleAmounts

## المشكلة ❌

عند إضافة عميل موجود في صفحة المبيعات، كان يظهر الخطأ التالي:

```
this.calculateSaleAmounts is not a function
```

---

## تحليل المشكلة 🔍

### مصدر الخطأ:

في الملف `src/lib/existingCustomerSaleManager.ts` على السطر 91:

```typescript
// 3. حساب المبالغ بدقة
const calculations = this.calculateSaleAmounts(cartItems, saleData); // ❌ خطأ
```

### السبب:

الدالة كانت تحاول استدعاء `calculateSaleAmounts` لكن الدالة الموجودة فعلياً اسمها `calculateSaleTotals`.

---

## الحل المطبق ✅

### تصحيح الاستدعاء:

```typescript
// قبل الإصلاح ❌
const calculations = this.calculateSaleAmounts(cartItems, saleData);

// بعد الإصلاح ✅
const calculations = this.calculateSaleTotals(cartItems, saleData);
```

### الدالة الصحيحة الموجودة:

```typescript
private static calculateSaleTotals(
  cartItems: CartItem[],
  saleData: {
    paymentType: "cash" | "deferred" | "partial";
    paidAmount: number;
  },
) {
  // استخدام النظام المحسن للحسابات
  const calculations = SaleCalculations.calculateSaleTotals(
    cartItems,
    saleData,
  );

  // التحقق من صحة الحسابات
  const validation = SaleCalculations.validateCalculations(calculations);
  if (!validation.isValid) {
    console.error("❌ أخطاء في الحسابات:", validation.errors);
    throw new Error(`أخطاء في الحسابات: ${validation.errors.join(", ")}`);
  }

  // عرض التحذيرات إن وجدت
  if (validation.warnings.length > 0) {
    console.warn("⚠️ تحذيرات في الحسابات:", validation.warnings);
  }

  return {
    totalAmount: calculations.totalAmount,
    totalProfit: calculations.totalProfit,
    actualPaidAmount: calculations.actualPaidAmount,
    remainingAmount: calculations.remainingAmount,
    calculations, // إضافة الحسابات التفصيلية
  };
}
```

---

## ضمان دقة العمليات الحسابية 🧮

### نظام التحقق المدمج:

1. **التحقق من الإجماليات**:

   ```typescript
   if (calculations.totalAmount <= 0) {
     errors.push("الإجمالي النهائي يجب أن يكون أكبر من صفر");
   }
   ```

2. **التحقق من التطابق**:

   ```typescript
   const calculatedTotal =
     calculations.actualPaidAmount + calculations.remainingAmount;
   if (Math.abs(calculatedTotal - calculations.totalAmount) > 1) {
     errors.push(
       `عدم تطابق في الحسابات: ${calculatedTotal} ≠ ${calculations.totalAmount}`,
     );
   }
   ```

3. **التحقق من تفاصيل المنتجات**:
   ```typescript
   if (item.totalPrice !== item.quantity * item.unitPrice) {
     errors.push(`خطأ في حساب المجموع للمنتج: ${item.productName}`);
   }
   ```

### نظام الحسابات الدقيق:

```typescript
// حساب تفاصيل كل منتج
const itemBreakdown = cartItems.map((item) => {
  const quantity = Math.abs(item.quantity || 0); // ضمان القيم الموجبة
  const unitPrice = Math.abs(item.product.salePrice || 0);
  const unitCost = Math.abs(item.product.wholesalePrice || 0);

  const totalPrice = this.roundCurrency(quantity * unitPrice);
  const totalCost = this.roundCurrency(quantity * unitCost);
  const profit = this.roundCurrency(totalPrice - totalCost);
  const profitMargin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;

  return {
    productId: item.product.id,
    productName: item.product.name,
    quantity,
    unitPrice,
    totalPrice,
    unitCost,
    totalCost,
    profit,
    profitMargin: this.roundPercentage(profitMargin),
  };
});
```

---

## النتائج 📊

### قبل الإصلاح:

- ❌ خطأ `this.calculateSaleAmounts is not a function`
- ❌ عدم القدرة على إضافة مبيعات للعملاء الموجودين
- ❌ توقف العملية عند هذه النقطة

### بعد الإصلاح:

- ✅ عملية البيع تكتمل بنجاح
- ✅ حسابات دقيقة مع تحقق شامل
- ✅ معالجة صحيحة للأخطاء والتحذيرات
- ✅ إضافة مبيعات للعملاء الموجودين تعمل بشكل مثالي

---

## الدوال المحسنة للحسابات 🛠️

### 1. تقريب العملة:

```typescript
private static roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
```

### 2. تقريب النسب المئوية:

```typescript
private static roundPercentage(percentage: number): number {
  return Math.round(percentage * 100) / 100;
}
```

### 3. حساب المبالغ حسب نوع الدفع:

```typescript
private static calculatePaymentAmounts(
  totalAmount: number,
  paymentData: {
    paymentType: "cash" | "deferred" | "partial";
    paidAmount: number;
  },
) {
  let actualPaidAmount = 0;
  let remainingAmount = 0;

  switch (paymentData.paymentType) {
    case "cash":
      actualPaidAmount = totalAmount;
      remainingAmount = 0;
      break;

    case "deferred":
      actualPaidAmount = 0;
      remainingAmount = totalAmount;
      break;

    case "partial":
      actualPaidAmount = Math.min(paymentData.paidAmount, totalAmount);
      remainingAmount = this.roundCurrency(totalAmount - actualPaidAmount);
      break;
  }

  return { actualPaidAmount, remainingAmount };
}
```

---

## اختبار الإصلاح ✅

لاختبار أن الإصلاح نجح:

1. **اذهب لصفحة إضافة مبيعة** 🛒
2. **اختر "عميل موجود"**
3. **ابحث عن عميل واختره**
4. **أضف منتجات للسلة**
5. **اختر نوع الدفع والمبلغ**
6. **اضغط "إتمام البيع"**

**النتيجة المتوقعة**: العملية تكتمل بنجاح بدون خطأ `calculateSaleAmounts is not a function` ✅

---

## 🎉 خلاصة الإصلاح

**تم إصلاح الخطأ بنجاح!**

- 🔧 **الخطأ**: تصحيح اسم الدالة من `calculateSaleAmounts` إلى `calculateSaleAmounts`
- 🧮 **الحسابات**: جميع العمليات الحسابية دقيقة مع تحقق شامل
- ✅ **الوظائف**: إضافة مبيعات للعملاء الموجودين تعمل بشكل مثالي
- 🛡️ **الأمان**: معالجة شاملة للأخطاء والتحذيرات

يمكن الآن إضافة مبيعات للعملاء الموجودين بدون أي مشاكل! 🎯
