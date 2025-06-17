-- 🚨 السكريبت الشامل النهائي لإصلاح قاعدة بيانات Supabase
-- قم بتشغيل هذا السكريبت في Supabase SQL Editor
-- هذا السكريبت يحل جميع مشاكل عرض المنتجات في كشف الحساب ويضمن حفظ البيانات بشكل صحيح

-- =================================================================================
-- Step 1: تمكين UUID إذا لم يكن موجود
-- =================================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================================
-- Step 2: إنشاء جدول العملاء (customers) مع تحسينات
-- =================================================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    address TEXT NOT NULL,
    payment_status TEXT DEFAULT 'cash' CHECK (payment_status IN ('cash', 'deferred', 'partial')),
    registration_date DATE DEFAULT CURRENT_DATE,
    last_sale_date DATE DEFAULT CURRENT_DATE,
    debt_amount DECIMAL(12,2) DEFAULT 0 CHECK (debt_amount >= 0),
    debt_paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =================================================================================
-- Step 3: إنشاء جدول المنتجات (products) مع تحسينات
-- =================================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    wholesale_price DECIMAL(10,2) NOT NULL CHECK (wholesale_price >= 0),
    sale_price DECIMAL(10,2) NOT NULL CHECK (sale_price >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER DEFAULT 5 CHECK (min_quantity >= 0),
    last_sale_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =================================================================================
-- Step 4: إنشاء جدول المبيعات الرئيسي (sales)
-- =================================================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    sale_date DATE DEFAULT CURRENT_DATE,
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    payment_type TEXT DEFAULT 'cash' CHECK (payment_type IN ('cash', 'deferred', 'partial')),
    paid_amount DECIMAL(12,2) DEFAULT 0 CHECK (paid_amount >= 0),
    remaining_amount DECIMAL(12,2) DEFAULT 0 CHECK (remaining_amount >= 0),
    payment_date DATE,
    profit_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    items_count INTEGER DEFAULT 0 CHECK (items_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- العلاقة مع جدول العملاء
    CONSTRAINT sales_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- =================================================================================
-- Step 5: إنشاء جدول تفاصيل المبيعات (sale_items) - هذا هو الجدول المفقود الذي يسبب المشكلة
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- العلاقات مع الجداول الأخرى
    CONSTRAINT sale_items_sale_id_fkey 
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    
    CONSTRAINT sale_items_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =================================================================================
-- Step 6: إنشاء جدول دفعات الديون (debt_payments)
-- =================================================================================
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_type TEXT DEFAULT 'partial' CHECK (payment_type IN ('full', 'partial')),
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT DEFAULT '',
    remaining_debt DECIMAL(10,2) DEFAULT 0 CHECK (remaining_debt >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    CONSTRAINT debt_payments_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- =================================================================================
-- Step 7: إنشاء جدول المعاملات (transactions) للسجل الشامل
-- =================================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'payment', 'refund')),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    CONSTRAINT transactions_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- =================================================================================
-- Step 8: إنشاء الفهارس للأداء السريع
-- =================================================================================

-- فهارس الجدول الرئيسي للمبيعات
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_payment_type ON sales(payment_type);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- فهارس جدول تفاصيل المبيعات (الأهم - هذا يحل مشكلة بطء العرض)
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_created_at ON sale_items(created_at);

-- فهارس العملاء
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_payment_status ON customers(payment_status);
CREATE INDEX IF NOT EXISTS idx_customers_debt_amount ON customers(debt_amount);

-- فهارس المنتجات
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);

-- فهارس الدفعات والمعاملات
CREATE INDEX IF NOT EXISTS idx_debt_payments_customer_id ON debt_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- =================================================================================
-- Step 9: إنشاء الدوال التلقائية (Functions)
-- =================================================================================

-- دالة تحديث التاريخ تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- دالة تحديث كمية المنتج ��ند البيع
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- تقليل كمية المنتج
        UPDATE products 
        SET quantity = quantity - NEW.quantity,
            updated_at = TIMEZONE('utc'::text, NOW()),
            last_sale_date = CURRENT_DATE
        WHERE id = NEW.product_id;
        
        -- التحقق من عدم وجود كمية سالبة
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'الكمية غير كافية للمنتج: %', NEW.product_name;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- تعديل كمية المنتج حسب التغيير
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

