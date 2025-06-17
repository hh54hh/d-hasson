# إصلاح مشاكل انتهاء مهلة الاتصال

## المشكلة

كانت العمليات تنتهي مهلتها بسرعة مما يسبب أخطاء:

```
فشل في جلب المنتجات: Operation quantitySync_products_1750149646582 timed out after 10 seconds
فشل في جلب المبيعات: Operation quantitySync_sales_1750149646583 timed out after 10 seconds
```

## السبب الجذري

1. **مهلة قصيرة جداً**: 10 ثواني فقط للعمليات
2. **طلبات متزامنة كثيرة**: تزاحم في الطلبات
3. **تنظيف غير فعال**: الطلبات المعلقة لا تُنظ�� بشكل صحيح

## الإصلاحات المطبقة

### 1. زيادة المهل الزمنية

#### قبل:

```typescript
private static requestTimeout = 15000; // 15 ثانية
const operationTimeout = 10000; // 10 ثواني للعملية
maxWaitTime = 30000; // 30 ثانية انتظار
```

#### بعد:

```typescript
private static requestTimeout = 45000; // 45 ثانية
const operationTimeout = 30000; // 30 ثانية للعملية
maxWaitTime = 60000; // 60 ثانية انتظار
```

### 2. تقليل الطلبات المتزامنة

#### قبل:

```typescript
private static maxConcurrentRequests = 3;
private static minDelayBetweenRequests = 200;
```

#### بعد:

```typescript
private static maxConcurrentRequests = 2; // طلبين فقط متزامنين
private static minDelayBetweenRequests = 300; // تأخير أكبر
```

### 3. تحسين تنظيف الطلبات المعلقة

#### التنظيف القسري:

```typescript
static cleanupStuckRequests(): void {
  const forceCleanupTime = 20000; // تنظيف بعد 20 ثانية

  // تنظيف الطلبات المعلقة
  for (const [requestId, startTime] of this.requestStartTimes.entries()) {
    if (now - startTime > forceCleanupTime) {
      this.activeRequests.delete(requestId);
      this.requestStartTimes.delete(requestId);
    }
  }

  // تنظيف إضافي إذا كانت الطلبات كثيرة جداً
  if (this.activeRequests.size > this.maxConcurrentRequests * 2) {
    this.activeRequests.clear();
    this.requestStartTimes.clear();
  }
}
```

### 4. إعادة تعيين طارئة

#### دالة إعادة التعيين الطارئة:

```typescript
static emergencyReset(): void {
  // تنظيف شامل
  this.activeRequests.clear();
  this.requestStartTimes.clear();
  this.requestQueue.clear();

  // إعدادات آمنة
  this.maxConcurrentRequests = 1; // طلب واحد فقط
  this.minDelayBetweenRequests = 1000; // ثانية كاملة
}
```

### 5. زر إعادة التعيين في الإعدادات

**المكان**: قسم "الإصلاحات الحرجة"

```typescript
<Button
  onClick={handleEmergencyConnectionReset}
  className="bg-yellow-600 hover:bg-yellow-700 text-white"
>
  <RefreshCw className="h-4 w-4" />
  إعادة تعيين الاتصالات (طوارئ)
</Button>
```

**الوظيفة**:

- إعادة تعيين جميع الطلبات المعلقة
- تقليل عدد الطلبات المتزامنة إلى 1
- زيادة التأخير بين الطلبات
- تنظيف الـ cache

## الجدول الزمني الجديد

| المرحلة           | المهلة السابقة | المهلة الجديدة |
| ----------------- | -------------- | -------------- |
| **انتظار الطلب**  | 30 ثانية       | 60 ثانية       |
| **تنفيذ العملية** | 10 ثواني       | 30 ثانية       |
| **تنظيف الطلبات** | 15 ثانية       | 20 ثانية       |
| **مهلة الطلب**    | 15 ثانية       | 45 ثانية       |

## إعدادات التحكم

### الوضع العادي:

- طلبين متزامنين
- 300ms بين الطلبات
- 30 ثانية للعملية

### الوضع الآمن (بعد الإعادة الطارئة):

- طلب واحد فقط
- 1000ms بين الطلبات
- تنظيف فوري للطلبات

## كيفية الاستخدام

### عند مواجهة مشاكل timeout:

1. **اذهب إلى الإعدادات**
2. **قسم "الإصلاحات الحرجة"**
3. **اضغط "إعادة تعيين الاتصالات (طوارئ)"**
4. **انتظر رسالة التأكيد**
5. **حدث الصفحة**

### النتيجة المتوقعة:

```
✅ تم إعادة تعيين نظام الاتصالات في الوضع الآمن

تم:
• إعادة تعيين جميع الطلبات المعلقة
• تقليل عدد الطلبات المتزامنة إلى 1
• زيادة التأخير بين الطلبات
• تنظيف الـ cache

حاول تحديث الصفحة الآن
```

## المشاكل المحلولة

✅ **انتهاء مهلة العمليات**: زيادة الوقت إلى 30 ثانية  
✅ **طلبات معلقة**: تنظيف قسري بعد 20 ثانية  
✅ **تزاحم الطلبات**: تقليل العدد المتزامن إلى 2  
✅ **عدم الاستجابة**: إعادة تعيين طارئة متاحة  
✅ **أخطاء متكررة**: وضع آمن بطلب واحد فقط

## التوقعات

بعد هذه الإصلاحات:

- ✅ عمليات أقل انتهاءً للمهلة
- ✅ استجابة أفضل من Supabase
- ✅ تعافي تلقائي من المشاكل
- ✅ أدوات طوارئ للحالات الصعبة
- ✅ أداء أكثر استقراراً

الآن النظام أكثر صبراً ومرونة مع الاتصالات البطيئة! ⏱️
