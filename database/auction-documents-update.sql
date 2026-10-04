-- Update Auction Documents Schema to Store Files in Database
-- This removes dependency on Supabase Storage and stores files as base64 in PostgreSQL

-- Step 1: Add file_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_documents' 
        AND column_name = 'file_data'
    ) THEN
        ALTER TABLE auction_documents ADD COLUMN file_data TEXT;
    END IF;
END $$;

-- Step 2: Drop file_path column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_documents' 
        AND column_name = 'file_path'
    ) THEN
        ALTER TABLE auction_documents DROP COLUMN file_path;
    END IF;
END $$;

-- Step 3: Add comment to explain the column
COMMENT ON COLUMN auction_documents.file_data IS 'Base64 encoded file content stored directly in database';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'auction_documents'
ORDER BY ordinal_position;

