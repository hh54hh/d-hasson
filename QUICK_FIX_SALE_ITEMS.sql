-- 🚨 إصلاح سريع لمشكلة عدم ظهور المنتجات في كشف الحساب
-- انسخ والصق هذا الكود في Supabase SQL Editor واضغط RUN

-- =================================================================================
-- Step 1: إنشاء جدول sale_items (المفقود والذي يسبب المشكلة)
-- =================================================================================

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

-- =================================================================================
-- Step 2: إضافة العلاقات المطلوبة
-- =================================================================================

-- العلاقة مع جدول المبيعات
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sale_items_sale_id_fkey'
    ) THEN
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_sale_id_fkey
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
    END IF;
END $$;

-- العلاقة مع جدول المنتجات
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sale_items_product_id_fkey'
    ) THEN
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =================================================================================
-- Step 3: إنشاء الفهارس للأداء السريع
-- =================================================================================

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_created_at ON sale_items(created_at);

-- =================================================================================
-- Step 4: إضافة عمود items_count إلى جدول sales (إذا لم يكن موجود)
-- =================================================================================

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
-- Step 5: إنشاء الدوال التلقائية
-- =================================================================================

-- دالة تحديث كمية المنتج عند البيع
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- تقليل كمية المنتج
        UPDATE products 
        SET quantity = quantity - NEW.quantity,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.product_id;
        
        -- التحقق من عدم وجود كمية سالبة
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
$$ LANGUAGE plpgsql;

-- =================================================================================
-- Step 6: إنشاء المشغلات (Triggers)
-- =================================================================================

-- مشغل تحديث كمية المنتج
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON sale_items;
CREATE TRIGGER update_product_quantity_trigger
    AFTER INSERT OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_sale();

-- مشغل تحديث عدد المنتجات في البيعة
DROP TRIGGER IF EXISTS update_sale_items_count_trigger ON sale_items;
CREATE TRIGGER update_sale_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_count();

-- =================================================================================
-- Step 7: تحديث البيانات الموجودة
-- =================================================================================

-- تحديث عدد المنتجات للمبيعات الموجودة
UPDATE sales
SET items_count = COALESCE((
    SELECT COUNT(*)
    FROM sale_items
    WHERE sale_id = sales.id
), 0)
WHERE items_count IS NULL OR items_count = 0;

-- =================================================================================
-- Step 8: إنشاء view لكشف الحساب
-- =================================================================================

CREATE OR REPLACE VIEW customer_statement_detailed AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    s.id as sale_id,
    s.sale_date,
    s.total_amount as sale_total,
    s.payment_type,
    s.paid_amount,
    s.remaining_amount,
    si.id as item_id,
    si.product_name,
    si.quantity,
    si.unit_price,
    si.total_amount as item_total,
    si.profit_amount
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
LEFT JOIN sale_items si ON s.id = si.sale_id
ORDER BY c.name, s.sale_date DESC, si.created_at;

-- =================================================================================
-- Step 9: دالة للحصول على كشف حساب العميل
-- =================================================================================

CREATE OR REPLACE FUNCTION get_customer_purchases(customer_uuid UUID)
RETURNS TABLE (
    sale_date DATE,
    product_name TEXT,
    quantity INTEGER,
    unit_price DECIMAL,
    total_amount DECIMAL,
    payment_type TEXT,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.sale_date,
        si.product_name,
        si.quantity,
        si.unit_price,
        si.total_amount,
        s.payment_type,
        COALESCE(s.notes, '') as notes
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    WHERE s.customer_id = customer_uuid
    ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =================================================================================
-- Step 10: اختبار الإصلاح
-- =================================================================================

-- فحص وجود الجدول
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'sale_items'
        ) THEN '✅ جدول sale_items موجود'
        ELSE '❌ جدول sale_items مفقود'
    END as table_check;

-- فحص العلاقات
SELECT 
    COUNT(*) as foreign_keys_count,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ العلاقات موجودة'
        ELSE '❌ العلاقات مفقودة'
    END as relations_check
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
  AND table_name = 'sale_items';

-- فحص المشغلات
SELECT 
    COUNT(*) as triggers_count,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ المشغلات موجودة'
        ELSE '❌ المشغلات مفقودة'
    END as triggers_check
FROM information_schema.triggers 
WHERE event_object_table = 'sale_items';

-- =================================================================================
-- رسالة النجاح
-- =================================================================================

SELECT 
    '🎉 تم إصلاح قاعدة البيانات بنجاح!' as message,
    'الآن يمكن إضافة المبيعات وستظهر المنتجات في كشف الحساب' as instruction,
    'جرب إضافة عملية بيع جديدة مع عدة منتجات واعرض كشف الحساب' as next_step;

-- للتحقق من نجاح الإصلاح، شغّل هذا الاستعلام:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'sale_items';
-- يجب أن يُظهر النتيجة: sale_items

-- =================================================================================
-- انتهى الإصل��ح!
-- =================================================================================
