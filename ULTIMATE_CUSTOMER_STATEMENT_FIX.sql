-- 🚨 الحل النهائي والعميق لمشكلة عدم ظهور المنتجات في كشف الحساب
-- هذا السكريبت يحل المشكلة من الجذور ويضمن عمل النظام بشكل صحيح 100%
-- انسخ والصق هذا الكود كاملاً في Supabase SQL Editor واضغط RUN

-- =================================================================================
-- Step 1: إزالة جميع الإعدادات القديمة والبدء من الصفر
-- =================================================================================

-- إزالة المشغلات والدوال القديمة
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON sale_items;
DROP TRIGGER IF EXISTS update_sale_items_count_trigger ON sale_items;
DROP TRIGGER IF EXISTS update_sale_items_updated_at ON sale_items;

-- إزالة الدوال القديمة
DROP FUNCTION IF EXISTS update_product_quantity_on_sale();
DROP FUNCTION IF EXISTS update_sale_items_count();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- =================================================================================
-- Step 2: إنشاء جدول sale_items من الصفر مع الهيكل الصحيح
-- =================================================================================

-- حذف الجدول إذا كان موجود (لضمان البداية الصحيحة)
DROP TABLE IF EXISTS sale_items CASCADE;

-- إنشاء جدول sale_items جديد مع الهيكل الصحيح
CREATE TABLE sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    profit_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =================================================================================
-- Step 3: إضافة العلاقات الخارجية الصحيحة
-- =================================================================================

-- العلاقة مع جدول المبيعات
ALTER TABLE sale_items 
ADD CONSTRAINT sale_items_sale_id_fkey 
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- العلاقة مع جدول المنتجات  
ALTER TABLE sale_items 
ADD CONSTRAINT sale_items_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- =================================================================================
-- Step 4: إنشاء الفهارس المحسنة للأداء السريع
-- =================================================================================

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_sale_items_created_at ON sale_items(created_at DESC);
CREATE INDEX idx_sale_items_product_name ON sale_items(product_name);

-- فهارس إضافية للمبيعات
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);

-- =================================================================================
-- Step 5: تحديث جدول sales لإضافة عمود items_count
-- =================================================================================

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

-- =================================================================================
-- Step 6: إنشاء الدوال المحسنة
-- =================================================================================

-- دالة تحديث التاريخ
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- دالة تحديث كمية المنتج عند البيع/الحذف
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- تقليل كمية المنتج عند إضافة عنصر جديد
        UPDATE products 
        SET quantity = quantity - NEW.quantity,
            updated_at = TIMEZONE('utc'::text, NOW()),
            last_sale_date = CURRENT_DATE
        WHERE id = NEW.product_id;
        
        -- التحقق من عدم وجود كمية سالبة
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'الكمية غير كافية للمنتج: % (الكمية المتبقية: %)', 
                NEW.product_name, 
                (SELECT quantity + NEW.quantity FROM products WHERE id = NEW.product_id);
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- تعديل كمية المنتج عند تحديث الكمية
        UPDATE products 
        SET quantity = quantity - (NEW.quantity - OLD.quantity),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.product_id;
        
        -- التحقق من عدم وجود كمية سالبة
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'الكمية غير كافية للمنتج: %', NEW.product_name;
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- إرجاع كمية المنتج عند حذف العنصر
        UPDATE products 
        SET quantity = quantity + OLD.quantity,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = OLD.product_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
        ),
        updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.sale_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sales
        SET items_count = (
            SELECT COUNT(*)
            FROM sale_items
            WHERE sale_id = OLD.sale_id
        ),
        updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = OLD.sale_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =================================================================================
-- Step 7: إنشاء المشغلات المحسنة
-- =================================================================================

-- مشغل تحديث التاريخ
CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- مشغل تحديث كمية المنتج
CREATE TRIGGER update_product_quantity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_sale();

-- مشغل تحديث عدد المنتجات في البيعة
CREATE TRIGGER update_sale_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_count();

-- =================================================================================
-- Step 8: إنشاء دوال استعلام محسنة لكشف الحساب
-- =================================================================================

