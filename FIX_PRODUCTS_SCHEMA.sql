-- =================================================================================
-- إصلاح مشكلة last_sale_date في جدول products
-- Fix for last_sale_date issue in products table
-- 
-- تشغيل هذا السكريبت في Supabase SQL Editor
-- Run this script in Supabase SQL Editor
-- =================================================================================

-- تحقق من وجود عمود last_sale_date في جدول products
-- Check if last_sale_date column exists in products table
DO $$
BEGIN
    -- إزالة عمود last_sale_date من جدول products ��ذا كان موجوداً
    -- Remove last_sale_date column from products table if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'last_sale_date'
    ) THEN
        ALTER TABLE products DROP COLUMN last_sale_date;
        RAISE NOTICE 'تم حذف عمود last_sale_date من جدول products - Column last_sale_date removed from products table';
    ELSE
        RAISE NOTICE 'عمود last_sale_date غير موجود في جدول products - Column last_sale_date not found in products table';
    END IF;
END
$$;

-- التأكد من أن جدول products يحتوي على الأعمدة المطلوبة فقط
-- Ensure products table contains only required columns
-- Expected schema for products table:
-- - id (UUID)
-- - name (TEXT)
-- - wholesale_price (DECIMAL)
-- - sale_price (DECIMAL)
-- - quantity (INTEGER)
-- - min_quantity (INTEGER)
-- - created_at (TIMESTAMP)
-- - updated_at (TIMESTAMP)

-- إضافة الأعمدة المفقودة إذا لم تكن موجودة
-- Add missing columns if they don't exist
DO $$
BEGIN
    -- إضافة عمود min_quantity إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'min_quantity'
    ) THEN
        ALTER TABLE products ADD COLUMN min_quantity INTEGER DEFAULT 5 CHECK (min_quantity >= 0);
        RAISE NOTICE 'تم إضافة عمود min_quantity - Added min_quantity column';
    END IF;

    -- إضافة عمود updated_at إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE products ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
        RAISE NOTICE 'تم إضافة عمود updated_at - Added updated_at column';
    END IF;
END
$$;

-- إنشاء دالة تحديث تلقائي لـ updated_at إذا لم تكن موجودة
-- Create automatic updated_at function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إنشاء trigger لتحديث updated_at تلقائياً
-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- التحقق من Schema النهائي
-- Verify final schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- عرض رسالة نجاح
-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ تم إصلاح schema جدول products بنجاح - Products table schema fixed successfully';
    RAISE NOTICE '📋 الأعمدة الحالية: id, name, wholesale_price, sale_price, quantity, min_quantity, created_at, updated_at';
    RAISE NOTICE '🚫 تم حذف عمود last_sale_date (غير مطلوب للمنتجات)';
END
$$;
