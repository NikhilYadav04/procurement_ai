-- Migration: Associate vendors with customer emails
-- This allows each customer to have their own set of vendors

-- Add customer_email column to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_customer_email ON vendors(customer_email);

-- Update the unique constraint to be per customer
-- First, drop the existing unique constraint on email
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_email_key;

-- Create a new unique constraint that combines email and customer_email
-- This allows same vendor email to exist for different customers
ALTER TABLE vendors 
ADD CONSTRAINT vendors_email_customer_email_unique 
UNIQUE (email, customer_email);

-- Add foreign key constraint to ensure customer exists
-- Note: This assumes customer_email references the email field in customers table
ALTER TABLE vendors
ADD CONSTRAINT vendors_customer_email_fkey
FOREIGN KEY (customer_email) REFERENCES customers(email) ON DELETE CASCADE;

-- Update RLS policies for vendors table
-- Drop existing policy
DROP POLICY IF EXISTS "Allow all operations on vendors" ON vendors;

-- Create new policies that filter by customer email
-- Policy for authenticated users to view their own vendors
CREATE POLICY "Users can view their own vendors" ON vendors
FOR SELECT
USING (true);

-- Policy for authenticated users to insert their own vendors
CREATE POLICY "Users can insert their own vendors" ON vendors
FOR INSERT
WITH CHECK (true);

-- Policy for authenticated users to update their own vendors
CREATE POLICY "Users can update their own vendors" ON vendors
FOR UPDATE
USING (true);

-- Policy for authenticated users to delete their own vendors
CREATE POLICY "Users can delete their own vendors" ON vendors
FOR DELETE
USING (true);

-- Note: Actual filtering by customer_email will be done at the application level
-- since we're using anon key and passing customer context through the application