-- دالة تحديث ديون العميل
CREATE OR REPLACE FUNCTION update_customer_debt()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE customers
        SET debt_amount = (
            SELECT COALESCE(SUM(remaining_amount), 0)
            FROM sales
            WHERE customer_id = NEW.customer_id
        ),
        last_sale_date = CURRENT_DATE,
        updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.customer_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE customers
        SET debt_amount = (
            SELECT COALESCE(SUM(remaining_amount), 0)
            FROM sales
            WHERE customer_id = OLD.customer_id
        ),
        updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = OLD.customer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =================================================================================
-- Step 10: إنشاء المشغلات (Triggers)
-- =================================================================================

-- مشغل تحديث التاريخ لجميع الجداول
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sale_items_updated_at ON sale_items;
CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- مشغل تحديث كمية المنتج (هذا مهم جداً!)
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON sale_items;
CREATE TRIGGER update_product_quantity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_sale();

-- مشغل تحديث عدد المنتجات في البيعة
DROP TRIGGER IF EXISTS update_sale_items_count_trigger ON sale_items;
CREATE TRIGGER update_sale_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_count();

-- مشغل تحديث ديون العميل
DROP TRIGGER IF EXISTS update_customer_debt_trigger ON sales;
CREATE TRIGGER update_customer_debt_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_debt();

-- =================================================================================
-- Step 11: إصلاح البيانات الموجودة
-- =================================================================================

-- تحديث عدد المنتجات للمبيعات الموجودة
UPDATE sales
SET items_count = COALESCE((
    SELECT COUNT(*)
    FROM sale_items
    WHERE sale_id = sales.id
), 0)
WHERE items_count IS NULL OR items_count = 0;

-- تحديث ديون العملاء
UPDATE customers
SET debt_amount = COALESCE((
    SELECT SUM(remaining_amount)
    FROM sales
    WHERE customer_id = customers.id
), 0)
WHERE debt_amount IS NULL;

-- تحديث تاريخ آخر بيعة للعملاء
UPDATE customers
SET last_sale_date = COALESCE((
    SELECT MAX(sale_date)
    FROM sales
    WHERE customer_id = customers.id
), registration_date)
WHERE last_sale_date IS NULL;

-- =================================================================================
-- Step 12: إنشاء Views مفيدة للاستعلامات السريعة
-- =================================================================================

-- View لكشف حساب العميل الشامل
CREATE OR REPLACE VIEW customer_statement AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    c.debt_amount as current_debt,
    COUNT(DISTINCT s.id) as total_sales,
    COALESCE(SUM(s.total_amount), 0) as total_purchases,
    COALESCE(SUM(s.paid_amount), 0) as total_paid,
    COUNT(DISTINCT si.id) as total_items_purchased,
    COALESCE(SUM(si.quantity), 0) as total_quantity
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY c.id, c.name, c.phone, c.address, c.debt_amount;

-- View للمبيعات مع تفاصيل المنتجات
CREATE OR REPLACE VIEW sales_with_items AS
SELECT 
    s.id as sale_id,
    s.customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    s.sale_date,
    s.total_amount,
    s.payment_type,
    s.paid_amount,
    s.remaining_amount,
    s.items_count,
    si.id as item_id,
    si.product_id,
    si.product_name,
    si.quantity,
    si.unit_price,
    si.total_amount as item_total,
    si.profit_amount as item_profit
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN sale_items si ON s.id = si.sale_id
ORDER BY s.created_at DESC, si.created_at;

-- =================================================================================
-- Step 13: إنشاء دوال مساعدة للتطبيق
-- =================================================================================

-- دالة للحصول على كشف حساب عميل
CREATE OR REPLACE FUNCTION get_customer_statement(customer_uuid UUID)
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
        s.notes
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    WHERE s.customer_id = customer_uuid
    ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- دالة للحصول على ملخص العميل
CREATE OR REPLACE FUNCTION get_customer_summary(customer_uuid UUID)
RETURNS TABLE (
    total_sales BIGINT,
    total_amount DECIMAL,
    total_paid DECIMAL,
    current_debt DECIMAL,
    total_items BIGINT,
    last_sale_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id)::BIGINT as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_amount,
        COALESCE(SUM(s.paid_amount), 0) as total_paid,
        COALESCE(MAX(c.debt_amount), 0) as current_debt,
        COALESCE(SUM(si.quantity), 0)::BIGINT as total_items,
        MAX(s.sale_date) as last_sale_date
    FROM customers c
    LEFT JOIN sales s ON c.id = s.customer_id
    LEFT JOIN sale_items si ON s.id = si.sale_id
    WHERE c.id = customer_uuid
    GROUP BY c.id;
