-- CRITICAL FIX: إصلاح مشاكل قاعدة البيانات ونظام المبيعات
-- هذا الملف يحل المشاكل التالي��:
-- 1. عدم ظهور المشتريات في كشف حساب الزبون
-- 2. عدم تقليل المخزن عند البيع
-- 3. عدم وجود جدول sale_items

-- تمكين UUID إذا لم يكن موجود
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- 1. إنشاء جدول sale_items المفقود
-- =========================
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    profit_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =========================
-- 2. إضافة العلاقات المطلوبة
-- =========================
DO $$
BEGIN
    -- علاقة مع جدول المبيعات
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sale_items_sale_id_fkey'
    ) THEN
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_sale_id_fkey
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
    END IF;

    -- علاقة مع جدول المنتجات
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sale_items_product_id_fkey'
    ) THEN
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =========================
-- 3. إنشاء فهارس للأداء
-- =========================
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);

-- =========================
-- 4. تحديث جدول المبيعات
-- =========================
-- إضافة عمود عدد المنتجات إذا لم يكن موجود
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'items_count'
    ) THEN
        ALTER TABLE sales ADD COLUMN items_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- إزالة الأعمدة القديمة التي لا نحتاجها
DO $$
BEGIN
    -- إزالة product_id من جدول sales (الآن في sale_items)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'product_id'
    ) THEN
        ALTER TABLE sales DROP COLUMN product_id;
    END IF;

    -- إزالة product_name من جدول sales
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'product_name'
    ) THEN
        ALTER TABLE sales DROP COLUMN product_name;
    END IF;

    -- إزالة quantity من جدول sales
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE sales DROP COLUMN quantity;
    END IF;

    -- إزالة unit_price من جدول sales
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'unit_price'
    ) THEN
        ALTER TABLE sales DROP COLUMN unit_price;
    END IF;
END $$;

-- =========================
-- 5. إنشاء الدوال المطلوبة
-- =========================

-- دالة تحديث عدد المنتجات في البيعة
CREATE OR REPLACE FUNCTION update_sale_items_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE sales
        SET items_count = (
            SELECT COUNT(*)
            FROM sale_items
            WHERE sale_id = NEW.sale_id
        )
        WHERE id = NEW.sale_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sales
        SET items_count = (
            SELECT COUNT(*)
            FROM sale_items
            WHERE sale_id = OLD.sale_id
        )
        WHERE id = OLD.sale_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- دالة تحديث التاريخ
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- دالة تحديث كمية المنتج تلقائياً عند البيع
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- تقليل كمية المنتج
        UPDATE products 
        SET quantity = quantity - NEW.quantity,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.product_id;
        
        -- التحقق من الكمية السالبة
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'الكمية غير كافية للمنتج: %', NEW.product_name;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- تعديل كمية المنتج حسب الفرق
        UPDATE products 
        SET quantity = quantity - (NEW.quantity - OLD.quantity),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.product_id;
        
        -- التحقق من الكمية السالبة
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'الكمية غير كافية للمنتج: %', NEW.product_name;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- إرجاع كمية المنتج
        UPDATE products 
        SET quantity = quantity + OLD.quantity,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = OLD.product_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- =========================
-- 6. إنشاء المشغلات (Triggers)
-- =========================

-- مشغل عدد المنتجات
DROP TRIGGER IF EXISTS update_sale_items_count_trigger ON sale_items;
CREATE TRIGGER update_sale_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_count();

-- مشغل تحديث التاريخ
DROP TRIGGER IF EXISTS update_sale_items_updated_at ON sale_items;
CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- مشغل تحديث كمية المنتج التلقائي
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON sale_items;
CREATE TRIGGER update_product_quantity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_sale();

-- =========================
-- 7. تحديث البيانات الموجودة
-- =========================

-- تحديث عدد المنتجات للمبيعات الموجودة
UPDATE sales
SET items_count = COALESCE((
    SELECT COUNT(*)
    FROM sale_items
    WHERE sale_id = sales.id
), 0)
WHERE items_count IS NULL OR items_count = 0;

-- =========================
-- 8. إعدادات الأمان
-- =========================

-- تمكين Row Level Security إذا كان مطلوب
-- ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- منح الصلاحيات للمستخدمين (قم بتعديلها حسب الحاجة)
-- CREATE POLICY "Enable all operations for anon users on sale_items" ON sale_items FOR ALL TO anon USING (true);

-- =========================
-- 9. اختبارات التحقق
-- =========================

-- تحقق من وجود الجداول
SELECT 'اختبار الجداول' as test_name,
       CASE
         WHEN COUNT(*) >= 4 THEN 'نجح: جميع الجداول موجودة ✅'
         ELSE 'فشل: جداول مفقودة ❌ - متوقع 4، موجود ' || COUNT(*)::text
       END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sales', 'sale_items', 'customers', 'products');

-- تحقق من العلاقات
SELECT 'اختبار العلاقات' as test_name,
       CASE
         WHEN COUNT(*) >= 2 THEN 'نجح: العلاقات موجودة ✅'
         ELSE 'فشل: علاقات مفقودة ❌ - متوقع 2+، موجود ' || COUNT(*)::text
       END as result
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sale_items';

-- تحقق من هيكل الجدول
SELECT 'اختبار الهيكل' as test_name,
       CASE
         WHEN COUNT(*) >= 9 THEN 'نجح: هيكل الجدول صحيح ✅'
         ELSE 'فشل: أعمدة مفقودة ❌ - متوقع 9+، موجود ' || COUNT(*)::text
       END as result
FROM information_schema.columns
WHERE table_name = 'sale_items'
  AND table_schema = 'public';

-- =========================
-- 10. رسالة النجاح
-- =========================
SELECT '🎉 تم إصلاح قاعدة البيانات بنجاح!' as message,
       'الآن يمكن إجراء المبيعات وعرض كشوف الحساب بشكل صحيح' as instruction,
       'تأكد من تشغيل هذا السكريبت في محرر SQL في Supabase' as note;
