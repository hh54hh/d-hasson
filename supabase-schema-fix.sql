-- Fix Supabase schema issues for مركز البدر
-- Run this in your Supabase SQL editor
-- This will create the missing sale_items table and all necessary relationships

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Check and create sale_items table if it doesn't exist
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

-- 2. Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add foreign key to sales table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sale_items_sale_id_fkey'
    ) THEN
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_sale_id_fkey
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key to products table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sale_items_product_id_fkey'
    ) THEN
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);

-- 4. Add items_count column to sales table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'items_count'
    ) THEN
        ALTER TABLE sales ADD COLUMN items_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5. Create function to update items count
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

-- 6. Create trigger for items count
DROP TRIGGER IF EXISTS update_sale_items_count_trigger ON sale_items;
CREATE TRIGGER update_sale_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_count();

-- 7. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create updated_at trigger for sale_items
DROP TRIGGER IF EXISTS update_sale_items_updated_at ON sale_items;
CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Update existing sales to have items_count if any sale_items exist
UPDATE sales
SET items_count = (
    SELECT COUNT(*)
    FROM sale_items
    WHERE sale_id = sales.id
)
WHERE items_count IS NULL OR items_count = 0;

-- 10. Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON sale_items TO authenticated;
-- GRANT ALL ON sale_items TO service_role;

-- ===== VERIFICATION QUERIES =====
-- Run these to verify everything is working

-- 1. Check if all tables exist
SELECT 'Tables Check' as test_name,
       CASE
         WHEN COUNT(*) = 4 THEN 'PASS: All tables exist'
         ELSE 'FAIL: Missing tables - Expected 4, Found ' || COUNT(*)::text
       END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sales', 'sale_items', 'customers', 'products');

-- 2. Check foreign key relationships
SELECT 'Foreign Keys Check' as test_name,
       CASE
         WHEN COUNT(*) >= 2 THEN 'PASS: Foreign keys exist'
         ELSE 'FAIL: Missing foreign keys - Expected 2+, Found ' || COUNT(*)::text
       END as result
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sale_items';

-- 3. Check if sale_items table structure is correct
SELECT 'Table Structure Check' as test_name,
       CASE
         WHEN COUNT(*) >= 8 THEN 'PASS: Table structure correct'
         ELSE 'FAIL: Missing columns - Expected 8+, Found ' || COUNT(*)::text
       END as result
FROM information_schema.columns
WHERE table_name = 'sale_items'
  AND table_schema = 'public';

-- 4. Test basic query (should not fail)
SELECT 'Query Test' as test_name,
       'PASS: Queries working' as result
FROM sales
LIMIT 1;

-- Show the relationships for verification
SELECT
    'Relationship Details' as info_type,
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('sale_items', 'sales');

-- Final success message
SELECT '🎉 SCHEMA FIX COMPLETED' as message,
       'If all tests show PASS, your database is ready!' as instruction;
