# Vendor-Customer Association Migration

## Overview
This migration associates vendors with specific customer emails, ensuring that each customer only sees and interacts with their own vendors. This prevents cross-customer data leakage and provides proper multi-tenancy for the vendor system.

## Changes Made

### 1. Database Schema Changes (`vendors-customer-association.sql`)

#### New Column
- Added `customer_email` column to the `vendors` table
- Type: `TEXT` (references the `email` field in the `customers` table)
- Indexed for better query performance

#### Updated Constraints
- **Removed**: Unique constraint on `email` alone
- **Added**: Composite unique constraint on `(email, customer_email)`
  - This allows the same vendor email to exist for different customers
  - Each customer can have their own instance of a vendor

#### Foreign Key
- Added foreign key constraint linking `customer_email` to `customers(email)`
- Cascade delete: When a customer is deleted, their vendors are automatically removed

#### Row Level Security (RLS)
- Updated RLS policies to support customer-scoped access
- Filtering is done at the application level using the customer context

### 2. Vendor Tool Updates (`agent/tools/vendortool.tsx`)

All vendor tools now:
1. Accept an optional `customer_email` parameter
2. Automatically retrieve `customer_email` from the config if not provided
3. Filter all database queries by `customer_email`
4. Return errors if customer email is not available

#### Updated Tools:
- **`add_vendor`**: Saves vendor with customer_email, checks for duplicates per customer
- **`add_vendors_bulk`**: Associates all bulk-imported vendors with customer_email
- **`list_vendors`**: Only shows vendors belonging to the authenticated customer
- **`delete_vendor`**: Only deletes vendors belonging to the authenticated customer

### 3. Auction Tool Updates (`agent/tools/auctiontool.tsx`)

The `scheduleAuctionTool` now filters vendors by customer_email when:
- Selecting specific vendors by ID or email
- Getting top N vendors
- Getting all vendors from database

This ensures auctions only invite vendors that belong to the customer creating the auction.

### 4. API & Frontend Updates

#### Chat API (`src/pages/api/agent/chat.ts`)
- Now accepts `customerEmail` in the request body
- Passes `customerEmail` through the agent configuration to all tools

#### Dashboard (`src/pages/dashboard.tsx`)
- Sends `user.email` as `customerEmail` to the chat API
- Ensures all agent operations have customer context

## Migration Steps

### Step 1: Backup Your Database
```sql
-- Create a backup of the vendors table
CREATE TABLE vendors_backup AS SELECT * FROM vendors;
```

### Step 2: Run the Migration SQL
```bash
# Using psql
psql -h your-database-host -U your-username -d your-database -f database/vendors-customer-association.sql

# Or using Supabase SQL Editor
# Copy and paste the contents of vendors-customer-association.sql into the SQL Editor and run
```

### Step 3: Update Existing Vendor Data
If you have existing vendors in your database, you need to associate them with customer emails:

```sql
-- Option 1: If you have a single customer/user
UPDATE vendors 
SET customer_email = 'your-customer-email@example.com' 
WHERE customer_email IS NULL;

-- Option 2: If you need to distribute vendors among multiple customers
-- You'll need to manually assign vendors to customers based on your business logic
```

### Step 4: Deploy Code Changes
The code changes are backward compatible and will work once the database migration is complete.

```bash
# If using Vercel or similar
git add .
git commit -m "Add vendor-customer association"
git push

# Or restart your local development server
npm run dev
```

### Step 5: Verify the Migration

#### Test Vendor Operations:
1. Log in as a customer
2. Add a new vendor using the chat interface
3. List vendors - you should only see vendors you added
4. Try adding the same vendor email as a different customer - it should work (separate instances)
5. Schedule an auction - it should only show your vendors

#### Test Data Isolation:
1. Create vendors under Customer A
2. Log in as Customer B
3. List vendors - should not see Customer A's vendors
4. Add the same vendor email - should succeed (different customer context)

## Rollback Procedure

If you need to rollback the changes:

```sql
-- 1. Restore the original unique constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_email_customer_email_unique;
ALTER TABLE vendors ADD CONSTRAINT vendors_email_key UNIQUE (email);

-- 2. Remove foreign key constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_customer_email_fkey;

-- 3. Drop the customer_email column
ALTER TABLE vendors DROP COLUMN IF EXISTS customer_email;

-- 4. Restore RLS policies
DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can insert their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON vendors;

CREATE POLICY "Allow all operations on vendors" ON vendors
FOR ALL
USING (true);

-- 5. Optionally restore from backup
-- DELETE FROM vendors;
-- INSERT INTO vendors SELECT * FROM vendors_backup;
```

## Important Notes

### Multi-Tenancy
- Each customer now has their own isolated vendor database
- Same vendor email can exist for multiple customers (different instances)
- All vendor operations are automatically scoped to the authenticated customer

### Email Tool
- The email tool continues to work as before
- When sending emails to vendors, only vendors associated with the customer will be selected
- This prevents accidentally emailing vendors from other customers

### Performance
- Added index on `customer_email` for fast filtering
- Queries are optimized to filter early in the database layer

### Security
- Customer email is retrieved from authenticated session
- Tools validate customer email before operations
- Foreign key ensures referential integrity

## Troubleshooting

### Issue: "Customer email is required" errors
**Solution**: Ensure the user is logged in and their email is being passed through the chat API

### Issue: Vendors not showing up
**Solution**: Check that existing vendors have `customer_email` set correctly

### Issue: Duplicate vendor errors
**Solution**: The composite unique constraint allows duplicates across customers, but not within the same customer

### Issue: Foreign key constraint violation
**Solution**: Ensure the customer exists in the `customers` table before adding vendors

## Future Enhancements

Potential improvements to consider:
1. Add vendor sharing between customers (optional feature)
2. Vendor approval/verification workflow
3. Vendor performance tracking per customer
4. Vendor categorization and tagging
5. Bulk vendor export/import with customer context

## Support

If you encounter any issues during migration:
1. Check the database logs for constraint violations
2. Verify customer email is correctly passed through the API
3. Test with a fresh customer account
4. Review the SQL migration file for any syntax errors

For questions or issues, please refer to the project documentation or contact the development team.