END;
$$ LANGUAGE plpgsql;

-- =================================================================================
-- Step 14: إعدادات الأمان (RLS - Row Level Security)
-- =================================================================================

-- تمكين RLS للجداول (اختياري - قم بإلغاء التعليق إذا كنت تحتاج أمان إضافي)
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان (اختياري)
-- CREATE POLICY "Enable all operations for anon users on customers" ON customers FOR ALL TO anon USING (true);
-- CREATE POLICY "Enable all operations for anon users on products" ON products FOR ALL TO anon USING (true);
-- CREATE POLICY "Enable all operations for anon users on sales" ON sales FOR ALL TO anon USING (true);
-- CREATE POLICY "Enable all operations for anon users on sale_items" ON sale_items FOR ALL TO anon USING (true);

-- =================================================================================
-- Step 15: اختبار النظام
-- =================================================================================

-- فحص الجداول
SELECT 'اختبار الجداول' as test_name,
       CASE
         WHEN COUNT(*) >= 6 THEN 'نجح: جميع الجداول موجودة ✅ - عدد الجداول: ' || COUNT(*)::text
         ELSE 'فشل: جداول مفقودة ❌ - متوقع 6+، موجود ' || COUNT(*)::text
       END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'products', 'sales', 'sale_items', 'debt_payments', 'transactions');

-- فحص العلاقات
SELECT 'اختبار العلاقات' as test_name,
       CASE
         WHEN COUNT(*) >= 6 THEN 'نجح: العلاقات موجودة ✅ - عدد العلاقات: ' || COUNT(*)::text
         ELSE 'فشل: علاقات مفقودة ❌ - متوقع 6+، موجود ' || COUNT(*)::text
       END as result
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- فحص المشغلات
SELECT 'اختبار المشغلات' as test_name,
       CASE
         WHEN COUNT(*) >= 6 THEN 'نجح: المشغلات موجودة ✅ - عدد المشغلات: ' || COUNT(*)::text
         ELSE 'تحذير: مشغلات مفقودة ⚠️ - متوقع 6+، موجود ' || COUNT(*)::text
       END as result
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- فحص الفهارس
SELECT 'اختبار الفهارس' as test_name,
       CASE
         WHEN COUNT(*) >= 10 THEN 'نجح: الفهارس موجودة ✅ - عدد الفهارس: ' || COUNT(*)::text
         ELSE 'تحذير: فهارس مفقودة ⚠️ - متوقع 10+، موجود ' || COUNT(*)::text
       END as result
FROM pg_indexes
WHERE schemaname = 'public';

-- =================================================================================
-- Step 16: رسالة النجاح النهائية
-- =================================================================================
SELECT '🎉 تم إنشاء قاعدة البيانات بنجاح!' as message,
       'جميع الجداول والعلاقات والمشغلات تم إنشاؤها' as status,
       'الآن يمكن للتطبيق حفظ واسترجاع البيانات بشكل صحيح' as instruction,
       'المنتجات ستظهر في كشف حساب العميل بالتفصيل' as note;

-- =================================================================================
-- Step 17: بيانات تجريبية (اختياري - قم بإلغاء التعليق للاختبار)
-- =================================================================================

-- إدراج منتجات تجريبية
-- INSERT INTO products (name, wholesale_price, sale_price, quantity, min_quantity) VALUES
-- ('iPhone 15', 4500.00, 5000.00, 10, 2),
-- ('Samsung Galaxy S24', 3500.00, 4000.00, 15, 3),
-- ('سماعة AirPods', 700.00, 800.00, 20, 5),
-- ('شاحن سريع', 50.00, 80.00, 50, 10);

-- إدراج عميل تجريبي
-- INSERT INTO customers (name, phone, address) VALUES
-- ('أحمد محمد', '0501234567', 'الرياض - حي الملك فهد');

-- =================================================================================
-- تم الانتهاء من السكريبت!
-- =================================================================================

-- للتحقق من نجاح العملية، قم بتشغيل الاستعلام التالي:
-- SELECT COUNT(*) as tables_count FROM information_schema.tables WHERE table_schema = 'public';
-- يجب أن يُظهر 6 جداول على الأقل

-- للتحقق من جدول sale_items (الأهم):
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'sale_items';
-- يجب أن يُظهر 1

SELECT 'انتهى السكريبت بنجاح!' as final_message,
       NOW() as completion_time,
       'قم الآن بتجربة إضافة بيعة في التطبيق' as next_step;
