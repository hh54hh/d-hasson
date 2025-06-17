-- PAW Inventory Management System Database Setup
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'cash' CHECK (payment_status IN ('cash', 'deferred', 'partial')),
    last_sale_date DATE,
    debt_amount DECIMAL(10,2) DEFAULT 0,
    debt_paid_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Products table  
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    wholesale_price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(20) DEFAULT 'cash' CHECK (payment_type IN ('cash', 'deferred', 'partial')),
    paid_amount DECIMAL(10,2) DEFAULT 0,
    remaining_amount DECIMAL(10,2) DEFAULT 0,
    sale_date DATE NOT NULL,
    payment_date DATE,
    profit_amount DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Debt payments table
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(20) DEFAULT 'full' CHECK (payment_type IN ('full', 'partial')),
    payment_date DATE NOT NULL,
    notes TEXT,
    remaining_debt DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table (for tracking all activities)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'debt_payment')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sync tracking table (for offline sync)
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    data JSONB,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_payment_status ON customers(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_debt_payments_customer_id ON debt_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);

-- Insert sample products (Iraqi phone store)
INSERT INTO products (name, wholesale_price, sale_price, quantity, min_quantity) VALUES
('iPhone 15 Pro Max 256GB', 1800000, 2100000, 10, 3),
('iPhone 15 Pro 128GB', 1500000, 1850000, 8, 3),
('iPhone 15 128GB', 1200000, 1500000, 15, 5),
('iPhone 14 128GB', 950000, 1200000, 12, 4),
('Samsung Galaxy S24 Ultra', 1400000, 1750000, 6, 2),
('Samsung Galaxy S24', 1100000, 1400000, 10, 3),
('Samsung Galaxy A54', 500000, 650000, 20, 5),
('Samsung Galaxy A34', 350000, 450000, 15, 5),
('Xiaomi 13 Pro', 800000, 1050000, 8, 3),
('Xiaomi Redmi Note 13', 300000, 400000, 25, 8),
('OPPO Find X6 Pro', 900000, 1200000, 5, 2),
('Realme GT 3', 600000, 800000, 12, 4),
('OnePlus 11', 850000, 1100000, 7, 2),
('Google Pixel 8', 750000, 950000, 6, 2),
('Huawei P60 Pro', 700000, 900000, 8, 3);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Policies for anonymous access (since this is a single-user app)
CREATE POLICY "Enable all operations for anon users on customers" ON customers FOR ALL TO anon USING (true);
CREATE POLICY "Enable all operations for anon users on products" ON products FOR ALL TO anon USING (true);
CREATE POLICY "Enable all operations for anon users on sales" ON sales FOR ALL TO anon USING (true);
CREATE POLICY "Enable all operations for anon users on debt_payments" ON debt_payments FOR ALL TO anon USING (true);
CREATE POLICY "Enable all operations for anon users on transactions" ON transactions FOR ALL TO anon USING (true);
CREATE POLICY "Enable all operations for anon users on sync_queue" ON sync_queue FOR ALL TO anon USING (true);