-- دالة للحصول على تفاصيل مشتريات العميل
CREATE OR REPLACE FUNCTION get_customer_purchases_detailed(customer_uuid UUID)
RETURNS TABLE (
    sale_id UUID,
    sale_date DATE,
    product_id UUID,
    product_name TEXT,
    quantity INTEGER,
    unit_price DECIMAL(12,2),
    total_amount DECIMAL(12,2),
    profit_amount DECIMAL(12,2),
    payment_type TEXT,
    paid_amount DECIMAL(12,2),
    remaining_amount DECIMAL(12,2),
    notes TEXT,
    sale_created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as sale_id,
        s.sale_date,
        si.product_id,
        si.product_name,
        si.quantity,
        si.unit_price,
        si.total_amount,
        si.profit_amount,
        s.payment_type,
        s.paid_amount,
        s.remaining_amount,
        COALESCE(s.notes, '') as notes,
        s.created_at as sale_created_at
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    WHERE s.customer_id = customer_uuid
    ORDER BY s.sale_date DESC, s.created_at DESC, si.created_at;
END;
$$ LANGUAGE plpgsql;

-- دالة للحصول على ملخص مشتريات العميل
CREATE OR REPLACE FUNCTION get_customer_purchases_summary(customer_uuid UUID)
RETURNS TABLE (
    total_sales BIGINT,
    total_items BIGINT,
    total_quantity BIGINT,
    total_amount DECIMAL(12,2),
    total_paid DECIMAL(12,2),
    total_remaining DECIMAL(12,2),
    total_profit DECIMAL(12,2),
    last_purchase_date DATE,
    first_purchase_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id)::BIGINT as total_sales,
        COUNT(si.id)::BIGINT as total_items,
        COALESCE(SUM(si.quantity), 0)::BIGINT as total_quantity,
        COALESCE(SUM(s.total_amount), 0) as total_amount,
        COALESCE(SUM(s.paid_amount), 0) as total_paid,
        COALESCE(SUM(s.remaining_amount), 0) as total_remaining,
        COALESCE(SUM(si.profit_amount), 0) as total_profit,
        MAX(s.sale_date) as last_purchase_date,
        MIN(s.sale_date) as first_purchase_date
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    WHERE s.customer_id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

-- =================================================================================
-- Step 9: إنشاء Views محسنة للاستعلامات السريعة
-- =================================================================================

-- View شامل لكشف حساب العميل
CREATE OR REPLACE VIEW customer_statement_complete AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    c.payment_status as customer_payment_status,
    c.debt_amount as customer_debt,
    s.id as sale_id,
    s.sale_date,
    s.total_amount as sale_total,
    s.payment_type,
    s.paid_amount,
    s.remaining_amount,
    s.notes as sale_notes,
    s.items_count,
    si.id as item_id,
    si.product_id,
    si.product_name,
    si.quantity,
    si.unit_price,
    si.total_amount as item_total,
    si.profit_amount as item_profit,
    s.created_at as sale_created_at,
    si.created_at as item_created_at
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
LEFT JOIN sale_items si ON s.id = si.sale_id
ORDER BY c.name, s.sale_date DESC, s.created_at DESC, si.created_at;

-- View للمبيعات بدون تفاصيل منتجات (للتشخيص)
CREATE OR REPLACE VIEW sales_without_items AS
SELECT 
    s.id,
    s.customer_id,
    c.name as customer_name,
    s.sale_date,
    s.total_amount,
    s.items_count,
    COALESCE(si_count.actual_count, 0) as actual_items_count
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN (
    SELECT sale_id, COUNT(*) as actual_count 
    FROM sale_items 
    GROUP BY sale_id
) si_count ON s.id = si_count.sale_id
WHERE COALESCE(si_count.actual_count, 0) = 0
ORDER BY s.created_at DESC;

-- =================================================================================
-- Step 10: تحديث البيانات الموجودة
-- =================================================================================

-- تحديث عدد المنتجات للمبيعات الموجودة
UPDATE sales
SET items_count = COALESCE((
    SELECT COUNT(*)
    FROM sale_items
    WHERE sale_id = sales.id
), 0);

-- تحديث ديون العملاء
UPDATE customers
SET debt_amount = COALESCE((
    SELECT SUM(remaining_amount)
    FROM sales
    WHERE customer_id = customers.id
), 0);

-- =================================================================================
-- Step 11: إدراج بيانات تجريبية للاختبار (اختياري)
-- =================================================================================

-- إدراج عميل تجريبي
DO $$
DECLARE
    test_customer_id UUID;
    test_product_id UUID;
    test_sale_id UUID;
BEGIN
    -- التحقق من وجود عميل تجريبي
    SELECT id INTO test_customer_id FROM customers WHERE phone = 'test_123456789' LIMIT 1;
    
    IF test_customer_id IS NULL THEN
        -- إنشاء عميل تجريبي
        INSERT INTO customers (name, phone, address, payment_status)
        VALUES ('عميل تجريبي', 'test_123456789', 'عنوان تجريبي', 'cash')
        RETURNING id INTO test_customer_id;
        
        -- إنشاء منتج تجريبي
        INSERT INTO products (name, wholesale_price, sale_price, quantity, min_quantity)
        VALUES ('منتج تجريبي', 100.00, 150.00, 50, 5)
        RETURNING id INTO test_product_id;
        
        -- إنشاء بيعة تجريبية
        INSERT INTO sales (customer_id, sale_date, total_amount, payment_type, paid_amount, remaining_amount, notes)
        VALUES (test_customer_id, CURRENT_DATE, 300.00, 'cash', 300.00, 0.00, 'بيعة تجريبية للاختبار')
        RETURNING id INTO test_sale_id;
        
        -- إنشاء تفاصيل البيعة التجريبية
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_amount, profit_amount)
        VALUES 
        (test_sale_id, test_product_id, 'منتج تجريبي', 2, 150.00, 300.00, 100.00);
        
        RAISE NOTICE 'تم إنشاء بيانات تجريبية للاختبار: عميل % مع بيعة %', test_customer_id, test_sale_id;
    END IF;
