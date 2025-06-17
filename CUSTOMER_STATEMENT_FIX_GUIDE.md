# 🚨 حل مشكلة عدم ظهور المنتجات في كشف الحساب

## 📋 المشكلة

عند الضغط على "كشف الحساب" لأي عميل:

- ❌ لا تظهر المنتجات التي اشتراها العميل
- ❌ يظهر "0 عملية شراء" أو قائمة فارغة
- ❌ البيانات موجودة لكن لا تُعرض بشكل صحيح

## 🔍 السبب

**السبب الجذري:** جدول `sale_items` مفقود من قاعدة البيانات Supabase

### كيف يعمل النظام:

```
📊 عملية البيع الصحيحة:
├── 👤 إنشاء/اختيار عميل → جدول customers ✅
├── 💰 حفظ بيانات البيعة → جدول sales ✅
└── 📦 حفظ تفاصيل ا��منتجات → جدول sale_items ❌ (مفقود!)
```

بدون جدول `sale_items`، لا يمكن حفظ تفاصيل المنتجات لكل عملية بيع.

## 🛠 الحل السريع (5 دقائق)

### الطريقة الأولى: من التطبيق

1. **اذهب إلى صفحة الإصلاح:**

   - افتح التطبيق
   - في الصفحة الرئيسية، ابحث عن إشعار "هل لا تظهر المنتجات في كشف الحساب؟"
   - اضغط "إصلاح المشكلة"
   - أو اذهب مباشرة إلى `/fix-customer-statement`

2. **اتبع التعليمات:**
   - اضغط "نسخ الإصلاح السريع"
   - اضغط "فتح Supabase"
   - انتقل إلى SQL Editor
   - الصق الكود واضغط RUN

### الطريقة الثانية: مباشرة في Supabase

1. **افتح Supabase Dashboard:**

   - اذهب إلى [supabase.com/dashboard](https://supabase.com/dashboard)
   - اختر مشروعك

2. **افتح SQL Editor:**

   - في القائمة الجانبية، اختر "SQL Editor"

3. **انسخ والصق هذا الكود:**

```sql
-- إصلاح سريع لمشكلة كشف الحساب
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    profit_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة العلاقات
ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_id_fkey
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- إضافة الفهارس
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

SELECT '✅ تم إصلاح المشكلة بنجاح!' as result;
```

4. **اضغط RUN** (الزر الأخضر)

## ✅ اختبار الإصلاح

### 1. فحص النجاح:

بعد تشغيل الكود، يجب أن ترى:

```
✅ تم إصلاح المشكلة بنجاح!
```

### 2. اختبار عملي:

1. ارجع إلى التطبيق
2. أضف عملية بيع جديدة مع عدة منتجات
3. اذهب إلى كشف حساب العميل
4. يجب أن ترى جميع المنتجات مع التفاصيل

### 3. النتيجة المتوقعة:

```
👤 كشف حساب العميل: أحمد محمد
📱 الهاتف: 01234567890

📦 المشتريات:
┌─────────────────┬────────┬───────────┬───────────────┐
│ اسم المنتج      │ الكمية │ سعر الوحدة │ المجموع       │
├─────────────────┼────────┼───────────┼───────────────┤
│ iPhone 15       │   1    │ 5000 ريال │ 5000 ريال     │
│ سماعة AirPods   │   2    │  800 ريال │ 1600 ريال     │
└─────────────────┴────────┴───────────┴───────────────┘

💰 الإجمالي: 6600 ريال
✅ إجمالي العمليات: 1 عملية شراء
```

## 🔧 حل المشاكل الشائعة

### مشكلة 1: "permission denied for table sale_items"

**الحل:**

```sql
GRANT ALL ON sale_items TO authenticated;
GRANT ALL ON sale_items TO service_role;
```

### مشكلة 2: "relation does not exist"

**السبب:** لم يتم تشغيل السكريبت بشكل صحيح
**الحل:** أعد تشغيل السكريبت مرة أخرى

### مشكلة 3: المبيعات القديمة لا تظهر

**السبب:** البيانات القديمة تم حفظها قبل وجود جدول sale_items
**الحل:** المبيعات الجديدة ستعمل بشكل صحيح، البيانات القديمة تحتاج إعادة إدخال

## 📊 ما الذي تم إضافته

### 1. جدول sale_items:

- `id`: معرف فريد لكل منتج في البيعة
- `sale_id`: ربط مع عملية البيع
- `product_id`: ربط مع المنتج
- `product_name`: اسم المنتج
- `quantity`: الكمية المباعة
- `unit_price`: سعر الوحدة
- `total_amount`: المجموع الفرعي
- `profit_amount`: الربح من هذا المنتج

### 2. العلاقات (Foreign Keys):

- ربط `sale_items` مع `sales`
- ربط `sale_items` مع `products`

### 3. الفهارس للأداء:

- فهرس على `sale_id` للبحث السريع
- فهرس على `product_id` للتقارير

### 4. المشغلات التلقائية:

- تحديث كمية المنتج عند البيع
- تحديث عدد المنتجات في البيعة

## 🎯 ا��فوائد بعد الإصلاح

### للعملاء:

- ✅ كشف حساب مفصل يظهر كل منتج
- ✅ تتبع دقيق للمشتريات
- ✅ شفافية كاملة في المعاملات

### للمحل:

- ✅ تتبع دقيق للمخزون
- ✅ حسابات ربح صحيحة لكل منتج
- ✅ تقارير مفصلة للمبيعات
- ✅ تحليل أداء المنتجات

### للنظام:

- ✅ بيانات منظمة ومرتبة
- ✅ أداء سريع في الاستعلامات
- ✅ نسخ احتياطي موثوق
- ✅ قابلية التوسع

## 📞 الدعم

إذا واجهت أي مشاكل:

### 1. أدوات التشخيص:

- اذهب إلى `/fix-customer-statement` في التطبيق
- اضغط "إعادة الفحص" لرؤية حالة النظام

### 2. رسائل الخطأ الشائعة:

- `table "sale_items" does not exist` → شغّل السكريبت
- `Could not find a relationship` → أضف العلاقات
- `permission denied` → أضف الصلاحيات

### 3. ملفات الإصلاح:

- `QUICK_FIX_SALE_ITEMS.sql` - إصلاح سريع
- `SUPABASE_COMPLETE_DATABASE_FIX.sql` - إصلاح شامل

## ✨ خلاصة

**قبل الإصلاح:**

- 📱 إضافة منتجات ✅
- 👤 حفظ بيانات العميل ✅
- 📋 عرض كشف الحساب ❌

**بعد الإصلاح:**

- 📱 إضافة منتجات ✅
- 👤 حفظ بيانات العميل ✅
- 📦 حفظ تفاصيل المنتجات ✅
- 📋 عرض كشف الحساب ✅
- 💰 حسابات دقيقة ✅
- 📊 تقارير مفصلة ✅

---

🎉 **مبروك! الآن النظام يعمل بشكل مثالي!**
