-- ============================================
-- PROCURIX CUSTOMERS SETUP
-- Payment Integration - Complete Database Setup
-- ============================================
-- This script handles EVERYTHING:
-- 1. Drops existing table (fresh start)
-- 2. Creates new table with plan-name-based system
-- 3. Sets up RLS policies
-- 4. Creates helper functions and triggers
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire script
-- 2. Paste in Supabase SQL Editor
-- 3. Click "Run"
-- 4. Done! Your database is ready
-- ============================================

-- ============================================
-- STEP 1: CLEAN SLATE (Drop existing table)
-- ============================================
DROP TABLE IF EXISTS customers CASCADE;
DROP VIEW IF EXISTS active_customers CASCADE;
DROP FUNCTION IF EXISTS update_customers_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_credits_by_plan() CASCADE;

-- ============================================
-- STEP 2: CREATE CUSTOMERS TABLE
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  
  -- Lemon Squeezy identifiers
  customer_id VARCHAR(255),
  order_id VARCHAR(255),
  variant_id VARCHAR(255),
  
  -- Plan identification (PRIMARY MARKER)
  plan_name VARCHAR(100) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'past_due', 'on_trial', 'paused', 'pending')),
  billing_cycle VARCHAR(20),
  
  -- Payment details
  amount_paid DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- ============================================
  -- CREDIT SYSTEM
  -- ============================================
  -- Chat credits
  monthly_chat_credit INTEGER DEFAULT 50,
  plan_chat_credit INTEGER DEFAULT 0,
  total_chat_credit INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN plan_chat_credit = -1 THEN -1
      ELSE monthly_chat_credit + plan_chat_credit 
    END
  ) STORED,
  
  -- Document credits
  monthly_doc_credit INTEGER DEFAULT 10,
  plan_doc_credit INTEGER DEFAULT 0,
  total_doc_credit INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN plan_doc_credit = -1 THEN -1
      ELSE monthly_doc_credit + plan_doc_credit 
    END
  ) STORED,
  
  -- Subscription dates
  renews_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_customer_id ON customers(customer_id);
CREATE INDEX idx_customers_plan_name ON customers(plan_name);
CREATE INDEX idx_customers_status ON customers(subscription_status);
CREATE INDEX idx_customers_created_at ON customers(created_at);

-- ============================================
-- STEP 4: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow public inserts (for payment webhooks)
CREATE POLICY "Allow public customer creation" ON customers
  FOR INSERT TO public
  WITH CHECK (true);

-- Policy 2: Allow public select
CREATE POLICY "Allow public read" ON customers
  FOR SELECT TO public
  USING (true);

-- Policy 3: Allow public updates
CREATE POLICY "Allow public customer updates" ON customers
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

-- Policy 4: Service role has full access
CREATE POLICY "Allow service role full access" ON customers
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ============================================

-- Function 1: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Set credits based on plan name
CREATE OR REPLACE FUNCTION update_credits_by_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_name = 'topup' THEN
    NEW.plan_chat_credit := 200;
    NEW.plan_doc_credit := 50;
    NEW.billing_cycle := 'one-time';
  ELSIF NEW.plan_name = 'plus' THEN
    NEW.plan_chat_credit := -1;
    NEW.plan_doc_credit := -1;
    NEW.billing_cycle := 'monthly';
    NEW.renews_at := NEW.updated_at + INTERVAL '30 days';
  ELSE
    NEW.plan_chat_credit := 0;
    NEW.plan_doc_credit := 0;
    NEW.billing_cycle := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: CREATE TRIGGERS
-- ============================================

-- Trigger 1: Auto-update timestamp
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at_column();

-- Trigger 2: Set credits on insert/update
DROP TRIGGER IF EXISTS set_credits_by_plan_insert ON customers;
CREATE TRIGGER set_credits_by_plan_insert
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_credits_by_plan();

DROP TRIGGER IF EXISTS set_credits_by_plan_update ON customers;
CREATE TRIGGER set_credits_by_plan_update
    BEFORE UPDATE OF plan_name ON customers
    FOR EACH ROW
    WHEN (OLD.plan_name IS DISTINCT FROM NEW.plan_name)
    EXECUTE FUNCTION update_credits_by_plan();

-- ============================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================
GRANT ALL ON customers TO anon;
GRANT ALL ON customers TO authenticated;
GRANT ALL ON customers TO service_role;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Your Procurix database is now ready to handle:
-- ✅ User authentication
-- ✅ Credit management
-- ✅ Payment webhooks
-- ✅ Subscription tracking
-- ============================================
