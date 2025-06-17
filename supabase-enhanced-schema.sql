-- Enhanced Supabase schema for multi-product cart system
-- Run this in your Supabase SQL editor

-- Update sales table to support multi-product transactions
ALTER TABLE sales DROP COLUMN IF EXISTS product_id;
ALTER TABLE sales DROP COLUMN IF EXISTS product_name;
ALTER TABLE sales DROP COLUMN IF EXISTS quantity;
ALTER TABLE sales DROP COLUMN IF EXISTS unit_price;

-- Add new columns to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0;

-- Create sale_items table for individual products in a sale
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    profit_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create unique constraint to prevent duplicate phone numbers
ALTER TABLE customers ADD CONSTRAINT unique_customer_phone UNIQUE (phone);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sale_items_updated_at ON sale_items;
CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update items count in sales table
CREATE OR REPLACE FUNCTION update_sale_items_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update items count in sales table
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

DROP TRIGGER IF EXISTS update_sale_items_count_trigger ON sale_items;
CREATE TRIGGER update_sale_items_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_count();

-- Function to automatically update product quantities when sale items are added
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Decrease product quantity
        UPDATE products 
        SET quantity = quantity - NEW.quantity,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.product_id;
        
        -- Check if quantity becomes negative
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_name;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Adjust product quantity based on the difference
        UPDATE products 
        SET quantity = quantity - (NEW.quantity - OLD.quantity),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = NEW.product_id;
        
        -- Check if quantity becomes negative
        IF (SELECT quantity FROM products WHERE id = NEW.product_id) < 0 THEN
            RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_name;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Restore product quantity
        UPDATE products 
        SET quantity = quantity + OLD.quantity,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = OLD.product_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_product_quantity_trigger ON sale_items;
CREATE TRIGGER update_product_quantity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_sale();

-- Sample data for testing (only if tables are empty)
INSERT INTO products (name, wholesale_price, sale_price, quantity, min_quantity) 
SELECT * FROM (VALUES
    ('iPhone 14 Pro', 1200000, 1350000, 10, 2),
    ('Samsung Galaxy S23', 1100000, 1250000, 8, 2),
    ('iPad Air', 900000, 1050000, 5, 1),
    ('AirPods Pro', 350000, 420000, 15, 3),
    ('Samsung Buds', 280000, 350000, 12, 3)
) AS v(name, wholesale_price, sale_price, quantity, min_quantity)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

-- Enable Row Level Security (RLS) if needed
-- ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed)
-- GRANT ALL ON sale_items TO authenticated;
-- GRANT ALL ON sale_items TO service_role;