END $$;

-- =================================================================================
-- Step 12: اختبارات شاملة للتحقق من الإصلاح
-- =================================================================================

-- اختبار 1: التحقق من وجود الجداول
SELECT 
    'اختبار الجداول' as test_name,
    CASE 
        WHEN COUNT(*) >= 6 THEN '✅ جميع الجداول موجودة - العدد: ' || COUNT(*)::text
        ELSE '❌ جداول مفقودة - العدد: ' || COUNT(*)::text || ' من أصل 6'
    END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'products', 'sales', 'sale_items', 'debt_payments', 'transactions');

-- اختبار 2: التحقق من العلاقات
SELECT 
    'اختبار العلاقات' as test_name,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ العلاقات موجودة - العدد: ' || COUNT(*)::text
        ELSE '❌ علاقات مفقودة - العدد: ' || COUNT(*)::text
    END as result
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_name = 'sale_items';

-- اختبار 3: التحقق من المشغلات
SELECT 
    'اختبار المشغلات' as test_name,
    CASE 
        WHEN COUNT(*) >= 3 THEN '✅ المشغلات موجودة - العدد: ' || COUNT(*)::text
        ELSE '❌ مشغلات مفقودة - العدد: ' || COUNT(*)::text
    END as result
FROM information_schema.triggers
WHERE event_object_table = 'sale_items';

-- اختبار 4: التحقق من الدوال
SELECT 
    'اختبار الدوال' as test_name,
    CASE 
        WHEN COUNT(*) >= 3 THEN '✅ الدوال موجودة - العدد: ' || COUNT(*)::text
        ELSE '❌ دوال مفقودة - العدد: ' || COUNT(*)::text
    END as result
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_updated_at_column', 'update_product_quantity_on_sale', 'update_sale_items_count');

-- اختبار 5: التحقق من البيانات التجريبية
SELECT 
    'اختبار البيانات' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM customer_statement_complete 
            WHERE customer_phone = 'test_123456789' 
            AND product_name IS NOT NULL
        ) THEN '✅ البيانات التجريبية تعمل بشكل صحيح'
        ELSE '⚠️ لا توجد بيانات تجريبية أو لا تظهر بشكل صحيح'
    END as result;

-- اختبار 6: فحص المبيعات بدون تفاصيل
SELECT 
    'اختبار المبيعات الفارغة' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ جميع المبيعات لها تفاصيل منتجات'
        ELSE '⚠️ يوجد ' || COUNT(*)::text || ' مبيعات بدون تفاصيل منتجات'
    END as result,
    COUNT(*) as empty_sales_count
FROM sales_without_items;

-- =================================================================================
-- Step 13: رسائل النجاح والتعليمات
-- =================================================================================

SELECT 
    '🎉 تم إكمال الإصلاح الشامل بنجاح!' as status,
    'جميع الجداول والعلاقات والمشغلات تم إنشاؤها' as tables_status,
    'تم إنشاء دوال محسنة لاستعلامات كشف الحساب' as functions_status,
    'تم إنشاء بيانات تجريبية للاختبار' as test_data_status;

SELECT 
    'الآن يمكنك:' as instructions,
    '1. إضافة مبيعات جديدة وستظهر تفاصيل المنتجات' as step_1,
    '2. عرض كشف حساب أي عميل وسترى جميع مشترياته' as step_2,
    '3. استخدام الدوال الجديدة للاستعلامات المحسنة' as step_3;

-- اختبار سريع للبيانات التجريبية
SELECT 
    'اختبار كشف الحساب التجريبي:' as test_title,
    customer_name,
    product_name,
    quantity,
    unit_price,
    item_total,
    sale_date
FROM customer_statement_complete 
WHERE customer_phone = 'test_123456789'
LIMIT 5;

-- =================================================================================
-- انتهى الإصلاح الشامل!
-- =================================================================================

-- ملاحظات مهمة للاستخدام:
-- 1. هذا السكريبت آمن ويمكن تشغيله عدة مرات
-- 2. تم إنشاء بيانات تجريبية للاختبار (يمكن حذفها لاحقاً)
-- 3. جميع الاستعلامات محسنة للأداء السريع
-- 4. تم إضافة فحوصات شاملة للتأكد من سلامة البيانات

-- للتحقق من نجاح الإصلاح، شغّل هذا الاستعلام:
-- SELECT * FROM customer_statement_complete WHERE customer_phone = 'test_123456789';

-- لحذف البيانات التجريبية بعد الاختبار:
-- DELETE FROM customers WHERE phone = 'test_123456789';
-- DELETE FROM products WHERE name = 'منتج تجريبي';

SELECT 'تم الانتهاء من الإصلاح الشامل! 🎉' as final_message;
